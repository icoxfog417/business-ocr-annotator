import type { Handler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const sqsClient = new SQSClient({});

// Environment variables (set in backend.ts)
const ANNOTATION_TABLE = process.env.ANNOTATION_TABLE_NAME || '';
const QUEUE_STATS_TABLE = process.env.QUEUE_STATS_TABLE_NAME || '';
const SQS_QUEUE_URL = process.env.SQS_QUEUE_URL || '';

interface QueueAnnotationInput {
  annotationIds: string[];
  triggeredBy: string;
}

interface QueueAnnotationResult {
  success: boolean;
  queuedCount: number;
  failedIds: string[];
  errorMessage?: string;
}

async function getAnnotation(annotationId: string): Promise<Record<string, unknown> | null> {
  try {
    const result = await docClient.send(new GetCommand({
      TableName: ANNOTATION_TABLE,
      Key: { id: annotationId }
    }));
    return result.Item || null;
  } catch (error) {
    console.error(`Failed to get annotation ${annotationId}:`, error);
    return null;
  }
}

async function updateAnnotationForQueue(annotationId: string, validatedBy: string): Promise<boolean> {
  try {
    await docClient.send(new UpdateCommand({
      TableName: ANNOTATION_TABLE,
      Key: { id: annotationId },
      UpdateExpression: `
        SET validationStatus = :approved,
            queuedForDataset = :queued,
            validatedBy = :validatedBy,
            validatedAt = :validatedAt,
            updatedAt = :updatedAt,
            updatedBy = :updatedBy
      `,
      ExpressionAttributeValues: {
        ':approved': 'APPROVED',
        ':queued': true,
        ':validatedBy': validatedBy,
        ':validatedAt': new Date().toISOString(),
        ':updatedAt': new Date().toISOString(),
        ':updatedBy': validatedBy
      },
      // Only update if not already queued
      ConditionExpression: 'queuedForDataset <> :queued OR attribute_not_exists(queuedForDataset)'
    }));
    return true;
  } catch (error) {
    if ((error as { name?: string }).name === 'ConditionalCheckFailedException') {
      console.log(`Annotation ${annotationId} is already queued, skipping`);
      return false;
    }
    console.error(`Failed to update annotation ${annotationId}:`, error);
    throw error;
  }
}

async function sendToSQS(
  annotationId: string,
  imageId: string,
  triggeredBy: string
): Promise<void> {
  const message = {
    annotationId,
    imageId,
    triggerType: 'MANUAL' as const,
    triggeredBy
  };

  await sqsClient.send(new SendMessageCommand({
    QueueUrl: SQS_QUEUE_URL,
    MessageBody: JSON.stringify(message),
    MessageGroupId: 'annotations', // For FIFO queue (if used)
    MessageDeduplicationId: `${annotationId}-${Date.now()}` // For FIFO queue (if used)
  }));
}

async function incrementQueueStats(): Promise<void> {
  try {
    await docClient.send(new UpdateCommand({
      TableName: QUEUE_STATS_TABLE,
      Key: { statsId: 'global' },
      UpdateExpression: 'SET pendingAnnotations = if_not_exists(pendingAnnotations, :zero) + :one',
      ExpressionAttributeValues: {
        ':zero': 0,
        ':one': 1
      }
    }));
  } catch (error) {
    console.error('Failed to update queue stats:', error);
    // Non-critical, continue
  }
}

export const handler: Handler<QueueAnnotationInput, QueueAnnotationResult> = async (event) => {
  console.log('Queue annotation request:', JSON.stringify(event));

  const { annotationIds, triggeredBy } = event;

  if (!annotationIds || annotationIds.length === 0) {
    return {
      success: false,
      queuedCount: 0,
      failedIds: [],
      errorMessage: 'No annotation IDs provided'
    };
  }

  if (!triggeredBy) {
    return {
      success: false,
      queuedCount: 0,
      failedIds: annotationIds,
      errorMessage: 'triggeredBy is required'
    };
  }

  const failedIds: string[] = [];
  let queuedCount = 0;

  for (const annotationId of annotationIds) {
    try {
      // Get the annotation to verify it exists and get imageId
      const annotation = await getAnnotation(annotationId);
      if (!annotation) {
        console.warn(`Annotation ${annotationId} not found`);
        failedIds.push(annotationId);
        continue;
      }

      // Check if already processed
      if (annotation.processedAt) {
        console.log(`Annotation ${annotationId} already processed, skipping`);
        continue;
      }

      // Update annotation status
      const updated = await updateAnnotationForQueue(annotationId, triggeredBy);
      if (!updated) {
        // Already queued, skip
        continue;
      }

      // Send to SQS
      await sendToSQS(annotationId, annotation.imageId as string, triggeredBy);

      // Increment queue stats
      await incrementQueueStats();

      queuedCount++;
      console.log(`Queued annotation ${annotationId}`);
    } catch (error) {
      console.error(`Failed to queue annotation ${annotationId}:`, error);
      failedIds.push(annotationId);
    }
  }

  return {
    success: failedIds.length === 0,
    queuedCount,
    failedIds,
    errorMessage: failedIds.length > 0 ? `Failed to queue ${failedIds.length} annotations` : undefined
  };
};
