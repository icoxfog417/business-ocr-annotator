import { defineBackend } from '@aws-amplify/backend';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { EventType } from 'aws-cdk-lib/aws-s3';
import { LambdaDestination } from 'aws-cdk-lib/aws-s3-notifications';
import { Duration, Stack } from 'aws-cdk-lib';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { auth } from './auth/resource';
import { storage } from './storage/resource';
import {
  data,
  generateAnnotationHandler,
  exportDatasetHandler,
  triggerEvaluationHandler,
} from './data/resource';
import { processImage } from './functions/process-image/resource';
import { exportDataset } from './functions/export-dataset/resource';
import { runEvaluation } from './functions/run-evaluation/resource';

const backend = defineBackend({
  auth,
  storage,
  data,
  generateAnnotationHandler,
  exportDatasetHandler,
  triggerEvaluationHandler,
  processImage,
  exportDataset,
  runEvaluation,
});

// =============================================================================
// SQS Queues (Sprint 4 Phase 1 - already provisioned)
// =============================================================================
const stack = Stack.of(backend.data.resources.graphqlApi);

// Dead Letter Queue for failed evaluation jobs
const evaluationDLQ = new sqs.Queue(stack, 'EvaluationJobsDLQ', {
  queueName: 'biz-doc-vqa-evaluation-dlq',
  retentionPeriod: Duration.days(14),
});

// Main evaluation queue
const evaluationQueue = new sqs.Queue(stack, 'EvaluationJobsQueue', {
  queueName: 'biz-doc-vqa-evaluation-queue',
  visibilityTimeout: Duration.minutes(15), // Match Lambda timeout
  retentionPeriod: Duration.days(7),
  deadLetterQueue: {
    queue: evaluationDLQ,
    maxReceiveCount: 3, // Move to DLQ after 3 failures
  },
});

// Export queue URLs for frontend and Lambda functions
backend.addOutput({
  custom: {
    evaluationQueueUrl: evaluationQueue.queueUrl,
    evaluationQueueArn: evaluationQueue.queueArn,
    evaluationDLQUrl: evaluationDLQ.queueUrl,
  },
});

// =============================================================================
// generateAnnotation Lambda (Sprint 2)
// =============================================================================
backend.generateAnnotationHandler.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['bedrock:InvokeModel'],
    resources: ['arn:aws:bedrock:*::foundation-model/*'],
  })
);

// =============================================================================
// processImage Lambda (Sprint 2)
// =============================================================================
const storageBucket = backend.storage.resources.bucket;

backend.processImage.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['s3:GetObject', 's3:PutObject'],
    resources: [`${storageBucket.bucketArn}/*`],
  })
);

backend.processImage.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['dynamodb:ListTables'],
    resources: ['*'],
  })
);
backend.processImage.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['dynamodb:UpdateItem', 'dynamodb:Query'],
    resources: ['arn:aws:dynamodb:*:*:table/Image-*', 'arn:aws:dynamodb:*:*:table/Image-*/index/*'],
  })
);

const processImageCfnFunction = backend.processImage.resources.cfnResources
  .cfnFunction as import('aws-cdk-lib/aws-lambda').CfnFunction;
processImageCfnFunction.addPropertyOverride(
  'Environment.Variables.STORAGE_BUCKET_NAME',
  storageBucket.bucketName
);
processImageCfnFunction.addPropertyOverride(
  'Environment.Variables.IMAGE_TABLE_INDEX_NAME',
  'imagesByS3KeyOriginal'
);

storageBucket.addEventNotification(
  EventType.OBJECT_CREATED,
  new LambdaDestination(backend.processImage.resources.lambda),
  { prefix: 'images/original/' }
);

// =============================================================================
// exportDataset Lambda (Sprint 4 Phase 2) - Python CDK Function
// Risk 2 fix: Wire all environment variables and IAM permissions
// =============================================================================
const exportDatasetLambda = backend.exportDataset.resources.lambda;

// Environment variables
exportDatasetLambda.addEnvironment('STORAGE_BUCKET_NAME', storageBucket.bucketName);
exportDatasetLambda.addEnvironment('ANNOTATION_INDEX_NAME', 'annotationsByValidationStatus');
exportDatasetLambda.addEnvironment('HF_TOKEN_SSM_PARAM', '/business-ocr/hf-token');

