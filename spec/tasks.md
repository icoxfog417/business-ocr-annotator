# Implementation Tasks

**Project**: Business OCR Annotator
**Last Updated**: 2026-01-25
**Status**: Sprint 3 Complete, Starting Sprint 4 (Dataset Export & Evaluation)
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

### Image Compression (Moved from Sprint 5)
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

## Sprint 3: UX & Mobile UI Optimization

**Goal**: Streamlined annotation cycle + responsive mobile UI + legal compliance
**Duration**: 1 week (5-6 working days)
**Deliverable**: Optimized annotation workflow, mobile-friendly interface, user consent system
**Proposal**: See [spec/proposals/20260112_sprint3_mobile_first_ui.md](proposals/20260112_sprint3_mobile_first_ui.md)

### Parallel Work Units

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SPRINT 3 PARALLEL EXECUTION                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Day 1-2: Foundation (Run in Parallel)                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ Unit A       │  │ Unit B       │  │ Unit C       │  │ Unit D       │    │
│  │ Backend      │  │ Config &     │  │ Layout       │  │ i18n &       │    │
│  │ Infrastructure│  │ Hooks        │  │ Components   │  │ Styles       │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
│         │                 │                 │                 │             │
│         ▼                 ▼                 ▼                 ▼             │
│  Day 3-4: Features (Run in Parallel, depends on Foundation)                  │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────┐  │
│  │ Unit E               │  │ Unit F               │  │ Unit G           │  │
│  │ Upload Flow          │  │ Annotation Flow      │  │ Mobile Features  │  │
│  │ (Consent + Questions)│  │ (Box-first + Read)   │  │ (Touch + Camera) │  │
│  └──────────┬───────────┘  └──────────┬───────────┘  └────────┬─────────┘  │
│             │                         │                       │             │
│             ▼                         ▼                       ▼             │
│  Day 5-6: Integration & Testing                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Unit H: Page Integration + Testing                                   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Unit A: Backend Infrastructure ✅ COMPLETE

- ✅ Add Cognito custom attributes for consent in `amplify/auth/resource.ts`
  ```typescript
  userAttributes: {
    'custom:contributor': { dataType: 'String', mutable: true },
    'custom:consent_date': { dataType: 'String', mutable: true },
    'custom:consent_version': { dataType: 'String', mutable: true },
  }
  ```

- ✅ Update `Annotation` model in `amplify/data/resource.ts` with AI tracking fields
  - `aiAssisted: a.boolean()` - True if [📖 Read] was used
  - `aiModelId: a.string()` - Model ID (e.g., "anthropic.claude-3-5-sonnet")
  - `aiModelProvider: a.string()` - Provider (e.g., "bedrock")
  - `aiExtractionTimestamp: a.datetime()` - When AI extraction occurred

- ✅ Update `generate-annotation` Lambda to return model ID in response

---

### Unit B: Config & Hooks ✅ COMPLETE

- ✅ Create `src/config/defaultQuestions.json`
  - All document types (RECEIPT, INVOICE, ORDER_FORM, TAX_FORM, CONTRACT, APPLICATION_FORM, OTHER)
  - All languages (ja, en, zh, ko)
  - Default + optional questions per type/language

- ✅ Create `src/hooks/useDefaultQuestions.ts`
  - Load questions from JSON config
  - Filter by document type and language
  - Fallback to English if language not found

- ✅ Create `src/hooks/useContributorStatus.ts`
  - Check `custom:contributor` via `fetchUserAttributes()`
  - Update via `updateUserAttributes()` when accepted
  - Return `{ isContributor, isLoading, becomeContributor }`

- ✅ Create `src/contexts/ContributorContext.tsx`
  - Cache contributor status globally
  - Provide context to all components

- ✅ Create `src/hooks/useBreakpoint.ts`
  - Detect breakpoint: mobile (<768px), tablet (768-1024px), desktop (>1024px)
  - Return `{ isMobile, isTablet, isDesktop }`

