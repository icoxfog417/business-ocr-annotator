# Implementation Q&A

This document records questions and answers discovered during sandbox verification of AWS Amplify Gen2 and related technologies for the Business OCR Annotator project.

**Last Updated**: 2026-01-08
**Total Questions**: 9
**Total Verified**: 1 / 9

## Overview

Each Q&A entry documents:
- A specific technical question encountered during development
- Detailed answer with code samples and explanations
- Reference to sandbox verification code
- Key findings and potential gotchas
- Best practices and recommendations

**Questions are ordered by priority** - critical questions that affect architecture come first.

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

**Answer**:

1. **Create React + TypeScript App with Vite**:
```bash
npm create vite@latest app-name -- --template react-ts
cd app-name
npm install
```

2. **Initialize Amplify Gen2**:
```bash
# Run from React app root directory (where package.json is)
npm create amplify@latest -- --yes
```

This command automatically:
- Installs `aws-amplify` (runtime) and `@aws-amplify/backend`, `@aws-amplify/backend-cli`, `aws-cdk-lib` (dev dependencies)
- Creates `amplify/` directory with auth, data resources pre-configured
- Generates `amplify/backend.ts` as the main backend definition

3. **Project Structure**:
```
app-name/
├── amplify/                    # Backend resources (Infrastructure as Code)
│   ├── auth/
│   │   └── resource.ts         # Auth config (email by default)
│   ├── data/
│   │   └── resource.ts         # GraphQL schema (Todo example)
│   ├── backend.ts              # Main backend definition
│   ├── package.json            # Backend config
│   └── tsconfig.json           # Backend TypeScript config
├── src/                        # Frontend React code
├── package.json                # Project dependencies
└── vite.config.ts              # Vite configuration
```

4. **Run Local Sandbox**:
```bash
npx ampx sandbox
```

This starts a local cloud sandbox that:
- Deploys backend to AWS in dev environment
- Watches for file changes and auto-deploys
- Generates `amplify_outputs.json` for frontend configuration
- Streams function logs (optional: `--stream-function-logs`)

**Code Sample**:
```typescript
// amplify/backend.ts - Main backend definition
import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';

defineBackend({
  auth,
  data,
  // Add more resources: storage, functions, etc.
});

// amplify/auth/resource.ts - Email authentication
import { defineAuth } from '@aws-amplify/backend';

export const auth = defineAuth({
  loginWith: {
    email: true,
    // Can add social providers: google, facebook, etc.
  },
});

// amplify/data/resource.ts - GraphQL schema
import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
  Todo: a
    .model({
      content: a.string(),
    })
    .authorization((allow) => [allow.guest()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'identityPool',
  },
});
```

**Verified in**: [`.sandbox/01-react-amplify-init/`](.sandbox/01-react-amplify-init/)

**Key Findings**:
- ✅ Amplify Gen2 uses **TypeScript-first** approach for backend configuration
- ✅ **Modular structure** - each resource (auth, data, storage) in separate file
- ✅ **Type-safe** - Full TypeScript support with generated types for GraphQL
- ✅ **Default configurations** provided (email auth, Todo example) - easy to modify
- ✅ **IaC (Infrastructure as Code)** - All backend config version-controlled
- ✅ **AWS CDK under the hood** - Powerful infrastructure abstraction
- ✅ **Sandbox environment** isolates dev from production
- ✅ **Watch mode** auto-deploys changes during development

