import { defineFunction } from '@aws-amplify/backend';

export const queueAnnotation = defineFunction({
  name: 'queueAnnotation',
  entry: './handler.ts',
  runtime: 20, // Node.js 20.x
  timeoutSeconds: 30,
  memoryMB: 256
});