- ✅ Create `src/hooks/useKeyboardShortcuts.ts`
  - Register/unregister keyboard event listeners
  - Support: `→`, `←`, `D`, `R`, `S`, `Esc`, `Ctrl+Enter`

---

### Unit C: Layout Components ✅ COMPLETE

- ✅ Create `src/styles/breakpoints.css`
  ```css
  :root {
    --breakpoint-mobile: 768px;
    --breakpoint-tablet: 1024px;
  }
  ```

- ✅ Create `src/components/layout/ResponsiveContainer.tsx`
  - Wrapper that provides breakpoint context
  - Applies appropriate layout based on screen size

- ✅ Create `src/components/layout/StackedLayout.tsx`
  - Mobile-first vertical stacking
  - Full-width content areas

- ✅ Create `src/components/layout/SplitLayout.tsx`
  - Side-by-side layout for tablet/desktop
  - Configurable split ratio (e.g., 60/40)

- ✅ Create `src/components/layout/MobileNavigation.tsx`
  - Bottom navigation bar (60px + safe area)
  - Icons: Home, Upload, Gallery, Profile
  - Active state indicator
  - Hide on desktop

---

### Unit D: i18n & Styles ✅ COMPLETE

- ✅ Create `src/i18n/consent/en.json`
  ```json
  {
    "title": "Data Usage Consent",
    "message": "The images and Q&A you submit will be used to build a dataset...",
    "warning": "DO NOT submit personal or sensitive information.",
    "checkbox": "I understand and consent to the above terms",
    "cancel": "Cancel",
    "agree": "I Agree & Continue"
  }
  ```

- ✅ Create `src/i18n/consent/ja.json` (Japanese translation)

- ✅ Create `src/i18n/consent/zh.json` (Chinese translation)

- ✅ Create `src/i18n/consent/ko.json` (Korean translation - bonus)

- ✅ Create `src/styles/mobile.css`
  - Touch target minimum sizes (48px)
  - Mobile-specific spacing
  - Safe area padding for notched devices

---

### Unit E: Upload Flow ✅ COMPLETE

- ✅ Create `src/components/consent/StartContributingDialog.tsx`
  - Multi-language consent message (loads from i18n)
  - Checkbox for explicit consent
  - Cancel and Accept buttons
  - Calls `becomeContributor()` on accept

- ✅ Create `src/components/consent/ContributorGate.tsx`
  - Wrapper component for contributor-only actions
  - Shows dialog if not contributor
  - Passes through if contributor

- ✅ Create `src/components/upload/QuestionSelector.tsx`
  - Load questions via `useDefaultQuestions(docType, lang)`
  - Checkbox list with default questions pre-checked
  - Optional questions section
  - Custom question input field
  - Returns selected questions array

- ✅ Create `src/components/upload/CameraCapture.tsx`
  - HTML5 input with `capture="environment"`
  - Image preview before upload
  - "Take Photo" and "Choose from Gallery" options
  - Works on iOS Safari and Android Chrome

- ✅ Update `src/pages/FileUpload.tsx`
  - Wrap upload action with `ContributorGate`
  - Add `QuestionSelector` component
  - Add `CameraCapture` for mobile
  - Pass selected questions to annotation

---

### Unit F: Annotation Flow 🔗 (Depends on: Unit A, Unit B, Unit C)

- ✅ Create `src/components/annotation/ProgressDots.tsx`
  - Visual dots for question progress
  - States: pending (○), current (●), completed (✓)
  - Shows "3 of 5" text

- ✅ Create `src/components/annotation/QuestionNavigator.tsx`
  - Previous/Next buttons
  - Skip button
  - Progress dots
  - Current question display
  - Keyboard shortcut integration

