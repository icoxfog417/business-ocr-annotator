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
