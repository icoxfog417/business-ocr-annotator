import { execSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineFunction } from '@aws-amplify/backend';
import { DockerImage, Duration } from 'aws-cdk-lib';
import { Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';

const functionDir = path.dirname(fileURLToPath(import.meta.url));

// Branch-based HuggingFace repo ID configuration
// - main branch: production repo
// - other branches / local sandbox: development repo
const HF_REPO_ID =
  process.env.AWS_BRANCH === 'main' ? 'icoxfog417/biz-doc-vqa' : 'icoxfog417/biz-doc-vqa-dev';

export const exportDataset = defineFunction(
  (scope) =>
    new Function(scope, 'export-dataset', {
      handler: 'handler.handler',
      runtime: Runtime.PYTHON_3_12,
      timeout: Duration.seconds(900), // 15 minutes
      memorySize: 2048,
      environment: {
        HF_HOME: '/tmp/hf_home',
        HF_TOKEN_SSM_PARAM: '/business-ocr/hf-token',
        ANNOTATION_INDEX_NAME: 'annotationsByValidationStatus',
        HF_REPO_ID, // Preset HuggingFace repo ID (branch-based)
      },
      code: Code.fromAsset(functionDir, {
        bundling: {
          image: DockerImage.fromRegistry('public.ecr.aws/sam/build-python3.12:latest'),
          local: {
            tryBundle(outputDir: string) {
              try {
                execSync(
                  `python3 -m pip install -r ${path.join(functionDir, 'requirements.txt')} -t ${outputDir} --platform manylinux2014_x86_64 --only-binary=:all: --quiet`,
                  { stdio: 'inherit' }
                );
                execSync(`cp -r ${functionDir}/*.py ${outputDir}/`);
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
