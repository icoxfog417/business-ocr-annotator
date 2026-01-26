import type { Handler } from 'aws-lambda';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  QueryCommand,
  ScanCommand,
  PutCommand,
  UpdateCommand,
  GetCommand,
} from '@aws-sdk/lib-dynamodb';
import { uploadFile, createRepo, RepoDesignation } from '@huggingface/hub';

// Initialize clients
const s3Client = new S3Client({});
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Configuration
const CHECKPOINT_INTERVAL = 100; // Save progress every 100 annotations
const BATCH_SIZE = 25; // Process 25 items at a time for pagination

// Table name cache
let cachedTableNames: {
  image?: string;
  annotation?: string;
  datasetVersion?: string;
  exportProgress?: string;
} = {};

/**
 * Event input for the export dataset Lambda
 */
interface ExportDatasetEvent {
  version: string; // e.g., "v1.0.0"
  huggingFaceRepoId: string; // e.g., "icoxfog417/biz-doc-vqa"
  exportId?: string; // Optional: for resuming an existing export
  createdBy: string; // User ID who triggered the export
}

/**
 * Export result response
 */
interface ExportDatasetResponse {
  success: boolean;
  exportId: string;
  version: string;
  huggingFaceUrl?: string;
  processedCount: number;
  totalCount: number;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  error?: string;
}

/**
 * Annotation record from DynamoDB
 */
interface AnnotationRecord {
  id: string;
  imageId: string;
  question: string;
  answer: string;
  language: string;
  boundingBoxes: number[][]; // Array of [x0, y0, x1, y1] in pixel coordinates
  questionType?: string;
  validationStatus: string;
  createdAt: string;
}

/**
 * Image record from DynamoDB
 */
interface ImageRecord {
  id: string;
  s3KeyCompressed: string;
  compressedWidth: number;
  compressedHeight: number;
  documentType?: string;
  language: string;
}

/**
 * HuggingFace dataset record schema
 */
interface DatasetRecord {
  question_id: string;
  image: string; // Base64 encoded image
  image_width: number;
  image_height: number;
  question: string;
  answers: string[];
  answer_bbox: number[]; // Normalized 0-1 range [x0, y0, x1, y1]
  document_type: string;
  question_type: string;
  language: string;
}

/**
 * Discover table names via ListTables API
 */
async function discoverTableNames(): Promise<void> {
  if (cachedTableNames.annotation && cachedTableNames.image) {
    return;
  }

  const result = await dynamoClient.send(new ListTablesCommand({}));
  const tables = result.TableNames || [];

  for (const tableName of tables) {
    if (tableName.startsWith('Annotation-')) {
      cachedTableNames.annotation = tableName;
    } else if (tableName.startsWith('Image-') && !tableName.includes('index')) {
      cachedTableNames.image = tableName;
    } else if (tableName.startsWith('DatasetVersion-')) {
      cachedTableNames.datasetVersion = tableName;
    } else if (tableName.startsWith('DatasetExportProgress-')) {
      cachedTableNames.exportProgress = tableName;
    }
  }

  console.log('Discovered tables:', cachedTableNames);

  if (!cachedTableNames.annotation || !cachedTableNames.image) {
    throw new Error('Required tables not found');
  }
}

/**
 * Get or create export progress record
 */
async function getOrCreateExportProgress(
  exportId: string,
  version: string,
  totalCount: number
): Promise<{
  id: string;
  lastProcessedAnnotationId?: string;
  processedCount: number;
}> {
  if (!cachedTableNames.exportProgress) {
    throw new Error('DatasetExportProgress table not found');
  }

  // Try to get existing progress
  const getResult = await docClient.send(
    new GetCommand({
      TableName: cachedTableNames.exportProgress,
      Key: { id: exportId },
    })
  );

  if (getResult.Item) {
    console.log('Resuming from checkpoint:', getResult.Item);
    return {
      id: getResult.Item.id,
      lastProcessedAnnotationId: getResult.Item.lastProcessedAnnotationId,
      processedCount: getResult.Item.processedCount || 0,
    };
  }

  // Create new progress record
  const now = new Date().toISOString();
  await docClient.send(
    new PutCommand({
      TableName: cachedTableNames.exportProgress,
      Item: {
        id: exportId,
        exportId: exportId,
        version: version,
        processedCount: 0,
        totalCount: totalCount,
        status: 'IN_PROGRESS',
        startedAt: now,
        updatedAt: now,
      },
    })
  );

  console.log('Created new export progress record');
  return {
    id: exportId,
    lastProcessedAnnotationId: undefined,
    processedCount: 0,
  };
}

