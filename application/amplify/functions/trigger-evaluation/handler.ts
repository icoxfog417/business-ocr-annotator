import { DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const sqsClient = new SQSClient({});

// Risk 7 fix: Import from single source of truth instead of hardcoding
import EVALUATION_MODELS from '../../../src/config/evaluation-models.json';

// Table name cache
let evaluationJobTableName: string | null = null;

async function getEvaluationJobTableName(): Promise<string> {
  if (evaluationJobTableName) return evaluationJobTableName;
  const result = await dynamoClient.send(new ListTablesCommand({}));
  const table = result.TableNames?.find((name) => name.startsWith('EvaluationJob-'));
  if (!table) throw new Error('EvaluationJob table not found');
  evaluationJobTableName = table;
  console.log(`Using EvaluationJob table: ${evaluationJobTableName}`);
  return evaluationJobTableName;
}

// GSI name cache (discovered at runtime)
let evaluationJobGsiName: string | null = null;

async function getEvaluationJobGsiName(tableName: string): Promise<string | null> {
  if (evaluationJobGsiName) return evaluationJobGsiName;

  const result = await dynamoClient.send(
    new (await import('@aws-sdk/client-dynamodb')).DescribeTableCommand({
      TableName: tableName,
    })
  );

  const gsi = result.Table?.GlobalSecondaryIndexes?.find(
    (idx) => idx.KeySchema?.some((key) => key.AttributeName === 'datasetVersion')
  );
  evaluationJobGsiName = gsi?.IndexName ?? null;
  return evaluationJobGsiName;
}

/**
 * Check for existing QUEUED or RUNNING jobs for the given dataset version and model.
 * Uses GSI query on datasetVersion instead of full table scan.
 */
async function findActiveJob(
  tableName: string,
  datasetVersion: string,
  modelId: string
): Promise<{ id: string; status: string } | null> {
  const gsiName = await getEvaluationJobGsiName(tableName);

  if (gsiName) {
    // Use GSI query (efficient: reads only matching partition)
    const result = await docClient.send(
      new QueryCommand({
        TableName: tableName,
        IndexName: gsiName,
        KeyConditionExpression: 'datasetVersion = :dv',
        FilterExpression: 'modelId = :mid AND (#s = :queued OR #s = :running)',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: {
          ':dv': datasetVersion,
          ':mid': modelId,
          ':queued': 'QUEUED',
          ':running': 'RUNNING',
        },
        ProjectionExpression: 'id, #s',
      })
    );

    if (result.Items && result.Items.length > 0) {
      return { id: result.Items[0].id as string, status: result.Items[0].status as string };
    }
  } else {
    // Fallback to scan if GSI not yet available
    const { ScanCommand: ScanCmd } = await import('@aws-sdk/lib-dynamodb');
    const result = await docClient.send(
      new ScanCmd({
        TableName: tableName,
        FilterExpression:
          'datasetVersion = :dv AND modelId = :mid AND (#s = :queued OR #s = :running)',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: {
          ':dv': datasetVersion,
          ':mid': modelId,
          ':queued': 'QUEUED',
          ':running': 'RUNNING',
        },
        ProjectionExpression: 'id, #s',
      })
    );

    if (result.Items && result.Items.length > 0) {
      return { id: result.Items[0].id as string, status: result.Items[0].status as string };
    }
  }

  return null;
}

/**
 * Mark a job as FAILED when SQS send fails.
 */
async function markJobFailed(tableName: string, jobId: string, errorMessage: string): Promise<void> {
  const now = new Date().toISOString();
  await docClient.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { id: jobId },
      UpdateExpression: 'SET #s = :status, errorMessage = :error, updatedAt = :now',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: {
        ':status': 'FAILED',
        ':error': errorMessage,
        ':now': now,
      },
    })
  );
}

interface TriggerEvaluationArgs {
  datasetVersion: string;
  huggingFaceRepoId: string;
  modelIds?: string[];
}

