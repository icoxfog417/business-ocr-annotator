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

## Sprint 2: AI-Assisted Annotation (Nemotron Integration)

**Goal**: Auto-generate annotations using NVIDIA Nemotron Nano 12B
**Duration**: 2-3 weeks
**Deliverable**: One-click AI annotation generation

### Nemotron Setup
- ⬜ Research NVIDIA Nemotron Nano 12B deployment options
- ⬜ Set up Nemotron model endpoint (self-hosted or API)
- ⬜ Configure IAM permissions for Nemotron access
- ⬜ Test model inference with sample images

### Lambda Function for Annotation Generation
- ⬜ Create `amplify/functions/generate-annotation/` directory
- ⬜ Initialize function package
  ```bash
  cd amplify/functions/generate-annotation
  npm init -y
  npm install @aws-sdk/client-s3
  cd ../../..
  ```
- ⬜ Create `amplify/functions/generate-annotation/resource.ts`
  ```typescript
  import { defineFunction } from '@aws-amplify/backend';

  export const generateAnnotation = defineFunction({
    name: 'generateAnnotation',
    runtime: 20, // Node.js 20.x
    timeoutSeconds: 300, // 5 minutes for Nemotron call
    memoryMB: 1024
  });
  ```
- ⬜ Implement handler in `amplify/functions/generate-annotation/handler.ts`
  ```typescript
  import { NemotronVisionClient } from './nemotron-client';
  ```
- ⬜ Implement NemotronVisionClient service class
  - ⬜ Initialize Nemotron client
  - ⬜ Create prompt template for Nemotron Nano 12B
  - ⬜ Implement API call with image (base64 or S3 reference)
  - ⬜ Parse response to extract Q&A pairs and bounding boxes
- ⬜ Add Lambda environment variables
  ```typescript
  // In resource.ts
  environment: {
    NEMOTRON_ENDPOINT: 'https://api.nemotron.nvidia.com/v1',
    MODEL_ID: 'nvidia/nemotron-nano-12b'
  }
  ```
- ⬜ Grant Lambda permissions to access S3 and Nemotron API
- ⬜ Store generated annotations in DynamoDB
- ⬜ Add error handling and retry logic
- ⬜ Implement CloudWatch logging

### Update Backend Configuration
- ⬜ Update `amplify/backend.ts` to include function
  ```typescript
  import { generateAnnotation } from './functions/generate-annotation/resource';

  defineBackend({
    auth,
    storage,
    data,
    generateAnnotation
  });
  ```
- ⬜ Add GraphQL custom query/mutation for annotation generation
- ⬜ Test Lambda function in sandbox
  ```bash
  npx ampx sandbox --stream-function-logs
  ```

### Frontend Integration
- ⬜ Add "Generate Annotations" button to AnnotationWorkspace
- ⬜ Implement API call to Lambda function
  ```typescript
  import { generateClient } from 'aws-amplify/api';
  ```
- ⬜ Show loading state during generation (with spinner)
- ⬜ Display generated annotations in AnnotationList
- ⬜ Allow users to edit/approve/reject AI annotations
- ⬜ Add confidence score display (if available from Nemotron)
- ⬜ Highlight AI-generated vs manual annotations
- ⬜ Handle generation errors gracefully

### Annotation Validation UI
- ⬜ Create ValidationControls component
  - ⬜ Approve button (green checkmark)
  - ⬜ Reject button (red X)
  - ⬜ Edit button (pencil icon)
- ⬜ Track annotation status (pending, approved, rejected)
- ⬜ Update data model to include status field
- ⬜ Filter annotations by status in AnnotationList

**Sprint 2 Acceptance Criteria:**
- ✅ Users can click "Generate Annotations" button
- ✅ AI generates Q&A pairs with bounding boxes
- ✅ Generated annotations appear in the workspace
- ✅ Users can approve, reject, or edit AI annotations
- ✅ Annotation status is tracked and persisted
- ✅ Error handling works for Nemotron failures

---

## Sprint 3: Dataset Management, Export & Validation