// DynamoDB permissions: table discovery + read/write
exportDatasetLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['dynamodb:ListTables'],
    resources: ['*'],
  })
);
exportDatasetLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['dynamodb:Query', 'dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem'],
    resources: [
      'arn:aws:dynamodb:*:*:table/Annotation-*',
      'arn:aws:dynamodb:*:*:table/Annotation-*/index/*',
      'arn:aws:dynamodb:*:*:table/Image-*',
      'arn:aws:dynamodb:*:*:table/DatasetVersion-*',
      'arn:aws:dynamodb:*:*:table/DatasetExportProgress-*',
    ],
  })
);

// S3 read permission for downloading images
exportDatasetLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['s3:GetObject'],
    resources: [`${storageBucket.bucketArn}/*`],
  })
);

// SSM Parameter Store read permission for HF_TOKEN secret
exportDatasetLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['ssm:GetParameter'],
    resources: ['arn:aws:ssm:*:*:parameter/business-ocr/*'],
  })
);

// =============================================================================
// exportDatasetHandler Lambda (Sprint 4 Phase 2) - Node.js async dispatcher
// Risk 6 fix: Thin wrapper that invokes the Python export Lambda asynchronously
// =============================================================================
const exportDatasetHandlerLambda = backend.exportDatasetHandler.resources.lambda;

// Pass the Python Lambda's function name so the wrapper can invoke it
exportDatasetHandlerLambda.addEnvironment(
  'EXPORT_DATASET_FUNCTION_NAME',
  exportDatasetLambda.functionName
);

// Grant the wrapper permission to invoke the Python Lambda
exportDatasetLambda.grantInvoke(exportDatasetHandlerLambda);

// =============================================================================
// triggerEvaluation Lambda (Sprint 4 Phase 2) - Node.js GraphQL mutation handler
// Risk 4 fix: Grant SQS send permission
// =============================================================================
const triggerEvaluationLambda = backend.triggerEvaluationHandler.resources.lambda;

// Environment variable: SQS queue URL
const triggerEvalCfnFunction = backend.triggerEvaluationHandler.resources.cfnResources
  .cfnFunction as import('aws-cdk-lib/aws-lambda').CfnFunction;
triggerEvalCfnFunction.addPropertyOverride(
  'Environment.Variables.EVALUATION_QUEUE_URL',
  evaluationQueue.queueUrl
);

// DynamoDB permissions: table discovery + write
triggerEvaluationLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['dynamodb:ListTables'],
    resources: ['*'],
  })
);
triggerEvaluationLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['dynamodb:PutItem'],
    resources: ['arn:aws:dynamodb:*:*:table/EvaluationJob-*'],
  })
);

// SQS send permission (Risk 4 fix)
evaluationQueue.grantSendMessages(triggerEvaluationLambda);

// =============================================================================
// runEvaluation Lambda (Sprint 4 Phase 2) - Python CDK Function, SQS triggered
// Risk 3 fix: Full evaluation pipeline
// Risk 4 fix: SQS event source mapping + permissions
// =============================================================================
const runEvaluationLambda = backend.runEvaluation.resources.lambda;

// Environment variables
runEvaluationLambda.addEnvironment('WANDB_PROJECT', 'biz-doc-vqa');
runEvaluationLambda.addEnvironment(
  'WANDB_API_KEY',
  '/business-ocr/wandb-api-key'
);

// SQS event source (Risk 4 fix: event source mapping)
runEvaluationLambda.addEventSource(
  new SqsEventSource(evaluationQueue, {
    batchSize: 1, // One model evaluation per invocation
    reportBatchItemFailures: true,
  })
);

// DynamoDB permissions: table discovery + read/write
runEvaluationLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['dynamodb:ListTables'],
    resources: ['*'],
  })
);
runEvaluationLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['dynamodb:GetItem', 'dynamodb:UpdateItem'],
    resources: ['arn:aws:dynamodb:*:*:table/EvaluationJob-*'],
  })
);

// Bedrock permissions for model invocation
runEvaluationLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['bedrock:InvokeModel'],
    resources: ['arn:aws:bedrock:*::foundation-model/*'],
  })
);

// SSM Parameter Store read permission for WANDB_API_KEY secret
runEvaluationLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['ssm:GetParameter'],
    resources: ['arn:aws:ssm:*:*:parameter/business-ocr/*'],
  })
);
