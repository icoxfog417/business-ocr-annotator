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
- [ ] **Q1**: React app initialization with Amplify Gen2
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
