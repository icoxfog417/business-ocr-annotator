import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { queueAnnotation } from '../functions/queue-annotation/resource';

const schema = a.schema({
  Image: a.model({
    fileName: a.string().required(),
    s3Key: a.string().required(),

    // Image dimensions (required for bounding box normalization)
    width: a.integer().required(),
    height: a.integer().required(),

    // Document classification
    documentType: a.enum([
      'RECEIPT', 'INVOICE', 'ORDER_FORM',
      'TAX_FORM', 'CONTRACT', 'APPLICATION_FORM', 'OTHER'
    ]),

    // Language support (ISO 639-1 code: ja, en, zh, ko)
    language: a.string().required(),

    // Tracking fields
    uploadedBy: a.string().required(),
    uploadedAt: a.datetime().required(),
    updatedBy: a.string(),
    updatedAt: a.datetime(),

    // Processing status
    status: a.enum(['UPLOADED', 'ANNOTATING', 'VALIDATED']),

    // Relationships
    annotations: a.hasMany('Annotation', 'imageId')
  }).authorization((allow) => [allow.authenticated()]),

  Annotation: a.model({
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
    questionType: a.enum([
      'EXTRACTIVE', 'ABSTRACTIVE', 'BOOLEAN', 'COUNTING', 'REASONING'
    ]),

    // Validation tracking
    validationStatus: a.enum(['PENDING', 'APPROVED', 'REJECTED']),
    validatedBy: a.string(),
    validatedAt: a.datetime(),

    // Tracking fields
    createdBy: a.string().required(),
    createdAt: a.datetime().required(),
    updatedBy: a.string(),
    updatedAt: a.datetime(),

    // Sprint 3: Queue-based W&B integration fields
    queuedForDataset: a.boolean().default(false),
    processedAt: a.datetime()
  }).authorization((allow) => [allow.authenticated()]),

  // Sprint 3: Job tracking models for W&B integration
  DatasetBuildJob: a.model({
    // Job status tracking
    status: a.enum(['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED']).required(),

    // Timing
    startedAt: a.datetime(),
    completedAt: a.datetime(),

    // Metrics
    annotationCount: a.integer(),

    // W&B references
    wandbRunUrl: a.string(),
    wandbArtifactVersion: a.string(),

    // Error handling
    errorMessage: a.string(),

    // Tracking
    triggeredBy: a.string().required(),
    triggerType: a.enum(['SCHEDULED', 'MANUAL']).required()
  }).authorization((allow) => [allow.authenticated()]),

  EvaluationJob: a.model({
    // Job status tracking
    status: a.enum(['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED']).required(),

    // Evaluation configuration
    modelName: a.string().required(),
    datasetVersion: a.string().required(),

    // Timing
    startedAt: a.datetime(),
    completedAt: a.datetime(),

    // Evaluation metrics
    exactMatchRate: a.float(),
    f1Score: a.float(),
    avgIoU: a.float(),
    sampleCount: a.integer(),

    // W&B references
    wandbRunUrl: a.string(),

    // Error handling
    errorMessage: a.string(),

    // Tracking
    triggeredBy: a.string().required(),
    triggerType: a.enum(['SCHEDULED', 'MANUAL']).required()
  }).authorization((allow) => [allow.authenticated()]),

  QueueStats: a.model({
    // Singleton pattern - only one record with fixed ID
    statsId: a.string().required(),

    // Queue metrics
    pendingAnnotations: a.integer().default(0),
    totalProcessed: a.integer().default(0),

    // Timing
    lastDatasetBuild: a.datetime(),
    lastDatasetBuildJobId: a.string(),
    nextScheduledBuild: a.datetime(),

    // Last evaluation
    lastEvaluation: a.datetime(),
    lastEvaluationJobId: a.string()
  }).authorization((allow) => [allow.authenticated()]),

  // Custom mutation to queue annotations for W&B dataset processing
  queueAnnotationsForDataset: a
    .mutation()
    .arguments({
      annotationIds: a.string().required().array().required(),
      triggeredBy: a.string().required()
    })
    .returns(a.customType({
      success: a.boolean().required(),
      queuedCount: a.integer().required(),
      failedIds: a.string().array(),
      errorMessage: a.string()
    }))
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(queueAnnotation))
});

export type Schema = ClientSchema<typeof schema>;
export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool'
  }
});
