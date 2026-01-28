import { DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
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

interface TriggerEvaluationArgs {
  datasetVersion: string;
  huggingFaceRepoId: string;
  modelIds?: string[];
}

interface TriggerEvaluationResponse {
  success: boolean;
  jobIds: string[];
  modelCount: number;
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
    const now = new Date().toISOString();

    for (const model of models) {
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
    }

    console.log(`Triggered ${jobIds.length} evaluation jobs`);

    return {
      success: true,
      jobIds,
      modelCount: jobIds.length,
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
