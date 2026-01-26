import { defineFunction, secret } from '@aws-amplify/backend';

export const exportDataset = defineFunction({
  name: 'exportDataset',
  entry: './handler.ts',
  timeoutSeconds: 900, // 15 minutes for large dataset export
  memoryMB: 2048,
  environment: {
    HF_TOKEN: secret('HF_TOKEN'),
  },
});
