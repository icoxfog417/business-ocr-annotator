import type { Handler, S3Event } from 'aws-lambda';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBDocumentClient, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import sharp from 'sharp';

const s3Client = new S3Client({});
const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const ssmClient = new SSMClient({});

const COMPRESSED_MAX_SIZE = 4 * 1024 * 1024; // 4MB for AI processing
const THUMBNAIL_MAX_SIZE = 100 * 1024; // 100KB for gallery
const COMPRESSED_MAX_DIMENSION = 2048;
const THUMBNAIL_MAX_DIMENSION = 300;

// Cache for discovered table name (persists across warm Lambda invocations)
let cachedTableName: string | null = null;

/**
 * Discover Image table name via SSM Parameter Store.
 * The parameter is created by CDK at deploy time, keyed by S3 bucket name,
 * so each Amplify environment resolves to its own table — no cross-env collisions.
 */
async function getImageTableName(bucketName: string): Promise<string> {
  if (cachedTableName) return cachedTableName;

  const paramName = `/business-ocr/tables/${bucketName}/image-table-name`;
  const result = await ssmClient.send(new GetParameterCommand({ Name: paramName }));

  if (!result.Parameter?.Value) {
    throw new Error(`SSM parameter ${paramName} not found`);
  }

  cachedTableName = result.Parameter.Value;
  console.log(`Using Image table from SSM: ${cachedTableName}`);
  return cachedTableName;
}

interface ProcessImageResult {
  success: boolean;
  imageId?: string;
  s3KeyOriginal?: string;
  s3KeyCompressed?: string;
  s3KeyThumbnail?: string;
  originalSize?: number;
  compressedSize?: number;
  thumbnailSize?: number;
  error?: string;
}

/**
 * Compress image to target size using iterative quality reduction
 */
async function compressToTargetSize(
  inputBuffer: Buffer,
  targetSizeBytes: number,
  maxDimension: number,
  initialQuality: number = 90
): Promise<Buffer> {
  const metadata = await sharp(inputBuffer).metadata();

  // Calculate dimensions maintaining aspect ratio
  // EXIF orientations 5-8 swap width/height; account for this so the
  // resize targets match the visually-correct (post-rotation) dimensions.
  let width = metadata.width || 1000;
  let height = metadata.height || 1000;
  const orientation = metadata.orientation || 1;
  if (orientation >= 5) {
    [width, height] = [height, width];
  }

  if (width > maxDimension || height > maxDimension) {
    const ratio = Math.min(maxDimension / width, maxDimension / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  let quality = initialQuality;
  let compressed: Buffer;
  let attempts = 0;

  do {
    attempts++;
    compressed = await sharp(inputBuffer)
      .rotate() // Apply EXIF orientation physically
      .resize(width, height, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true, progressive: true })
      .toBuffer();

    if (compressed.length <= targetSizeBytes || quality <= 30) {
      break;
    }

    // Reduce quality more aggressively for larger files
    if (compressed.length > targetSizeBytes * 2) {
      quality -= 15;
    } else {
      quality -= 5;
    }

  } while (attempts < 15 && quality >= 30);

  // If still too large, reduce dimensions
  if (compressed.length > targetSizeBytes && width > 800) {
    width = Math.round(width * 0.7);
    height = Math.round(height * 0.7);
    compressed = await sharp(inputBuffer)
      .rotate()
      .resize(width, height, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 70, mozjpeg: true, progressive: true })
      .toBuffer();
  }

  return compressed;
}

/**
 * Generate thumbnail with size constraint
 */
