import { DynamoDBClient, PutItemCommand, ListTablesCommand } from '@aws-sdk/client-dynamodb';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { randomUUID } from 'crypto';

/**
 * Evaluation model configuration from evaluation-models.json
 */
interface EvaluationModel {
  id: string;
  name: string;
  provider: string;
  bedrockModelId: string;
  enabled: boolean;
}

interface EvaluationConfig {
  version: string;
  models: EvaluationModel[];
  metrics: {
    primary: string[];
    anlsThreshold: number;
    iouThreshold: number;
  };
}

/**
 * Input arguments for the trigger evaluation function
 */
interface TriggerEvaluationInput {
  datasetVersion: string;
  modelIds?: string[]; // Optional: specific models to evaluate, defaults to all enabled
}

/**
 * SQS message payload for evaluation job
 */
interface EvaluationJobMessage {
  jobId: string;
  datasetVersion: string;
  modelId: string;
  modelName: string;
  bedrockModelId: string;
  provider: string;
}

/**
 * Response from the trigger evaluation function
 */
interface TriggerEvaluationResponse {
  success: boolean;
  jobIds?: string[];
  error?: string;
}

// Embedded evaluation models config (loaded from evaluation-models.json at build time)
// This avoids runtime file system access in Lambda
const EVALUATION_CONFIG: EvaluationConfig = {
  version: '1.0',
  models: [
    {
      id: 'amazon-nova-pro',
      name: 'Amazon Nova Pro',
      provider: 'bedrock',
      bedrockModelId: 'amazon.nova-pro-v1:0',
      enabled: true,
    },
    {
      id: 'claude-sonnet-4-5',
      name: 'Claude Sonnet 4.5',
      provider: 'bedrock',
      bedrockModelId: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
      enabled: true,
    },
    {
      id: 'claude-haiku-4-5',
      name: 'Claude Haiku 4.5',
      provider: 'bedrock',
      bedrockModelId: 'global.anthropic.claude-haiku-4-5-20251001-v1:0',
      enabled: true,
    },
    {
      id: 'qwen3-vl-235b',
      name: 'Qwen3 VL 235B',
      provider: 'bedrock',
      bedrockModelId: 'qwen.qwen3-vl-235b-a22b',
      enabled: true,
    },
    {
      id: 'gemma-3-27b',
      name: 'Google Gemma 3 27B',
      provider: 'bedrock',
      bedrockModelId: 'google.gemma-3-27b-it',
      enabled: true,
    },
    {
      id: 'nemotron-nano-12b',
      name: 'NVIDIA Nemotron Nano 12B',
      provider: 'bedrock',
      bedrockModelId: 'nvidia.nemotron-nano-12b-v2',
      enabled: true,
    },
  ],
  metrics: {
    primary: ['anls', 'iou'],
    anlsThreshold: 0.5,
    iouThreshold: 0.5,
  },
};

/**
 * Find the EvaluationJob table name by pattern matching
 */
async function findEvaluationJobTableName(dynamoClient: DynamoDBClient): Promise<string> {
  const listTablesResult = await dynamoClient.send(new ListTablesCommand({}));
  const tables = listTablesResult.TableNames || [];
  const evaluationJobTable = tables.find((name) => name.startsWith('EvaluationJob-'));

  if (!evaluationJobTable) {
    throw new Error('EvaluationJob table not found. Available tables: ' + tables.join(', '));
  }

  return evaluationJobTable;
}

/**
 * Create an EvaluationJob record in DynamoDB
 */
async function createEvaluationJob(
  dynamoClient: DynamoDBClient,
  tableName: string,
  jobId: string,
  datasetVersion: string,
  model: EvaluationModel
): Promise<void> {
  const now = new Date().toISOString();

  const command = new PutItemCommand({
    TableName: tableName,
    Item: {
      id: { S: jobId }, // Amplify uses 'id' as primary key
      jobId: { S: jobId },
      datasetVersion: { S: datasetVersion },
      modelId: { S: model.id },
      modelName: { S: model.name },
      status: { S: 'QUEUED' },
      createdAt: { S: now },
      // Optional fields set to null initially
      avgAnls: { NULL: true },
      avgIou: { NULL: true },
      totalSamples: { NULL: true },
      wandbRunUrl: { NULL: true },
      errorMessage: { NULL: true },
      startedAt: { NULL: true },
      completedAt: { NULL: true },
    },
  });

  await dynamoClient.send(command);
  console.log(`Created EvaluationJob record: ${jobId} for model ${model.id}`);
}

