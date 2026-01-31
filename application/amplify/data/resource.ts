import { type ClientSchema, a, defineData, defineFunction } from '@aws-amplify/backend';

// Define the function inline to avoid circular dependency
const generateAnnotationHandler = defineFunction({
  name: 'generateAnnotationHandler',
  entry: '../functions/generate-annotation/handler.ts',
  timeoutSeconds: 60,
  memoryMB: 512,
});

// Sprint 4 Phase 2: Export dataset dispatcher (Node.js wrapper for Python Lambda)
const exportDatasetHandler = defineFunction({
  name: 'exportDatasetHandler',
  entry: '../functions/export-dataset-handler/handler.ts',
  timeoutSeconds: 30,
  memoryMB: 256,
});

// Sprint 4 Phase 2: Trigger evaluation orchestrator (Node.js)
const triggerEvaluationHandler = defineFunction({
  name: 'triggerEvaluationHandler',
  entry: '../functions/trigger-evaluation/handler.ts',
  timeoutSeconds: 30,
  memoryMB: 512,
});

// Server-side annotation and image counts
const getAnnotationCountsHandler = defineFunction({
  name: 'getAnnotationCountsHandler',
  entry: '../functions/get-annotation-counts/handler.ts',
  timeoutSeconds: 10,
  memoryMB: 256,
});


