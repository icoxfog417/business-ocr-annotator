import { defineFunction, secret } from '@aws-amplify/backend';

export const runEvaluation = defineFunction({
  name: 'runEvaluation',
  entry: './handler.ts',
  timeoutSeconds: 900, // 15 minutes for full evaluation
  memoryMB: 2048, // Memory for dataset processing
  environment: {
    WANDB_API_KEY: secret('WANDB_API_KEY'),
    WANDB_PROJECT: 'biz-doc-vqa',
  },
});
