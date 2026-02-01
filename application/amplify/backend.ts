import { defineBackend } from '@aws-amplify/backend';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { EventType } from 'aws-cdk-lib/aws-s3';
import { LambdaDestination } from 'aws-cdk-lib/aws-s3-notifications';
import { Duration, Fn, Stack } from 'aws-cdk-lib';
import { CfnParameter } from 'aws-cdk-lib/aws-ssm';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { auth } from './auth/resource';
import { storage } from './storage/resource';
import {
  data,
  generateAnnotationHandler,
  exportDatasetHandler,
  triggerEvaluationHandler,
  getAnnotationCountsHandler,
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
  getAnnotationCountsHandler,
  processImage,
  exportDataset,
  runEvaluation,
});

// =============================================================================
// SQS Queues (Sprint 4 Phase 1 - already provisioned)
// Place in function stack to avoid circular dependency with data stack
// (data stack references handler functions, handler functions reference SQS queues)
// =============================================================================
const stack = Stack.of(backend.exportDataset.resources.lambda);

// Dead Letter Queue for failed evaluation jobs
// Note: queueName omitted to let CloudFormation auto-generate unique names,
// avoiding naming conflicts when queues move between nested stacks.
const evaluationDLQ = new sqs.Queue(stack, 'EvaluationJobsDLQ', {
  retentionPeriod: Duration.days(14),
});

// Main evaluation queue
const evaluationQueue = new sqs.Queue(stack, 'EvaluationJobsQueue', {
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
// DynamoDB table references (used to pass exact table names to Lambdas)
// =============================================================================
const { tables } = backend.data.resources;
const annotationTable = tables['Annotation'];
const imageTable = tables['Image'];
const evaluationJobTable = tables['EvaluationJob'];
const datasetVersionTable = tables['DatasetVersion'];
const datasetExportProgressTable = tables['DatasetExportProgress'];

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

// SSM Parameter: Map S3 bucket name → Image table name (for processImage)
// Both storageBucket and imageTable live in the data stack, so no cross-stack ref.
// At runtime, processImage reads this parameter using its STORAGE_BUCKET_NAME env var.
// Uses L1 CfnParameter because the L2 StringParameter can't compute ARNs for token-based names.
new CfnParameter(Stack.of(imageTable), 'ImageTableNameParam', {
  type: 'String',
  name: Fn.join('/', ['/business-ocr/tables', storageBucket.bucketName, 'image-table-name']),
  value: imageTable.tableName,
});

backend.processImage.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['s3:GetObject', 's3:PutObject'],
    resources: [`${storageBucket.bucketArn}/*`],
  })
);

// SSM read permission: processImage discovers the Image table name via SSM
// parameter (keyed by bucket name) instead of ListTables, which avoids wrong-table
// bugs when multiple Amplify environments share the same AWS account.
backend.processImage.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['ssm:GetParameter'],
    resources: ['arn:aws:ssm:*:*:parameter/business-ocr/*'],
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
// Environment variables are set in resource.ts Function constructor
// (addPropertyOverride via node.defaultChild does not work for custom functions)
// STORAGE_BUCKET_NAME is forwarded via event payload from the Node.js handler
// =============================================================================
const exportDatasetLambda = backend.exportDataset.resources.lambda;

// Note: exportDataset is in the function stack (custom CDK Function). Using CDK
// table tokens here would create a circular dependency with the data stack. Table
// names are passed at runtime via the event payload from exportDatasetHandler
// (which IS in the data stack and can safely reference table tokens).
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
const exportDatasetHandlerCfnFunction = backend.exportDatasetHandler.resources.cfnResources
  .cfnFunction as import('aws-cdk-lib/aws-lambda').CfnFunction;
exportDatasetHandlerCfnFunction.addPropertyOverride(
  'Environment.Variables.EXPORT_DATASET_FUNCTION_NAME',
  exportDatasetLambda.functionName
);
exportDatasetHandlerCfnFunction.addPropertyOverride(
  'Environment.Variables.STORAGE_BUCKET_NAME',
  storageBucket.bucketName
);
// Table names for the Python export Lambda (passed via event payload)
exportDatasetHandlerCfnFunction.addPropertyOverride(
  'Environment.Variables.ANNOTATION_TABLE_NAME',
  annotationTable.tableName
);
exportDatasetHandlerCfnFunction.addPropertyOverride(
  'Environment.Variables.IMAGE_TABLE_NAME',
  imageTable.tableName
);
exportDatasetHandlerCfnFunction.addPropertyOverride(
  'Environment.Variables.DATASET_VERSION_TABLE_NAME',
  datasetVersionTable.tableName
);
exportDatasetHandlerCfnFunction.addPropertyOverride(
  'Environment.Variables.DATASET_EXPORT_PROGRESS_TABLE_NAME',
  datasetExportProgressTable.tableName
);

