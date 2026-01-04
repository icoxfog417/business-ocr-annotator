# Design Specification

**Project**: Business OCR Annotator
**Version**: 1.0
**Last Updated**: 2026-01-04

## 1. Architecture Overview

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Upload UI  │  │ Annotation UI│  │ Dashboard UI │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTPS/GraphQL
┌────────────────────────┴────────────────────────────────────────┐
│                    AWS Amplify Gen2 Layer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Auth       │  │   AppSync    │  │  Functions   │          │
│  │  (Cognito)   │  │  (GraphQL)   │  │  (Lambda)    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────────────┐
│                      Backend Services                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Storage    │  │   Database   │  │  AI Service  │          │
│  │    (S3)      │  │  (DynamoDB)  │  │   (Qwen)     │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────────────┐
│                  External Integrations                           │
│  ┌──────────────────────────────────────────────────┐           │
│  │         Hugging Face Dataset Hub                 │           │
│  └──────────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Technology Stack

#### Frontend
- **Framework**: React 18+ with TypeScript
- **UI Library**: AWS Amplify UI Components + Custom components
- **State Management**: React Context API + Amplify DataStore
- **Image Annotation**: Custom canvas-based component or react-image-annotate
- **Routing**: React Router v6

#### Backend
- **Infrastructure**: AWS Amplify Gen2
- **Authentication**: AWS Cognito
- **API**: AWS AppSync (GraphQL)
- **Functions**: AWS Lambda (Node.js 18+)
- **Storage**: AWS S3 for images
- **Database**: AWS DynamoDB
- **File Processing**: Lambda + Sharp for image processing

#### AI/ML
- **OCR Model**: Qwen (open-weight model)
- **Model Hosting**: External API or AWS SageMaker endpoint
- **Inference**: Lambda functions for orchestration

#### External Services
- **Dataset Platform**: Hugging Face Hub API
- **Version Control**: Git for code, Hugging Face for datasets

## 2. Data Models

### 2.1 Database Schema (DynamoDB)

#### Image Table
```typescript
interface Image {
  id: string;                    // Partition Key (UUID)
  datasetId: string;             // Sort Key (GSI)

  // Image versions (multiple sizes for different use cases)
  s3KeyOriginal: string;         // S3 key for original high-res image
  s3KeyCompressed: string;       // S3 key for model-optimized image (≤4MB)
  s3KeyThumbnail: string;        // S3 key for thumbnail (≤100KB)
  s3Url: string;                 // Presigned URL (temporary, points to compressed by default)
  s3UrlOriginal?: string;        // Presigned URL for original (on-demand)

  fileName: string;              // Original filename
  originalSize: number;          // Original file size in bytes
  compressedSize: number;        // Compressed file size in bytes
  thumbnailSize: number;         // Thumbnail file size in bytes
  compressionRatio: number;      // compressedSize / originalSize

  mimeType: string;              // image/jpeg, image/png, etc.
  documentType: DocumentType;    // Receipt, Invoice, etc.
  uploadedBy: string;            // User ID
  uploadedAt: string;            // ISO timestamp
  status: ImageStatus;           // Uploaded, Processing, Annotated, Validated
  processingError?: string;      // Error message if processing failed

  metadata: {
    original: {
      width: number;
      height: number;
    };
    compressed: {
      width: number;
      height: number;
    };
    exif?: Record<string, any>;
  };

  createdAt: string;
  updatedAt: string;
}

enum DocumentType {
  RECEIPT = 'RECEIPT',
  ORDER_FORM = 'ORDER_FORM',
  OFFICIAL_FORM = 'OFFICIAL_FORM',
  INVOICE = 'INVOICE',
  CONTRACT = 'CONTRACT',
  OTHER = 'OTHER'
}

enum ImageStatus {
  UPLOADED = 'UPLOADED',
  PROCESSING = 'PROCESSING',
  ANNOTATED = 'ANNOTATED',
  VALIDATED = 'VALIDATED',
  FAILED = 'FAILED'
}
```

