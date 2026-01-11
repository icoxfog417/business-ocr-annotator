import type { SQSHandler, SQSRecord, SQSBatchResponse } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
  QueryCommand,
  PutCommand
} from '@aws-sdk/lib-dynamodb';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

// W&B SDK import (using dynamic import for CommonJS compatibility)
let wandb: typeof import('wandb') | null = null;

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({});

// Environment variables
const WANDB_API_KEY = process.env.WANDB_API_KEY;
const WANDB_PROJECT = process.env.WANDB_PROJECT || 'biz-doc-vqa';
const WANDB_ENTITY = process.env.WANDB_ENTITY;

// Table names will be passed via environment or derived from stack
const ANNOTATION_TABLE = process.env.ANNOTATION_TABLE_NAME || '';
const IMAGE_TABLE = process.env.IMAGE_TABLE_NAME || '';
const JOB_TABLE = process.env.JOB_TABLE_NAME || '';
const QUEUE_STATS_TABLE = process.env.QUEUE_STATS_TABLE_NAME || '';
const STORAGE_BUCKET = process.env.STORAGE_BUCKET_NAME || '';

interface AnnotationMessage {
  annotationId: string;
  imageId: string;
  jobId?: string;
  triggerType: 'SCHEDULED' | 'MANUAL';
  triggeredBy: string;
}

interface AnnotationData {
  id: string;
  imageId: string;
  question: string;
  answer: string;
  language: string;
  boundingBoxes: number[][];
  questionType: string;
  validationStatus: string;
}

interface ImageData {
  id: string;
  fileName: string;
  s3Key: string;
  width: number;
  height: number;
  documentType: string;
  language: string;
}

async function initWandb(): Promise<void> {
  if (!wandb) {
    wandb = await import('wandb');
  }
}

async function getAnnotation(annotationId: string): Promise<AnnotationData | null> {
  try {
    const result = await docClient.send(new GetCommand({
      TableName: ANNOTATION_TABLE,
      Key: { id: annotationId }
    }));
    return result.Item as AnnotationData | null;
  } catch (error) {
    console.error(`Failed to get annotation ${annotationId}:`, error);
    return null;
  }
}

async function getImage(imageId: string): Promise<ImageData | null> {
  try {
    const result = await docClient.send(new GetCommand({
      TableName: IMAGE_TABLE,
      Key: { id: imageId }
    }));
    return result.Item as ImageData | null;
  } catch (error) {
    console.error(`Failed to get image ${imageId}:`, error);
    return null;
  }
}

async function getImageFromS3(s3Key: string): Promise<Buffer | null> {
  try {
    const response = await s3Client.send(new GetObjectCommand({
      Bucket: STORAGE_BUCKET,
      Key: s3Key
    }));
    const bytes = await response.Body?.transformToByteArray();
    return bytes ? Buffer.from(bytes) : null;
  } catch (error) {
    console.error(`Failed to get image from S3 ${s3Key}:`, error);
    return null;
  }
}

async function markAnnotationProcessed(annotationId: string): Promise<void> {
  try {
    await docClient.send(new UpdateCommand({
      TableName: ANNOTATION_TABLE,
      Key: { id: annotationId },
      UpdateExpression: 'SET processedAt = :now, queuedForDataset = :queued',
      ExpressionAttributeValues: {
        ':now': new Date().toISOString(),
        ':queued': false
      }
    }));
  } catch (error) {
    console.error(`Failed to mark annotation ${annotationId} as processed:`, error);
    throw error;
  }
}

async function createOrUpdateJob(
  jobId: string,
  status: string,
  updates: Record<string, unknown>
): Promise<void> {
  const updateParts: string[] = [];
  const expressionValues: Record<string, unknown> = {};

  Object.entries({ status, ...updates }).forEach(([key, value]) => {
    if (value !== undefined) {
      updateParts.push(`${key} = :${key}`);
      expressionValues[`:${key}`] = value;
    }
  });

  try {
    await docClient.send(new UpdateCommand({
      TableName: JOB_TABLE,
      Key: { id: jobId },
      UpdateExpression: `SET ${updateParts.join(', ')}`,
      ExpressionAttributeValues: expressionValues
    }));
  } catch (error) {
    console.error(`Failed to update job ${jobId}:`, error);
    throw error;
  }
}

async function updateQueueStats(processedCount: number, jobId: string): Promise<void> {
  const now = new Date().toISOString();
  try {
    await docClient.send(new UpdateCommand({
      TableName: QUEUE_STATS_TABLE,
      Key: { statsId: 'global' },
      UpdateExpression: `
        SET pendingAnnotations = pendingAnnotations - :count,
            totalProcessed = totalProcessed + :count,
            lastDatasetBuild = :now,
            lastDatasetBuildJobId = :jobId
      `,
      ExpressionAttributeValues: {
        ':count': processedCount,
        ':now': now,
        ':jobId': jobId
      }
    }));
  } catch (error) {
    console.error('Failed to update queue stats:', error);
    // Non-critical, don't throw
  }
}