const schema = a.schema({
  Image: a
    .model({
      fileName: a.string().required(),

      // 3-tier S3 storage keys
      s3KeyOriginal: a.string().required(),
      s3KeyCompressed: a.string(),
      s3KeyThumbnail: a.string(),

      // Image dimensions (required for bounding box normalization)
      width: a.integer().required(),
      height: a.integer().required(),

      // Compressed image dimensions (for coordinate scaling)
      compressedWidth: a.integer(),
      compressedHeight: a.integer(),

      // File sizes in bytes
      originalSize: a.integer(),
      compressedSize: a.integer(),
      thumbnailSize: a.integer(),

      // Compression metadata
      compressionRatio: a.float(),
      originalFormat: a.string(),

      // Document classification
      documentType: a.enum([
        'RECEIPT',
        'INVOICE',
        'ORDER_FORM',
        'TAX_FORM',
        'CONTRACT',
        'APPLICATION_FORM',
        'OTHER',
      ]),

      // Language support (ISO 639-1 code: ja, en, zh, ko)
      language: a.string().required(),

      // Tracking fields
      uploadedBy: a.string().required(),
      uploadedAt: a.datetime().required(),
      updatedBy: a.string(),
      updatedAt: a.datetime(),

      // Processing status
      status: a.enum(['UPLOADED', 'PROCESSING', 'ANNOTATING', 'VALIDATED']),

      // Relationships
      annotations: a.hasMany('Annotation', 'imageId'),
    })
    .secondaryIndexes((index) => [index('s3KeyOriginal')])
    .authorization((allow) => [allow.authenticated()]),

  Annotation: a
    .model({
      imageId: a.id().required(),
      image: a.belongsTo('Image', 'imageId'),

      // Q&A fields
      question: a.string().required(),
      answer: a.string().required(),

      // Language support (ISO 639-1 code)
      language: a.string().required(),

      // Bounding boxes in HuggingFace standard format
      // Array of [x0, y0, x1, y1] in pixel coordinates (not normalized)
      boundingBoxes: a.json().required(),

      // Classification for academic compatibility
      questionType: a.enum(['EXTRACTIVE', 'ABSTRACTIVE', 'BOOLEAN', 'COUNTING', 'REASONING']),

      // Validation tracking
      validationStatus: a.enum(['PENDING', 'APPROVED', 'REJECTED']),
      validatedBy: a.string(),
      validatedAt: a.datetime(),

      // Generation metadata (Sprint 2)
      generatedBy: a.enum(['AI', 'HUMAN']),
      modelVersion: a.string(),
      confidence: a.float(),

      // AI assistance tracking (Sprint 3) - for [📖 Read] button usage
      aiAssisted: a.boolean(), // True if [📖 Read] was used to extract the answer
      aiModelId: a.string(), // Model ID (e.g., "anthropic.claude-3-5-sonnet-20241022-v2:0")
      aiModelProvider: a.string(), // Provider (e.g., "bedrock")
      aiExtractionTimestamp: a.datetime(), // When AI extraction occurred

      // Unanswerable tracking - when document doesn't contain the answer
      isUnanswerable: a.boolean().default(false), // True if marked as "No Answer"

      // Tracking fields
      createdBy: a.string().required(),
      createdAt: a.datetime().required(),
      updatedBy: a.string(),
      updatedAt: a.datetime(),
    })
    .secondaryIndexes((index) => [index('validationStatus')])
    .authorization((allow) => [allow.authenticated()]),

  DefaultQuestion: a
    .model({
      documentType: a.enum([
        'RECEIPT',
        'INVOICE',
        'ORDER_FORM',
        'TAX_FORM',
        'CONTRACT',
        'APPLICATION_FORM',
        'OTHER',
      ]),
      language: a.string().required(),
      questionText: a.string().required(),
      questionType: a.enum(['EXTRACTIVE']),
      displayOrder: a.integer().required(),
      createdBy: a.string().required(),
      createdAt: a.datetime().required(),
      updatedBy: a.string(),
      updatedAt: a.datetime(),
    })
    .authorization((allow) => [allow.authenticated()]),

  // Sprint 4: Dataset Version Management
  DatasetVersion: a
    .model({
      version: a.string().required(), // e.g., "v1.0.0"
      huggingFaceRepoId: a.string().required(), // e.g., "icoxfog417/biz-doc-vqa"
      huggingFaceUrl: a.string().required(), // Full URL to HF dataset
      annotationCount: a.integer().required(),
      imageCount: a.integer().required(),
      status: a.enum(['CREATING', 'READY', 'EVALUATING', 'FINALIZED']),
      createdBy: a.string().required(),
      createdAt: a.datetime().required(),
      finalizedAt: a.datetime(),
    })
    .authorization((allow) => [allow.authenticated()]),

  // Sprint 4: Dataset Export Progress (Checkpoint for Resume)
  DatasetExportProgress: a
    .model({
      exportId: a.string().required(), // Unique export job ID
      version: a.string().required(), // Dataset version being exported
      lastProcessedAnnotationId: a.string(), // Checkpoint for resume
      processedCount: a.integer().required(),
      totalCount: a.integer().required(),
      status: a.enum(['IN_PROGRESS', 'COMPLETED', 'FAILED']),
      errorMessage: a.string(),
      startedAt: a.datetime().required(),
      updatedAt: a.datetime(),
    })
    .authorization((allow) => [allow.authenticated()]),

  // Sprint 4: Model Evaluation Jobs
  EvaluationJob: a
    .model({
      jobId: a.string().required(), // Unique job ID
      datasetVersion: a.string().required(), // e.g., "v1.0.0"
      modelId: a.string().required(), // From evaluation-models.json
      modelName: a.string(), // Display name
      status: a.enum(['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED']),
      // Primary metrics (DocVQA standard) - 0-1 scale
      avgAnls: a.float(), // Average ANLS (text accuracy)
      avgIou: a.float(), // Average IoU (bbox accuracy)
      totalSamples: a.integer(), // Successfully evaluated samples
      failedSamples: a.integer(), // Samples that failed to evaluate
      wandbRunUrl: a.string(), // Link to W&B run
      errorMessage: a.string(), // Error details (for FAILED status or partial failures)
      startedAt: a.datetime(),
      completedAt: a.datetime(),
      createdAt: a.datetime().required(),
    })
    .secondaryIndexes((index) => [index('datasetVersion')])
    .authorization((allow) => [allow.authenticated()]),

  // Custom query for AI annotation generation
  generateAnnotation: a
    .query()
    .arguments({
      imageId: a.string().required(),
      imageBase64: a.string().required(),
      imageFormat: a.string().required(),
      language: a.string().required(),
      documentType: a.string().required(),
      width: a.integer().required(),
      height: a.integer().required(),
      question: a.string(),
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(generateAnnotationHandler)),

  // Sprint 4 Phase 2: Export dataset to Hugging Face (async dispatch)
  exportDataset: a
    .mutation()
    .arguments({
      datasetVersionId: a.string().required(),
      datasetVersion: a.string().required(),
      huggingFaceRepoId: a.string().required(),
      resumeFrom: a.string(),
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(exportDatasetHandler)),

  // Sprint 4 Phase 2: Trigger parallel model evaluation
  triggerEvaluation: a
    .mutation()
    .arguments({
      datasetVersion: a.string().required(),
      huggingFaceRepoId: a.string().required(),
      modelIds: a.string().array(),
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(triggerEvaluationHandler)),

  // Server-side annotation and image counts
  getAnnotationCounts: a
    .query()
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(getAnnotationCountsHandler)),
});

export type Schema = ClientSchema<typeof schema>;

export {
  generateAnnotationHandler,
  exportDatasetHandler,
  triggerEvaluationHandler,
  getAnnotationCountsHandler,
};
export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});