#### Annotation Table
```typescript
interface Annotation {
  id: string;                    // Partition Key (UUID)
  imageId: string;               // Sort Key (GSI)
  datasetId: string;             // GSI
  question: string;              // The question text
  answer: string;                // The answer text
  questionType: QuestionType;    // Classification of question
  boundingBoxes: BoundingBox[];  // Answer evidence areas
  generatedBy: GenerationSource; // AI or Human
  modelVersion?: string;         // Model that generated this (if AI)
  confidence?: number;           // Model confidence (0-1)
  validationStatus: ValidationStatus;
  validatedBy?: string;          // User ID who validated
  validatedAt?: string;          // ISO timestamp
  rejectionReason?: string;      // If rejected
  editHistory: AnnotationEdit[]; // Track changes
  createdAt: string;
  updatedAt: string;
}

interface BoundingBox {
  id: string;                    // UUID
  x: number;                     // Top-left x (normalized 0-1)
  y: number;                     // Top-left y (normalized 0-1)
  width: number;                 // Width (normalized 0-1)
  height: number;                // Height (normalized 0-1)
  label?: string;                // Optional label
}

enum QuestionType {
  INFORMATION_EXTRACTION = 'INFORMATION_EXTRACTION',
  ITEM_IDENTIFICATION = 'ITEM_IDENTIFICATION',
  DATE_TIME = 'DATE_TIME',
  ENTITY_RECOGNITION = 'ENTITY_RECOGNITION',
  CALCULATION = 'CALCULATION',
  OTHER = 'OTHER'
}

enum GenerationSource {
  AI = 'AI',
  HUMAN = 'HUMAN'
}

enum ValidationStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  FLAGGED = 'FLAGGED'
}

interface AnnotationEdit {
  editedBy: string;              // User ID
  editedAt: string;              // ISO timestamp
  field: string;                 // What was edited
  oldValue: any;
  newValue: any;
}
```

#### Dataset Table
```typescript
interface Dataset {
  id: string;                    // Partition Key (UUID)
  name: string;
  description: string;
  createdBy: string;             // User ID
  createdAt: string;
  updatedAt: string;
  status: DatasetStatus;
  statistics: DatasetStatistics;
  versions: DatasetVersion[];    // Version history
}

enum DatasetStatus {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED'
}

interface DatasetStatistics {
  totalImages: number;
  totalAnnotations: number;
  validatedAnnotations: number;
  documentTypeDistribution: Record<DocumentType, number>;
  questionTypeDistribution: Record<QuestionType, number>;
  approvalRate: number;          // Percentage
  lastUpdated: string;
}

interface DatasetVersion {
  version: string;               // Semantic version (1.0.0)
  createdAt: string;
  createdBy: string;
  changelog: string;
  imageCount: number;
  annotationCount: number;
  huggingFaceUrl?: string;       // Published URL
  exportUrls: {
    json?: string;               // S3 URL
    jsonl?: string;
    parquet?: string;
  };
  status: VersionStatus;
}

enum VersionStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED'
}
```

#### User Table
```typescript
interface User {
  id: string;                    // Partition Key (Cognito User ID)
  email: string;
  name: string;
  role: UserRole;
  assignedAnnotations: string[]; // Annotation IDs
  statistics: UserStatistics;
  createdAt: string;
  updatedAt: string;
}

enum UserRole {
  ADMIN = 'ADMIN',
  CURATOR = 'CURATOR',
  ANNOTATOR = 'ANNOTATOR',
  VIEWER = 'VIEWER'
}

interface UserStatistics {
  totalAnnotationsReviewed: number;
  totalApproved: number;
  totalRejected: number;
  averageReviewTime: number;     // Seconds
  accuracy: number;              // Inter-annotator agreement
}
```

### 2.2 GraphQL Schema