**Goal**: Create datasets, export in JSON format, and validate quality with W&B
**Duration**: 2-3 weeks
**Deliverable**: Dataset creation, export functionality, and W&B-based evaluation

### Data Model Extension
- ⬜ Add Dataset model to `amplify/data/resource.ts`
  ```typescript
  Dataset: a.model({
    name: a.string().required(),
    description: a.string(),
    version: a.string().required(),
    createdBy: a.string().required(),
    createdAt: a.datetime().required(),
    imageCount: a.integer(),
    annotationCount: a.integer()
  }).authorization((allow) => [allow.authenticated()])
  ```
- ⬜ Add relationship: Image belongs to Dataset
- ⬜ Add relationship: Annotation belongs to Image
- ⬜ Deploy schema updates
  ```bash
  npx ampx sandbox
  ```

### Dataset Management UI
- ⬜ Create DatasetList page
  - ⬜ Display all datasets in a grid/list
  - ⬜ Show dataset metadata (name, version, count)
  - ⬜ Add "Create New Dataset" button
- ⬜ Create DatasetForm dialog
  - ⬜ Name input field
  - ⬜ Description textarea
  - ⬜ Version input field
  - ⬜ Select images to include (multi-select)
- ⬜ Implement dataset creation (save to DynamoDB)
- ⬜ Create DatasetDetails page
  - ⬜ Display dataset metadata
  - ⬜ Show included images and annotations
  - ⬜ Display statistics (total Q&A pairs, image count)
  - ⬜ Add edit/delete dataset functionality

### Export Lambda Function
- ⬜ Create `amplify/functions/export-dataset/` directory
- ⬜ Create `amplify/functions/export-dataset/resource.ts`
  ```typescript
  import { defineFunction } from '@aws-amplify/backend';

  export const exportDataset = defineFunction({
    name: 'exportDataset',
    runtime: 20,
    timeoutSeconds: 300,
    memoryMB: 2048
  });
  ```
- ⬜ Implement handler in `amplify/functions/export-dataset/handler.ts`
  - ⬜ Fetch dataset data from DynamoDB
  - ⬜ Fetch associated images and annotations
  - ⬜ Transform to JSON format (simple structure)
  - ⬜ Upload export file to S3
  - ⬜ Return presigned URL for download
- ⬜ Add error handling and validation
- ⬜ Update `amplify/backend.ts` to include function

### Export UI
- ⬜ Add "Export Dataset" button to DatasetDetails page
- ⬜ Create ExportDialog component
  - ⬜ Format selection (JSON only for now)
  - ⬜ Show export progress
  - ⬜ Display download link when ready
- ⬜ Implement download functionality
- ⬜ Handle export errors

### Dashboard Enhancements
- ⬜ Display total datasets count
- ⬜ Show recent datasets list
- ⬜ Add quick actions (Create Dataset, Upload Image)

### Weights & Biases Integration
- ⬜ Set up W&B account and project
  ```bash
  pip install wandb
  wandb login
  ```
- ⬜ Store W&B API key in AWS Secrets Manager
  ```bash
  printf "your-wandb-api-key" | npx ampx sandbox secret set WANDB_API_KEY
  ```
- ⬜ Create `amplify/functions/wandb-logger/` directory
- ⬜ Create `amplify/functions/wandb-logger/resource.ts`
  ```typescript
  import { defineFunction, secret } from '@aws-amplify/backend';

  export const wandbLogger = defineFunction({
    name: 'wandbLogger',
    runtime: 20,
    timeoutSeconds: 300,
    memoryMB: 1024,
    environment: {
      WANDB_API_KEY: secret('WANDB_API_KEY'),
      WANDB_PROJECT: 'business-ocr-dataset'
    }
  });
  ```
- ⬜ Install dependencies in function directory
  ```bash
  cd amplify/functions/wandb-logger
  npm install wandb
  ```