- ✅ Create `src/components/annotation/ReadButton.tsx`
  - [📖 Read] button with loading state
  - Calls Bedrock Lambda with bounding box region
  - Extracts text and fills answer field
  - Captures model ID for tracking
  - Error handling with retry option
  - ✅ Improved prompt for value extraction (2026-01-25)
    - Extract value only (exclude labels like 登録番号:, 日付:)
    - Format: money → numbers only, date → yyyy/MM/dd, items → one per line
    - See [spec/proposals/20260125_improve_read_button_prompt.md](proposals/20260125_improve_read_button_prompt.md)

- ✅ Create `src/components/annotation/FinalizeScreen.tsx`
  - Summary: X questions answered, Y boxes drawn
  - "Upload Next Image" primary button
  - "Back to Gallery" secondary button
  - Session stats (optional)

- ✅ Create `src/components/annotation/AnnotationFlow.tsx`
  - Container managing question-by-question flow
  - State: currentQuestionIndex, answers, boxes
  - Box-first workflow enforcement
  - Auto-advance on save
  - Integrates all annotation components
  - **Responsive layout: stacked (mobile) / side-by-side (desktop)**
  - **Keyboard shortcuts for desktop (←→ navigate, D draw, S skip, Esc cancel)**

- ✅ Update `src/pages/AnnotationWorkspace.tsx`
  - Replace current layout with `AnnotationFlow`
  - Remove question add/remove during annotation
  - Add keyboard shortcut support
  - Responsive layout integration
  - **Load default questions from config when not passed via state**
  - **Unified UX for both desktop and mobile**
  - **Proposal**: See [spec/proposals/20260112_align_desktop_ux_with_mobile.md](proposals/20260112_align_desktop_ux_with_mobile.md)

---

### Unit G: Mobile Features ✅ COMPLETE

- ✅ Create `src/components/annotation/TouchCanvas.tsx`
  - Native touch events (touchstart, touchmove, touchend)
  - View mode: scroll/pan pass-through
  - Draw mode: single-finger box creation
  - Box selection by tap
  - Corner handles for resize (32×32px touch area)
  - Visual feedback during interactions
  - **Move functionality**: drag inside box to reposition
  - **Resize functionality**: drag corners to resize
  - **Proposal**: See [spec/proposals/20260125_bounding_box_move_resize.md](proposals/20260125_bounding_box_move_resize.md)

- ✅ Create `src/components/annotation/ModeBadge.tsx`
  - Fixed position indicator (top-right)
  - Shows "VIEW" (gray) or "DRAW" (blue pulsing)
  - Tappable to toggle mode (48px touch area)

- ✅ Create `src/components/annotation/ZoomControls.tsx` (as ZoomControlsMobile.tsx)
  - [+] zoom in button
  - [−] zoom out button
  - [Fit] reset to fit view
  - Touch-friendly sizing (48×48px each)

---

### Unit H: Integration & Testing 🔗 (Depends on: All Units)

**Page Updates:**
- ✅ Update `src/pages/Dashboard.tsx` for responsiveness
  - Card grid → stacked on mobile
  - Add "Start Contributing" banner for non-contributors

- ⬜ Update `src/pages/ImageGallery.tsx` for responsiveness
  - Grid column adjustment by breakpoint (partial - uses inline window.innerWidth)
  - Touch-friendly image cards

- ✅ Integrate `MobileNavigation` in `src/App.tsx`
  - Show on mobile only
  - Hide header nav on mobile

**Testing:**
- ✅ Touch target audit (2026-01-25)
  - All buttons ≥48×48px
  - All form inputs ≥48px height
  - Box corner handles ≥32×32px

- ⬜ Keyboard shortcut testing (desktop)
  - All shortcuts work as documented
  - No conflicts with browser shortcuts

- ⬜ Device testing
  - iPhone Safari
  - Android Chrome
  - iPad Safari
  - Desktop Chrome/Firefox/Safari

- ⬜ Flow testing
  - Upload → Select Questions → Annotate → Finalize → Next
  - Consent flow blocks upload without agreement
  - AI model tracking recorded correctly