```graphql
# Queries
type Query {
  # Images
  getImage(id: ID!): Image
  listImages(datasetId: ID!, filter: ImageFilter, limit: Int, nextToken: String): ImageConnection

  # Annotations
  getAnnotation(id: ID!): Annotation
  listAnnotationsByImage(imageId: ID!): [Annotation]
  listAnnotationsByDataset(datasetId: ID!, filter: AnnotationFilter, limit: Int): AnnotationConnection

  # Datasets
  getDataset(id: ID!): Dataset
  listDatasets(filter: DatasetFilter): [Dataset]
  getDatasetStatistics(datasetId: ID!): DatasetStatistics

  # User
  getCurrentUser: User
  getUserStatistics(userId: ID!): UserStatistics
}

# Mutations
type Mutation {
  # Images
  createImage(input: CreateImageInput!): Image
  updateImage(id: ID!, input: UpdateImageInput!): Image
  deleteImage(id: ID!): DeleteImageResult

  # Annotations
  createAnnotation(input: CreateAnnotationInput!): Annotation
  updateAnnotation(id: ID!, input: UpdateAnnotationInput!): Annotation
  deleteAnnotation(id: ID!): DeleteAnnotationResult
  validateAnnotation(id: ID!, status: ValidationStatus!, reason: String): Annotation

  # AI Generation
  generateAnnotations(imageId: ID!): GenerateAnnotationsResult

  # Datasets
  createDataset(input: CreateDatasetInput!): Dataset
  updateDataset(id: ID!, input: UpdateDatasetInput!): Dataset
  createDatasetVersion(datasetId: ID!, input: CreateVersionInput!): DatasetVersion
  publishToHuggingFace(datasetId: ID!, version: String!): PublishResult

  # Batch operations
  batchValidateAnnotations(input: BatchValidateInput!): BatchValidateResult
}

# Subscriptions
type Subscription {
  onImageProcessed(datasetId: ID!): Image
  onAnnotationCreated(imageId: ID!): Annotation
  onAnnotationValidated(imageId: ID!): Annotation
}

# Types
type Image {
  id: ID!
  datasetId: ID!
  s3Url: String!
  fileName: String!
  documentType: DocumentType!
  status: ImageStatus!
  annotations: [Annotation]
  metadata: ImageMetadata
  createdAt: AWSDateTime!
  updatedAt: AWSDateTime!
}

type Annotation {
  id: ID!
  imageId: ID!
  image: Image
  question: String!
  answer: String!
  questionType: QuestionType!
  boundingBoxes: [BoundingBox!]!
  generatedBy: GenerationSource!
  confidence: Float
  validationStatus: ValidationStatus!
  validatedBy: User
  validatedAt: AWSDateTime
  createdAt: AWSDateTime!
  updatedAt: AWSDateTime!
}

# ... Additional types
```

## 3. Component Design

### 3.1 Frontend Components

#### Component Hierarchy
```
App
├── AuthenticatedApp
│   ├── Navigation
│   ├── Router
│   │   ├── Dashboard
│   │   │   ├── StatisticsCards
│   │   │   ├── DocumentTypeChart
│   │   │   └── RecentActivity
│   │   ├── ImageUpload
│   │   │   ├── FileDropzone
│   │   │   ├── CameraCapture (mobile-specific)
│   │   │   ├── ImagePreview
│   │   │   └── UploadProgress
│   │   ├── ImageGallery
│   │   │   ├── ImageGrid
│   │   │   ├── FilterPanel
│   │   │   └── ImageCard
│   │   ├── AnnotationWorkspace
│   │   │   ├── ImageViewer
│   │   │   │   ├── CanvasAnnotator / TouchAnnotator (responsive)
│   │   │   │   ├── ZoomControls
│   │   │   │   └── ProgressiveImageLoader
│   │   │   ├── QuestionList
│   │   │   │   └── QuestionItem
│   │   │   ├── AnnotationEditor
│   │   │   │   ├── QuestionInput
│   │   │   │   ├── AnswerInput
│   │   │   │   └── BoundingBoxEditor
│   │   │   └── ValidationControls
│   │   ├── DatasetManagement
│   │   │   ├── DatasetList
│   │   │   ├── DatasetDetails
│   │   │   ├── VersionHistory
│   │   │   └── ExportDialog
│   │   └── Settings
│   │       ├── ModelConfiguration
│   │       ├── UserManagement
│   │       └── HuggingFaceSettings
│   └── Notifications
└── UnauthenticatedApp
    ├── Login
    └── SignUp
```

#### Key Component Specifications

##### CanvasAnnotator
```typescript
interface CanvasAnnotatorProps {
  imageUrl: string;
  boundingBoxes: BoundingBox[];
  selectedBoxId?: string;
  onBoundingBoxChange: (boxes: BoundingBox[]) => void;
  onBoundingBoxSelect: (boxId: string) => void;
  mode: 'view' | 'edit';
}

// Features:
// - Render image with overlay canvas
// - Draw bounding boxes with labels
// - Support drag-to-create new boxes
// - Support drag corners/edges to resize
// - Support drag box to move
// - Highlight selected box
// - Zoom and pan controls
```

