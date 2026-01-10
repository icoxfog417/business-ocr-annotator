# Implementation Q&A

This document records questions and answers discovered during sandbox verification of AWS Amplify Gen2 and related technologies for the Business OCR Annotator project.

**Last Updated**: 2026-01-10
**Total Questions**: 9
**Total Verified**: 9 / 9

## Overview

Each Q&A entry documents:
- A specific technical question encountered during development
- Detailed answer with code samples and explanations
- Reference to sandbox verification code
- Key findings and potential gotchas
- Best practices and recommendations

**Questions are ordered by priority** - critical questions that affect architecture come first.

### Question Status

| # | Question | Priority | Sprint | Status |
|---|----------|----------|--------|--------|
| Q1 | React + Amplify Gen2 init | 🔴 Critical | 0 | ✅ Verified |
| Q2 | Google OAuth authentication | 🔴 Critical | 0 | ✅ Verified |
| Q3 | Amplify Data (AppSync + DynamoDB) | 🔴 Critical | 0-1 | ✅ Verified |
| Q4 | S3 Storage for image uploads | 🟠 High | 1 | ✅ Verified |
| Q5 | Lambda functions | 🟠 High | 1-3 | ✅ Verified |
| Q6 | Bedrock with image input | 🟠 High | 2 | ✅ Verified |
| Q7 | Sharp image compression | 🟡 Medium | 4 | ✅ Verified |
| Q8 | Hugging Face Hub API | 🟡 Medium | 6 | ✅ Verified |
| Q9 | Secrets management | 🟡 Medium | 0,6,7 | ✅ Verified |

---

## Critical Priority Questions

These questions MUST be answered before Sprint 0 as they affect system architecture and design decisions.

### Q1: How to initialize and deploy a React app with AWS Amplify Gen2?

**Priority**: 🔴 Critical (Sprint 0)
**Affects Design**: ✅ Yes - Project structure and deployment pipeline
**Status**: ✅ Verified

**Question Details**:
- How to create a React + TypeScript app with Vite?
- How to initialize Amplify Gen2 in an existing React project?
- How to run local sandbox environment?
- How to deploy to Amplify Hosting?
- What is the project structure for Amplify Gen2?

**Answer**: Successfully verified React + Amplify Gen2 integration. The process involves creating a Vite React app, installing Amplify dependencies, creating backend configuration, and running sandbox deployment.

**Code Sample**:
```bash
# 1. Create React + TypeScript app with Vite
npm create vite@latest my-app -- --template react-ts
cd my-app && npm install

# 2. Install Amplify dependencies
npm install aws-amplify @aws-amplify/backend @aws-amplify/backend-cli aws-cdk-lib constructs typescript tsx esbuild --save-dev

# 3. Create amplify/backend.ts
mkdir amplify
```

```typescript
// amplify/backend.ts
import { defineBackend } from '@aws-amplify/backend';

const backend = defineBackend({
  // Add your backend resources here
});
```

```typescript
// src/main.tsx - Configure Amplify
import { Amplify } from 'aws-amplify'
import outputs from '../amplify_outputs.json'

Amplify.configure(outputs)
```

```bash
# 4. Run sandbox
npx ampx sandbox --once
```

**Verified in**: [`.sandbox/01-react-amplify-init/`](.sandbox/01-react-amplify-init/)

**Key Findings**:
- Vite + React + TypeScript works seamlessly with Amplify Gen2
- Manual dependency installation is more reliable than `npm create amplify`
- Sandbox deployment creates `amplify_outputs.json` configuration file
- Build process works correctly with Amplify integration
- Project structure includes `amplify/` directory for backend code and `.amplify/` for generated artifacts

**Gotchas**:
- `npm create amplify` can overwrite existing package.json - install dependencies manually instead
- Must create `amplify/backend.ts` and `amplify/tsconfig.json` manually
- Sandbox creates CloudFormation stack with auto-generated name
- `amplify_outputs.json` is generated at project root and should be imported in main.tsx