/**
 * Update export progress checkpoint
 */
async function updateExportProgress(
  exportId: string,
  lastProcessedAnnotationId: string,
  processedCount: number,
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED',
  errorMessage?: string
): Promise<void> {
  if (!cachedTableNames.exportProgress) {
    console.warn('DatasetExportProgress table not found, skipping checkpoint');
    return;
  }

  const now = new Date().toISOString();
  const updateExpr = errorMessage
    ? 'SET lastProcessedAnnotationId = :lastId, processedCount = :count, #status = :status, updatedAt = :updatedAt, errorMessage = :error'
    : 'SET lastProcessedAnnotationId = :lastId, processedCount = :count, #status = :status, updatedAt = :updatedAt';

  const exprValues: Record<string, unknown> = {
    ':lastId': lastProcessedAnnotationId,
    ':count': processedCount,
    ':status': status,
    ':updatedAt': now,
  };

  if (errorMessage) {
    exprValues[':error'] = errorMessage;
  }

  await docClient.send(
    new UpdateCommand({
      TableName: cachedTableNames.exportProgress,
      Key: { id: exportId },
      UpdateExpression: updateExpr,
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: exprValues,
    })
  );

  console.log(`Checkpoint saved: ${processedCount} processed, last ID: ${lastProcessedAnnotationId}`);
}

/**
 * Query approved annotations from DynamoDB
 * Uses pagination to handle large datasets
 */
async function queryApprovedAnnotations(
  lastEvaluatedKey?: Record<string, unknown>
): Promise<{
  annotations: AnnotationRecord[];
  lastEvaluatedKey?: Record<string, unknown>;
}> {
  if (!cachedTableNames.annotation) {
    throw new Error('Annotation table not found');
  }

  // Note: Using Scan since we need to filter by validationStatus
  // In production, consider adding a GSI on validationStatus for better performance
  const result = await docClient.send(
    new ScanCommand({
      TableName: cachedTableNames.annotation,
      FilterExpression: 'validationStatus = :approved',
      ExpressionAttributeValues: {
        ':approved': 'APPROVED',
      },
      Limit: BATCH_SIZE,
      ExclusiveStartKey: lastEvaluatedKey,
    })
  );

  return {
    annotations: (result.Items || []) as AnnotationRecord[],
    lastEvaluatedKey: result.LastEvaluatedKey,
  };
}

/**
 * Count total approved annotations
 */
async function countApprovedAnnotations(): Promise<number> {
  if (!cachedTableNames.annotation) {
    throw new Error('Annotation table not found');
  }

  let count = 0;
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: cachedTableNames.annotation,
        FilterExpression: 'validationStatus = :approved',
        ExpressionAttributeValues: {
          ':approved': 'APPROVED',
        },
        Select: 'COUNT',
        ExclusiveStartKey: lastKey,
      })
    );

    count += result.Count || 0;
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  console.log(`Total approved annotations: ${count}`);
  return count;
}

/**
 * Get image record by ID
 */
async function getImage(imageId: string): Promise<ImageRecord | null> {
  if (!cachedTableNames.image) {
    throw new Error('Image table not found');
  }

  const result = await docClient.send(
    new GetCommand({
      TableName: cachedTableNames.image,
      Key: { id: imageId },
    })
  );

  return (result.Item as ImageRecord) || null;
}

/**
 * Download image from S3 and return as base64
 */