- ✅ Performance check (2026-01-25)
  - Lighthouse mobile performance: 98 (target >70)
  - Lighthouse accessibility: 100

---

**Sprint 3 Acceptance Criteria:**
- ✅ Contributor consent dialog appears before first upload/annotation
- ✅ Consent stored as Cognito custom attributes (custom:contributor, custom:consent_date)
- ✅ Question selection works on Upload screen
- ✅ Default questions auto-load by document type + language
- ✅ Question-by-question navigation works
- ✅ Box-first workflow: draw → read/type → next
- ✅ [📖 Read] button extracts text from bounding box
- ✅ AI model ID recorded when Read is used
- ✅ Progress dots show completion status
- ✅ Keyboard shortcuts work on desktop
- ✅ Finalize screen shows summary
- ✅ All pages responsive at 375px width
- ✅ Bottom navigation works on mobile
- ✅ Camera capture works on iOS/Android
- ✅ Touch bounding box drawing works
- ✅ All touch targets ≥48px
- ✅ Lighthouse mobile score >70

---

## Sprint 4: Dataset Export & Model Evaluation

**Goal**: Publish datasets to Hugging Face and run parallel model evaluations with ANLS/IoU metrics
**Duration**: 2-3 weeks
**Deliverable**: Manual dataset export to HF Hub, parallel model evaluation with W&B tracking
**Proposal**: See [spec/proposals/20260125_dataset_export_evaluation.md](proposals/20260125_dataset_export_evaluation.md)

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Dataset Storage | Hugging Face Hub (not S3) | Avoid forcing users to download from our S3; HF handles hosting |
| Image Format | Compressed images embedded in Parquet | Self-contained dataset, no external dependencies |
| Coordinate Format | Normalized 0-1 range with width/height provided | Standard for VQA datasets, scale-independent |
| Primary Metrics | ANLS + IoU | DocVQA standard; ANLS for text, IoU for bounding boxes |
| Evaluation Config | JSON file in repo | Git-tracked, enables future auto-trigger on change |
| Trigger Method | Manual (UI buttons) | Simpler initial implementation; auto-trigger deferred |

---

### Phase 1: Foundation (Parallel Units A, B, E)

#### Unit A: Data Models

- ⬜ Update data schema in `amplify/data/resource.ts`
  ```typescript
  DatasetVersion: a.model({
    version: a.string().required(),           // e.g., "v1.0.0"
    huggingFaceRepoId: a.string().required(), // e.g., "icoxfog417/biz-doc-vqa"
    huggingFaceUrl: a.string().required(),    // Full URL
    annotationCount: a.integer().required(),
    imageCount: a.integer().required(),
    status: a.enum(['CREATING', 'READY', 'EVALUATING', 'FINALIZED']),
    createdAt: a.datetime().required(),
    finalizedAt: a.datetime(),
  }).authorization((allow) => [allow.authenticated()]),

  DatasetExportProgress: a.model({
    exportId: a.string().required(),
    version: a.string().required(),
    lastProcessedAnnotationId: a.string(),    // Checkpoint for resume
    processedCount: a.integer().required(),
    totalCount: a.integer().required(),
    status: a.enum(['IN_PROGRESS', 'COMPLETED', 'FAILED']),
    errorMessage: a.string(),
    startedAt: a.datetime().required(),
    updatedAt: a.datetime(),
  }).authorization((allow) => [allow.authenticated()]),

  EvaluationJob: a.model({
    jobId: a.string().required(),
    datasetVersion: a.string().required(),
    modelId: a.string().required(),
    status: a.enum(['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED']),
    avgAnls: a.float(),                       // 0-1 scale
    avgIou: a.float(),                        // 0-1 scale
    totalSamples: a.integer(),
    wandbRunUrl: a.string(),
    errorMessage: a.string(),
    startedAt: a.datetime(),
    completedAt: a.datetime(),
  }).authorization((allow) => [allow.authenticated()]),
  ```

- ⬜ Deploy and test schema changes in sandbox