interface TriggerEvaluationResponse {
  success: boolean;
  jobIds: string[];
  modelCount: number;
  skippedModels?: { modelId: string; reason: string; existingJobId?: string }[];
  error?: string;
}

export const handler = async (
  event: TriggerEvaluationArgs | { arguments: TriggerEvaluationArgs }
): Promise<TriggerEvaluationResponse> => {
  // AppSync wraps arguments
  const args = 'arguments' in event ? event.arguments : event;

  try {
    const { datasetVersion, huggingFaceRepoId, modelIds } = args;
    const queueUrl = process.env.EVALUATION_QUEUE_URL;

    if (!queueUrl) {
      throw new Error('EVALUATION_QUEUE_URL not configured');
    }

    console.log(`Triggering evaluation for dataset ${datasetVersion}`);

    // Filter models: enabled + optional model ID filter
    let models = EVALUATION_MODELS.models.filter((m) => m.enabled);
    if (modelIds && modelIds.length > 0) {
      models = models.filter((m) => modelIds.includes(m.id));
    }

    if (models.length === 0) {
      throw new Error('No enabled models found for evaluation');
    }

    const tableName = await getEvaluationJobTableName();
    const jobIds: string[] = [];
    const skippedModels: { modelId: string; reason: string; existingJobId?: string }[] = [];
    const now = new Date().toISOString();

    for (const model of models) {
      // Check for existing QUEUED or RUNNING job to prevent duplicate concurrent execution
      const existingJob = await findActiveJob(tableName, datasetVersion, model.id);
      if (existingJob) {
        console.log(
          `Skipping ${model.id} - already ${existingJob.status} (job ${existingJob.id})`
        );
        skippedModels.push({
          modelId: model.id,
          reason: `Already ${existingJob.status}`,
          existingJobId: existingJob.id,
        });
        continue;
      }

      const jobId = crypto.randomUUID();

      // Create EvaluationJob record in DynamoDB
      await docClient.send(
        new PutCommand({
          TableName: tableName,
          Item: {
            id: jobId,
            jobId: jobId,
            datasetVersion: datasetVersion,
            modelId: model.id,
            modelName: model.name,
            status: 'QUEUED',
            createdAt: now,
            updatedAt: now,
          },
        })
      );

      // Send SQS message to trigger parallel evaluation
      try {
        await sqsClient.send(
          new SendMessageCommand({
            QueueUrl: queueUrl,
            MessageBody: JSON.stringify({
              evaluationJobId: jobId,
              jobId: jobId,
              datasetVersion: datasetVersion,
              huggingFaceRepoId: huggingFaceRepoId,
              modelId: model.id,
              modelName: model.name,
              modelBedrockId: model.bedrockModelId,
            }),
          })
        );
        console.log(`Queued evaluation job ${jobId} for model ${model.id}`);
        jobIds.push(jobId);
      } catch (sqsError) {
        // SQS send failed - mark job as FAILED to avoid orphaned QUEUED jobs
        const errorMsg = sqsError instanceof Error ? sqsError.message : 'SQS send failed';
        console.error(`Failed to send SQS message for job ${jobId}: ${errorMsg}`);
        await markJobFailed(tableName, jobId, `Failed to queue: ${errorMsg}`);
        skippedModels.push({
          modelId: model.id,
          reason: `SQS error: ${errorMsg}`,
        });
      }
    }

    console.log(
      `Triggered ${jobIds.length} evaluation jobs, skipped ${skippedModels.length} models`
    );

    return {
      success: jobIds.length > 0 || skippedModels.length === models.length,
      jobIds,
      modelCount: jobIds.length,
      skippedModels: skippedModels.length > 0 ? skippedModels : undefined,
    };
  } catch (error) {
    console.error('Error triggering evaluation:', error);
    return {
      success: false,
      jobIds: [],
      modelCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};
