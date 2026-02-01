import { execSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineFunction } from '@aws-amplify/backend';
import { DockerImage, Duration } from 'aws-cdk-lib';
import { Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';

const functionDir = path.dirname(fileURLToPath(import.meta.url));

export const runEvaluation = defineFunction(
  (scope) =>
    new Function(scope, 'run-evaluation', {
      handler: 'handler.handler',
      runtime: Runtime.PYTHON_3_12,
      timeout: Duration.seconds(900), // 15 minutes
      memorySize: 2048,
      environment: {
        HOME: '/tmp', // Required for libraries that write to home directory
        HF_HOME: '/tmp/hf_home',
        HF_TOKEN_SSM_PARAM: '/business-ocr/hf-token',
        WANDB_DIR: '/tmp/wandb',
        WANDB_CONFIG_DIR: '/tmp/.config/wandb',
        WANDB_PROJECT: process.env.AWS_BRANCH === 'main' ? 'biz-doc-vqa' : 'biz-doc-vqa-dev',
        WANDB_API_KEY_SSM_PARAM: '/business-ocr/wandb-api-key',
      },
      code: Code.fromAsset(functionDir, {
        bundling: {
          image: DockerImage.fromRegistry('public.ecr.aws/sam/build-python3.12:latest'),
          local: {
            tryBundle(outputDir: string) {
              try {
                execSync(
                  `python3 -m pip install -r ${path.join(functionDir, 'requirements.txt')} -t ${outputDir} --platform manylinux2014_x86_64 --python-version 3.12 --only-binary=:all: --quiet`,
                  { stdio: 'inherit' }
                );
                execSync(
                  `find ${functionDir} -maxdepth 1 -name '*.py' ! -name 'test_*' -exec cp {} ${outputDir}/ \\;`
                );
                return true;
              } catch (error) {
                console.error('Local bundling failed:', error);
                return false;
              }
            },
          },
        },
      }),
    })
);
