import { type ClientSchema, a, defineData, defineFunction } from '@aws-amplify/backend';

// Define the function inline to avoid circular dependency
const generateAnnotationHandler = defineFunction({
  entry: '../functions/generate-annotation/handler.ts',
  timeoutSeconds: 60,
  memoryMB: 512,
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

      // Tracking fields
      createdBy: a.string().required(),
      createdAt: a.datetime().required(),
      updatedBy: a.string(),
      updatedAt: a.datetime(),
    })
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
});

export type Schema = ClientSchema<typeof schema>;

export { generateAnnotationHandler };
export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});
