import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

const lambdaClient = new LambdaClient({});

interface ExportDatasetArgs {
  datasetVersionId: string;
  datasetVersion: string;
  huggingFaceRepoId: string;
  resumeFrom?: string;
}

interface ExportDatasetResponse {
  success: boolean;
  exportId: string;
  error?: string;
}

export const handler = async (
  event: ExportDatasetArgs | { arguments: ExportDatasetArgs }
): Promise<ExportDatasetResponse> => {
  const args = 'arguments' in event ? event.arguments : event;

  try {
    const functionName = process.env.EXPORT_DATASET_FUNCTION_NAME;
    if (!functionName) {
      throw new Error('EXPORT_DATASET_FUNCTION_NAME not configured');
    }

    const exportId = crypto.randomUUID();

    const storageBucketName = process.env.STORAGE_BUCKET_NAME;
    if (!storageBucketName) {
      throw new Error('STORAGE_BUCKET_NAME not configured');
    }

    // Table names are passed via payload to avoid circular dependency between
    // the data stack (where this handler lives) and the function stack (where
    // the Python Lambda lives). See backend.ts for details.
    const tableNames = {
      annotation: process.env.ANNOTATION_TABLE_NAME,
      image: process.env.IMAGE_TABLE_NAME,
      datasetVersion: process.env.DATASET_VERSION_TABLE_NAME,
      datasetExportProgress: process.env.DATASET_EXPORT_PROGRESS_TABLE_NAME,
    };
    const missing = Object.entries(tableNames)
      .filter(([, v]) => !v)
      .map(([k]) => k);
    if (missing.length > 0) {
      throw new Error(`Missing table name env vars: ${missing.join(', ')}`);
    }

    // Invoke the Python Lambda asynchronously (fire-and-forget)
    await lambdaClient.send(
      new InvokeCommand({
        FunctionName: functionName,
        InvocationType: 'Event',
        Payload: JSON.stringify({
          datasetVersionId: args.datasetVersionId,
          datasetVersion: args.datasetVersion,
          huggingFaceRepoId: args.huggingFaceRepoId,
          exportId,
          storageBucketName,
          resumeFrom: args.resumeFrom,
          tableNames,
        }),
      })
    );

    console.log(`Started export ${exportId} for version ${args.datasetVersion}`);

    return {
      success: true,
      exportId,
    };
  } catch (error) {
    console.error('Error starting export:', error);
    return {
      success: false,
      exportId: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};
