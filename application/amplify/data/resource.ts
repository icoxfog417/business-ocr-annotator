import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

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
    updatedAt: a.datetime()
  }).authorization((allow) => [allow.authenticated()])
});

export type Schema = ClientSchema<typeof schema>;
export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool'
  }
});