async function downloadImageAsBase64(s3Key: string): Promise<string> {
  const bucketName = process.env.STORAGE_BUCKET_NAME;
  if (!bucketName) {
    throw new Error('STORAGE_BUCKET_NAME environment variable not set');
  }

  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
    })
  );

  const bytes = await response.Body!.transformToByteArray();
  return Buffer.from(bytes).toString('base64');
}

/**
 * Normalize bounding box from pixel coordinates to 0-1 range
 */
function normalizeBoundingBox(
  bbox: number[],
  imageWidth: number,
  imageHeight: number
): number[] {
  if (bbox.length !== 4) {
    console.warn('Invalid bounding box length:', bbox);
    return [0, 0, 1, 1]; // Full image as fallback
  }

  const [x0, y0, x1, y1] = bbox;

  // Clamp values to valid range
  const normalized = [
    Math.max(0, Math.min(1, x0 / imageWidth)),
    Math.max(0, Math.min(1, y0 / imageHeight)),
    Math.max(0, Math.min(1, x1 / imageWidth)),
    Math.max(0, Math.min(1, y1 / imageHeight)),
  ];

  return normalized;
}

/**
 * Build dataset record from annotation and image
 */
async function buildDatasetRecord(
  annotation: AnnotationRecord,
  image: ImageRecord
): Promise<DatasetRecord> {
  // Download compressed image as base64
  const imageBase64 = await downloadImageAsBase64(image.s3KeyCompressed);

  // Get first bounding box and normalize it
  const firstBbox = annotation.boundingBoxes?.[0] || [0, 0, image.compressedWidth, image.compressedHeight];
  const normalizedBbox = normalizeBoundingBox(
    firstBbox,
    image.compressedWidth,
    image.compressedHeight
  );

  return {
    question_id: annotation.id,
    image: imageBase64,
    image_width: image.compressedWidth,
    image_height: image.compressedHeight,
    question: annotation.question,
    answers: [annotation.answer], // Single answer as array for compatibility
    answer_bbox: normalizedBbox,
    document_type: image.documentType || 'OTHER',
    question_type: annotation.questionType || 'EXTRACTIVE',
    language: annotation.language || image.language || 'en',
  };
}

/**
 * Upload dataset to HuggingFace Hub
 */
async function uploadToHuggingFace(
  repoId: string,
  version: string,
  records: DatasetRecord[]
): Promise<string> {
  const hfToken = process.env.HF_TOKEN;
  if (!hfToken) {
    throw new Error('HF_TOKEN environment variable not set');
  }

  const repo: RepoDesignation = { type: 'dataset', name: repoId };

  // Try to create repo (will fail silently if already exists)
  try {
    await createRepo({
      repo,
      credentials: { accessToken: hfToken },
      private: false,
    });
    console.log(`Created new HuggingFace repo: ${repoId}`);
  } catch (error) {
    // Repo likely already exists, continue
    console.log(`Repo ${repoId} already exists or creation failed, continuing...`);
  }

  // Convert records to JSONL format
  const jsonlContent = records.map((record) => JSON.stringify(record)).join('\n');

  // Upload as JSONL file (HuggingFace auto-converts to Parquet)
  const fileName = `data/train-${version}.jsonl`;
  const blob = new Blob([jsonlContent], { type: 'application/jsonl' });

  await uploadFile({
    repo,
    credentials: { accessToken: hfToken },
    file: {
      path: fileName,
      content: blob,
    },
    commitTitle: `Add dataset version ${version}`,
    commitDescription: `Exported ${records.length} annotations from Business OCR Annotator`,
  });

  console.log(`Uploaded ${records.length} records to HuggingFace`);

  // Generate README/dataset card
  const readmeContent = generateDatasetCard(repoId, version, records.length);
  const readmeBlob = new Blob([readmeContent], { type: 'text/markdown' });

  await uploadFile({
    repo,
    credentials: { accessToken: hfToken },
    file: {
      path: 'README.md',
      content: readmeBlob,
    },
    commitTitle: `Update dataset card for ${version}`,
  });

  return `https://huggingface.co/datasets/${repoId}`;
}

