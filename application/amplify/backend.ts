import { defineBackend } from '@aws-amplify/backend';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { EventType } from 'aws-cdk-lib/aws-s3';
import { LambdaDestination } from 'aws-cdk-lib/aws-s3-notifications';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { Duration, Stack } from 'aws-cdk-lib';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { auth } from './auth/resource';
import { storage } from './storage/resource';
import { data, generateAnnotationHandler, triggerEvaluationHandler } from './data/resource';
import { processImage } from './functions/process-image/resource';
import { exportDataset } from './functions/export-dataset/resource';
import { runEvaluation } from './functions/run-evaluation/resource';

const backend = defineBackend({
  auth,
  storage,
  data,
  generateAnnotationHandler,
  triggerEvaluationHandler,
  processImage,
  exportDataset,
  runEvaluation,
});

// Sprint 4: Create SQS queue for evaluation jobs
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

// Export queue URLs for Lambda functions
backend.addOutput({
  custom: {
    evaluationQueueUrl: evaluationQueue.queueUrl,
    evaluationQueueArn: evaluationQueue.queueArn,
    evaluationDLQUrl: evaluationDLQ.queueUrl,
  },
});

// Grant generateAnnotation Lambda permission to invoke Bedrock
backend.generateAnnotationHandler.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['bedrock:InvokeModel'],
    resources: ['arn:aws:bedrock:*::foundation-model/*'],
  })
);

// Get storage bucket reference
const storageBucket = backend.storage.resources.bucket;

// Grant processImage Lambda permission to read/write S3 bucket
backend.processImage.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['s3:GetObject', 's3:PutObject'],
    resources: [`${storageBucket.bucketArn}/*`],
  })
);

// Grant processImage Lambda permission to DynamoDB (wildcard to avoid cross-stack cycle)
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

// Add environment variables for processImage Lambda
// Note: IMAGE_TABLE_NAME uses pattern matching in handler since we can't reference data stack
const processImageCfnFunction = backend.processImage.resources.cfnResources
  .cfnFunction as import('aws-cdk-lib/aws-lambda').CfnFunction;
processImageCfnFunction.addPropertyOverride('Environment.Variables.STORAGE_BUCKET_NAME', storageBucket.bucketName);
processImageCfnFunction.addPropertyOverride('Environment.Variables.IMAGE_TABLE_INDEX_NAME', 'imagesByS3KeyOriginal');

// Add S3 event trigger for processImage Lambda
storageBucket.addEventNotification(
  EventType.OBJECT_CREATED,
  new LambdaDestination(backend.processImage.resources.lambda),
  { prefix: 'images/original/' }
);

// ============================================
// Sprint 4 Phase 2: Lambda Function Integration
// ============================================

// --- exportDataset Lambda permissions ---
backend.exportDataset.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['s3:GetObject'],
    resources: [`${storageBucket.bucketArn}/*`],
  })
);
backend.exportDataset.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['dynamodb:ListTables'],
    resources: ['*'],
  })
);
backend.exportDataset.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['dynamodb:Scan', 'dynamodb:Query', 'dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem'],
    resources: [
      'arn:aws:dynamodb:*:*:table/Annotation-*',
      'arn:aws:dynamodb:*:*:table/Image-*',
      'arn:aws:dynamodb:*:*:table/DatasetVersion-*',
      'arn:aws:dynamodb:*:*:table/DatasetExportProgress-*',
    ],
  })
);

// Add environment variables for exportDataset
const exportDatasetCfnFunction = backend.exportDataset.resources.cfnResources
  .cfnFunction as import('aws-cdk-lib/aws-lambda').CfnFunction;
exportDatasetCfnFunction.addPropertyOverride('Environment.Variables.STORAGE_BUCKET_NAME', storageBucket.bucketName);

// --- triggerEvaluation Lambda permissions ---
backend.triggerEvaluationHandler.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['sqs:SendMessage'],
    resources: [evaluationQueue.queueArn],
  })
);
backend.triggerEvaluationHandler.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['dynamodb:ListTables'],
    resources: ['*'],
  })
);
backend.triggerEvaluationHandler.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['dynamodb:PutItem', 'dynamodb:GetItem', 'dynamodb:Query'],
    resources: [
      'arn:aws:dynamodb:*:*:table/EvaluationJob-*',
      'arn:aws:dynamodb:*:*:table/DatasetVersion-*',
    ],
  })
);

// Add environment variables for triggerEvaluation
const triggerEvaluationCfnFunction = backend.triggerEvaluationHandler.resources.cfnResources
  .cfnFunction as import('aws-cdk-lib/aws-lambda').CfnFunction;
triggerEvaluationCfnFunction.addPropertyOverride('Environment.Variables.EVALUATION_QUEUE_URL', evaluationQueue.queueUrl);

// --- runEvaluation Lambda permissions ---
backend.runEvaluation.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['bedrock:InvokeModel'],
    resources: ['arn:aws:bedrock:*::foundation-model/*'],
  })
);
backend.runEvaluation.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['dynamodb:ListTables'],
    resources: ['*'],
  })
);
backend.runEvaluation.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['dynamodb:UpdateItem', 'dynamodb:GetItem'],
    resources: ['arn:aws:dynamodb:*:*:table/EvaluationJob-*'],
  })
);

// Add SQS event trigger for runEvaluation Lambda
backend.runEvaluation.resources.lambda.addEventSource(
  new SqsEventSource(evaluationQueue, {
    batchSize: 1, // Process one evaluation job at a time
    reportBatchItemFailures: true,
  })
);
