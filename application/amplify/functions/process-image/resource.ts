import { defineFunction } from '@aws-amplify/backend';

export const processImage = defineFunction({
  name: 'processImage',
  entry: './handler.ts',
  timeoutSeconds: 90,
  memoryMB: 1024,
  resourceGroupName: 'storage',
  layers: {
    // sharp module provided via Lambda layer (built with --cpu=x64 --os=linux --libc=glibc)
    sharp: 'arn:aws:lambda:us-east-1:872515288562:layer:sharp-layer:1',
  },
});