/**
 * Generate HuggingFace dataset card (README.md)
 */
function generateDatasetCard(repoId: string, version: string, recordCount: number): string {
  return `---
license: cc-by-sa-4.0
task_categories:
  - document-question-answering
  - visual-question-answering
language:
  - ja
  - en
  - zh
  - ko
size_categories:
  - ${recordCount < 1000 ? 'n<1K' : recordCount < 10000 ? '1K<n<10K' : '10K<n<100K'}
tags:
  - ocr
  - document-understanding
  - business-documents
---

# ${repoId.split('/').pop()}

Business Document Visual Question Answering Dataset

## Dataset Description

This dataset contains question-answer pairs with bounding box annotations for OCR evaluation on business documents.

### Version: ${version}

- **Total Records**: ${recordCount}
- **Export Date**: ${new Date().toISOString().split('T')[0]}
- **Source**: Business OCR Annotator

## Dataset Schema

| Field | Type | Description |
|-------|------|-------------|
| question_id | string | Unique identifier for the annotation |
| image | Image | Compressed document image |
| image_width | int32 | Image width in pixels |
| image_height | int32 | Image height in pixels |
| question | string | Question about the document |
| answers | Sequence[string] | Acceptable answers |
| answer_bbox | Sequence[float32] | Normalized bounding box [x0, y0, x1, y1] (0-1 range) |
| document_type | string | Type of business document |
| question_type | string | Type of question (EXTRACTIVE, ABSTRACTIVE, etc.) |
| language | string | ISO 639-1 language code |

## Usage

\`\`\`python
from datasets import load_dataset

dataset = load_dataset("${repoId}")
\`\`\`

## Evaluation Metrics

- **ANLS (Average Normalized Levenshtein Similarity)**: For text answer accuracy
- **IoU (Intersection over Union)**: For bounding box accuracy

## License

This dataset is released under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

## Citation

\`\`\`bibtex
@dataset{biz_doc_vqa_${version.replace(/\./g, '_')},
  title={Business Document VQA Dataset},
  version={${version}},
  year={${new Date().getFullYear()}},
  url={https://huggingface.co/datasets/${repoId}}
}
\`\`\`
`;
}

/**
 * Create or update DatasetVersion record
 */
async function createOrUpdateDatasetVersion(
  version: string,
  repoId: string,
  huggingFaceUrl: string,
  annotationCount: number,
  imageCount: number,
  createdBy: string,
  status: 'CREATING' | 'READY' | 'FAILED'
): Promise<void> {
  if (!cachedTableNames.datasetVersion) {
    console.warn('DatasetVersion table not found, skipping version record');
    return;
  }

  const now = new Date().toISOString();
  const versionId = `${repoId}-${version}`;

  await docClient.send(
    new PutCommand({
      TableName: cachedTableNames.datasetVersion,
      Item: {
        id: versionId,
        version: version,
        huggingFaceRepoId: repoId,
        huggingFaceUrl: huggingFaceUrl,
        annotationCount: annotationCount,
        imageCount: imageCount,
        status: status,
        createdBy: createdBy,
        createdAt: now,
        ...(status === 'READY' ? { finalizedAt: now } : {}),
      },
    })
  );

  console.log(`DatasetVersion record ${status === 'READY' ? 'finalized' : 'created'}: ${versionId}`);
}

/**
 * Main handler for export dataset Lambda
 */
export const handler: Handler<
  ExportDatasetEvent | { arguments: ExportDatasetEvent },
  ExportDatasetResponse