async function processAnnotationBatch(
  annotations: Array<{ annotation: AnnotationData; image: ImageData; imageBuffer: Buffer | null }>,
  jobId: string
): Promise<{ success: boolean; artifactVersion?: string; wandbRunUrl?: string }> {
  await initWandb();
  if (!wandb) {
    throw new Error('Failed to initialize W&B SDK');
  }

  // Initialize W&B run
  const run = await wandb.init({
    project: WANDB_PROJECT,
    entity: WANDB_ENTITY || undefined,
    name: `dataset-build-${jobId}`,
    tags: ['dataset-creation', 'vqa', 'batch-processing'],
    config: {
      jobId,
      annotationCount: annotations.length,
      timestamp: new Date().toISOString()
    }
  });

  try {
    // Create artifact for dataset
    const artifact = new wandb.Artifact('business-ocr-vqa-dataset', 'dataset', {
      description: 'VQA dataset for business document OCR',
      metadata: {
        total_samples: annotations.length,
        build_job_id: jobId,
        created_date: new Date().toISOString()
      }
    });

    // Create table with VQA schema
    const columns = [
      'question_id',
      'image',
      'question',
      'answers',
      'answer_bbox',
      'document_type',
      'question_type',
      'language'
    ];
    const table = new wandb.Table({ columns });

    // Add each annotation to the table
    for (const { annotation, image, imageBuffer } of annotations) {
      // Convert bounding boxes to normalized format [x0, y0, x1, y1]
      const normalizedBboxes = annotation.boundingBoxes.map(bbox => {
        if (bbox.length >= 4) {
          return [
            bbox[0] / image.width,
            bbox[1] / image.height,
            bbox[2] / image.width,
            bbox[3] / image.height
          ];
        }
        return bbox;
      });

      // Create W&B Image object if buffer is available
      let wandbImage: wandb.Image | null = null;
      if (imageBuffer) {
        wandbImage = new wandb.Image(imageBuffer, {
          caption: `${image.fileName} - ${annotation.question}`
        });
      }

      // Add row to table (preserve unicode with JSON.stringify)
      table.addData(
        annotation.id,
        wandbImage || image.s3Key,
        annotation.question,
        JSON.stringify([annotation.answer], null, 0).replace(/\\u/g, ''),
        JSON.stringify(normalizedBboxes[0] || []),
        image.documentType || 'OTHER',
        annotation.questionType || 'EXTRACTIVE',
        annotation.language
      );
    }

    // Add table to artifact
    artifact.add(table, 'vqa_dataset');

    // Log artifact (auto-versioned)
    run.logArtifact(artifact);

    // Also log to run history for visibility
    run.log({ dataset: table });
    run.log({
      total_samples: annotations.length,
      job_id: jobId
    });

    // Wait for upload
    await artifact.wait();

    const artifactVersion = artifact.version;
    const wandbRunUrl = run.url;

    // Finish run
    await run.finish();

    return {
      success: true,
      artifactVersion,
      wandbRunUrl
    };
  } catch (error) {
    console.error('W&B processing error:', error);
    await run.finish(1); // Exit with error code
    throw error;
  }
}

export const handler: SQSHandler = async (event): Promise<SQSBatchResponse> => {
  console.log(`Processing ${event.Records.length} SQS messages`);

  const batchItemFailures: { itemIdentifier: string }[] = [];
  const processedAnnotations: Array<{
    annotation: AnnotationData;
    image: ImageData;
    imageBuffer: Buffer | null;
  }> = [];

  // Group messages by job ID for batch processing
  const messagesByJob = new Map<string, SQSRecord[]>();

  for (const record of event.Records) {
    try {
      const message: AnnotationMessage = JSON.parse(record.body);
      const jobKey = message.jobId || 'default';

      if (!messagesByJob.has(jobKey)) {
        messagesByJob.set(jobKey, []);
      }
      messagesByJob.get(jobKey)!.push(record);
    } catch (error) {
      console.error('Failed to parse message:', error);
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  // Process each job's messages
  for (const [jobId, records] of messagesByJob) {
    const actualJobId = jobId === 'default' ? `auto-${Date.now()}` : jobId;

    try {
      // Update job status to RUNNING
      await createOrUpdateJob(actualJobId, 'RUNNING', {
        startedAt: new Date().toISOString()
      });

      // Fetch all annotations and images for this batch
      for (const record of records) {
        try {
          const message: AnnotationMessage = JSON.parse(record.body);

          // Fetch annotation
          const annotation = await getAnnotation(message.annotationId);
          if (!annotation) {
            console.warn(`Annotation ${message.annotationId} not found, skipping`);
            continue;
          }

          // Fetch image metadata
          const image = await getImage(annotation.imageId);
          if (!image) {
            console.warn(`Image ${annotation.imageId} not found, skipping`);
            continue;
          }

          // Fetch image from S3 (optional - for W&B Image objects)
          const imageBuffer = await getImageFromS3(image.s3Key);

          processedAnnotations.push({ annotation, image, imageBuffer });
        } catch (error) {
          console.error(`Failed to process record ${record.messageId}:`, error);
          batchItemFailures.push({ itemIdentifier: record.messageId });
        }
      }

      // Process batch with W&B
      if (processedAnnotations.length > 0) {
        const result = await processAnnotationBatch(processedAnnotations, actualJobId);

        // Mark all annotations as processed
        for (const { annotation } of processedAnnotations) {
          try {
            await markAnnotationProcessed(annotation.id);
          } catch (error) {
            console.error(`Failed to mark annotation ${annotation.id} as processed:`, error);
          }
        }

        // Update job status to COMPLETED
        await createOrUpdateJob(actualJobId, 'COMPLETED', {
          completedAt: new Date().toISOString(),
          annotationCount: processedAnnotations.length,
          wandbRunUrl: result.wandbRunUrl,
          wandbArtifactVersion: result.artifactVersion
        });

        // Update queue stats
        await updateQueueStats(processedAnnotations.length, actualJobId);

        console.log(`Successfully processed ${processedAnnotations.length} annotations for job ${actualJobId}`);
      }
    } catch (error) {
      console.error(`Failed to process job ${actualJobId}:`, error);

      // Update job status to FAILED
      await createOrUpdateJob(actualJobId, 'FAILED', {
        completedAt: new Date().toISOString(),
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });

      // Mark all records from this job as failed
      for (const record of records) {
        batchItemFailures.push({ itemIdentifier: record.messageId });
      }
    }
  }

  return { batchItemFailures };
};
