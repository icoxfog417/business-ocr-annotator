import { defineFunction } from '@aws-amplify/backend';

export const triggerEvaluation = defineFunction({
  name: 'triggerEvaluation',
  entry: './handler.ts',
  timeoutSeconds: 60,
  memoryMB: 512,
  // Environment variables will be added in backend.ts during integration:
  // - EVALUATION_QUEUE_URL: SQS queue URL for evaluation jobs
  // - EVALUATION_TABLE_NAME: DynamoDB table for EvaluationJob records
});
