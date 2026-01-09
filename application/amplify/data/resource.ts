import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
  Image: a.model({
    fileName: a.string().required(),
    s3Key: a.string().required(),
    uploadedBy: a.string().required(),
    uploadedAt: a.datetime().required(),
    metadata: a.json()
  }).authorization((allow) => [allow.authenticated()]),

  Annotation: a.model({
    imageId: a.id().required(),
    question: a.string().required(),
    answer: a.string().required(),
    boundingBox: a.json(), // {x, y, width, height}
    createdBy: a.string().required(),
    createdAt: a.datetime().required()
  }).authorization((allow) => [allow.authenticated()])
});

export type Schema = ClientSchema<typeof schema>;
export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool'
  }
});
