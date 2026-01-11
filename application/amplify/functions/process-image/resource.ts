import { defineFunction } from '@aws-amplify/backend';

export const processImage = defineFunction({
  name: 'processImage',
  entry: './handler.ts',
  timeoutSeconds: 90, // Increased for large image processing
  memoryMB: 1024,
});
