---
name: amplify-patterns
description: Amplify Gen2 patterns and conventions for this project. Use when creating Lambda functions, modifying backend.ts, updating data schema, or working with S3 storage. Reference this for consistent code structure.
---

# Amplify Gen2 Patterns

Project-specific patterns for AWS Amplify Gen2 backend development.

## Project Structure

```
application/amplify/
├── auth/resource.ts       # Authentication config
├── storage/resource.ts    # S3 bucket config
├── data/resource.ts       # GraphQL schema + functions
├── functions/
│   ├── generate-annotation/
│   │   ├── handler.ts
│   │   └── package.json
│   └── process-image/
│       ├── resource.ts
│       ├── handler.ts
│       └── package.json
└── backend.ts             # Main backend definition
```

## Lambda Function Pattern

### Directory Structure

```
amplify/functions/{function-name}/
├── resource.ts    # Function definition
├── handler.ts     # Implementation
└── package.json   # Dependencies (isolated per function)
```

### resource.ts Template

```typescript
import { defineFunction } from '@aws-amplify/backend';

export const myFunction = defineFunction({
  name: 'myFunction',
  entry: './handler.ts',
  timeoutSeconds: 60,        // Adjust based on workload
  memoryMB: 512,             // Adjust based on needs
  // Optional: for functions needing layers
  layers: {
    layerName: 'arn:aws:lambda:region:account:layer:name:version',
  },
});
```

### handler.ts Template

```typescript
import type { Handler } from 'aws-lambda';

interface EventInput {
  // Define input shape
}

interface EventOutput {
  // Define output shape
}

export const handler: Handler<EventInput, EventOutput> = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  try {
    // Implementation
    return { /* result */ };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
};
```

### package.json Template

```json
{
  "name": "function-name",
  "type": "module",
  "dependencies": {
    // Only what this function needs
  }
}
```

## Backend Integration

### Adding a New Function

1. Create function in `amplify/functions/{name}/`
2. Import in `amplify/backend.ts`:

```typescript
import { myFunction } from './functions/my-function/resource';

const backend = defineBackend({
  auth,
  storage,
  data,
  generateAnnotationHandler,
  processImage,
  myFunction,  // Add here
});
```

3. Add IAM permissions if needed:

```typescript
// Bedrock access
backend.myFunction.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['bedrock:InvokeModel'],
    resources: ['arn:aws:bedrock:*::foundation-model/*'],
  })
);

// S3 access
backend.myFunction.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['s3:GetObject', 's3:PutObject'],
    resources: [`${storageBucket.bucketArn}/*`],
  })
);

// DynamoDB access
backend.myFunction.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['dynamodb:UpdateItem', 'dynamodb:Query'],
    resources: ['arn:aws:dynamodb:*:*:table/TableName-*'],
  })
);

// SQS access
backend.myFunction.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['sqs:SendMessage', 'sqs:ReceiveMessage', 'sqs:DeleteMessage'],
    resources: [evaluationQueue.queueArn],
  })
);
```

4. Add environment variables:

```typescript
const cfnFunction = backend.myFunction.resources.cfnResources
  .cfnFunction as import('aws-cdk-lib/aws-lambda').CfnFunction;

cfnFunction.addPropertyOverride('Environment.Variables.MY_VAR', 'value');
cfnFunction.addPropertyOverride('Environment.Variables.BUCKET_NAME', storageBucket.bucketName);
```

## Data Schema Pattern

### Model Definition

```typescript
ModelName: a
  .model({
    fieldName: a.string().required(),
    optionalField: a.string(),
    enumField: a.enum(['VALUE1', 'VALUE2']),
    numberField: a.integer(),
    floatField: a.float(),
    boolField: a.boolean().default(false),
    jsonField: a.json(),
    dateField: a.datetime(),
    
    // Relationships
    relatedItems: a.hasMany('RelatedModel', 'foreignKey'),
    parent: a.belongsTo('ParentModel', 'parentId'),
  })
  .secondaryIndexes((index) => [
    index('fieldName'),  // GSI for queries
  ])
  .authorization((allow) => [allow.authenticated()]),
```

### Custom Query/Mutation

```typescript
myOperation: a
  .query()  // or .mutation()
  .arguments({
    param1: a.string().required(),
    param2: a.integer(),
  })
  .returns(a.json())
  .authorization((allow) => [allow.authenticated()])
  .handler(a.handler.function(myFunctionHandler)),
```

## S3 Storage Pattern

### 3-Tier Storage Structure

```
images/
├── original/     # Full-size uploads
├── compressed/   # ≤4MB for AI processing
└── thumbnail/    # ≤100KB for gallery
```

### S3 Event Trigger

```typescript
storageBucket.addEventNotification(
  EventType.OBJECT_CREATED,
  new LambdaDestination(backend.processImage.resources.lambda),
  { prefix: 'images/original/' }
);
```

## SQS Queue Pattern

```typescript
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Duration, Stack } from 'aws-cdk-lib';

const stack = Stack.of(backend.data.resources.graphqlApi);

// Dead Letter Queue
const dlq = new sqs.Queue(stack, 'MyDLQ', {
  queueName: 'my-dlq',
  retentionPeriod: Duration.days(14),
});

// Main Queue
const queue = new sqs.Queue(stack, 'MyQueue', {
  queueName: 'my-queue',
  visibilityTimeout: Duration.minutes(15),
  retentionPeriod: Duration.days(7),
  deadLetterQueue: {
    queue: dlq,
    maxReceiveCount: 3,
  },
});

// Export URLs
backend.addOutput({
  custom: {
    queueUrl: queue.queueUrl,
    queueArn: queue.queueArn,
  },
});
```

## Secrets Management

```bash
# Store secret
printf "your-secret-value" | npx ampx sandbox secret set SECRET_NAME

# Use in function
import { defineFunction, secret } from '@aws-amplify/backend';

export const myFunction = defineFunction({
  name: 'myFunction',
  environment: {
    API_KEY: secret('SECRET_NAME'),
  },
});
```

## Common Commands

```bash
# Start local sandbox
npx ampx sandbox

# Stream function logs
npx ampx sandbox --stream-function-logs

# Filter specific function logs
npx ampx sandbox --logs-filter "functionName"

# Generate GraphQL types
npx ampx generate graphql-client-code

# Delete sandbox
npx ampx sandbox delete
```

## Gotchas

1. **Cross-stack references**: Use wildcard ARNs to avoid cyclic dependencies
2. **Function cold starts**: Keep dependencies minimal
3. **Timeout defaults**: 60s may not be enough for AI operations
4. **Layer ARNs**: Region-specific, update when deploying to different regions
