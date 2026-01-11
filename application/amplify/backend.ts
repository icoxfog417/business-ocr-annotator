import { defineBackend } from '@aws-amplify/backend';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { EventType } from 'aws-cdk-lib/aws-s3';
import { LambdaDestination } from 'aws-cdk-lib/aws-s3-notifications';
import { auth } from './auth/resource';
import { storage } from './storage/resource';
import { data } from './data/resource';
import { generateAnnotation } from './functions/generate-annotation/resource';
import { processImage } from './functions/process-image/resource';

const backend = defineBackend({
  auth,
  storage,
  data,
  generateAnnotation,
  processImage,
});

// Grant Lambda permission to access S3 bucket
const storageBucket = backend.storage.resources.bucket;
backend.generateAnnotation.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['s3:GetObject'],
    resources: [`${storageBucket.bucketArn}/*`],
  })
);

// Grant Lambda permission to invoke Bedrock
backend.generateAnnotation.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['bedrock:InvokeModel'],
    resources: ['arn:aws:bedrock:*::foundation-model/*'],
  })
);

// Add environment variables using CDK
const cfnFunction = backend.generateAnnotation.resources.cfnResources
  .cfnFunction as import('aws-cdk-lib/aws-lambda').CfnFunction;
cfnFunction.addPropertyOverride('Environment.Variables.STORAGE_BUCKET_NAME', storageBucket.bucketName);

// Grant processImage Lambda permission to read/write S3 bucket
backend.processImage.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['s3:GetObject', 's3:PutObject'],
    resources: [`${storageBucket.bucketArn}/*`],
  })
);

// Grant processImage Lambda permission to update DynamoDB
const imageTable = backend.data.resources.tables['Image'];
backend.processImage.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['dynamodb:UpdateItem'],
    resources: [imageTable.tableArn],
  })
);

// Add environment variables for processImage Lambda
const processImageCfnFunction = backend.processImage.resources.cfnResources
  .cfnFunction as import('aws-cdk-lib/aws-lambda').CfnFunction;
processImageCfnFunction.addPropertyOverride('Environment.Variables.STORAGE_BUCKET_NAME', storageBucket.bucketName);
processImageCfnFunction.addPropertyOverride('Environment.Variables.IMAGE_TABLE_NAME', imageTable.tableName);
processImageCfnFunction.addPropertyOverride('Environment.Variables.IMAGE_TABLE_INDEX_NAME', 'imagesByS3KeyOriginal');

// Add S3 event trigger for processImage Lambda
storageBucket.addEventNotification(
  EventType.OBJECT_CREATED,
  new LambdaDestination(backend.processImage.resources.lambda),
  { prefix: 'images/original/' }
);

// Grant processImage Lambda permission to query DynamoDB GSI
backend.processImage.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['dynamodb:Query'],
    resources: [`${imageTable.tableArn}/index/*`],
  })
);