##### QuestionList
```typescript
interface QuestionListProps {
  annotations: Annotation[];
  selectedAnnotationId?: string;
  onSelectAnnotation: (id: string) => void;
  onValidate: (id: string, status: ValidationStatus) => void;
  onEdit: (id: string) => void;
}

// Features:
// - List all questions for current image
// - Show validation status badges
// - Show confidence scores
// - Filter by status
// - Sort by various criteria
```

##### CameraCapture (Mobile-Specific)
```typescript
interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onCancel: () => void;
  documentType?: DocumentType;
}

// Features:
// - Access device camera via HTML5 capture API
// - Show live camera preview
// - Capture photo on button press
// - Support front/back camera switching
// - Show captured image preview before confirmation
// - Handle camera permissions gracefully
```

##### TouchAnnotator (Mobile-Specific)
```typescript
interface TouchAnnotatorProps {
  imageUrl: string;
  boundingBoxes: BoundingBox[];
  selectedBoxId?: string;
  onBoundingBoxChange: (boxes: BoundingBox[]) => void;
  onBoundingBoxSelect: (boxId: string) => void;
}

// Features:
// - Touch-friendly bounding box manipulation
// - Pinch-to-zoom gesture support
// - Two-finger pan gesture
// - Large touch targets (minimum 44x44px)
// - Corner handles for resizing (minimum 12px touch area)
// - Tap to select box
// - Long-press to show context menu
// - Haptic feedback on interactions (if available)
```

##### ProgressiveImageLoader
```typescript
interface ProgressiveImageLoaderProps {
  thumbnailUrl: string;
  compressedUrl: string;
  originalUrl: string;
  onLoadComplete: () => void;
  showOriginalOption?: boolean;
}

// Features:
// - Load thumbnail first for instant display
// - Load compressed image progressively
// - Option to load original on demand
// - Show loading progress indicator
// - Optimize for mobile network conditions
// - Cache loaded images in browser
// - Handle network errors gracefully
```

### 3.2 Backend Components

#### Lambda Functions

##### ImageProcessor
```typescript
// Trigger: S3 upload event
// Purpose: Process uploaded images and generate multiple versions
async function handler(event: S3Event) {
  // 1. Get original image from S3
  const originalImage = await s3.getObject({ Key: s3KeyOriginal });

  // 2. Extract metadata (dimensions, EXIF)
  const metadata = await sharp(originalImage).metadata();

  // 3. Generate compressed version (≤4MB for model processing)
  const compressed = await compressImage(originalImage, {
    maxSize: 4 * 1024 * 1024,  // 4MB
    maxDimension: 2048,
    quality: 90
  });

  // 4. Generate thumbnail (≤100KB for gallery view)
  const thumbnail = await sharp(originalImage)
    .resize(200, 200, { fit: 'inside' })
    .jpeg({ quality: 80 })
    .toBuffer();

  // 5. Upload compressed and thumbnail to S3
  await Promise.all([
    s3.putObject({ Key: s3KeyCompressed, Body: compressed }),
    s3.putObject({ Key: s3KeyThumbnail, Body: thumbnail })
  ]);

  // 6. Update DynamoDB with all metadata
  await updateImageRecord({
    s3KeyOriginal,
    s3KeyCompressed,
    s3KeyThumbnail,
    originalSize: originalImage.length,
    compressedSize: compressed.length,
    thumbnailSize: thumbnail.length,
    compressionRatio: compressed.length / originalImage.length,
    metadata: {
      original: { width: metadata.width, height: metadata.height },
      compressed: await sharp(compressed).metadata(),
      exif: metadata.exif
    }
  });

  // 7. Trigger annotation generation using compressed image
  await triggerAnnotationGeneration(s3KeyCompressed);

  // 8. Update status to PROCESSING
  await updateImageStatus(imageId, 'PROCESSING');
}

// Helper function for smart compression
async function compressImage(
  buffer: Buffer,
  options: { maxSize: number; maxDimension: number; quality: number }
): Promise<Buffer> {
  const metadata = await sharp(buffer).metadata();

  // Calculate dimensions maintaining aspect ratio
  let { width, height } = metadata;
  if (width > options.maxDimension || height > options.maxDimension) {
    const ratio = Math.min(
      options.maxDimension / width,
      options.maxDimension / height
    );
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  // Iteratively compress until under maxSize
  let quality = options.quality;
  let compressed: Buffer;

  do {
    compressed = await sharp(buffer)
      .resize(width, height, { fit: 'inside' })
      .jpeg({ quality, progressive: true })
      .toBuffer();

    if (compressed.length > options.maxSize && quality > 50) {
      quality -= 5;
    } else {
      break;
    }
  } while (quality >= 50);

  return compressed;
}
```