**Gotchas**:
- ⚠️ Must run `npm create amplify` from React app **root directory** (where package.json is)
- ⚠️ Cannot re-run initialization if `amplify/` directory already exists
- ⚠️ Requires **AWS credentials** configured (`aws configure`) before running sandbox
- ⚠️ Requires **interactive terminal** for sandbox deployment (doesn't work well in background)
- ⚠️ **Backend TypeScript** uses separate tsconfig.json for CDK compilation
- ⚠️ Default auth mode is `identityPool` (allows guest access) - change for production
- ⚠️ Sandbox deploys to **actual AWS account** - not fully local (uses AWS resources)
- ⚠️ Each developer gets isolated sandbox environment (by system username)
- ⚠️ **Permissions required**: CloudFormation, Cognito, AppSync, DynamoDB, IAM
- ⚠️ First deployment can take **5-10 minutes** (creates multiple AWS resources)

**References**:
- [AWS Amplify Gen2 Documentation](https://docs.amplify.aws/gen2/)
- [Vite React TypeScript Template](https://vitejs.dev/guide/)
- [Amplify Gen2 Quickstart](https://docs.amplify.aws/gen2/start/quickstart/)
- [Amplify CLI Reference](https://docs.amplify.aws/gen2/reference/cli-commands/)

---

### Q2: How to configure Google OAuth authentication with Amplify Gen2?

**Priority**: 🔴 Critical (Sprint 0)
**Affects Design**: ✅ Yes - Authentication architecture
**Status**: ⏳ Pending Verification

**Question Details**:
- How to set up Google OAuth credentials in Google Cloud Console?
- How to configure external authentication providers in Amplify Gen2?
- How to securely store OAuth secrets?
- How to use Amplify UI Authenticator with social providers?
- How to handle authentication state in React?

**Answer**: [To be documented after verification]

**Verified in**: [`.sandbox/02-google-oauth/`](.sandbox/02-google-oauth/)

**Key Findings**:
- [To be documented]

**Gotchas**:
- [To be documented]

**References**:
- [Amplify Gen2 Authentication](https://docs.amplify.aws/gen2/build-a-backend/auth/)
- [Google Cloud Console](https://console.cloud.google.com/)

---

### Q3: How to set up Amplify Gen2 Data (AppSync + DynamoDB)?

**Priority**: 🔴 Critical (Sprint 0, Sprint 1)
**Affects Design**: ✅ Yes - Data model and API structure
**Status**: ⏳ Pending Verification

**Question Details**:
- How to define data schema in Amplify Gen2?
- How to use the `a.model()` API for defining entities?
- How to set up relationships between models?
- How to configure authorization rules?
- How to generate TypeScript types for GraphQL?
- How to query data from React frontend?

**Answer**: [To be documented after verification]

**Verified in**: [`.sandbox/03-amplify-data/`](.sandbox/03-amplify-data/)

**Key Findings**:
- [To be documented]

**Gotchas**:
- [To be documented]

**References**:
- [Amplify Gen2 Data Documentation](https://docs.amplify.aws/gen2/build-a-backend/data/)
- [GraphQL Schema Design](https://docs.amplify.aws/gen2/build-a-backend/data/data-modeling/)

---

## High Priority Questions

These questions enable core MVP functionality (Sprint 1-2).

### Q4: How to configure S3 storage for image uploads in Amplify Gen2?

**Priority**: 🟠 High (Sprint 1)
**Affects Design**: ⚠️ Maybe - Storage tiers and access patterns
**Status**: ⏳ Pending Verification

**Question Details**:
- How to define storage in Amplify Gen2?
- How to configure folder-based access control?
- How to upload files from React frontend?
- How to generate presigned URLs for image display?
- How to implement folder structure (original/, compressed/, thumbnail/)?

**Answer**: [To be documented after verification]

**Verified in**: [`.sandbox/04-s3-storage/`](.sandbox/04-s3-storage/)

**Key Findings**:
- [To be documented]

**Gotchas**:
- [To be documented]

**References**:
- [Amplify Gen2 Storage](https://docs.amplify.aws/gen2/build-a-backend/storage/)

---

### Q5: How to create and deploy Lambda functions in Amplify Gen2?

**Priority**: 🟠 High (Sprint 1, 2, 3)
**Affects Design**: ✅ Yes - Lambda function architecture
**Status**: ⏳ Pending Verification

**Question Details**:
- How to define Lambda functions in Amplify Gen2?
- How to set runtime, timeout, memory configuration?
- How to manage function dependencies (package.json)?
- How to grant permissions to Lambda (S3, DynamoDB, Bedrock)?
- How to invoke Lambda from AppSync GraphQL?
- How to test Lambda locally in sandbox?
- How to view Lambda logs?

**Answer**: [To be documented after verification]

**Verified in**: [`.sandbox/05-lambda-functions/`](.sandbox/05-lambda-functions/)

**Key Findings**:
- [To be documented]

**Gotchas**:
- [To be documented]

**References**:
- [Amplify Gen2 Functions](https://docs.amplify.aws/gen2/build-a-backend/functions/)

---

### Q6: How to call Amazon Bedrock from Lambda with image input?

**Priority**: 🟠 High (Sprint 2)
**Affects Design**: ✅ Yes - AI service integration pattern
**Status**: ⏳ Pending Verification

**Question Details**:
- How to initialize Bedrock Runtime client in Lambda?
- How to use the Converse API with vision models?
- How to send images to Bedrock (base64 vs S3 reference)?
- How to structure prompts for vision-language models?
- How to parse structured output (Q&A pairs, bounding boxes)?
- How to handle Bedrock errors and rate limits?
- What are the image size limits and cost considerations?

**Answer**: [To be documented after verification]

**Verified in**: [`.sandbox/06-bedrock-lambda/`](.sandbox/06-bedrock-lambda/)

**Key Findings**:
- [To be documented]

**Gotchas**:
- [To be documented]

**References**:
- [Amazon Bedrock Documentation](https://docs.aws.amazon.com/bedrock/)
- [Bedrock Runtime API](https://docs.aws.amazon.com/bedrock/latest/APIReference/welcome.html)
- [Claude 3.5 Sonnet Vision](https://docs.anthropic.com/claude/docs/vision)

---

## Medium Priority Questions

These questions can be verified as needed during later sprints (Sprint 4-6).

### Q7: How to implement Sharp image compression in Lambda?

**Priority**: 🟡 Medium (Sprint 4)
**Affects Design**: ⚠️ Maybe - Storage optimization strategy
**Status**: ⏳ Pending Verification

**Question Details**:
- How to install Sharp in Lambda function?
- How to implement smart compression (target ≤4MB)?
- How to generate thumbnails (≤100KB)?
- How to maintain aspect ratio and quality?
- How to handle different image formats (JPEG, PNG, PDF)?
- What are the performance characteristics (memory, time)?

**Answer**: [To be documented after verification]

**Verified in**: [`.sandbox/07-sharp-compression/`](.sandbox/07-sharp-compression/)

**Key Findings**:
- [To be documented]

**Gotchas**:
- [To be documented]

**References**:
- [Sharp Documentation](https://sharp.pixelplumbing.com/)
- [AWS Lambda Sharp Layer](https://github.com/Umkus/lambda-layer-sharp)

---

### Q8: How to integrate Hugging Face Hub API from Lambda?

**Priority**: 🟡 Medium (Sprint 6)
**Affects Design**: ❌ No - External API integration
**Status**: ⏳ Pending Verification

**Question Details**:
- How to install @huggingface/hub SDK in Lambda?
- How to authenticate with HF API token?
- How to create a dataset repository?
- How to upload Parquet files?
- How to generate dataset cards (README.md)?
- How to handle API rate limits?

**Answer**: [To be documented after verification]

**Verified in**: [`.sandbox/08-huggingface-integration/`](.sandbox/08-huggingface-integration/)

**Key Findings**:
- [To be documented]

**Gotchas**:
- [To be documented]

**References**:
- [Hugging Face Hub API](https://huggingface.co/docs/huggingface_hub/)
- [Datasets Documentation](https://huggingface.co/docs/datasets/)

---

### Q9: How to manage secrets and environment variables in Amplify Gen2?

**Priority**: 🟡 Medium (Sprint 0, 6, 7)
**Affects Design**: ⚠️ Maybe - Secret management approach
**Status**: ⏳ Pending Verification

**Question Details**:
- How to set environment variables for Lambda functions?
- How to use AWS Secrets Manager with Amplify Gen2?
- How to manage secrets in sandbox vs production?
- How to securely store API tokens (Google OAuth, Hugging Face)?
- How to reference secrets from function code?

**Answer**: [To be documented after verification]

**Verified in**: [`.sandbox/09-secrets-management/`](.sandbox/09-secrets-management/)

**Key Findings**:
- [To be documented]

**Gotchas**:
- [To be documented]

**References**:
- [Amplify Gen2 Environment Variables](https://docs.amplify.aws/gen2/deploy-and-host/environment-variables/)
- [AWS Secrets Manager](https://aws.amazon.com/secrets-manager/)

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
- [x] **Q1**: React app initialization with Amplify Gen2 ✅
- [ ] **Q2**: Google OAuth authentication
- [ ] **Q3**: Amplify Gen2 Data (AppSync + DynamoDB)

### Core Features (Verify before Sprint 1-2)
- [ ] **Q4**: S3 storage configuration
- [ ] **Q5**: Lambda function creation and deployment
- [ ] **Q6**: Bedrock integration with image input

### Extended Features (Verify as needed)
- [ ] **Q7**: Sharp image compression in Lambda
- [ ] **Q8**: Hugging Face Hub API integration
- [ ] **Q9**: Secrets and environment variable management

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