#### Unit B: Configuration File

- ✅ Create `src/config/evaluation-models.json`
  ```json
  {
    "version": "1.0",
    "models": [
      {
        "id": "claude-3-5-sonnet",
        "name": "Claude 3.5 Sonnet",
        "provider": "bedrock",
        "bedrockModelId": "anthropic.claude-3-5-sonnet-20241022-v2:0",
        "enabled": true
      },
      {
        "id": "amazon-nova-pro",
        "name": "Amazon Nova Pro",
        "provider": "bedrock",
        "bedrockModelId": "amazon.nova-pro-v1:0",
        "enabled": true
      }
    ],
    "metrics": {
      "primary": ["anls", "iou"],
      "anlsThreshold": 0.5,
      "iouThreshold": 0.5
    }
  }
  ```

- ⬜ Create `src/hooks/useEvaluationModels.ts` to load config

#### Unit E: SQS Queue Setup

- ⬜ Set up SQS queue for evaluation jobs in `amplify/backend.ts`
  ```typescript
  import * as sqs from 'aws-cdk-lib/aws-sqs';
  import { Duration } from 'aws-cdk-lib';

  const evaluationQueue = new sqs.Queue(stack, 'EvaluationJobQueue', {
    visibilityTimeout: Duration.minutes(15),
    retentionPeriod: Duration.days(7),
    deadLetterQueue: {
      queue: dlq,
      maxReceiveCount: 3
    }
  });
  ```

- ⬜ Grant Lambda functions access to queue

---

### Phase 2: Lambda Functions (Units C, D, F)

#### Unit C: Dataset Export Lambda (Python)

- ⬜ Store Hugging Face API token in AWS Secrets Manager
  ```bash
  printf "your-hf-token" | npx ampx sandbox secret set HF_TOKEN
  ```

- ⬜ Create `amplify/functions/export-dataset/` directory

- ⬜ Create `amplify/functions/export-dataset/resource.ts`
  ```typescript
  import { defineFunction, secret } from '@aws-amplify/backend';

  export const exportDataset = defineFunction({
    name: 'exportDataset',
    runtime: 20,
    timeoutSeconds: 900, // 15 minutes
    memoryMB: 2048,
    environment: {
      HF_TOKEN: secret('HF_TOKEN'),
      STORAGE_BUCKET_NAME: process.env.STORAGE_BUCKET_NAME,
    }
  });
  ```

- ⬜ Implement handler with checkpoint/resume capability
  - ⬜ Create DatasetExportProgress record at start
  - ⬜ Query approved annotations (status='APPROVED')
  - ⬜ Checkpoint every 100 annotations (update lastProcessedAnnotationId)
  - ⬜ Download compressed images from S3
  - ⬜ Normalize bounding boxes to 0-1 range
    ```python
    normalized_bbox = [
        bbox[0] / image['compressedWidth'],   # x0
        bbox[1] / image['compressedHeight'],  # y0
        bbox[2] / image['compressedWidth'],   # x1
        bbox[3] / image['compressedHeight'],  # y1
    ]
    ```
  - ⬜ Build dataset with HF datasets schema
    ```python
    features = Features({
        "question_id": Value("string"),
        "image": Image(),
        "image_width": Value("int32"),
        "image_height": Value("int32"),
        "question": Value("string"),
        "answers": Sequence(Value("string")),
        "answer_bbox": Sequence(Value("float32"), length=4),
        "document_type": Value("string"),
        "question_type": Value("string"),
        "language": Value("string"),
    })
    ```
  - ⬜ Push to Hugging Face Hub with version tag
  - ⬜ Update DatasetVersion record (status=READY)
  - ⬜ Handle errors and update progress to FAILED

- ⬜ Update `amplify/backend.ts` to include export-dataset function

#### Unit D: Evaluation Lambda (Python)

- ⬜ Store W&B API key in AWS Secrets Manager
  ```bash
  printf "your-wandb-api-key" | npx ampx sandbox secret set WANDB_API_KEY
  ```