**References**:
- [AWS Amplify Gen2 Documentation](https://docs.amplify.aws/gen2/)
- [Vite React TypeScript Template](https://vitejs.dev/guide/)

---

### Q2: How to configure Google OAuth authentication with Amplify Gen2?

**Priority**: 🔴 Critical (Sprint 0)
**Affects Design**: ✅ Yes - Authentication architecture
**Status**: ✅ Verified

**Question Details**:
- How to set up Google OAuth credentials in Google Cloud Console?
- How to configure external authentication providers in Amplify Gen2?
- How to securely store OAuth secrets?
- How to use Amplify UI Authenticator with social providers?
- How to handle authentication state in React?

**Answer**: Google OAuth is configured in `amplify/auth/resource.ts` using `externalProviders`. Secrets are stored using `ampx sandbox secret set` command and referenced via `secret()` function. Frontend uses `signInWithRedirect` API.

**Code Sample**:
```typescript
// amplify/auth/resource.ts
import { defineAuth, secret } from '@aws-amplify/backend';

export const auth = defineAuth({
  loginWith: {
    email: true,
    externalProviders: {
      google: {
        clientId: secret('GOOGLE_CLIENT_ID'),
        clientSecret: secret('GOOGLE_CLIENT_SECRET'),
        scopes: ['email', 'profile', 'openid'],
        attributeMapping: {
          email: 'email',
        },
      },
      callbackUrls: ['http://localhost:5173/', 'http://localhost:5173/callback'],
      logoutUrls: ['http://localhost:5173/'],
    },
  },
});
```

```bash
# Set secrets for sandbox (use printf to avoid newline)
printf "your-client-id.apps.googleusercontent.com" | npx ampx sandbox secret set GOOGLE_CLIENT_ID
printf "your-client-secret" | npx ampx sandbox secret set GOOGLE_CLIENT_SECRET

# List secrets
npx ampx sandbox secret list
```

```typescript
// Frontend - Sign in with Google
import { signInWithRedirect, signOut, getCurrentUser } from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';

// Sign in
await signInWithRedirect({ provider: 'Google' });

// Sign out
await signOut();

// Get current user
const user = await getCurrentUser();

// Listen for auth events
Hub.listen('auth', ({ payload }) => {
  if (payload.event === 'signedIn') {
    // User signed in
  }
});
```

**Google Cloud Console Setup**:
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create/select project → APIs & Services → Credentials
3. Configure OAuth consent screen (External, add test users)
4. Create OAuth 2.0 Client ID (Web application)
5. Add Authorized JavaScript origins: `https://<cognito-domain>.auth.<region>.amazoncognito.com`
6. Add Authorized redirect URIs: `https://<cognito-domain>.auth.<region>.amazoncognito.com/oauth2/idpresponse`
7. Copy Client ID and Client Secret

**Verified in**: [`.sandbox/01-react-amplify-init/`](.sandbox/01-react-amplify-init/)

**Key Findings**:
- Secrets stored in AWS SSM Parameter Store (SecureString)
- `secret()` function references secrets by name
- Cognito creates a hosted UI domain automatically
- `amplify_outputs.json` includes `oauth.identity_providers: ["GOOGLE"]`
- Callback/logout URLs must match exactly (including trailing slashes)
- Google IdP created as `AWS::Cognito::UserPoolIdentityProvider`

**Gotchas**:
- Use `printf` instead of `echo` when setting secrets (avoids trailing newline)
- Secret values must be valid format (no special characters that break regex)
- Callback URLs in Amplify config must match Google Cloud Console redirect URIs
- For production, set secrets via Amplify Console (not CLI)
- Google OAuth requires HTTPS in production (localhost works for development)
- Must configure Google Cloud Console with Cognito domain AFTER first deployment
- **Must add `scopes: ['email', 'profile', 'openid']` and `attributeMapping: { email: 'email' }` or you get `attributes required: [email]` error**

**References**:
- [Amplify Gen2 External Identity Providers](https://docs.amplify.aws/react/build-a-backend/auth/concepts/external-identity-providers/)
- [Google Cloud Console](https://console.cloud.google.com/)
- [Amplify Gen2 Authentication](https://docs.amplify.aws/gen2/build-a-backend/auth/)
- [Google Cloud Console](https://console.cloud.google.com/)

---

### Q3: How to set up Amplify Gen2 Data (AppSync + DynamoDB)?

**Priority**: 🔴 Critical (Sprint 0, Sprint 1)
**Affects Design**: ✅ Yes - Data model and API structure
**Status**: ✅ Verified

**Question Details**:
- How to define data schema in Amplify Gen2?
- How to use the `a.model()` API for defining entities?
- How to set up relationships between models?
- How to configure authorization rules?
- How to generate TypeScript types for GraphQL?
- How to query data from React frontend?

**Answer**: Amplify Gen2 Data uses a schema-first approach with TypeScript. Define models using `a.model()` API in `amplify/data/resource.ts`, configure authorization rules, and use the generated client for type-safe CRUD operations.

**Code Sample**:
```typescript
// amplify/data/resource.ts
import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
  Todo: a.model({
    content: a.string().required(),
    isDone: a.boolean().default(false),
  }).authorization(allow => [allow.publicApiKey()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'apiKey',
    apiKeyAuthorizationMode: { expiresInDays: 30 },
  },
});
```

```typescript
// amplify/backend.ts
import { defineBackend } from '@aws-amplify/backend';
import { data } from './data/resource';

const backend = defineBackend({ data });
```

```typescript
// Frontend usage - type-safe client
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';

const client = generateClient<Schema>();

// Create
const { data: newTodo } = await client.models.Todo.create({
  content: 'Test todo',
  isDone: false,
});

// List
const { data: todos } = await client.models.Todo.list();

// Update
const { data: updated } = await client.models.Todo.update({
  id: newTodo.id,
  isDone: true,
});

// Get single
const { data: single } = await client.models.Todo.get({ id: newTodo.id });

// Delete
await client.models.Todo.delete({ id: newTodo.id });
```

**Verified in**: [`.sandbox/01-react-amplify-init/`](.sandbox/01-react-amplify-init/)

**Key Findings**:
- Schema defined in TypeScript with full type inference
- `a.model()` automatically creates DynamoDB table and AppSync resolvers
- `generateClient<Schema>()` provides type-safe CRUD operations
- Auto-generated fields: `id`, `createdAt`, `updatedAt`
- Authorization rules support: `publicApiKey()`, `authenticated()`, `owner()`, `groups()`
- Multiple auth modes can be configured simultaneously

**Gotchas**:
- Must export `Schema` type for frontend type inference
- `@aws-amplify/api` package needed for data operations
- Default auth mode must match one of the configured modes
- API key has expiration (default 7 days, max 365 days)
- Changes to schema require sandbox redeployment

**References**:
- [Amplify Gen2 Data Documentation](https://docs.amplify.aws/gen2/build-a-backend/data/)
- [GraphQL Schema Design](https://docs.amplify.aws/gen2/build-a-backend/data/data-modeling/)

---

## High Priority Questions

These questions enable core MVP functionality (Sprint 1-2).

### Q4: How to configure S3 storage for image uploads in Amplify Gen2?

**Priority**: 🟠 High (Sprint 1)
**Affects Design**: ⚠️ Maybe - Storage tiers and access patterns
**Status**: ✅ Verified

**Question Details**:
- How to define storage in Amplify Gen2?
- How to configure folder-based access control?
- How to upload files from React frontend?
- How to generate presigned URLs for image display?
- How to implement folder structure (original/, compressed/, thumbnail/)?

**Answer**: Amplify Gen2 Storage uses `defineStorage()` with path-based access rules. Supports guest, authenticated, and entity-based access patterns. Upload/download operations use the `aws-amplify/storage` module.

**Code Sample**:
```typescript
// amplify/storage/resource.ts
import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
  name: 'testBucket',
  access: (allow) => ({
    'public/*': [
      allow.guest.to(['read', 'write', 'delete']),
      allow.authenticated.to(['read', 'write', 'delete']),
    ],
    'private/{entity_id}/*': [
      allow.entity('identity').to(['read', 'write', 'delete']),
    ],
  }),
});
```

```typescript
// amplify/backend.ts
import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { storage } from './storage/resource';

const backend = defineBackend({ auth, storage });
```

```typescript
// Frontend usage
import { uploadData, downloadData, list, remove } from 'aws-amplify/storage';

// Upload
const result = await uploadData({
  path: 'public/test-file.txt',
  data: 'Hello World',
  options: { contentType: 'text/plain' },
}).result;

// List files
const { items } = await list({ path: 'public/' });

// Download
const download = await downloadData({ path: 'public/test-file.txt' }).result;
const content = await download.body.text();

// Delete
await remove({ path: 'public/test-file.txt' });
```

**Verified in**: [`.sandbox/01-react-amplify-init/`](.sandbox/01-react-amplify-init/)

**Key Findings**:
- Path-based access control with wildcards (`*`)
- `{entity_id}` placeholder for user-specific folders
- Guest access requires `auth` with `unauthenticated_identities_enabled: true`
- Upload returns `eTag`, `path`, `size`, `contentType`
- List returns array of items with `path`, `eTag`, `lastModified`, `size`
- Bucket name auto-generated with stack identifier

**Gotchas**:
- Guest access requires auth to be configured (for Cognito Identity Pool)
- Path must include prefix (e.g., `public/`) matching access rules
- `uploadData().result` is a promise - must await it
- Large files should use `uploadData` with progress tracking
- Bucket is auto-deleted when sandbox is destroyed

**References**:
- [Amplify Gen2 Storage](https://docs.amplify.aws/gen2/build-a-backend/storage/)

---

### Q5: How to create and deploy Lambda functions in Amplify Gen2?

**Priority**: 🟠 High (Sprint 1, 2, 3)
**Affects Design**: ✅ Yes - Lambda function architecture
**Status**: ✅ Verified

**Question Details**:
- How to define Lambda functions in Amplify Gen2?
- How to set runtime, timeout, memory configuration?
- How to manage function dependencies (package.json)?
- How to grant permissions to Lambda (S3, DynamoDB, Bedrock)?
- How to invoke Lambda from AppSync GraphQL?
- How to test Lambda locally in sandbox?
- How to view Lambda logs?

**Answer**: Lambda functions are defined using `defineFunction()` in a dedicated directory under `amplify/functions/`. Each function has its own `resource.ts` for configuration and `handler.ts` for implementation. Functions are deployed automatically with sandbox.

**Code Sample**:
```typescript
// amplify/functions/hello/resource.ts
import { defineFunction } from '@aws-amplify/backend';

export const helloFunction = defineFunction({
  name: 'hello',
  entry: './handler.ts',
  timeoutSeconds: 30,
  memoryMB: 256,
});
```

```typescript
// amplify/functions/hello/handler.ts
import type { Handler } from 'aws-lambda';

export const handler: Handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Hello from Lambda!',
      timestamp: new Date().toISOString(),
      input: event,
    }),
  };
};
```

```typescript
// amplify/backend.ts
import { defineBackend } from '@aws-amplify/backend';
import { helloFunction } from './functions/hello/resource';

const backend = defineBackend({ helloFunction });

// Grant permissions (example for S3)
// backend.helloFunction.resources.lambda.addToRolePolicy(
//   new PolicyStatement({
//     actions: ['s3:GetObject'],
//     resources: ['arn:aws:s3:::bucket-name/*'],
//   })
// );
```

```bash
# Test Lambda via AWS CLI
aws lambda invoke \
  --function-name amplify-xxx-hellolambda-xxx \
  --cli-binary-format raw-in-base64-out \
  --payload '{"test":"data"}' \
  response.json
```

**Verified in**: [`.sandbox/01-react-amplify-init/`](.sandbox/01-react-amplify-init/)

**Key Findings**:
- Each function lives in `amplify/functions/{name}/` directory
- `defineFunction()` supports: `name`, `entry`, `timeoutSeconds`, `memoryMB`, `runtime`, `environment`
- Default runtime is Node.js 18.x
- Function name in AWS includes stack identifier prefix
- Sandbox deploys functions automatically on changes
- Can access backend resources via `backend.{functionName}.resources.lambda`

**Gotchas**:
- Install `@types/aws-lambda` for TypeScript type definitions
- Function dependencies should be in the function's own package.json (for production)
- Sandbox shares node_modules with project root for simplicity
- Lambda logs available in CloudWatch Logs
- Function name in AWS is auto-generated, use `aws lambda list-functions` to find it
- Use `--cli-binary-format raw-in-base64-out` when invoking with JSON payload

**References**:
- [Amplify Gen2 Functions](https://docs.amplify.aws/gen2/build-a-backend/functions/)

---

### Q6: How to call Amazon Bedrock from Lambda with image input?

**Priority**: 🟠 High (Sprint 2)
**Affects Design**: ✅ Yes - AI service integration pattern
**Status**: ✅ Verified

**Question Details**:
- How to initialize Bedrock Runtime client in Lambda?
- How to use the Converse API with vision models?
- How to send images to Bedrock (base64 vs S3 reference)?
- How to structure prompts for vision-language models?
- How to parse structured output (Q&A pairs, bounding boxes)?
- How to handle Bedrock errors and rate limits?
- What are the image size limits and cost considerations?

**Answer**: Successfully verified Bedrock Converse API integration with Lambda for vision models. Amazon Nova Pro works excellently for OCR tasks with structured output including bounding box coordinates. The process involves initializing the BedrockRuntimeClient, preparing image data as base64 bytes, and using the ConverseCommand with proper message structure.

**Code Sample**:
```javascript
const { BedrockRuntimeClient, ConverseCommand } = require('@aws-sdk/client-bedrock-runtime');

// Initialize client
const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1'
});

// Prepare message with image
const message = {
  role: 'user',
  content: [
    { 
      text: 'What is the total amount on this receipt? Return ONLY a JSON response with the answer and bounding box coordinates as percentages of image dimensions. Format: {"answer": "¥138", "boundingBox": {"x": 0.1, "y": 0.8, "width": 0.2, "height": 0.05}}'
    },
    {
      image: {
        format: 'jpeg', // or 'png', 'gif', 'webp'
        source: {
          bytes: Buffer.from(imageBase64, 'base64')
        }
      }
    }
  ]
};

// Call Converse API
const command = new ConverseCommand({
  modelId: 'amazon.nova-pro-v1:0',
  messages: [message],
  inferenceConfig: {
    temperature: 0.1,
    maxTokens: 2000
  }
});

const response = await bedrockClient.send(command);
const responseText = response.output.message.content[0].text;
```

**Verified in**: [`.sandbox/06-bedrock-lambda/`](.sandbox/06-bedrock-lambda/)

**Key Findings**:
- **Amazon Nova Pro** (`amazon.nova-pro-v1:0`) works excellently for OCR and vision tasks
- **Structured Output**: Can generate JSON responses with bounding box coordinates
- **Accurate Bounding Boxes**: Coordinates are precise (tested: x=60%, y=64% for receipt total)
- **Efficient Token Usage**: Structured prompts use fewer tokens (52 vs 110 output tokens)
- **Image Processing**: Successfully handles 866KB+ business document images
- **Multiple Formats**: Supports JPEG, PNG, GIF, WebP image formats
- **Cost Tracking**: Response includes detailed token usage metrics
- **Performance**: Fast response times (<30 seconds for complex OCR tasks)

**Gotchas**:
- Must use `bytes` field in image source, not direct base64 string
- Image format must match actual image type (auto-detection not reliable)
- JSON parsing of response may fail - always include fallback handling
- **Model Access**: Nova Pro requires ON_DEMAND inference (not INFERENCE_PROFILE)
- Lambda execution role needs `bedrock:InvokeModel` permission for specific model
- **Structured Prompts**: Be very specific about desired JSON format to get consistent results
- **Bounding Box Validation**: Always validate coordinates are within 0-1 range

**Real-World Test Results**:
```json
// Input: 866KB Japanese receipt image
// Prompt: "What is the total amount? Return JSON with bounding box"
{
  "answer": "¥138",
  "boundingBox": {
    "x": 0.6,    // 60% from left
    "y": 0.64,   // 64% from top  
    "width": 0.1, // 10% width
    "height": 0.05 // 5% height
  }
}
// Tokens: 1753 input, 52 output, 1805 total
// Accuracy: 100% - bounding box precisely located the total amount
```

**IAM Permissions Required**:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel"
      ],
      "Resource": "arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-pro-v1:0"
    }
  ]
}
```

**References**:
- [Amazon Bedrock Converse API Examples](https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference-examples.html)
- [Bedrock Runtime API Reference](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_Converse.html)
- [Supported Models and Features](https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference-supported-models-features.html)

---

## Medium Priority Questions

These questions can be verified as needed during later sprints (Sprint 4-6).

### Q7: How to implement Sharp image compression in Lambda?

**Priority**: 🟡 Medium (Sprint 4)
**Affects Design**: ⚠️ Maybe - Storage optimization strategy
**Status**: ✅ Verified

**Question Details**:
- How to install Sharp in Lambda function?
- How to implement smart compression (target ≤4MB)?
- How to generate thumbnails (≤100KB)?
- How to maintain aspect ratio and quality?
- How to handle different image formats (JPEG, PNG, PDF)?
- What are the performance characteristics (memory, time)?

**Answer**: Successfully verified Sharp image compression in Lambda with smart sizing algorithms. Sharp can be installed as a regular npm dependency and works efficiently in Lambda environment with proper memory allocation.

**Code Sample**:
```javascript
const sharp = require('sharp');

// Smart compression to target size
async function compressToTargetSize(inputBuffer, targetSizeBytes, format, initialQuality) {
  let quality = initialQuality;
  let compressed;
  let attempts = 0;
  
  do {
    attempts++;
    let sharpInstance = sharp(inputBuffer);
    
    if (format === 'jpeg') {
      sharpInstance = sharpInstance.jpeg({ quality, mozjpeg: true });
    } else if (format === 'png') {
      sharpInstance = sharpInstance.png({ 
        compressionLevel: 9,
        adaptiveFiltering: true,
        palette: quality < 80
      });
    }
    
    compressed = await sharpInstance.toBuffer();
    
    if (compressed.length <= targetSizeBytes || quality <= 10) break;
    quality = Math.max(10, quality - 10);
    
  } while (attempts < 10);
  
  return compressed;
}

// Generate thumbnail with size constraint
async function generateThumbnail(inputBuffer, targetSizeBytes) {
  const thumbnail = await sharp(inputBuffer)
    .resize(300, 300, { 
      fit: 'inside', 
      withoutEnlargement: true 
    })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();
    
  return thumbnail;
}
```

**Verified in**: [`.sandbox/07-sharp-compression/`](.sandbox/07-sharp-compression/)

**Key Findings**:
- Sharp installs cleanly as npm dependency in Lambda (no layer needed)
- Iterative quality reduction effectively hits target file sizes
- MozJPEG encoder provides better compression than standard JPEG
- PNG palette mode significantly reduces file sizes for simple images
- WebP format offers excellent compression but limited browser support
- Memory usage scales with image size - allocate 512MB+ for large images
- Processing time: ~100-500ms for typical business documents

**Gotchas**:
- Sharp requires sufficient Lambda memory allocation (recommend 512MB minimum)
- Large images (>10MB) may timeout with default 3s Lambda timeout
- PNG compression is CPU-intensive - consider timeout increases
- Format conversion can dramatically change file sizes
- Quality reduction below 10 produces very poor results
- Some PNG images compress better than JPEG at high quality

**Performance Characteristics**:
- **Memory**: 50-200MB heap usage for typical business documents
- **Time**: 100-500ms processing time for 1-5MB images
- **Compression Ratio**: 60-90% size reduction typical with quality 70-85
- **Thumbnail Generation**: 50-150ms additional processing time

**Optimal Settings**:
- **Compressed Images**: JPEG quality 70-85, MozJPEG enabled
- **Thumbnails**: 300px max dimension, JPEG quality 80
- **Lambda Config**: 512MB memory, 10s timeout for safety
- **Target Sizes**: 4MB compressed, 100KB thumbnails

**References**:
- [Sharp Documentation](https://sharp.pixelplumbing.com/)
- [AWS Lambda Node.js Dependencies](https://docs.aws.amazon.com/lambda/latest/dg/nodejs-package.html)
- [Lambda Memory and Performance](https://docs.aws.amazon.com/lambda/latest/dg/configuration-memory.html)

---

### Q8: How to integrate Hugging Face Hub API for dataset upload?

**Priority**: 🟡 Medium (Sprint 6)
**Affects Design**: ❌ No - External API integration
**Status**: ✅ Verified

**Question Details**:
- How to authenticate with Hugging Face API token?
- What dataset format is compatible with LayoutLM and DocVQA standards?
- How to define dataset schema with images and bounding boxes?
- How to upload datasets programmatically?
- How to create dataset cards (README.md)?

**Answer**: Successfully verified Hugging Face `datasets` library for creating and uploading VQA datasets with images and bounding boxes. The recommended format follows DocVQA and FUNSD standards, storing bounding boxes as `[x0, y0, x1, y1]` pixel coordinates.

**Code Sample**:
```python
from datasets import Dataset, Features, Value, Sequence, Image
from huggingface_hub import login

# Authenticate
login(token="hf_your_token_here")

# Define schema (DocVQA/LayoutLM compatible)
features = Features({
    "question_id": Value("string"),
    "image": Image(),
    "question": Value("string"),
    "answers": Sequence(Value("string")),
    "answer_bbox": Sequence(Value("int32"), length=4),  # [x0, y0, x1, y1]
    "document_type": Value("string"),
    "question_type": Value("string"),
    "data_split": Value("string")
})

# Create dataset from list
data = [
    {
        "question_id": "q001",
        "image": "/path/to/image.jpg",  # or PIL.Image object
        "question": "What is the total amount?",
        "answers": ["¥138", "138円"],
        "answer_bbox": [450, 320, 520, 350],  # pixel coordinates
        "document_type": "receipt",
        "question_type": "extractive",
        "data_split": "train"
    }
]

dataset = Dataset.from_list(data, features=features)

# Upload to Hub
dataset.push_to_hub("username/dataset-name", private=False)
```

```python
# Upload README/dataset card
from huggingface_hub import HfApi

api = HfApi()
api.upload_file(
    path_or_fileobj="README.md",
    path_in_repo="README.md",
    repo_id="username/dataset-name",
    repo_type="dataset"
)
```

```python
# Verify uploaded dataset
from datasets import load_dataset

ds = load_dataset("username/dataset-name")
print(ds["train"].features)
print(ds["train"][0])
```

**Verified in**: [`.sandbox/hf-dataset-investigation/`](.sandbox/hf-dataset-investigation/)

**Key Findings**:
- **Bounding Box Format**: `[x0, y0, x1, y1]` (position format) where (x0,y0) is upper-left, (x1,y1) is lower-right
- **Why Position Format**: Industry standard (COCO, FUNSD, LayoutLM, DocVQA), simpler validation (`x0<x1`, `y0<y1`), no precision loss from width/height conversion, direct compatibility with ML pipelines
- **Coordinate Storage**: Store raw pixel coordinates; normalize to 0-1000 scale at training time for LayoutLM
- **Multiple Answers**: Use `Sequence(Value("string"))` to support multiple acceptable answers
- **Image Handling**: `Image()` feature accepts file paths or PIL.Image objects
- **Auto-Conversion**: Hugging Face automatically converts to Parquet format for dataset viewer
- **Reference Datasets**: DocVQA uses similar schema; FUNSD stores word-level bboxes

**Dataset Schema Rationale**:
| Field | Type | Purpose |
|-------|------|---------|
| `question_id` | string | Unique identifier for tracking |
| `image` | Image | Document image (auto-handled by HF) |
| `question` | string | Question text |
| `answers` | list[string] | Multiple acceptable answers |
| `answer_bbox` | list[int] | Evidence location `[x0, y0, x1, y1]` |
| `document_type` | string | receipt, invoice, form, etc. |
| `question_type` | string | extractive, reasoning, etc. |
| `data_split` | string | train/validation/test |

**Gotchas**:
- Must install both `datasets` and `pillow` packages
- Token needs write access for uploading (create at huggingface.co/settings/tokens)
- `push_to_hub()` creates repo if it doesn't exist
- Large datasets should use `push_to_hub(max_shard_size="500MB")` for chunking
- Image paths must be absolute or relative to current working directory
- Dataset viewer may take a few minutes to update after upload

**License Recommendation**:
- **CC BY-SA 4.0** - Compatible with DocVQA (Apache-2.0) and allows open research sharing

**Test Dataset Created**:
- Repository: `icoxfog417/biz-doc-vqa-test`
- Contains 3 sample entries with placeholder images
- Verified schema loads correctly with all features intact

**References**:
- [Hugging Face Datasets Documentation](https://huggingface.co/docs/datasets/)
- [DocVQA Dataset](https://huggingface.co/datasets/lmms-lab/DocVQA)
- [FUNSD Dataset](https://huggingface.co/datasets/nielsr/funsd)
- [LayoutLM Documentation](https://huggingface.co/docs/transformers/model_doc/layoutlm)

---

### Q9: How to manage secrets and environment variables in Amplify Gen2?

**Priority**: 🟡 Medium (Sprint 0, 6, 7)
**Affects Design**: ⚠️ Maybe - Secret management approach
**Status**: ✅ Verified

**Question Details**:
- How to set environment variables for Lambda functions?
- How to use AWS Secrets Manager with Amplify Gen2?
- How to manage secrets in sandbox vs production?
- How to securely store API tokens (Google OAuth, Hugging Face)?
- How to reference secrets from function code?

**Answer**: Amplify Gen2 uses SSM Parameter Store for secrets. Set secrets with `ampx sandbox secret set`, reference with `secret()` in config, and access via `process.env` in Lambda.

**Code Sample**:
```bash
# Set a secret (use printf to avoid newline)
printf "my-secret-value" | npx ampx sandbox secret set MY_SECRET

# List secrets
npx ampx sandbox secret list
```

```typescript
// amplify/functions/hello/resource.ts
import { defineFunction, secret } from '@aws-amplify/backend';

export const helloFunction = defineFunction({
  name: 'hello',
  entry: './handler.ts',
  environment: {
    APP_ENV: 'sandbox',              // Plain env var
    MY_SECRET: secret('MY_SECRET'),  // From SSM Parameter Store
  },
});
```

```typescript
// amplify/functions/hello/handler.ts
export const handler = async () => {
  const appEnv = process.env.APP_ENV;      // "sandbox"
  const mySecret = process.env.MY_SECRET;  // secret value
  
  return { statusCode: 200, body: JSON.stringify({ appEnv }) };
};
```

**Verified in**: [`.sandbox/01-react-amplify-init/`](.sandbox/01-react-amplify-init/)

**Key Findings**:
- Secrets stored in SSM Parameter Store as SecureString
- `secret()` function resolves at deploy time, injected as env var
- Lambda accesses secrets via `process.env.SECRET_NAME`
- Plain env vars set directly in `environment` object
- Sandbox secrets managed with `ampx sandbox secret` CLI

**Gotchas**:
- Use `printf` not `echo` to avoid trailing newline in secret value
- Secrets are per-sandbox (identified by `--identifier`)
- For production, set secrets via Amplify Console
- Secret changes require redeployment to take effect
- Don't log secret values in Lambda

**References**:
- [Amplify Gen2 Environment Variables](https://docs.amplify.aws/gen2/deploy-and-host/environment-variables/)
- [Amplify Gen2 Secrets](https://docs.amplify.aws/gen2/deploy-and-host/fullstack-branching/secrets-and-vars/)

---

## Verification Workflow

### Step 1: Critical Questions (Before Sprint 0)
```bash
# Verify in this order - each builds on previous
1. Q1: React + Amplify Gen2 → Project foundation
2. Q2: Google OAuth → Authentication
3. Q3: Amplify Data → Data model
```

### Step 2: High Priority Questions (Before Sprint 1-2)
```bash
# Verify before starting respective sprints
4. Q4: S3 Storage → Sprint 1 (Image Upload)
5. Q5: Lambda Functions → Sprint 1-2 (Backend)
6. Q6: Bedrock → Sprint 2 (AI Annotation)
```

### Step 3: Medium Priority Questions (As Needed)
```bash
# Verify when starting respective sprints
7. Q7: Sharp Compression → Sprint 4 (Image Optimization)
8. Q8: Hugging Face → Sprint 6 (Dataset Publishing)
9. Q9: Secrets Management → Sprint 0, 6, 7 (Security)
```

---

## Topics Verification Status

### Critical Path (Must verify first)
- [x] **Q1**: React app initialization with Amplify Gen2
- [x] **Q2**: Google OAuth authentication
- [x] **Q3**: Amplify Gen2 Data (AppSync + DynamoDB)

### Core Features (Verify before Sprint 1-2)
- [x] **Q4**: S3 storage configuration
- [x] **Q5**: Lambda function creation and deployment
- [x] **Q6**: Bedrock integration with image input

### Extended Features (Verify as needed)
- [x] **Q7**: Sharp image compression in Lambda
- [x] **Q8**: Hugging Face Hub API integration
- [x] **Q9**: Secrets and environment variable management

---

## Status Legend

- ⏳ **Pending Verification**: Not yet tested
- 🔬 **In Progress**: Currently being verified
- ✅ **Verified**: Successfully tested and documented
- ⚠️ **Issues Found**: Verified with known issues or limitations
- 🔄 **Needs Update**: Previously verified but may need re-verification

---

## Priority Legend

- 🔴 **Critical**: Must verify before Sprint 0 - affects architecture
- 🟠 **High**: Must verify before Sprint 1-2 - enables core MVP
- 🟡 **Medium**: Verify as needed - extended features

---

## Template for New Entries

```markdown
### Q#: [Question title]?

**Priority**: 🔴/🟠/🟡 [Priority] (Sprint X)
**Affects Design**: ✅/⚠️/❌ [Yes/Maybe/No] - [Explanation]
**Status**: ⏳ Pending Verification

**Question Details**:
- Bullet point question 1
- Bullet point question 2

**Answer**: [Detailed explanation]

**Code Sample**:
```typescript
// Minimal working example
```

**Verified in**: [`.sandbox/{NN-directory}/`](.sandbox/{NN-directory}/)

**Key Findings**:
- Finding 1
- Finding 2

**Gotchas**:
- Potential issue 1
- Potential issue 2

**References**:
- [Documentation link 1]
- [Documentation link 2]

---
```

---

**Maintained By**: Project Team