async function generateThumbnail(inputBuffer: Buffer): Promise<Buffer> {
  let quality = 85;
  let size = THUMBNAIL_MAX_DIMENSION;
  let thumbnail: Buffer;

  do {
    thumbnail = await sharp(inputBuffer)
      .rotate() // Apply EXIF orientation physically
      .resize(size, size, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();

    if (thumbnail.length <= THUMBNAIL_MAX_SIZE || quality <= 50) {
      break;
    }

    quality -= 10;
    if (quality < 50 && size > 200) {
      size = 200;
      quality = 70;
    }
  } while (quality >= 50);

  return thumbnail;
}

/**
 * Find Image record by s3KeyOriginal using GSI
 * Uses Query instead of Scan for O(1) performance
 */
async function findImageByS3Key(tableName: string, indexName: string, s3KeyOriginal: string): Promise<{ id: string } | null> {
  console.log(`Querying GSI for image with s3KeyOriginal: ${s3KeyOriginal}`);

  const result = await docClient.send(new QueryCommand({
    TableName: tableName,
    IndexName: indexName,
    KeyConditionExpression: 's3KeyOriginal = :s3Key',
    ExpressionAttributeValues: {
      ':s3Key': s3KeyOriginal,
    },
    Limit: 1,
  }));

  if (result.Items && result.Items.length > 0) {
    console.log(`Found image: ${result.Items[0].id}`);
    return { id: result.Items[0].id as string };
  }

  console.log('Image not found in database');
  return null;
}

/**
 * Process a single image: compress and generate thumbnail
 */
async function processImage(
  bucketName: string,
  tableName: string,
  s3KeyOriginal: string,
  imageId: string
): Promise<ProcessImageResult> {
  try {
    // 1. Download original image from S3
    console.log(`Downloading original image from s3://${bucketName}/${s3KeyOriginal}`);
    const getCommand = new GetObjectCommand({
      Bucket: bucketName,
      Key: s3KeyOriginal,
    });
    const response = await s3Client.send(getCommand);
    const originalBuffer = Buffer.from(await response.Body!.transformToByteArray());
    const originalSize = originalBuffer.length;
    console.log(`Original image size: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);

    // Get original format from metadata
    const metadata = await sharp(originalBuffer).metadata();
    const originalFormat = metadata.format || 'unknown';
    console.log(`Original format: ${originalFormat}`);

    // 2. Generate compressed version (≤4MB)
    console.log('Generating compressed version...');
    const compressedBuffer = await compressToTargetSize(
      originalBuffer,
      COMPRESSED_MAX_SIZE,
      COMPRESSED_MAX_DIMENSION
    );
    const compressedSize = compressedBuffer.length;
    console.log(`Compressed image size: ${(compressedSize / 1024).toFixed(2)} KB`);

    // Get compressed image dimensions
    const compressedMetadata = await sharp(compressedBuffer).metadata();
    const compressedWidth = compressedMetadata.width;
    const compressedHeight = compressedMetadata.height;
    
    if (!compressedWidth || !compressedHeight) {
      throw new Error('Failed to get compressed image dimensions');
    }
    console.log(`Compressed dimensions: ${compressedWidth}x${compressedHeight}`);

    // Calculate compression ratio
    const compressionRatio = compressedSize > 0 ? originalSize / compressedSize : 1;
    console.log(`Compression ratio: ${compressionRatio.toFixed(2)}x`);

    // 3. Generate thumbnail (≤100KB)
    console.log('Generating thumbnail...');
    const thumbnailBuffer = await generateThumbnail(originalBuffer);
    const thumbnailSize = thumbnailBuffer.length;
    console.log(`Thumbnail size: ${(thumbnailSize / 1024).toFixed(2)} KB`);

    // 4. Generate S3 keys for compressed and thumbnail
    const fileId = s3KeyOriginal.split('/').pop()?.replace(/\.[^/.]+$/, '') || imageId;
    const s3KeyCompressed = `images/compressed/${fileId}.jpg`;
    const s3KeyThumbnail = `images/thumbnail/${fileId}.jpg`;

    // 5. Upload compressed and thumbnail to S3
    console.log(`Uploading compressed to s3://${bucketName}/${s3KeyCompressed}`);
    await s3Client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: s3KeyCompressed,
      Body: compressedBuffer,
      ContentType: 'image/jpeg',
    }));

    console.log(`Uploading thumbnail to s3://${bucketName}/${s3KeyThumbnail}`);
    await s3Client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: s3KeyThumbnail,
      Body: thumbnailBuffer,
      ContentType: 'image/jpeg',
    }));

    // 6. Update DynamoDB Image record
    // Status changes: PROCESSING → ANNOTATING (ready for annotation)
    console.log(`Updating DynamoDB record for image ${imageId}`);
    await docClient.send(new UpdateCommand({
      TableName: tableName,
      Key: { id: imageId },
      UpdateExpression: 'SET s3KeyCompressed = :compressed, s3KeyThumbnail = :thumbnail, originalSize = :origSize, compressedSize = :compSize, thumbnailSize = :thumbSize, compressedWidth = :compWidth, compressedHeight = :compHeight, compressionRatio = :ratio, originalFormat = :format, #status = :status, updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':compressed': s3KeyCompressed,
        ':thumbnail': s3KeyThumbnail,
        ':origSize': originalSize,
        ':compSize': compressedSize,
        ':thumbSize': thumbnailSize,
        ':compWidth': compressedWidth,
        ':compHeight': compressedHeight,
        ':ratio': compressionRatio,
        ':format': originalFormat,
        ':status': 'ANNOTATING',
        ':updatedAt': new Date().toISOString(),
      },
    }));

    console.log('Image processing completed successfully');

    return {
      success: true,
      imageId,
      s3KeyOriginal,
      s3KeyCompressed,
      s3KeyThumbnail,
      originalSize,
      compressedSize,
      thumbnailSize,
    };

  } catch (error) {
    console.error('Error processing image:', error);
    return {
      success: false,
      imageId,
      s3KeyOriginal,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Handler for S3 event trigger
 * Automatically processes images when uploaded to images/original/
 */
export const handler: Handler<S3Event, ProcessImageResult[]> = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  const bucketName = process.env.STORAGE_BUCKET_NAME;
  const indexName = process.env.IMAGE_TABLE_INDEX_NAME || 'imagesByS3KeyOriginal';

  if (!bucketName) {
    console.error('STORAGE_BUCKET_NAME environment variable not set');
    return [{
      success: false,
      error: 'STORAGE_BUCKET_NAME environment variable not set',
    }];
  }

  const tableName = await getImageTableName(bucketName);

  const results: ProcessImageResult[] = [];

  // Process each S3 record in the event
  for (const record of event.Records) {
    const s3KeyOriginal = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

    console.log(`Processing S3 event for key: ${s3KeyOriginal}`);

    // Skip if not in images/original/ folder
    if (!s3KeyOriginal.startsWith('images/original/')) {
      console.log(`Skipping non-original image: ${s3KeyOriginal}`);
      continue;
    }

    // Find the Image record in DynamoDB using GSI with exponential backoff
    let imageRecord = await findImageByS3Key(tableName, indexName, s3KeyOriginal);
    let retryAttempt = 0;
    const maxRetries = 5;
    const initialBackoffMs = 500;

    while (!imageRecord && retryAttempt < maxRetries) {
      const backoffMs = initialBackoffMs * Math.pow(2, retryAttempt);
      console.log(`Image record not found, retry ${retryAttempt + 1}/${maxRetries} after ${backoffMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, backoffMs));
      imageRecord = await findImageByS3Key(tableName, indexName, s3KeyOriginal);
      retryAttempt++;
    }

    if (!imageRecord) {
      console.error(`Image record not found after ${maxRetries} retries for ${s3KeyOriginal}`);
      results.push({
        success: false,
        s3KeyOriginal,
        error: `Image record not found in database after ${maxRetries} retries`,
      });
      continue;
    }

    const result = await processImage(bucketName, tableName, s3KeyOriginal, imageRecord.id);
    results.push(result);
  }

  console.log('Processing complete. Results:', JSON.stringify(results, null, 2));
  return results;
};
