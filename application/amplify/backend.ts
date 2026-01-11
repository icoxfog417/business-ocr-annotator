import { defineBackend } from '@aws-amplify/backend';
import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';

import { auth } from './auth/resource';
import { storage } from './storage/resource';
import { data } from './data/resource';
import { wandbProcessor } from './functions/wandb-processor/resource';
import { evaluationRunner } from './functions/evaluation-runner/resource';
import { queueAnnotation } from './functions/queue-annotation/resource';

const backend = defineBackend({
  auth,
  storage,
  data,
  wandbProcessor,
  evaluationRunner,
  queueAnnotation
});

// Get the underlying CDK stack for custom resources
const stack = backend.createStack('WandbIntegrationStack');

// Create Dead Letter Queue for failed messages
const dlq = new sqs.Queue(stack, 'AnnotationsDLQ', {
  queueName: 'verified-annotations-dlq',
  retentionPeriod: Duration.days(14),
  removalPolicy: RemovalPolicy.DESTROY
});

// Create main SQS queue for verified annotations
const annotationsQueue = new sqs.Queue(stack, 'VerifiedAnnotationsQueue', {
  queueName: 'verified-annotations-queue',
  visibilityTimeout: Duration.minutes(16), // Slightly longer than Lambda timeout
  retentionPeriod: Duration.days(14),
  deadLetterQueue: {
    queue: dlq,
    maxReceiveCount: 3 // Retry 3 times before moving to DLQ
  },
  removalPolicy: RemovalPolicy.DESTROY
});

// Get Lambda function reference
const wandbProcessorLambda = backend.wandbProcessor.resources.lambda;

// Add SQS event source to Lambda
wandbProcessorLambda.addEventSource(
  new SqsEventSource(annotationsQueue, {
    batchSize: 10,
    maxBatchingWindow: Duration.minutes(5),
    reportBatchItemFailures: true
  })
);

// Grant Lambda permissions to access the queue
annotationsQueue.grantConsumeMessages(wandbProcessorLambda);

// Grant Lambda permissions to access DynamoDB tables
const dataResources = backend.data.resources;
const annotationTable = dataResources.tables['Annotation'];
const imageTable = dataResources.tables['Image'];
const datasetBuildJobTable = dataResources.tables['DatasetBuildJob'];
const queueStatsTable = dataResources.tables['QueueStats'];

if (annotationTable) {
  annotationTable.grantReadWriteData(wandbProcessorLambda);
}
if (imageTable) {
  imageTable.grantReadData(wandbProcessorLambda);
}
if (datasetBuildJobTable) {
  datasetBuildJobTable.grantReadWriteData(wandbProcessorLambda);
}
if (queueStatsTable) {
  queueStatsTable.grantReadWriteData(wandbProcessorLambda);
}

// Grant Lambda permissions to access S3 storage bucket
const storageBucket = backend.storage.resources.bucket;
storageBucket.grantRead(wandbProcessorLambda);

// Add environment variables to Lambda with table names and bucket
wandbProcessorLambda.addEnvironment('ANNOTATION_TABLE_NAME', annotationTable?.tableName || '');
wandbProcessorLambda.addEnvironment('IMAGE_TABLE_NAME', imageTable?.tableName || '');
wandbProcessorLambda.addEnvironment('JOB_TABLE_NAME', datasetBuildJobTable?.tableName || '');
wandbProcessorLambda.addEnvironment('QUEUE_STATS_TABLE_NAME', queueStatsTable?.tableName || '');
wandbProcessorLambda.addEnvironment('STORAGE_BUCKET_NAME', storageBucket.bucketName);
wandbProcessorLambda.addEnvironment('SQS_QUEUE_URL', annotationsQueue.queueUrl);

// Create EventBridge schedule for daily dataset builds at 2 AM UTC
const dailyBuildSchedule = new events.Rule(stack, 'DailyDatasetBuildSchedule', {
  ruleName: 'daily-dataset-build',
  schedule: events.Schedule.cron({
    minute: '0',
    hour: '2',
    day: '*',
    month: '*',
    year: '*'
  }),
  description: 'Triggers daily dataset build at 2 AM UTC'
});