/**
 * Send an SQS message for evaluation job processing
 */
async function sendEvaluationMessage(
  sqsClient: SQSClient,
  queueUrl: string,
  message: EvaluationJobMessage
): Promise<void> {
  const command = new SendMessageCommand({
    QueueUrl: queueUrl,
    MessageBody: JSON.stringify(message),
    MessageAttributes: {
      modelId: {
        DataType: 'String',
        StringValue: message.modelId,
      },
      datasetVersion: {
        DataType: 'String',
        StringValue: message.datasetVersion,
      },
    },
    // Use jobId as deduplication ID to prevent duplicate messages
    MessageDeduplicationId: message.jobId,
    // Group by dataset version for FIFO queues (if used)
    MessageGroupId: message.datasetVersion,
  });

  await sqsClient.send(command);
  console.log(`Sent SQS message for job: ${message.jobId}, model: ${message.modelId}`);
}

/**
 * Lambda handler for triggering model evaluations
 *
 * This function:
 * 1. Receives datasetVersion and optional modelIds from GraphQL mutation
 * 2. Reads enabled models from embedded config (or uses provided modelIds)
 * 3. Creates EvaluationJob records for each model with status=QUEUED
 * 4. Sends SQS messages to evaluation queue for each model
 * 5. Returns array of job IDs
 */
export const handler = async (
  event: TriggerEvaluationInput | { arguments: TriggerEvaluationInput }
): Promise<TriggerEvaluationResponse> => {
  const region = process.env.AWS_REGION || 'us-east-1';
  const queueUrl = process.env.EVALUATION_QUEUE_URL;

  // Initialize AWS clients
  const dynamoClient = new DynamoDBClient({ region });
  const sqsClient = new SQSClient({ region });

  // Extract arguments (AppSync wraps them)
  const args = 'arguments' in event ? event.arguments : event;

  try {
    console.log('Triggering evaluation for dataset version:', args.datasetVersion);

    // Validate required input
    if (!args.datasetVersion) {
      throw new Error('datasetVersion is required');
    }

    if (!queueUrl) {
      throw new Error('EVALUATION_QUEUE_URL environment variable is not set');
    }

    // Find the EvaluationJob table
    const tableName = await findEvaluationJobTableName(dynamoClient);
    console.log('Using EvaluationJob table:', tableName);

    // Get models to evaluate
    let modelsToEvaluate: EvaluationModel[];

    if (args.modelIds && args.modelIds.length > 0) {
      // Use specific models if provided
      modelsToEvaluate = EVALUATION_CONFIG.models.filter((model) =>
        args.modelIds!.includes(model.id)
      );

      // Warn about any requested models that weren't found
      const foundIds = modelsToEvaluate.map((m) => m.id);
      const missingIds = args.modelIds.filter((id) => !foundIds.includes(id));
      if (missingIds.length > 0) {
        console.warn('Requested models not found in config:', missingIds);
      }
    } else {
      // Use all enabled models from config
      modelsToEvaluate = EVALUATION_CONFIG.models.filter((model) => model.enabled);
    }

    if (modelsToEvaluate.length === 0) {
      throw new Error('No models to evaluate. Check modelIds or enable models in config.');
    }

    console.log(
      `Evaluating ${modelsToEvaluate.length} models:`,
      modelsToEvaluate.map((m) => m.id)
    );

    // Create evaluation jobs for each model
    const jobIds: string[] = [];

    for (const model of modelsToEvaluate) {
      const jobId = randomUUID();
      jobIds.push(jobId);

      // Create DynamoDB record
      await createEvaluationJob(dynamoClient, tableName, jobId, args.datasetVersion, model);

      // Send SQS message for processing
      const message: EvaluationJobMessage = {
        jobId,
        datasetVersion: args.datasetVersion,
        modelId: model.id,
        modelName: model.name,
        bedrockModelId: model.bedrockModelId,
        provider: model.provider,
      };

      await sendEvaluationMessage(sqsClient, queueUrl, message);
    }

    console.log(`Successfully triggered ${jobIds.length} evaluation jobs`);

    return {
      success: true,
      jobIds,
    };
  } catch (error) {
    console.error('Error triggering evaluations:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};
