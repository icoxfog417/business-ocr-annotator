import { defineFunction, secret } from '@aws-amplify/backend';

export const wandbProcessor = defineFunction({
  name: 'wandbProcessor',
  entry: './handler.ts',
  runtime: 20, // Node.js 20.x
  timeoutSeconds: 900, // 15 minutes max for batch processing
  memoryMB: 2048, // 2GB for image processing
  environment: {
    WANDB_API_KEY: secret('WANDB_API_KEY'),
    WANDB_PROJECT: 'business-ocr-sandbox', // Use 'biz-doc-vqa' for production
    WANDB_ENTITY: secret('WANDB_ENTITY')
  }
});