##### AnnotationGenerator
```typescript
// Trigger: Manual invocation or ImageProcessor
// Purpose: Generate AI annotations
async function handler(event: { imageId: string }) {
  // 1. Fetch image from S3
  // 2. Call Qwen model API
  // 3. Parse model response
  // 4. Create annotation records in DynamoDB
  // 5. Update image status to ANNOTATED
  // 6. Publish notification via AppSync subscription
}
```

##### DatasetExporter
```typescript
// Trigger: Manual invocation
// Purpose: Export dataset version
async function handler(event: { datasetId: string, version: string, format: string }) {
  // 1. Fetch all validated annotations
  // 2. Format data (JSON/JSONL/Parquet)
  // 3. Upload to S3
  // 4. Update version record with export URL
  // 5. Optionally publish to Hugging Face
}
```

##### HuggingFacePublisher
```typescript
// Trigger: Manual invocation
// Purpose: Publish dataset to Hugging Face
async function handler(event: { datasetId: string, version: string }) {
  // 1. Fetch dataset export from S3
  // 2. Generate dataset card (README.md)
  // 3. Use Hugging Face API to create/update dataset
  // 4. Upload files to Hugging Face
  // 5. Update version record with HF URL
}
```

## 4. API Integrations

### 4.1 Qwen Model Integration

```typescript
interface QwenRequest {
  image: string;                 // Base64 encoded or URL
  taskType: 'ocr_annotation';
  parameters: {
    maxQuestions: number;
    questionTypes: QuestionType[];
    language: string;
  };
}

interface QwenResponse {
  annotations: {
    question: string;
    answer: string;
    questionType: string;
    confidence: number;
    boundingBoxes: {
      x: number;
      y: number;
      width: number;
      height: number;
    }[];
  }[];
  processingTime: number;
}

class QwenClient {
  async generateAnnotations(imageUrl: string, config: QwenConfig): Promise<Annotation[]>
  async healthCheck(): Promise<boolean>
}
```

### 4.2 Hugging Face Integration

```typescript
interface HuggingFaceClient {
  // Dataset operations
  createDataset(name: string, config: DatasetConfig): Promise<string>
  uploadFile(datasetId: string, file: Buffer, filename: string): Promise<void>
  createDatasetCard(datasetId: string, metadata: DatasetMetadata): Promise<void>

  // Version operations
  createTag(datasetId: string, tag: string): Promise<void>

  // Dataset info
  getDatasetInfo(datasetId: string): Promise<DatasetInfo>
}

interface DatasetConfig {
  private: boolean;
  license: string;
  tags: string[];
  task_categories: string[];
}

interface DatasetMetadata {
  title: string;
  description: string;
  authors: string[];
  version: string;
  size: number;
  format: string;
  examples: Example[];
}
```

## 5. Security Design

### 5.1 Authentication & Authorization

```typescript
// Cognito User Pools for authentication
// IAM policies for service-to-service auth
// API Gateway/AppSync for request authentication

// Role-based access control
const permissions = {
  ADMIN: ['*'],
  CURATOR: [
    'image:*',
    'annotation:*',
    'dataset:*',
    'user:read'
  ],
  ANNOTATOR: [
    'image:read',
    'annotation:create',
    'annotation:update',
    'annotation:validate'
  ],
  VIEWER: [
    'image:read',
    'annotation:read',
    'dataset:read'
  ]
};

// GraphQL resolver authorization
function checkPermission(user: User, resource: string, action: string): boolean {
  const requiredPermission = `${resource}:${action}`;
  const userPermissions = permissions[user.role];
  return userPermissions.includes('*') ||
         userPermissions.includes(requiredPermission) ||
         userPermissions.includes(`${resource}:*`);
}
```