> = async (event) => {
  console.log('Export dataset event:', JSON.stringify(event, null, 2));

  // Handle AppSync wrapper
  const args = 'arguments' in event ? event.arguments : event;
  const { version, huggingFaceRepoId, createdBy } = args;
  const exportId = args.exportId || `export-${version}-${Date.now()}`;

  try {
    // Discover table names
    await discoverTableNames();

    // Count total approved annotations
    const totalCount = await countApprovedAnnotations();

    if (totalCount === 0) {
      return {
        success: false,
        exportId,
        version,
        processedCount: 0,
        totalCount: 0,
        status: 'FAILED',
        error: 'No approved annotations found to export',
      };
    }

    // Get or create export progress
    const progress = await getOrCreateExportProgress(exportId, version, totalCount);

    // Create DatasetVersion record with CREATING status
    await createOrUpdateDatasetVersion(
      version,
      huggingFaceRepoId,
      '',
      totalCount,
      0,
      createdBy,
      'CREATING'
    );

    // Collect all dataset records
    const allRecords: DatasetRecord[] = [];
    const processedImageIds = new Set<string>();
    let lastEvaluatedKey: Record<string, unknown> | undefined;
    let processedCount = progress.processedCount;
    let skippedForResume = 0;

    // Paginate through all approved annotations
    do {
      const { annotations, lastEvaluatedKey: nextKey } = await queryApprovedAnnotations(lastEvaluatedKey);
      lastEvaluatedKey = nextKey;

      for (const annotation of annotations) {
        // Skip already processed annotations (for resume)
        if (
          progress.lastProcessedAnnotationId &&
          annotation.id <= progress.lastProcessedAnnotationId
        ) {
          skippedForResume++;
          continue;
        }

        try {
          // Get image record
          const image = await getImage(annotation.imageId);
          if (!image || !image.s3KeyCompressed || !image.compressedWidth || !image.compressedHeight) {
            console.warn(`Skipping annotation ${annotation.id}: Image not found or missing compressed data`);
            continue;
          }

          // Build dataset record
          const record = await buildDatasetRecord(annotation, image);
          allRecords.push(record);
          processedImageIds.add(image.id);
          processedCount++;

          // Checkpoint every N annotations
          if (processedCount % CHECKPOINT_INTERVAL === 0) {
            await updateExportProgress(exportId, annotation.id, processedCount, 'IN_PROGRESS');
          }
        } catch (error) {
          console.error(`Error processing annotation ${annotation.id}:`, error);
          // Continue with next annotation
        }
      }

      console.log(
        `Batch processed. Total: ${processedCount}, Skipped for resume: ${skippedForResume}`
      );
    } while (lastEvaluatedKey);

    if (allRecords.length === 0) {
      await updateExportProgress(exportId, '', processedCount, 'FAILED', 'No valid annotations to export');
      return {
        success: false,
        exportId,
        version,
        processedCount: 0,
        totalCount,
        status: 'FAILED',
        error: 'No valid annotations could be processed',
      };
    }

    // Upload to HuggingFace Hub
    console.log(`Uploading ${allRecords.length} records to HuggingFace Hub...`);
    const huggingFaceUrl = await uploadToHuggingFace(huggingFaceRepoId, version, allRecords);

    // Update DatasetVersion to READY
    await createOrUpdateDatasetVersion(
      version,
      huggingFaceRepoId,
      huggingFaceUrl,
      allRecords.length,
      processedImageIds.size,
      createdBy,
      'READY'
    );

    // Mark export as completed
    await updateExportProgress(exportId, 'COMPLETED', processedCount, 'COMPLETED');

    console.log('Export completed successfully');
    return {
      success: true,
      exportId,
      version,
      huggingFaceUrl,
      processedCount: allRecords.length,
      totalCount,
      status: 'COMPLETED',
    };
  } catch (error) {
    console.error('Export failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Update progress to failed
    try {
      await updateExportProgress(exportId, '', 0, 'FAILED', errorMessage);
      await createOrUpdateDatasetVersion(
        version,
        huggingFaceRepoId,
        '',
        0,
        0,
        createdBy,
        'FAILED'
      );
    } catch (updateError) {
      console.error('Failed to update progress/version records:', updateError);
    }

    return {
      success: false,
      exportId,
      version,
      processedCount: 0,
      totalCount: 0,
      status: 'FAILED',
      error: errorMessage,
    };
  }
};