- ⬜ Create `amplify/functions/run-evaluation/` directory

- ⬜ Create `amplify/functions/run-evaluation/resource.ts`
  ```typescript
  import { defineFunction, secret } from '@aws-amplify/backend';

  export const runEvaluation = defineFunction({
    name: 'runEvaluation',
    runtime: 20,
    timeoutSeconds: 900,
    memoryMB: 2048,
    environment: {
      WANDB_API_KEY: secret('WANDB_API_KEY'),
      WANDB_PROJECT: 'biz-doc-vqa',
    }
  });
  ```

- ⬜ Implement ANLS metric calculation
  ```python
  def calculate_anls(prediction: str, ground_truths: list, threshold: float = 0.5) -> float:
      """ANLS = 1 - NLD (Normalized Levenshtein Distance)"""
      max_anls = 0
      pred_norm = prediction.lower().strip()
      for gt in ground_truths:
          gt_norm = gt.lower().strip()
          lev_dist = levenshtein_distance(pred_norm, gt_norm)
          max_len = max(len(pred_norm), len(gt_norm), 1)
          anls = 1 - (lev_dist / max_len)
          if anls < threshold:
              anls = 0
          max_anls = max(max_anls, anls)
      return max_anls
  ```

- ⬜ Implement IoU metric calculation
  ```python
  def calculate_iou(pred_bbox: list, gt_bbox: list) -> float:
      """IoU for bounding boxes in normalized 0-1 coordinates [x0, y0, x1, y1]"""
      x1 = max(pred_bbox[0], gt_bbox[0])
      y1 = max(pred_bbox[1], gt_bbox[1])
      x2 = min(pred_bbox[2], gt_bbox[2])
      y2 = min(pred_bbox[3], gt_bbox[3])
      intersection = max(0, x2 - x1) * max(0, y2 - y1)
      pred_area = (pred_bbox[2] - pred_bbox[0]) * (pred_bbox[3] - pred_bbox[1])
      gt_area = (gt_bbox[2] - gt_bbox[0]) * (gt_bbox[3] - gt_bbox[1])
      union = pred_area + gt_area - intersection
      return intersection / union if union > 0 else 0
  ```

- ⬜ Implement evaluation handler
  - ⬜ Update EvaluationJob status to RUNNING
  - ⬜ Stream dataset from HF Hub
  - ⬜ Run model predictions via Bedrock (load model from config)
  - ⬜ Calculate ANLS and IoU per sample
  - ⬜ Log results incrementally to W&B
  - ⬜ Update EvaluationJob with final metrics (avgAnls, avgIou)
  - ⬜ Handle errors and update status to FAILED

- ⬜ Configure SQS trigger for parallel model evaluation
  ```typescript
  evaluationLambda.addEventSource(
    new SqsEventSource(evaluationQueue, {
      batchSize: 1,  // One model per Lambda invocation
      reportBatchItemFailures: true
    })
  );
  ```

#### Unit F: Trigger Lambda (Node.js)

- ⬜ Create `amplify/functions/trigger-evaluation/` directory

- ⬜ Create `amplify/functions/trigger-evaluation/resource.ts`

- ⬜ Implement handler
  - ⬜ Read enabled models from `evaluation-models.json`
  - ⬜ Create EvaluationJob records for each model (status=QUEUED)
  - ⬜ Send SQS messages for each model
  - ⬜ Return job IDs to caller

- ⬜ Add GraphQL mutation for manual trigger
  ```typescript
  triggerEvaluation: a.mutation()
    .arguments({
      datasetVersion: a.string().required(),
      modelIds: a.string().array(),  // Optional, defaults to all enabled
    })
    .returns(a.string().array())  // Returns job IDs
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(triggerEvaluation)),
  ```

---

### Phase 3: Frontend UI (Unit G)

#### Unit G: Dataset Management Page