### 5.2 Data Protection

- S3 bucket encryption at rest (AES-256)
- HTTPS for all data in transit
- Presigned URLs with expiration for image access
- DynamoDB encryption at rest
- Secrets Manager for API keys and credentials

## 6. Performance Optimization

### 6.1 Caching Strategy

```typescript
// CloudFront for static assets
// AppSync query caching for dashboard statistics
// DynamoDB DAX for hot data
// Browser caching for images with ETag

const cacheConfig = {
  images: {
    ttl: 86400,              // 24 hours
    storage: 'cloudfront'
  },
  statistics: {
    ttl: 300,                // 5 minutes
    storage: 'appsync'
  },
  annotations: {
    ttl: 60,                 // 1 minute
    storage: 'browser'
  }
};
```

### 6.2 Image Processing

```typescript
// Generate multiple sizes for responsive display
const imageSizes = {
  thumbnail: { width: 200, height: 200 },
  medium: { width: 800, height: 600 },
  large: { width: 1600, height: 1200 },
  original: { preserveOriginal: true }
};

// Lazy loading with Intersection Observer
// Progressive JPEG encoding
// WebP format with fallback
```

## 7. Error Handling

### 7.1 Error Types

```typescript
enum ErrorCode {
  // Client errors (4xx)
  INVALID_INPUT = 'INVALID_INPUT',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',

  // Server errors (5xx)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  MODEL_API_ERROR = 'MODEL_API_ERROR',
  STORAGE_ERROR = 'STORAGE_ERROR'
}

interface AppError {
  code: ErrorCode;
  message: string;
  details?: Record<string, any>;
  retryable: boolean;
}
```

### 7.2 Retry Logic

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  backoff: number = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1 || !isRetryable(error)) {
        throw error;
      }
      await sleep(backoff * Math.pow(2, i));
    }
  }
  throw new Error('Max retries exceeded');
}
```

## 8. Monitoring & Logging

### 8.1 Metrics

```typescript
// CloudWatch metrics to track
const metrics = [
  'ImageUploadCount',
  'AnnotationGenerationCount',
  'AnnotationValidationCount',
  'ModelAPILatency',
  'ModelAPIErrors',
  'DatasetExportCount',
  'UserActiveCount'
];

// CloudWatch alarms
const alarms = [
  { metric: 'ModelAPIErrors', threshold: 10, period: 300 },
  { metric: 'ModelAPILatency', threshold: 30000, period: 300 },
  { metric: 'LambdaErrors', threshold: 5, period: 60 }
];
```

### 8.2 Logging

```typescript
// Structured logging with context
interface LogContext {
  requestId: string;
  userId?: string;
  imageId?: string;
  annotationId?: string;
  operation: string;
}

class Logger {
  info(message: string, context: LogContext): void
  warn(message: string, context: LogContext): void
  error(message: string, error: Error, context: LogContext): void
}
```

## 9. Deployment Architecture

### 9.1 Environments

- **Development**: Local + AWS dev account
- **Staging**: AWS staging account with production-like config
- **Production**: AWS production account with high availability

### 9.2 CI/CD Pipeline

```yaml
# GitHub Actions / AWS Amplify CI/CD
stages:
  - lint
  - test
  - build
  - deploy

# Automated testing
tests:
  - unit_tests
  - integration_tests
  - e2e_tests

# Deployment strategy
deployment:
  type: rolling
  canary: 10%           # Route 10% traffic to new version first
  monitor_period: 5min   # Monitor before full rollout
```

## 10. Future Considerations

### 10.1 Scalability Enhancements
- Implement batch processing for large datasets
- Add caching layer for frequently accessed data
- Consider migrating to Aurora for complex queries
- Implement dataset partitioning for >100k images

### 10.2 Feature Enhancements
- Real-time collaboration on annotations
- Custom model training pipeline
- Advanced analytics and ML insights
- Mobile application support
- Webhook integrations

---

**Document Status**: Initial Draft
**Next Review Date**: TBD
**Approval Status**: Pending Review
