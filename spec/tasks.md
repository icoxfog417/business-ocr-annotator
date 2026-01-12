# Implementation Tasks

**Project**: Business OCR Annotator
**Last Updated**: 2026-01-11
**Status**: Sprint 2 (AI-Assisted Annotation)
**Approach**: Agile Incremental Development
**Reference**: See [spec/proposals/20260107_reorganize_tasks_agile_approach.md](proposals/20260107_reorganize_tasks_agile_approach.md)

## Task Status Legend

- ⬜ **TODO**: Not started
- 🔄 **IN PROGRESS**: Currently being worked on
- ✅ **DONE**: Completed
- 🚫 **BLOCKED**: Waiting on dependencies or external factors
- ⏸️ **ON HOLD**: Paused temporarily

---

## Agile Development Approach

This task list is organized into **sprints** that deliver working software incrementally. Each sprint includes both frontend and backend tasks necessary to deliver a complete, deployable feature.

**Key Principles:**
- Each sprint delivers a working, deployable application
- Frontend and backend tasks are integrated within each sprint
- User feedback is collected after key sprints (1, 2, 3)
- Infrastructure is built incrementally as needed for features
- Complexity is added gradually based on validated learning

---

## Sprint 0: Foundation & Deployment

**Goal**: Deploy a working authenticated "Hello World" app to AWS
**Duration**: 1-2 weeks
**Deliverable**: Users can log in and see an empty dashboard

### Project Initialization
- ✅ Create React app with Vite and TypeScript
  ```bash
  # Create Vite project (this downloads create-vite temporarily via npx)
  npm create vite@latest business-ocr-annotator -- --template react-ts

  # Enter project directory
  cd business-ocr-annotator

  # Install base dependencies (React, Vite, TypeScript, etc.)
  npm install
  ```

- ✅ Initialize Amplify Gen2 project
  ```bash
  # Add Amplify to existing project (run from project root)
  npm create amplify@latest
  ```
  This creates the `amplify/` directory structure:
  - `amplify/auth/resource.ts`
  - `amplify/data/resource.ts`
  - `amplify/backend.ts`

### Development Environment Setup
- ✅ Install essential dependencies only
  ```bash
  # Install Amplify client libraries (REQUIRED)
  npm install aws-amplify @aws-amplify/ui-react

  # Install Amplify backend development tools (REQUIRED)
  npm install --save-dev @aws-amplify/backend @aws-amplify/backend-cli

  # Install React Router for navigation (REQUIRED)
  npm install react-router-dom

  # Install linting and formatting tools for code quality (REQUIRED)
  npm install --save-dev eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
  npm install --save-dev prettier eslint-config-prettier eslint-plugin-react-hooks

  # Install git hooks for automated quality checks (REQUIRED)
  npm install --save-dev husky lint-staged
  ```

- ✅ Create ESLint configuration `eslint.config.js`
  ```javascript
  module.exports = {
    root: true,
    env: { browser: true, es2020: true },
    extends: [
      'eslint:recommended',
      'plugin:@typescript-eslint/recommended',
      'plugin:react-hooks/recommended',
      'prettier'
    ],
    ignorePatterns: ['dist', '.eslintrc.cjs', 'amplify_outputs.json'],
    parser: '@typescript-eslint/parser',
    plugins: ['react-hooks'],
  };
  ```

- ✅ Create Prettier configuration `.prettierrc`
  ```json
  {
    "semi": true,
    "trailingComma": "es5",
    "singleQuote": true,
    "printWidth": 100,
    "tabWidth": 2
  }
  ```

- ✅ Add lint scripts to `package.json`
  ```json
  {
    "scripts": {
      "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
      "format": "prettier --write \"src/**/*.{ts,tsx,css}\""
    }
  }
  ```

- ✅ Set up Husky for git hooks
  ```bash
  npx husky init
  echo "npm run lint-staged" > .husky/pre-commit
  ```

- ✅ Configure lint-staged in `package.json`
  ```json
  {
    "lint-staged": {
      "*.{ts,tsx}": [
        "prettier --write",
        "eslint --fix"
      ],
      "*.{css,json,md}": [
        "prettier --write"
      ]
    }
  }
  ```

**Note**: Git hooks automatically run linting and formatting before each commit to maintain code quality.