- ⬜ Create `src/pages/DatasetManagement.tsx`
  - ⬜ Dataset Versions section
    - ⬜ List all DatasetVersion records
    - ⬜ Show status badge (CREATING, READY, EVALUATING, FINALIZED)
    - ⬜ Display annotation count and image count
    - ⬜ Link to Hugging Face dataset page
  - ⬜ Export section
    - ⬜ "Create New Version" button
    - ⬜ Version input field (default: increment from latest)
    - ⬜ Show export progress (IN_PROGRESS, COMPLETED, FAILED)
    - ⬜ Display checkpoint info for resume capability
  - ⬜ Evaluation section
    - ⬜ Model selector (checkboxes from evaluation-models.json)
    - ⬜ Dataset version selector
    - ⬜ "Run Evaluation" button
    - ⬜ Evaluation jobs table
      - ⬜ Columns: Model, Status, ANLS, IoU, W&B Link
      - ⬜ Status badge component (QUEUED, RUNNING, COMPLETED, FAILED)
    - ⬜ Poll for status updates (every 10 seconds when jobs running)

- ⬜ Add navigation to DatasetManagement page
  - ⬜ Add link in Dashboard
  - ⬜ Add route in App.tsx

- ⬜ Update Dashboard
  - ⬜ Add "Latest Dataset" widget
  - ⬜ Show recent evaluation results summary
  - ⬜ Quick link to W&B project

---

### Phase 4: Testing & Documentation

- ⬜ Test dataset export
  - ⬜ Export 100+ annotations to HF Hub
  - ⬜ Verify Parquet format is correct
  - ⬜ Verify images are embedded correctly
  - ⬜ Verify bounding boxes are normalized (0-1 range)
  - ⬜ Test resume after simulated failure (checkpoint)

- ⬜ Test evaluation pipeline
  - ⬜ Run evaluation on test dataset
  - ⬜ Verify ANLS calculation matches manual check
  - ⬜ Verify IoU calculation matches manual check
  - ⬜ Test parallel model evaluation (multiple models)
  - ⬜ Check W&B dashboard shows comparison

- ⬜ Test error handling
  - ⬜ Simulate HF Hub upload failure
  - ⬜ Simulate Bedrock API failure
  - ⬜ Verify failed jobs show error messages
  - ⬜ Test DLQ for failed messages

- ⬜ Documentation
  - ⬜ Update README with dataset export workflow
  - ⬜ Document evaluation metrics (ANLS, IoU)
  - ⬜ Document evaluation-models.json configuration
  - ⬜ Create HF Hub dataset card template
  - ⬜ Document W&B project structure

**Sprint 4 Acceptance Criteria:**
- ⬜ Dataset export works for 1,000+ annotations
- ⬜ Resume works after simulated failure (checkpoint system)
- ⬜ ANLS/IoU metrics match manual calculation
- ⬜ W&B shows model comparison dashboard
- ⬜ Manual trigger from UI works end-to-end
- ⬜ Compressed images embedded in Parquet correctly
- ⬜ Bounding boxes normalized to 0-1 range
- ⬜ Unicode characters preserved (Japanese, Chinese text)
- ⬜ HF Hub dataset page accessible with correct schema
- ⬜ Multiple models can be evaluated in parallel

---

## Sprint 5: Multi-Language Support & Image Optimization

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

**Sprint 5 Acceptance Criteria:**
- ✅ Users can select language when uploading images
- ✅ Images can be filtered by language
- ✅ Bedrock prompts use appropriate language
- ✅ Multiple Bedrock models are supported
- ✅ Progressive image loading works
- ✅ Settings page allows model configuration

Note: Image compression tasks moved to Sprint 2. See [spec/proposals/20260111_move_compression_to_sprint2.md](proposals/20260111_move_compression_to_sprint2.md)

---

## Sprint 6: Advanced Mobile Features

**Goal**: Advanced mobile gestures, offline support, and polish
**Duration**: 2 weeks
**Deliverable**: Pinch-to-zoom, offline PWA, advanced gestures
**Note**: Basic mobile features (camera, touch, responsive) are in Sprint 3

