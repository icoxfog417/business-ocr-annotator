import { defineFunction } from '@aws-amplify/backend';

export const generateAnnotation = defineFunction({
  name: 'generateAnnotation',
  entry: './handler.ts',
  timeoutSeconds: 300,
  memoryMB: 1024,
  environment: {
    MODEL_ID: 'nvidia.nemotron-nano-12b-v2',
  },
});
