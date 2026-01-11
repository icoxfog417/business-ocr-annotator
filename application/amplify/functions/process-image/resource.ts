import { defineFunction } from '@aws-amplify/backend';

export const processImage = defineFunction({
  name: 'processImage',
  entry: './handler.ts',
  timeoutSeconds: 60,
  memoryMB: 1024,
});
