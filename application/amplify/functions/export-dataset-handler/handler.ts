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
          resumeFrom: args.resumeFrom,
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