### Authentication Setup (Amplify Gen2)
- ✅ Set up Google OAuth credentials
  - Go to [Google Cloud Console](https://console.cloud.google.com/)
  - Create a new project or use existing one
  - Enable Google+ API
  - Create OAuth 2.0 credentials (OAuth client ID)
  - Add authorized redirect URIs (Amplify will provide these)
  - Save Client ID and Client Secret

- ✅ Configure Google OAuth in `amplify/auth/resource.ts`
  ```typescript
  import { defineAuth } from '@aws-amplify/backend';

  export const auth = defineAuth({
    loginWith: {
      externalProviders: {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        },
        callbackUrls: [
          'http://localhost:5173',  // Vite dev server
          'https://your-app-domain.amplifyapp.com'  // Production
        ],
        logoutUrls: [
          'http://localhost:5173',
          'https://your-app-domain.amplifyapp.com'
        ]
      }
    }
  });
  ```

- ✅ Add Google credentials to environment
  ```bash
  # For local development
  npx ampx sandbox secret set GOOGLE_CLIENT_ID
  npx ampx sandbox secret set GOOGLE_CLIENT_SECRET
  ```
- ✅ Update `amplify/backend.ts` to include auth
  ```typescript
  import { defineBackend } from '@aws-amplify/backend';
  import { auth } from './auth/resource';

  defineBackend({
    auth
  });
  ```
- ✅ Configure Amplify client in frontend
  ```typescript
  // In src/main.tsx
  import { Amplify } from 'aws-amplify';
  import outputs from '../amplify_outputs.json';

  Amplify.configure(outputs);
  ```

- ✅ Add Google OAuth sign-in to App.tsx
  ```typescript
  import { Authenticator } from '@aws-amplify/ui-react';
  import '@aws-amplify/ui-react/styles.css';

  // The Authenticator will automatically show Google sign-in button
  function App() {
    return (
      <Authenticator socialProviders={['google']}>
        {({ signOut, user }) => (
          <main>
            <h1>Hello {user?.username}</h1>
            <button onClick={signOut}>Sign out</button>
          </main>
        )}
      </Authenticator>
    );
  }
  ```

### Basic Frontend Structure
- ✅ Create main layout component with navigation
- ✅ Create empty Dashboard page
- ✅ Set up React Router v6 (already installed above)
- ✅ Implement authenticated routing wrapper
- ✅ Add logout functionality

### Deployment & Testing
- ✅ Start local sandbox environment
  ```bash
  npx ampx sandbox
  ```
- ✅ Test authentication flow locally
- ✅ Configure AWS credentials
  ```bash
  aws configure
  ```
- ✅ Deploy to Amplify Hosting
- ✅ Verify authentication works in deployed app

### Documentation
- ✅ Create README.md
- ✅ Create CLAUDE.md for agent workflow
- ✅ Create spec/requirements.md
- ✅ Create spec/design.md
- ✅ Create spec/tasks.md
- ⬜ Create CONTRIBUTING.md
- ⬜ Create LICENSE file
- ⬜ Document Sprint 0 setup process

**Sprint 0 Acceptance Criteria:**
- ✅ App deployed to AWS Amplify
- ✅ Users can sign in with Google account
- ✅ Users can log out
- ✅ Authenticated users see a dashboard (even if empty)
- ✅ Sandbox environment working locally
- ✅ Google OAuth credentials configured securely

---

## Sprint 1: Image Upload & Manual Annotation (MVP) - ✅ COMPLETED

**Goal**: Upload images and create annotations manually (no AI yet)
**Duration**: 2-3 weeks
**Deliverable**: Working annotation tool with manual Q&A entry

### Storage Setup (Amplify Gen2)
- ✅ Create `amplify/storage/resource.ts`
- ✅ Update `amplify/backend.ts` to include storage
- ✅ Test S3 upload functionality in sandbox

### Data Model Setup (Amplify Gen2)
- ✅ Define minimal data schema in `amplify/data/resource.ts`
- ✅ Add Image and Annotation models with relationships
- ✅ Update `amplify/backend.ts` to include data
- ✅ Generate GraphQL client types
- ✅ Test data operations in sandbox

### Image Upload UI
- ✅ Create FileUpload page with native drag-and-drop
- ✅ Implement file validation (type, size ≤20MB)
- ✅ Add image preview before upload using FileReader API
- ✅ Implement S3 upload using Amplify Storage
- ✅ Save image metadata to DynamoDB via GraphQL
- ✅ Show upload progress indicator
- ✅ Handle upload errors with retry option

### Image Gallery UI
- ✅ Create ImageGallery page
- ✅ Implement image grid with lazy loading
- ✅ Fetch images from GraphQL API
- ✅ Display image thumbnails using S3 presigned URLs
- ✅ Add click to open annotation workspace
- ✅ Implement basic filtering (date, uploaded by)
- ✅ Add image deletion functionality

### Manual Annotation Workspace
- ✅ Create AnnotationWorkspace page with layout
- ✅ Implement ImageViewer component
  - ✅ Display full-size image from S3
  - ✅ Add zoom controls (zoom in, out, reset, fit)
  - ✅ Implement pan functionality
- ✅ Create CanvasAnnotator for bounding boxes
  - ✅ Render image with HTML5 canvas overlay
  - ✅ Implement drag-to-create bounding box
  - ✅ Implement box selection (click to select)
  - ✅ Add delete box functionality
  - ✅ Store coordinates in pixels {x, y, width, height}
- ✅ Create AnnotationForm component
  - ✅ QuestionInput text field
  - ✅ AnswerInput text field
  - ✅ Associate annotation with selected bounding box
  - ✅ Display bounding box coordinates
- ✅ Create AnnotationList component
  - ✅ Display all annotations for current image
  - ✅ Click annotation to highlight its bounding box
  - ✅ Edit/delete existing annotations
- ✅ Implement save functionality (save to DynamoDB via GraphQL)

### Dashboard Updates
- ✅ Display total images count
- ✅ Display total annotations count
- ✅ Show recent uploads list
- ✅ Add navigation to Upload and Gallery pages

**Sprint 1 Acceptance Criteria:**
- ✅ Users can upload images (single or batch)
- ✅ Uploaded images appear in gallery
- ✅ Users can open annotation workspace
- ✅ Users can draw bounding boxes on images
- ✅ Users can manually enter questions and answers
- ✅ Annotations are saved and persisted
- ✅ Users can view, edit, and delete annotations
- ✅ Dashboard shows basic statistics
- ✅ Zoom and pan controls work in annotation workspace
- ✅ GraphQL types are generated and working
- ✅ Sandbox deployment is successful

---

## Sprint 2: AI-Assisted Annotation (Nemotron Integration) - ✅ COMPLETED

**Goal**: Auto-generate annotations using NVIDIA Nemotron Nano 12B
**Duration**: 2-3 weeks
**Deliverable**: One-click AI annotation generation

### Nemotron Setup
- ✅ Research NVIDIA Nemotron Nano 12B deployment options
- ✅ Set up Nemotron model endpoint (via Amazon Bedrock)
- ✅ Configure IAM permissions for Bedrock access
- ⬜ Test model inference with sample images

### Lambda Function for Annotation Generation
- ✅ Create `amplify/functions/generate-annotation/` directory
- ✅ Create `amplify/functions/generate-annotation/resource.ts`
- ✅ Implement handler in `amplify/functions/generate-annotation/handler.ts`
- ✅ Implement Bedrock Converse API integration
  - ✅ Initialize Bedrock client
  - ✅ Create prompt templates for multiple languages (ja, en, zh, ko)
  - ✅ Implement API call with image from S3
  - ✅ Parse response to extract Q&A pairs and bounding boxes
- ✅ Add Lambda environment variables (MODEL_ID, STORAGE_BUCKET_NAME)
- ✅ Grant Lambda permissions to access S3 and Bedrock
- ✅ Store generated annotations in DynamoDB (done via frontend)
- ✅ Add error handling and retry logic
- ✅ Implement CloudWatch logging

### Update Backend Configuration
- ✅ Update `amplify/backend.ts` to include function
- ✅ Add GraphQL custom query/mutation for annotation generation
- ✅ Test Lambda function in sandbox
  ```bash
  npx ampx sandbox --stream-function-logs
  ```

### Default Questions Configuration
- ✅ Add DefaultQuestion model to `amplify/data/resource.ts`
- ✅ Create DefaultQuestionManager admin page (basic fallback implementation)
- ✅ Seed initial default questions for each document type and language (fallback questions)

### Annotation Workflow UI
- ✅ Update AnnotationWorkspace with AI suggestion panel
- ✅ Implement QuestionList with default questions loading
- ✅ Implement AISuggestionList with adopt/reject buttons
- ✅ Implement AnswerEditor with AI suggestion button
- ✅ Implement FinalizeControls with finalize/re-open buttons
- ✅ Add question status indicators (pending/answered)

### Frontend Integration
- ✅ Add "Generate Annotations" button to AnnotationWorkspace
- ✅ Implement API call to Lambda function (with mock fallback)
- ✅ Show loading state during generation (with spinner)
- ✅ Display generated annotations in AISuggestionList
- ✅ Allow users to edit/approve/reject AI annotations
- ✅ Add confidence score display
- ✅ Highlight AI-generated vs manual annotations
- ✅ Handle generation errors gracefully

### Annotation Validation UI
- ✅ Create ValidationControls component (inline in AnnotationWorkspace)
  - ✅ Approve button (green checkmark)
  - ✅ Reject button (orange X)
  - ✅ Delete button
- ✅ Track annotation status (pending, approved, rejected)
- ✅ Update data model to include status field (generatedBy, modelVersion, confidence)
- ✅ Filter annotations by status in AnnotationList

### Contribution Tracking
- ✅ Add ContributionStats component to Dashboard
- ✅ Display AI vs Human annotation counts
- ✅ Display approved vs pending annotation counts

### Image Compression (Moved from Sprint 4)
**Proposal**: See [spec/proposals/20260111_move_compression_to_sprint2.md](proposals/20260111_move_compression_to_sprint2.md)

- ✅ Update data schema with 3-tier storage keys
  - ✅ Replace `s3Key` with `s3KeyOriginal`, `s3KeyCompressed`, `s3KeyThumbnail`
  - ✅ Add `originalSize`, `compressedSize`, `thumbnailSize` fields
  - ✅ Add `PROCESSING` status to ImageStatus enum
- ✅ Update storage structure for 3-tier folders
  - ✅ `images/original/*` - Original uploads
  - ✅ `images/compressed/*` - ≤4MB for AI processing
  - ✅ `images/thumbnail/*` - ≤100KB for gallery
- ✅ Create `amplify/functions/process-image/` directory
- ✅ Create `amplify/functions/process-image/resource.ts`
- ✅ Implement handler with Sharp library
  - ✅ Smart compression to ≤4MB target
  - ✅ Thumbnail generation ≤100KB
  - ✅ Upload to S3 compressed/ and thumbnail/ folders
  - ✅ Update Image record with new keys and sizes
- ✅ Update `amplify/backend.ts` with process-image function
- ✅ Update FileUpload page
  - ✅ Upload to `images/original/` folder
  - ✅ Set status to PROCESSING on upload
  - ✅ Show processing status
- ✅ Set up S3 event trigger for automatic processing
- ✅ Update ImageGallery to use thumbnail URLs
- ✅ Update AnnotationWorkspace to use compressed image URL

### Review Fixes (Post-Implementation)
**Review Document**: See [spec/proposals/20260111_sprint2_compression_review.md](proposals/20260111_sprint2_compression_review.md)

- ✅ P0: Replace DynamoDB Scan with Query using GSI on s3KeyOriginal
- ✅ P1: Fix status progression (PROCESSING → ANNOTATING, not UPLOADED)
- ✅ P1: Add exponential backoff retry for eventual consistency
- ✅ P1: Increase Lambda timeout from 60s to 90s
- ✅ P2: Track compression ratio (originalSize / compressedSize)
- ✅ P2: Track original image format from Sharp metadata

**Sprint 2 Acceptance Criteria:**
- ✅ Users can click "Generate Annotations" button
- ✅ AI generates Q&A pairs with bounding boxes
- ✅ Generated annotations appear in the workspace
- ✅ Users can approve, reject, or edit AI annotations
- ✅ Annotation status is tracked and persisted
- ✅ Error handling works for AI model failures
- ✅ Images are compressed to 3-tier storage (original, compressed ≤4MB, thumbnail ≤100KB)
- ✅ Gallery uses thumbnails for fast loading
- ✅ Annotation workspace uses compressed images for AI processing

---

## Sprint 3: Queue-Based W&B Integration

**Goal**: Queue-based batch processing for W&B dataset builds and evaluations
**Duration**: 2-3 weeks
**Deliverable**: Automated dataset builds, job status tracking, and W&B-based evaluation
**Proposal**: See [spec/proposals/20260111_queue_based_wandb_integration.md](proposals/20260111_queue_based_wandb_integration.md)

### Phase 1: Queue Infrastructure & Data Models

- ⬜ Update data schema in `amplify/data/resource.ts`
  ```typescript
  // Add to Annotation model
  Annotation: a.model({
    // ... existing fields
    queuedForDataset: a.boolean().default(false),
    processedAt: a.datetime()
  }),

  // New job tracking models
  DatasetBuildJob: a.model({
    jobId: a.id().required(),
    status: a.enum(['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED']),
    startedAt: a.datetime(),
    completedAt: a.datetime(),
    annotationCount: a.integer(),
    wandbRunUrl: a.url(),
    wandbArtifactVersion: a.string(),
    errorMessage: a.string()
  }).authorization((allow) => [allow.authenticated()]),

  EvaluationJob: a.model({
    jobId: a.id().required(),
    status: a.enum(['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED']),
    modelName: a.string().required(),
    datasetVersion: a.string().required(),
    exactMatchRate: a.float(),
    f1Score: a.float(),
    avgIoU: a.float(),
    wandbRunUrl: a.url(),
    errorMessage: a.string()
  }).authorization((allow) => [allow.authenticated()]),

  QueueStats: a.model({
    id: a.id().required(),
    pendingAnnotations: a.integer().default(0),
    lastDatasetBuild: a.datetime(),
    nextScheduledBuild: a.datetime()
  }).authorization((allow) => [allow.authenticated()])
  ```

- ⬜ Set up SQS queue in `amplify/backend.ts`
  ```typescript
  import * as sqs from 'aws-cdk-lib/aws-sqs';
  import { Duration } from 'aws-cdk-lib';

  const annotationQueue = new sqs.Queue(stack, 'VerifiedAnnotationsQueue', {
    visibilityTimeout: Duration.minutes(15),
    retentionPeriod: Duration.days(14),
    deadLetterQueue: {
      queue: dlq,
      maxReceiveCount: 3
    }
  });
  ```

- ⬜ Update annotation approval workflow
  - ⬜ Add "Queue for Dataset" action on approved annotations
  - ⬜ Send message to SQS with annotation data
  - ⬜ Update `queuedForDataset` flag in DynamoDB
  - ⬜ Show "Queued for dataset build" status in UI

### Phase 2: Batch Processor Lambda

- ⬜ Set up W&B account and create `biz-doc-vqa` project
  ```bash
  wandb login
  # Create project: biz-doc-vqa (Business Document Visual Question Answering)
  ```

- ⬜ Store W&B API key in AWS Secrets Manager
  ```bash
  printf "your-wandb-api-key" | npx ampx sandbox secret set WANDB_API_KEY
  ```

- ⬜ Create `amplify/functions/wandb-processor/` directory

- ⬜ Create `amplify/functions/wandb-processor/resource.ts`
  ```typescript
  import { defineFunction, secret } from '@aws-amplify/backend';

  export const wandbProcessor = defineFunction({
    name: 'wandbProcessor',
    runtime: 20,
    timeoutSeconds: 900, // 15 minutes
    memoryMB: 2048,
    environment: {
      WANDB_API_KEY: secret('WANDB_API_KEY'),
      WANDB_PROJECT: 'biz-doc-vqa'
    }
  });
  ```

- ⬜ Install dependencies in function directory
  ```bash
  cd amplify/functions/wandb-processor
  npm install wandb @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
  ```

- ⬜ Implement handler in `amplify/functions/wandb-processor/handler.ts`
  - ⬜ Implement SQS handler (batch processing)
  - ⬜ Initialize W&B with project `biz-doc-vqa`
  - ⬜ Create DatasetBuildJob record (status=RUNNING)
  - ⬜ Create/update W&B artifact `business-ocr-vqa-dataset`
  - ⬜ Log annotations incrementally to W&B Table
    - ⬜ Include fields: question_id, image, question, answers, answer_bbox
    - ⬜ Use `json.dumps(data, ensure_ascii=False)` for unicode preservation
  - ⬜ Mark processed annotations with `processedAt` timestamp
  - ⬜ Update DatasetBuildJob (status=COMPLETED, wandbRunUrl, artifactVersion)
  - ⬜ Handle errors and update job status to FAILED
  - ⬜ Return batch item failures for retry

- ⬜ Configure Lambda SQS trigger in `amplify/backend.ts`
  ```typescript
  import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';

  wandbProcessorLambda.addEventSource(
    new SqsEventSource(annotationQueue, {
      batchSize: 10,
      maxBatchingWindow: Duration.minutes(5),
      reportBatchItemFailures: true
    })
  );
  ```

- ⬜ Add EventBridge schedule for daily builds
  ```typescript
  import * as events from 'aws-cdk-lib/aws-events';
  import * as targets from 'aws-cdk-lib/aws-events-targets';

  const dailyBuildSchedule = new events.Rule(stack, 'DailyDatasetBuild', {
    schedule: events.Schedule.cron({
      minute: '0',
      hour: '2', // 2 AM UTC
      day: '*'
    })
  });

  dailyBuildSchedule.addTarget(new targets.LambdaFunction(wandbProcessorLambda));
  ```

### Phase 3: Status UI

- ⬜ Create `src/pages/DatasetStatus.tsx`
  - ⬜ Display queue statistics (pending annotations count)
  - ⬜ Show last dataset build timestamp
  - ⬜ Show next scheduled build time
  - ⬜ Add "Trigger Manual Build" button
  - ⬜ Display recent DatasetBuildJob table
    - ⬜ Columns: Job ID, Status, Started, Completed, Annotation Count, W&B Link
    - ⬜ Status badge component (color-coded)
  - ⬜ Add direct links to W&B `biz-doc-vqa` project
    - ⬜ Link to datasets: `https://wandb.ai/<entity>/biz-doc-vqa/artifacts`
    - ⬜ Link to runs: `https://wandb.ai/<entity>/biz-doc-vqa`
  - ⬜ Poll for status updates (every 30 seconds)
  - ⬜ Handle manual trigger API call

- ⬜ Create `src/pages/EvaluationStatus.tsx`
  - ⬜ Display recent EvaluationJob table
  - ⬜ Show evaluation metrics (EM, F1, IoU)
  - ⬜ Add links to W&B evaluation dashboards
  - ⬜ Show evaluation schedule information

- ⬜ Update Dashboard
  - ⬜ Add "Dataset Status" navigation link
  - ⬜ Show queue count widget
  - ⬜ Display last build time
  - ⬜ Add quick link to W&B project

### Phase 4: Evaluation Runner

- ⬜ Create `amplify/functions/evaluation-runner/` directory

- ⬜ Create `amplify/functions/evaluation-runner/resource.ts`
  ```typescript
  import { defineFunction, secret } from '@aws-amplify/backend';

  export const evaluationRunner = defineFunction({
    name: 'evaluationRunner',
    runtime: 20,
    timeoutSeconds: 900,
    memoryMB: 2048,
    environment: {
      WANDB_API_KEY: secret('WANDB_API_KEY'),
      WANDB_PROJECT: 'biz-doc-vqa'
    }
  });
  ```

- ⬜ Install dependencies
  ```bash
  cd amplify/functions/evaluation-runner
  npm install wandb @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
  ```

- ⬜ Implement handler in `amplify/functions/evaluation-runner/handler.ts`
  - ⬜ Fetch dataset version from W&B
  - ⬜ Create EvaluationJob record (status=RUNNING)
  - ⬜ Run evaluation on annotations
    - ⬜ Calculate Exact Match rate
    - ⬜ Calculate F1 Score
    - ⬜ Calculate average IoU (bbox accuracy)
  - ⬜ Log evaluation results to W&B
    - ⬜ Create evaluation artifact
    - ⬜ Log metric visualizations
    - ⬜ Log bbox overlay images
  - ⬜ Update EvaluationJob (status=COMPLETED, metrics, wandbRunUrl)
  - ⬜ Handle errors and update status to FAILED

- ⬜ Add EventBridge schedule for weekly evaluations
  ```typescript
  const weeklyEvalSchedule = new events.Rule(stack, 'WeeklyEvaluation', {
    schedule: events.Schedule.cron({
      minute: '0',
      hour: '3', // 3 AM UTC
      weekDay: 'SUN'
    })
  });

  weeklyEvalSchedule.addTarget(new targets.LambdaFunction(evaluationRunnerLambda));
  ```

- ⬜ Add manual evaluation trigger API
  - ⬜ Create API endpoint to trigger evaluation
  - ⬜ Allow model selection
  - ⬜ Allow dataset version selection
  - ⬜ Return evaluation job ID

### Phase 5: Testing & Documentation

- ⬜ Test queue processing
  - ⬜ Submit 10 test annotations to queue
  - ⬜ Verify batch processing completes
  - ⬜ Verify DatasetBuildJob status updates
  - ⬜ Check W&B artifact is created correctly
  - ⬜ Verify unicode characters preserved (Japanese, Chinese)

- ⬜ Test retry logic
  - ⬜ Simulate Lambda failure
  - ⬜ Verify failed messages go to DLQ
  - ⬜ Test retry mechanism
  - ⬜ Verify partial batch failure reporting

- ⬜ Test scheduled jobs
  - ⬜ Trigger manual dataset build
  - ⬜ Verify EventBridge schedules are configured
  - ⬜ Test cron expression timing
  - ⬜ Verify status UI updates

- ⬜ Test evaluation workflow
  - ⬜ Run manual evaluation on test dataset
  - ⬜ Verify metrics are calculated correctly
  - ⬜ Check W&B evaluation dashboard
  - ⬜ Verify bbox visualizations

- ⬜ Documentation
  - ⬜ Update README with queue workflow explanation
  - ⬜ Document job status meanings (QUEUED, RUNNING, COMPLETED, FAILED)
  - ⬜ Create W&B navigation guide
  - ⬜ Document manual trigger process
  - ⬜ Create troubleshooting guide for failed jobs
  - ⬜ Document `biz-doc-vqa` project structure in W&B

**Sprint 3 Acceptance Criteria:**
- ✅ Approved annotations are queued automatically (non-blocking)
- ✅ SQS queue collects verified annotations successfully
- ✅ Scheduled batch jobs process 10+ annotations per run
- ✅ W&B datasets update with proper versioning (v0, v1, v2...)
- ✅ Job status UI shows real-time progress (QUEUED, RUNNING, COMPLETED, FAILED)
- ✅ Failed jobs retry automatically via DLQ
- ✅ Users can trigger manual dataset builds
- ✅ Users can view datasets in W&B `biz-doc-vqa` project
- ✅ Unicode characters preserved in W&B (Japanese, Chinese text)
- ✅ Evaluation runs complete successfully with metrics (EM, F1, IoU)
- ✅ Evaluation results viewable in W&B dashboard
- ✅ Queue handles large image files without memory issues
- ✅ Dashboard shows queue statistics and last build time

---

## Sprint 4: Multi-Language Support & Image Optimization

**Goal**: Support multiple languages and optimize image storage
**Duration**: 2 weeks
**Deliverable**: Multi-language annotation + image compression

### Multi-Language Data Model
- ⬜ Add language field to Image model
  ```typescript
  language: a.enum(['ja', 'en', 'zh', 'ko']).required()
  ```
- ⬜ Add language field to Annotation model
- ⬜ Add GSI on language field for filtering
- ⬜ Deploy schema updates

### Multi-Language UI
- ⬜ Add language selection to Upload page
  - ⬜ Language dropdown (Japanese, English, Chinese, Korean)
  - ⬜ Make language required field
  - ⬜ Display selected language prominently
- ⬜ Add language filter to Image Gallery
- ⬜ Display language badge on image cards
- ⬜ (Optional) Set up i18n framework for UI localization
  ```bash
  # Only if you need multi-language UI (not required for MVP)
  npm install react-i18next i18next
  ```
  Note: Can start with English-only UI and add translations later if needed

### Multi-Language Nemotron Prompts
- ⬜ Create prompt templates directory `amplify/functions/generate-annotation/prompts/`
  - ⬜ `ja.ts` - Japanese prompt template
  - ⬜ `en.ts` - English prompt template
  - ⬜ `zh.ts` - Chinese prompt template
  - ⬜ `ko.ts` - Korean prompt template
- ⬜ Update NemotronVisionClient to select prompt by language
- ⬜ Add language parameter to annotation generation Lambda
- ⬜ Test prompts for each language
- ⬜ Update Lambda environment variables
  ```typescript
  SUPPORTED_LANGUAGES: 'ja,en,zh,ko'
  ```

### Additional Bedrock Models
- ⬜ Request model access for Qwen-VL
- ⬜ Add model selection to annotation generation
- ⬜ Update BedrockVisionClient to support multiple models
  - ⬜ Claude 3.5 Sonnet (current)
  - ⬜ Qwen-VL (new)
- ⬜ Add model configuration to settings

### Frontend Updates
- ⬜ Create ProgressiveImageLoader component
  - ⬜ Load thumbnail first
  - ⬜ Load compressed image progressively
  - ⬜ Add "View Original" option
  - ⬜ Show loading progress
- ⬜ Update ImageViewer to use ProgressiveImageLoader
- ⬜ Display compression statistics in image metadata

### Settings Page
- ⬜ Create Settings page layout
- ⬜ Implement BedrockModelConfiguration panel
  - ⬜ Model selection dropdown
  - ⬜ Default language selection
  - ⬜ Parameter tuning (temperature, max tokens)
- ⬜ Save settings to user preferences (DynamoDB)

**Sprint 4 Acceptance Criteria:**
- ✅ Users can select language when uploading images
- ✅ Images can be filtered by language
- ✅ Bedrock prompts use appropriate language
- ✅ Multiple Bedrock models are supported
- ✅ Progressive image loading works
- ✅ Settings page allows model configuration

Note: Image compression tasks moved to Sprint 2. See [spec/proposals/20260111_move_compression_to_sprint2.md](proposals/20260111_move_compression_to_sprint2.md)

---

## Sprint 5: Mobile Optimization & Camera Capture

**Goal**: First-class mobile experience with camera capture
**Duration**: 2 weeks
**Deliverable**: Mobile-optimized annotation and camera integration

### Camera Capture UI
- ⬜ Create CameraCapture component
  - ⬜ Implement HTML5 camera access
    ```html
    <input type="file" accept="image/*" capture="camera" />
    ```
  - ⬜ Add camera permission handling
  - ⬜ Support front/back camera switching
  - ⬜ Show live camera preview
  - ⬜ Implement photo capture
  - ⬜ Add photo preview before upload
  - ⬜ Integrate with existing upload flow
- ⬜ Add camera capture option to Upload page
- ⬜ Test camera on iOS and Android browsers

### Mobile-Optimized Annotation UI
- ⬜ Create TouchAnnotator component (mobile version)
  - ⬜ Touch-friendly bounding box creation
  - ⬜ Pinch-to-zoom gesture support
  - ⬜ Two-finger pan gesture
  - ⬜ Large touch targets (44x44px minimum)
  - ⬜ Corner handles for resizing (12px+ touch area)
  - ⬜ Tap to select box
  - ⬜ Long-press for context menu
  - ⬜ Optional: Haptic feedback
- ⬜ Implement mobile-specific controls
  - ⬜ Touch-friendly validation buttons (44x44px)
  - ⬜ Bottom sheet for annotation form
  - ⬜ Mobile-optimized keyboard for text input
- ⬜ Add orientation support (portrait and landscape)

### Responsive Design
- ⬜ Audit all pages for mobile responsiveness
- ⬜ Implement mobile-first CSS
  - ⬜ Mobile (375px - 767px)
  - ⬜ Tablet (768px - 1023px)
  - ⬜ Desktop (1024px+)
- ⬜ Update navigation for mobile (hamburger menu)
- ⬜ Optimize dashboard for mobile layout
- ⬜ Test on various device sizes

### Performance Optimization for Mobile
- ⬜ Implement lazy loading for images
- ⬜ Add service worker for offline support (optional)
- ⬜ Optimize bundle size
  ```bash
  npm install --save-dev webpack-bundle-analyzer
  ```
- ⬜ Test on 3G/4G networks (throttling)
- ⬜ Measure page load times on mobile devices

### Common Components
- ⬜ Create NotificationToast component
- ⬜ Implement LoadingSpinner
- ⬜ Create ErrorBoundary
- ⬜ Implement ConfirmDialog (mobile-friendly)
- ⬜ Create Tooltip component
- ⬜ Implement ProgressBar

**Sprint 5 Acceptance Criteria:**
- ✅ Users can capture photos with device camera
- ✅ Camera works on iOS and Android browsers
- ✅ Touch annotation works smoothly on mobile
- ✅ Pinch-to-zoom and pan gestures work
- ✅ All pages are responsive and mobile-friendly
- ✅ App performs well on mobile networks
- ✅ Portrait and landscape orientations supported

---

## Sprint 6: Dataset Publishing & PII Handling

**Goal**: Publish datasets to Hugging Face with PII redaction
**Duration**: 2 weeks
**Deliverable**: One-click dataset publishing with compliance

### Advanced Export Formats
- ⬜ Extend export Lambda to support multiple formats
  - ⬜ JSON (existing)
  - ⬜ JSONL (streaming format)
  - ⬜ Parquet (for HuggingFace)
- ⬜ Install Apache Arrow for Parquet export
  ```bash
  cd amplify/functions/export-dataset
  npm install apache-arrow parquetjs
  ```
- ⬜ Implement Parquet export formatter
  - ⬜ Design Parquet schema for nested structures
  - ⬜ Optimize row group size
  - ⬜ Add compression (Snappy)
  - ⬜ Validate output
- ⬜ Add bounding box normalization utilities
  - ⬜ Convert absolute pixels to 0-1 normalized
  - ⬜ Convert to 0-1000 (LayoutLM standard)
  - ⬜ Support both formats in export
- ⬜ Update ExportDialog to support all formats

### PII Detection & Redaction
- ⬜ Create `amplify/functions/pii-redactor/` directory
- ⬜ Create `amplify/functions/pii-redactor/resource.ts`
- ⬜ Implement PIIDetector service (multi-language)
  - ⬜ Japanese patterns (phone, names, addresses)
  - ⬜ English patterns (SSN, phone, emails)
  - ⬜ Chinese patterns (ID numbers, phone)
  - ⬜ Korean patterns (phone, names)
  - ⬜ Universal patterns (emails, credit cards)
- ⬜ Implement image redaction using Sharp
  - ⬜ Blur detected PII regions (Gaussian blur)
  - ⬜ Preserve quality outside redacted areas
  - ⬜ Generate redacted image version
- ⬜ Implement text redaction in annotations
  - ⬜ Replace PII with placeholders
  - ⬜ Log redaction actions for audit
- ⬜ Add PII scanning to dataset export process
- ⬜ Update `amplify/backend.ts` to include function

### PII Detection UI
- ⬜ Create PIIRedactionControls component
  - ⬜ "Scan for PII" button
  - ⬜ Display PII detection results with confidence
  - ⬜ Allow manual review and override
  - ⬜ Show redaction progress
- ⬜ Add PII handling options to ExportDialog
  - ⬜ Include (no redaction)
  - ⬜ Redact (blur images, replace text)
  - ⬜ Exclude (remove PII annotations)
- ⬜ Display PII warnings before export

### Hugging Face Integration
- ⬜ Create `amplify/functions/hf-publisher/` directory
- ⬜ Create `amplify/functions/hf-publisher/resource.ts`
- ⬜ Install Hugging Face Hub SDK
  ```bash
  npm install @huggingface/hub
  ```
- ⬜ Implement HuggingFace client
  - ⬜ Create dataset repository
  - ⬜ Upload Parquet files
  - ⬜ Generate dataset card (README.md)
    - ⬜ Multi-language dataset description
    - ⬜ Citation (BibTeX and APA)
    - ⬜ Licensing (CC BY-SA 4.0)
    - ⬜ Usage examples with datasets library
    - ⬜ Language distribution statistics
    - ⬜ Legal context for international users
  - ⬜ Add version tagging
  - ⬜ Store HF dataset URL in DynamoDB
- ⬜ Add HF API token management to Settings
- ⬜ Update `amplify/backend.ts` to include function

### Publishing UI
- ⬜ Add "Publish to Hugging Face" button to DatasetDetails
- ⬜ Create PublishDialog component
  - ⬜ HuggingFace organization selection
  - ⬜ Dataset name and description
  - ⬜ License selection
  - ⬜ PII handling options
  - ⬜ Language filter
  - ⬜ Preview dataset card
- ⬜ Implement publish workflow
- ⬜ Display publication status and HF URL
- ⬜ Handle API rate limits and errors

### Dataset Card Template
- ⬜ Create dataset card template
- ⬜ Include standard sections
  - ⬜ Dataset Description
  - ⬜ Dataset Structure
  - ⬜ Multi-language support
  - ⬜ Citation format
  - ⬜ PII handling procedures
  - ⬜ Usage examples
  - ⬜ Legal context

**Sprint 6 Acceptance Criteria:**
- ✅ Datasets can be exported in JSON, JSONL, Parquet
- ✅ Bounding box normalization works correctly
- ✅ PII detection identifies sensitive data
- ✅ PII can be redacted from images and text
- ✅ Datasets can be published to Hugging Face
- ✅ Dataset card is auto-generated
- ✅ Publication URL is stored and displayed

---

## Sprint 7: Production Readiness & Polish

**Goal**: Production-ready secure and monitored platform
**Duration**: 2 weeks
**Deliverable**: Secure, documented, monitored system

### Security Hardening
- ⬜ Implement input validation on all forms
- ⬜ Sanitize user inputs (prevent XSS)
- ⬜ Implement CSRF protection
- ⬜ Set up Content Security Policy headers
- ⬜ Enable HTTPS only (HSTS)
- ⬜ Review S3 bucket policies (least privilege)
- ⬜ Review IAM roles and policies
- ⬜ Enable AWS CloudTrail for audit logs
- ⬜ Set up AWS Config for compliance
- ⬜ Secure API keys in AWS Secrets Manager
  ```bash
  aws secretsmanager create-secret --name hf-api-token
  ```
- ⬜ Implement presigned URL expiration (1 hour)
- ⬜ Enable DynamoDB encryption at rest (verify)
- ⬜ Enable S3 encryption at rest (verify)

### Vulnerability Scanning
- ⬜ Set up npm audit
  ```bash
  npm audit
  ```
- ⬜ Integrate Snyk for security scanning
  ```bash
  npm install -g snyk
  snyk test
  ```
- ⬜ Fix identified vulnerabilities
- ⬜ Schedule regular security audits

### Monitoring & Logging
- ⬜ Set up CloudWatch dashboards
  - ⬜ Lambda error rates
  - ⬜ API latency
  - ⬜ Bedrock API failures
  - ⬜ Storage usage
  - ⬜ DynamoDB read/write capacity
- ⬜ Configure CloudWatch alarms
  - ⬜ High error rates (email notification)
  - ⬜ High latency (>3s)
  - ⬜ Storage nearing quota
- ⬜ Implement structured logging in Lambda functions
  ```typescript
  import { Logger } from '@aws-lambda-powertools/logger';
  const logger = new Logger();
  ```
- ⬜ Set up log aggregation (CloudWatch Insights)
- ⬜ Configure SNS notifications for critical alarms
  ```bash
  aws sns create-topic --name amplify-alerts
  ```

### Error Tracking
- ⬜ Integrate frontend error tracking (Sentry or Rollbar)
  ```bash
  npm install @sentry/react
  ```
- ⬜ Configure error reporting for Lambda functions
- ⬜ Set up error alert notifications
- ⬜ Create error triage workflow

### Performance Monitoring
- ⬜ Implement APM (Application Performance Monitoring)
- ⬜ Set up X-Ray tracing for Lambda functions
  ```typescript
  import { captureLambdaHandler } from '@aws-lambda-powertools/tracer';
  ```
- ⬜ Monitor database query performance
- ⬜ Monitor Bedrock API latency
- ⬜ Create performance optimization plan

### Backup & Recovery
- ⬜ Enable DynamoDB point-in-time recovery
  ```bash
  aws dynamodb update-continuous-backups \
    --table-name Image \
    --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true
  ```
- ⬜ Enable S3 versioning for critical buckets
- ⬜ Create disaster recovery plan document
- ⬜ Document recovery procedures
- ⬜ Test backup restoration process

### Testing
- ⬜ Set up Jest testing framework
  ```bash
  npm install --save-dev jest @types/jest ts-jest
  ```
- ⬜ Write unit tests for utility functions
  - ⬜ Bounding box normalization
  - ⬜ PII detection patterns
  - ⬜ Image compression logic
- ⬜ Write tests for React components
  ```bash
  npm install --save-dev @testing-library/react
  ```
- ⬜ Write integration tests for Lambda functions
- ⬜ Set up E2E testing with Cypress/Playwright
  ```bash
  npm install --save-dev @playwright/test
  ```
- ⬜ Write E2E test for annotation workflow
- ⬜ Test across browsers (Chrome, Safari, Firefox)
- ⬜ Test responsive design on devices
- ⬜ Achieve >80% code coverage

### Performance Testing
- ⬜ Load test image upload (concurrent users)
- ⬜ Load test annotation generation
- ⬜ Test compression with various image sizes
- ⬜ Test on simulated mobile networks
- ⬜ Optimize slow queries and operations

### Documentation
- ⬜ Create user guide for curators
- ⬜ Create user guide for annotators
- ⬜ Document API endpoints
- ⬜ Create architecture diagrams
  ```bash
  npm install --save-dev mermaid
  ```
- ⬜ Document deployment process
- ⬜ Create troubleshooting guide
- ⬜ Document Bedrock integration
- ⬜ Create video tutorials (optional)

### CI/CD Pipeline
- ⬜ Set up GitHub Actions workflow
  ```yaml
  # .github/workflows/deploy.yml
  name: Deploy to Amplify
  on: [push]
  jobs:
    deploy:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v3
        - run: npm ci
        - run: npm test
        - run: npx ampx pipeline-deploy
  ```
- ⬜ Configure automated testing on PR
- ⬜ Set up staging environment
- ⬜ Configure production deployment
- ⬜ Add deployment approval workflow

### Launch Preparation
- ⬜ Complete security review checklist
- ⬜ Complete performance testing
- ⬜ Verify all monitoring is active
- ⬜ Create launch plan document
- ⬜ Prepare rollback plan
- ⬜ Train initial users
- ⬜ Set up support channels (email, chat)
- ⬜ Prepare announcement (blog post, social media)

**Sprint 7 Acceptance Criteria:**
- ✅ Security scan passes with no critical issues
- ✅ All monitoring dashboards are active
- ✅ Error tracking is configured
- ✅ Backup and recovery tested
- ✅ Test coverage >80%
- ✅ Documentation is complete
- ✅ CI/CD pipeline is operational
- ✅ Ready for production launch

---

## Post-Launch: Maintenance & Enhancements

### Launch Activities
- ⬜ Deploy to production
  ```bash
  npx ampx pipeline-deploy --branch main
  ```
- ⬜ Monitor for issues (first 48 hours)
- ⬜ Collect initial user feedback
- ⬜ Address critical issues immediately
- ⬜ Publish announcement
- ⬜ Conduct retrospective meeting

### Post-Launch Optimization
- ⬜ Analyze user behavior with analytics
- ⬜ Identify bottlenecks and optimize
- ⬜ Gather feature requests
- ⬜ Prioritize roadmap
- ⬜ Plan next sprint

---

## Future Enhancements (Backlog)

### Advanced Features
- ⬜ Multi-annotator consensus workflow
- ⬜ Real-time collaboration on annotations
- ⬜ Advanced analytics dashboard with ML insights
- ⬜ Custom model training pipeline
- ⬜ Native mobile app (React Native)
- ⬜ Public API for programmatic access
- ⬜ Webhook integrations
- ⬜ Annotation templates and presets
- ⬜ Bulk operations (batch approve/delete)
- ⬜ Dataset versioning with diff view
- ⬜ Annotation quality scoring

### Additional Integrations
- ⬜ Integration with Label Studio
- ⬜ Integration with CVAT
- ⬜ Support for GPT-4V model
- ⬜ Export to COCO format
- ⬜ Export to Pascal VOC format
- ⬜ Integration with Labelbox
- ⬜ IIIF (International Image Interoperability Framework) support

### Infrastructure Enhancements
- ⬜ Multi-region deployment
- ⬜ CDN for global performance (CloudFront)
- ⬜ Redis caching layer for API responses
- ⬜ Dataset partitioning for large collections
- ⬜ Database migration to Aurora (if needed)
- ⬜ Implement search with OpenSearch

### Advanced AI Features
- ⬜ Support for additional Bedrock models
- ⬜ Custom prompt engineering interface
- ⬜ Active learning to improve annotation quality
- ⬜ Automated quality assessment
- ⬜ Confidence scoring for annotations

---

## Amplify Gen2 Command Reference

### Development Commands
```bash
# Initialize new Amplify project
npm create amplify@latest

# Install Amplify dependencies
npm install aws-amplify @aws-amplify/ui-react
npm install --save-dev @aws-amplify/backend @aws-amplify/backend-cli

# Start local sandbox (with hot reload)
npx ampx sandbox

# Stream function logs while in sandbox
npx ampx sandbox --stream-function-logs

# Filter logs from specific functions
npx ampx sandbox --logs-filter "generateAnnotation"

# Generate GraphQL client types
npx ampx generate graphql-client-code

# Delete sandbox
npx ampx sandbox delete
```

### Deployment Commands
```bash
# Deploy to Amplify (production)
npx ampx pipeline-deploy --branch main

# Deploy to staging
npx ampx pipeline-deploy --branch staging

# Check deployment status
aws amplify list-apps
```

### AWS Configuration
```bash
# Configure AWS credentials
aws configure

# Create secrets for sensitive data
aws secretsmanager create-secret --name hf-api-token --secret-string "your-token"

# Enable Bedrock model access (via AWS Console)
# Navigate to: Amazon Bedrock > Model access > Request model access
```

### Testing Commands
```bash
# Run unit tests
npm test

# Run E2E tests
npx playwright test

# Security audit
npm audit
snyk test

# Bundle analysis
npm run build
npx webpack-bundle-analyzer build/stats.json
```

---

## Amplify Gen2 File Structure

```
business-ocr-annotator/
├── amplify/
│   ├── auth/
│   │   └── resource.ts           # defineAuth()
│   ├── storage/
│   │   └── resource.ts           # defineStorage()
│   ├── data/
│   │   └── resource.ts           # defineData() with schema
│   ├── functions/
│   │   ├── generate-annotation/
│   │   │   ├── resource.ts       # defineFunction()
│   │   │   ├── handler.ts        # Lambda handler
│   │   │   └── package.json
│   │   ├── export-dataset/
│   │   │   ├── resource.ts
│   │   │   ├── handler.ts
│   │   │   └── package.json
│   │   ├── image-processor/
│   │   │   ├── resource.ts
│   │   │   ├── handler.ts
│   │   │   └── package.json
│   │   ├── pii-redactor/
│   │   │   ├── resource.ts
│   │   │   ├── handler.ts
│   │   │   └── package.json
│   │   └── hf-publisher/
│   │       ├── resource.ts
│   │       ├── handler.ts
│   │       └── package.json
│   └── backend.ts                # defineBackend() - imports all resources
├── src/
│   ├── components/
│   ├── pages/
│   ├── App.tsx
│   └── main.tsx                  # Vite entry point
├── public/                       # Static assets
├── index.html                    # HTML entry point (Vite)
├── amplify_outputs.json          # Generated after deployment
├── vite.config.ts                # Vite configuration
├── package.json
└── tsconfig.json
```

---

## Risk Management

### Known Risks
1. **Bedrock Model Availability**: Dependency on external model API
   - Mitigation: Multiple model options, robust error handling

2. **Hugging Face API Limits**: Rate limiting and quotas
   - Mitigation: Retry logic, batch operations, upgrade plan if needed

3. **Dataset Size**: Large datasets may impact performance
   - Mitigation: Pagination, lazy loading, partitioning

4. **Annotation Quality**: AI-generated annotations may have errors
   - Mitigation: Human validation workflow, confidence thresholds

5. **Cost Overruns**: AWS and Bedrock costs may exceed budget
   - Mitigation: Monitor costs, implement limits, optimize storage

6. **Mobile Browser Compatibility**: Camera API may vary across devices
   - Mitigation: Fallback mechanisms, progressive enhancement, testing

---

## Progress Tracking

**Last Review Date**: 2026-01-11
**Next Review Date**: TBD
**Completed Tasks**: Sprint 0 + Sprint 1 completed
**Current Sprint**: Sprint 2 (AI-Assisted Annotation)

### Sprint Completion Status
- ✅ Sprint 0: Foundation & Deployment
- ✅ Sprint 1: Image Upload & Manual Annotation (MVP)
- ⬜ Sprint 2: AI-Assisted Annotation
- ⬜ Sprint 3: Queue-Based W&B Integration
- ⬜ Sprint 4: Multi-Language Support & Optimization
- ⬜ Sprint 5: Mobile Optimization & Camera
- ⬜ Sprint 6: Publishing & PII Handling
- ⬜ Sprint 7: Production Readiness

---

## Notes

- **Agile Approach**: Each sprint delivers working, deployable software
- **User Feedback**: Collect feedback after Sprints 1, 2, and 3
- **Incremental Complexity**: Start simple, add features gradually
- **Integration**: Frontend and backend tasks are integrated per sprint
- **Flexibility**: Sprint order can be adjusted based on priorities
- **Documentation**: Update this file after each sprint completion
- **Proposals**: Create proposal documents for significant changes

---

## Sources & References

- [AWS Amplify Gen2 Documentation](https://docs.amplify.aws/)
- [CLI Commands Reference](https://docs.amplify.aws/react/reference/cli-commands/)
- [Sandbox Features](https://docs.amplify.aws/react/deploy-and-host/sandbox-environments/features/)
- [create-amplify npm package](https://www.npmjs.com/package/create-amplify)
- [Amplify Storage with TypeScript](https://aws.amazon.com/blogs/mobile/amplify-storage-now-with-fullstack-typescript-powered-by-amazon-s3/)