dailyBuildSchedule.addTarget(new targets.LambdaFunction(wandbProcessorLambda, {
  event: events.RuleTargetInput.fromObject({
    source: 'scheduled',
    triggerType: 'SCHEDULED',
    triggeredBy: 'EventBridge'
  })
}));

// Export the queue URL and ARN for use in the frontend
backend.addOutput({
  custom: {
    annotationsQueueUrl: annotationsQueue.queueUrl,
    annotationsQueueArn: annotationsQueue.queueArn,
    dlqUrl: dlq.queueUrl
  }
});

// ======= Evaluation Runner Configuration =======

// Get Lambda function reference
const evaluationRunnerLambda = backend.evaluationRunner.resources.lambda;

// Grant Lambda permissions to access DynamoDB tables
const evaluationJobTable = dataResources.tables['EvaluationJob'];

if (annotationTable) {
  annotationTable.grantReadData(evaluationRunnerLambda);
}
if (imageTable) {
  imageTable.grantReadData(evaluationRunnerLambda);
}
if (evaluationJobTable) {
  evaluationJobTable.grantReadWriteData(evaluationRunnerLambda);
}

// Grant Lambda permissions to access S3 storage bucket
storageBucket.grantRead(evaluationRunnerLambda);

// Grant Lambda permissions to invoke Bedrock models
evaluationRunnerLambda.addToRolePolicy(new iam.PolicyStatement({
  effect: iam.Effect.ALLOW,
  actions: ['bedrock:InvokeModel'],
  resources: [
    'arn:aws:bedrock:*::foundation-model/amazon.nova-pro-v1:0',
    'arn:aws:bedrock:*::foundation-model/anthropic.claude-3-5-sonnet-20241022-v2:0'
  ]
}));

// Add environment variables to Lambda with table names and bucket
evaluationRunnerLambda.addEnvironment('ANNOTATION_TABLE_NAME', annotationTable?.tableName || '');
evaluationRunnerLambda.addEnvironment('IMAGE_TABLE_NAME', imageTable?.tableName || '');
evaluationRunnerLambda.addEnvironment('EVALUATION_JOB_TABLE_NAME', evaluationJobTable?.tableName || '');
evaluationRunnerLambda.addEnvironment('STORAGE_BUCKET_NAME', storageBucket.bucketName);

// Create EventBridge schedule for weekly evaluations (Sunday 3 AM UTC)
const weeklyEvalSchedule = new events.Rule(stack, 'WeeklyEvaluationSchedule', {
  ruleName: 'weekly-model-evaluation',
  schedule: events.Schedule.cron({
    minute: '0',
    hour: '3',
    weekDay: 'SUN',
    month: '*',
    year: '*'
  }),
  description: 'Triggers weekly model evaluation on Sunday at 3 AM UTC'
});

weeklyEvalSchedule.addTarget(new targets.LambdaFunction(evaluationRunnerLambda, {
  event: events.RuleTargetInput.fromObject({
    source: 'scheduled',
    triggerType: 'SCHEDULED',
    triggeredBy: 'EventBridge',
    modelName: 'Amazon Nova Pro',
    datasetVersion: 'latest'
  })
}));

// ======= Queue Annotation Lambda Configuration =======

// Get Lambda function reference
const queueAnnotationLambda = backend.queueAnnotation.resources.lambda;

// Grant Lambda permissions to access DynamoDB tables
if (annotationTable) {
  annotationTable.grantReadWriteData(queueAnnotationLambda);
}
if (queueStatsTable) {
  queueStatsTable.grantReadWriteData(queueAnnotationLambda);
}

// Grant Lambda permissions to send messages to SQS
annotationsQueue.grantSendMessages(queueAnnotationLambda);

// Add environment variables
queueAnnotationLambda.addEnvironment('ANNOTATION_TABLE_NAME', annotationTable?.tableName || '');
queueAnnotationLambda.addEnvironment('QUEUE_STATS_TABLE_NAME', queueStatsTable?.tableName || '');
queueAnnotationLambda.addEnvironment('SQS_QUEUE_URL', annotationsQueue.queueUrl);

// Export the Lambda ARN for frontend invocation
backend.addOutput({
  custom: {
    queueAnnotationFunctionName: queueAnnotationLambda.functionName
  }
});