### Advanced Gesture Support
- ⬜ Implement gesture library integration (Hammer.js or similar)
- ⬜ Pinch-to-zoom gesture support
  - ⬜ Two-finger pinch to zoom in/out
  - ⬜ Smooth zoom transitions
  - ⬜ Zoom level limits (0.5x - 4x)
- ⬜ Two-finger pan gesture
  - ⬜ Pan while zoomed
  - ⬜ Momentum scrolling
- ⬜ Long-press for context menu
- ⬜ Haptic feedback on interactions (where supported)

### Offline Support (PWA)
- ⬜ Configure service worker for offline caching
- ⬜ Cache static assets and app shell
- ⬜ Queue uploads when offline
- ⬜ Sync queued items when back online
- ⬜ Show offline indicator in UI
- ⬜ Add PWA manifest
  ```json
  {
    "name": "Business OCR Annotator",
    "short_name": "OCR Annotator",
    "start_url": "/",
    "display": "standalone"
  }
  ```

### Performance Optimization for Mobile
- ⬜ Implement lazy loading for images
- ⬜ Optimize bundle size
  ```bash
  npm install --save-dev webpack-bundle-analyzer
  ```
- ⬜ Code splitting for routes
- ⬜ Test on 3G/4G networks (throttling)
- ⬜ Measure page load times on mobile devices
- ⬜ Skeleton loading states for better perceived performance

### Common Components
- ⬜ Create NotificationToast component
- ⬜ Implement LoadingSpinner
- ⬜ Create ErrorBoundary
- ⬜ Implement ConfirmDialog (mobile-friendly)
- ⬜ Create Tooltip component
- ⬜ Implement ProgressBar

**Sprint 6 Acceptance Criteria:**
- ✅ Pinch-to-zoom works smoothly
- ✅ Two-finger pan gesture works while zoomed
- ✅ App works offline (basic functionality)
- ✅ Uploads queue when offline and sync when online
- ✅ PWA installable on mobile devices
- ✅ App performs well on slow networks
- ✅ Skeleton loading improves perceived performance

---

## Sprint 7: Dataset Publishing & PII Handling

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

**Sprint 7 Acceptance Criteria:**
- ✅ Datasets can be exported in JSON, JSONL, Parquet
- ✅ Bounding box normalization works correctly
- ✅ PII detection identifies sensitive data
- ✅ PII can be redacted from images and text
- ✅ Datasets can be published to Hugging Face
- ✅ Dataset card is auto-generated
- ✅ Publication URL is stored and displayed

---

## Sprint 8: Production Readiness & Polish

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

**Sprint 8 Acceptance Criteria:**
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

**Last Review Date**: 2026-01-25
**Next Review Date**: TBD
**Completed Tasks**: Sprint 0 + Sprint 1 + Sprint 2 completed
**Current Sprint**: Sprint 4 (Dataset Export & Model Evaluation)

### Sprint Completion Status
- ✅ Sprint 0: Foundation & Deployment
- ✅ Sprint 1: Image Upload & Manual Annotation (MVP)
- ✅ Sprint 2: AI-Assisted Annotation
- ✅ Sprint 3: UX & Mobile UI Optimization
- ⬜ Sprint 4: Dataset Export & Model Evaluation
- ⬜ Sprint 5: Multi-Language Support & Optimization
- ⬜ Sprint 6: Advanced Mobile Features
- ⬜ Sprint 7: Publishing & PII Handling
- ⬜ Sprint 8: Production Readiness

### Deferred from Sprint 2
- ⬜ Per-user contribution tracking (REQ-AW-013, REQ-AW-014)
  - Requires User model implementation
  - Currently shows global stats only (Dashboard displays AI vs Human counts)
- ⬜ Test model inference with sample images
  - Using mock fallback implementation currently
  - DefaultQuestionManager uses fallback question generation

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