// Grant the wrapper permission to invoke the Python Lambda
exportDatasetLambda.grantInvoke(exportDatasetHandlerLambda);

// =============================================================================
// triggerEvaluation Lambda (Sprint 4 Phase 2) - Node.js GraphQL mutation handler
// Risk 4 fix: Grant SQS send permission
// =============================================================================
const triggerEvaluationLambda = backend.triggerEvaluationHandler.resources.lambda;

// Environment variables
const triggerEvalCfnFunction = backend.triggerEvaluationHandler.resources.cfnResources
  .cfnFunction as import('aws-cdk-lib/aws-lambda').CfnFunction;
triggerEvalCfnFunction.addPropertyOverride(
  'Environment.Variables.EVALUATION_QUEUE_URL',
  evaluationQueue.queueUrl
);
triggerEvalCfnFunction.addPropertyOverride(
  'Environment.Variables.EVALUATION_JOB_TABLE_NAME',
  evaluationJobTable.tableName
);

// DynamoDB permissions
triggerEvaluationLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['dynamodb:PutItem', 'dynamodb:Scan', 'dynamodb:UpdateItem', 'dynamodb:DescribeTable', 'dynamodb:Query'],
    resources: [evaluationJobTable.tableArn, `${evaluationJobTable.tableArn}/index/*`],
  })
);

// SQS send permission (Risk 4 fix)
evaluationQueue.grantSendMessages(triggerEvaluationLambda);

// =============================================================================
// runEvaluation Lambda (Sprint 4 Phase 2) - Python CDK Function, SQS triggered
// Environment variables are set in resource.ts Function constructor
// (addPropertyOverride via node.defaultChild does not work for custom functions)
// =============================================================================
const runEvaluationLambda = backend.runEvaluation.resources.lambda;

// SQS event source (Risk 4 fix: event source mapping)
runEvaluationLambda.addEventSource(
  new SqsEventSource(evaluationQueue, {
    batchSize: 1, // One model evaluation per invocation
    reportBatchItemFailures: true,
  })
);

// Note: runEvaluation is in the function stack (custom CDK Function). Table name
// is passed at runtime via the SQS message from triggerEvaluationHandler (data stack).
runEvaluationLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['dynamodb:GetItem', 'dynamodb:UpdateItem'],
    resources: ['arn:aws:dynamodb:*:*:table/EvaluationJob-*'],
  })
);

// Bedrock permissions for model invocation (foundation models + cross-region inference profiles)
runEvaluationLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['bedrock:InvokeModel'],
    resources: [
      'arn:aws:bedrock:*::foundation-model/*',
      'arn:aws:bedrock:*:*:inference-profile/*',
    ],
  })
);

// SSM Parameter Store read permission for WANDB_API_KEY secret
runEvaluationLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['ssm:GetParameter'],
    resources: ['arn:aws:ssm:*:*:parameter/business-ocr/*'],
  })
);

// =============================================================================
// getAnnotationCounts Lambda — Server-side annotation and image counts
// =============================================================================
const getAnnotationCountsCfnFunction = backend.getAnnotationCountsHandler.resources.cfnResources
  .cfnFunction as import('aws-cdk-lib/aws-lambda').CfnFunction;
getAnnotationCountsCfnFunction.addPropertyOverride(
  'Environment.Variables.ANNOTATION_TABLE_NAME',
  annotationTable.tableName
);
getAnnotationCountsCfnFunction.addPropertyOverride(
  'Environment.Variables.IMAGE_TABLE_NAME',
  imageTable.tableName
);

backend.getAnnotationCountsHandler.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['dynamodb:Query'],
    resources: [
      annotationTable.tableArn,
      `${annotationTable.tableArn}/index/*`,
    ],
  })
);
backend.getAnnotationCountsHandler.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['dynamodb:Scan'],
    resources: [imageTable.tableArn],
  })
);