- ⬜ Implement incremental data logging handler
  - ⬜ Initialize W&B run
  - ⬜ Create W&B Table for VQA data
  - ⬜ Log images incrementally (one row at a time to avoid memory issues)
  - ⬜ Include fields: image, question, answers, answer_bbox, document_type
  - ⬜ Handle large image files (compress if needed before upload)
  - ⬜ Track logging progress
  - ⬜ Return W&B run URL
- ⬜ Implement evaluation handler
  - ⬜ Fetch dataset from DynamoDB
  - ⬜ Create evaluation run in W&B
  - ⬜ Log evaluation metrics incrementally (per annotation)
  - ⬜ Calculate OCR accuracy metrics (exact match, F1 score)
  - ⬜ Visualize bounding box annotations
  - ⬜ Compare annotation quality across images
  - ⬜ Return evaluation summary and W&B URL
- ⬜ Update `amplify/backend.ts` to include wandbLogger function

### W&B Integration UI
- ⬜ Add "Log to W&B" button to DatasetDetails page
- ⬜ Create WandBDialog component
  - ⬜ Project name input
  - ⬜ Run name input (auto-generated by default)
  - ⬜ Show logging progress (X/Y images logged)
  - ⬜ Display W&B run URL when complete
- ⬜ Add "Evaluate Dataset" button
- ⬜ Create EvaluationDialog component
  - ⬜ Select metrics to compute
  - ⬜ Show evaluation progress
  - ⬜ Display evaluation results summary
  - ⬜ Link to W&B evaluation dashboard
- ⬜ Handle W&B API errors gracefully
- ⬜ Store W&B run URLs in dataset metadata

**Sprint 3 Acceptance Criteria:**
- ✅ Users can create new datasets
- ✅ Users can add images to datasets
- ✅ Datasets are listed and searchable
- ✅ Users can view dataset details
- ✅ Users can export datasets in JSON format
- ✅ Export file is downloadable
- ✅ Datasets can be logged to W&B incrementally
- ✅ Large images are handled without memory issues
- ✅ Evaluations can be run on datasets
- ✅ Evaluation metrics are displayed in W&B
- ✅ W&B run URLs are saved and accessible

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

### Image Compression Lambda
- ⬜ Create `amplify/functions/image-processor/` directory
- ⬜ Create `amplify/functions/image-processor/resource.ts`
  ```typescript
  import { defineFunction } from '@aws-amplify/backend';

  export const imageProcessor = defineFunction({
    name: 'imageProcessor',
    runtime: 20,
    timeoutSeconds: 300,
    memoryMB: 1536
  });
  ```
- ⬜ Install Sharp library
  ```bash
  cd amplify/functions/image-processor
  npm install sharp
  ```
- ⬜ Implement handler
  - ⬜ Extract image metadata (width, height, size)
  - ⬜ Implement smart compression (≤4MB target)
    - ⬜ Dynamic quality adjustment
    - ⬜ Max dimension 2048px
    - ⬜ Maintain aspect ratio
  - ⬜ Generate thumbnail (≤100KB, 200x200px)
  - ⬜ Upload compressed and thumbnail to S3
  - ⬜ Update Image record with all versions
- ⬜ Configure S3 trigger for original/ folder
- ⬜ Add S3 folder structure: `original/`, `compressed/`, `thumbnail/`
- ⬜ Update `amplify/storage/resource.ts` for folder access
- ⬜ Update `amplify/backend.ts` to include function

### Frontend Updates
- ⬜ Create ProgressiveImageLoader component
  - ⬜ Load thumbnail first
  - ⬜ Load compressed image progressively
  - ⬜ Add "View Original" option
  - ⬜ Show loading progress
- ⬜ Update ImageViewer to use ProgressiveImageLoader
- ⬜ Display compression statistics in image metadata
- ⬜ Use thumbnails in gallery for performance

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
- ✅ Images are automatically compressed on upload
- ✅ Thumbnails are generated for gallery view
- ✅ Progressive image loading works
- ✅ Settings page allows model configuration

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
- ⬜ Sprint 3: Dataset Management, Export & Validation (with W&B)
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
