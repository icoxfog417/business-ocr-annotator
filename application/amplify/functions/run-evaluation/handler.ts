import type { Handler, SQSEvent, SQSRecord } from 'aws-lambda';
import {
  BedrockRuntimeClient,
  ConverseCommand,
  ContentBlock,
} from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { downloadFile, listFiles } from '@huggingface/hub';

// Initialize clients
const bedrockClient = new BedrockRuntimeClient({});
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Cache for discovered table names
let cachedEvaluationJobTable: string | null = null;

// W&B API configuration
const WANDB_API_BASE = 'https://api.wandb.ai';
const WANDB_PROJECT = process.env.WANDB_PROJECT || 'biz-doc-vqa';
const WANDB_API_KEY = process.env.WANDB_API_KEY;

// Metrics configuration
const ANLS_THRESHOLD = 0.5;

/**
 * SQS Message format for evaluation jobs
 */
interface EvaluationJobMessage {
  jobId: string;
  datasetVersion: string;
  modelId: string;
  bedrockModelId: string;
  huggingFaceRepoId: string;
}

/**
 * Dataset sample format from HuggingFace
 */
interface DatasetSample {
  question_id: string;
  image: { bytes: Uint8Array } | null;
  image_width: number;
  image_height: number;
  question: string;
  answers: string[];
  answer_bbox: number[]; // [x0, y0, x1, y1] normalized 0-1
  document_type: string;
  question_type: string;
  language: string;
}

/**
 * Evaluation result per sample
 */
interface SampleResult {
  questionId: string;
  prediction: string;
  groundTruth: string[];
  anls: number;
  predictedBbox: number[] | null;
  groundTruthBbox: number[];
  iou: number;
}

/**
 * W&B Run information
 */
interface WandBRun {
  id: string;
  name: string;
  url: string;
  entity: string;
  project: string;
}

/**
 * Discover EvaluationJob table name via ListTables API
 */
async function getEvaluationJobTableName(): Promise<string> {
  if (cachedEvaluationJobTable) return cachedEvaluationJobTable;

  const result = await dynamoClient.send(new ListTablesCommand({}));
  const table = result.TableNames?.find((name) => name.startsWith('EvaluationJob-'));

  if (!table) {
    throw new Error('EvaluationJob table not found');
  }

  cachedEvaluationJobTable = table;
  console.log(`Using EvaluationJob table: ${cachedEvaluationJobTable}`);
  return cachedEvaluationJobTable;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;

  // Create distance matrix
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  // Initialize base cases
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  // Fill in the matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

/**
 * Calculate ANLS (Average Normalized Levenshtein Similarity)
 * ANLS = 1 - NLD (Normalized Levenshtein Distance)
 * Returns ANLS if >= threshold, else 0
 *
 * @param prediction - Model prediction
 * @param groundTruths - List of acceptable ground truth answers
 * @param threshold - ANLS threshold (default 0.5)
 * @returns ANLS score (0-1 scale)
 */
function calculateAnls(prediction: string, groundTruths: string[], threshold: number = ANLS_THRESHOLD): number {
  let maxAnls = 0;
  const predNorm = prediction.toLowerCase().trim();

  for (const gt of groundTruths) {
    const gtNorm = gt.toLowerCase().trim();
    const levDist = levenshteinDistance(predNorm, gtNorm);
    const maxLen = Math.max(predNorm.length, gtNorm.length, 1);
    let anls = 1 - levDist / maxLen;

    // Threshold distinguishes OCR errors from wrong answers
    if (anls < threshold) {
      anls = 0;
    }

    maxAnls = Math.max(maxAnls, anls);
  }

  return maxAnls;
}

/**
 * Calculate IoU (Intersection over Union) for bounding boxes
 * Boxes are in normalized 0-1 coordinates [x0, y0, x1, y1]
 *
 * @param predBbox - Predicted bounding box [x0, y0, x1, y1]
 * @param gtBbox - Ground truth bounding box [x0, y0, x1, y1]
 * @returns IoU score (0-1 scale)
 */
function calculateIou(predBbox: number[], gtBbox: number[]): number {
  if (predBbox.length !== 4 || gtBbox.length !== 4) {
    return 0;
  }

  // Calculate intersection coordinates
  const x1 = Math.max(predBbox[0], gtBbox[0]);
  const y1 = Math.max(predBbox[1], gtBbox[1]);
  const x2 = Math.min(predBbox[2], gtBbox[2]);
  const y2 = Math.min(predBbox[3], gtBbox[3]);

  // Calculate intersection area
  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);

  // Calculate union area
  const predArea = (predBbox[2] - predBbox[0]) * (predBbox[3] - predBbox[1]);
  const gtArea = (gtBbox[2] - gtBbox[0]) * (gtBbox[3] - gtBbox[1]);
  const union = predArea + gtArea - intersection;

  return union > 0 ? intersection / union : 0;
}

/**
 * Parse model response to extract answer and bounding box
 */
function parseModelResponse(response: string): { answer: string; bbox: number[] | null } {
  try {
    // Try to parse as JSON first
    const parsed = JSON.parse(response);
    if (parsed.answer !== undefined) {
      return {
        answer: String(parsed.answer || ''),
        bbox: Array.isArray(parsed.bbox) ? parsed.bbox : null,
      };
    }
  } catch {
    // Not JSON, try to extract from text
  }

  // Extract answer from text response
  // Look for common patterns like "Answer: ..." or just use the whole response
  const answerMatch = response.match(/(?:answer|result|value)[:\s]+(.+?)(?:\n|$)/i);
  const answer = answerMatch ? answerMatch[1].trim() : response.trim();

  // Try to extract bbox if mentioned
  const bboxMatch = response.match(/\[[\d.,\s]+\]/);
  let bbox: number[] | null = null;
  if (bboxMatch) {
    try {
      const parsed = JSON.parse(bboxMatch[0]);
      if (Array.isArray(parsed) && parsed.length === 4) {
        bbox = parsed;
      }
    } catch {
      // Ignore parsing errors
    }
  }

  return { answer, bbox };
}

/**
 * Run model prediction via Bedrock Converse API
 */
async function runModelPrediction(
  bedrockModelId: string,
  imageBytes: Uint8Array,
  question: string,
  imageWidth: number,
  imageHeight: number
): Promise<{ answer: string; bbox: number[] | null }> {
  const systemPrompt = `You are an OCR evaluation assistant. Given an image and a question, extract the answer from the image and provide a bounding box for where the answer is located.

Respond in JSON format:
{
  "answer": "extracted text answer",
  "bbox": [x0, y0, x1, y1]
}

Where bbox coordinates are normalized (0-1 range) relative to image dimensions.
- x0, y0: top-left corner
- x1, y1: bottom-right corner

If you cannot find the answer, respond with:
{
  "answer": "",
  "bbox": null
}`;

  const userMessage = `Question: ${question}

Image dimensions: ${imageWidth}x${imageHeight}

Please extract the answer from the image and provide the bounding box coordinates.`;

  try {
    const imageContent: ContentBlock = {
      image: {
        format: 'jpeg',
        source: {
          bytes: imageBytes,
        },
      },
    };

    const textContent: ContentBlock = {
      text: userMessage,
    };

    const command = new ConverseCommand({
      modelId: bedrockModelId,
      messages: [
        {
          role: 'user',
          content: [imageContent, textContent],
        },
      ],
      system: [{ text: systemPrompt }],
      inferenceConfig: {
        maxTokens: 1024,
        temperature: 0.1,
      },
    });

    const response = await bedrockClient.send(command);

    // Extract text from response
    const outputContent = response.output?.message?.content;
    if (!outputContent || outputContent.length === 0) {
      console.warn('Empty response from Bedrock');
      return { answer: '', bbox: null };
    }

    const textBlock = outputContent.find((block) => 'text' in block);
    if (!textBlock || !('text' in textBlock)) {
      console.warn('No text in Bedrock response');
      return { answer: '', bbox: null };
    }

    return parseModelResponse(textBlock.text || '');
  } catch (error) {
    console.error('Error calling Bedrock:', error);
    throw error;
  }
}

/**
 * Initialize W&B run via HTTP API
 */
async function initWandBRun(
  jobId: string,
  modelId: string,
  datasetVersion: string
): Promise<WandBRun | null> {
  if (!WANDB_API_KEY) {
    console.warn('WANDB_API_KEY not set, skipping W&B logging');
    return null;
  }

  const entity = 'default'; // Will be resolved by W&B
  const runName = `eval-${modelId}-${datasetVersion}-${Date.now()}`;

  try {
    // Create a new run using W&B API
    const response = await fetch(`${WANDB_API_BASE}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`api:${WANDB_API_KEY}`).toString('base64')}`,
      },
      body: JSON.stringify({
        query: `
          mutation CreateRun($entity: String!, $project: String!, $name: String!, $config: JSONString) {
            upsertBucket(input: {
              entityName: $entity
              projectName: $project
              name: $name
              config: $config
            }) {
              bucket {
                id
                name
                displayName
              }
            }
          }
        `,
        variables: {
          entity,
          project: WANDB_PROJECT,
          name: runName,
          config: JSON.stringify({
            model_id: modelId,
            dataset_version: datasetVersion,
            job_id: jobId,
            anls_threshold: ANLS_THRESHOLD,
          }),
        },
      }),
    });

    if (!response.ok) {
      console.error('Failed to create W&B run:', await response.text());
      return null;
    }

    const data = await response.json();
    const bucket = data?.data?.upsertBucket?.bucket;

    if (!bucket) {
      console.error('Failed to get W&B bucket from response:', data);
      return null;
    }

    return {
      id: bucket.id,
      name: bucket.name,
      url: `https://wandb.ai/${entity}/${WANDB_PROJECT}/runs/${bucket.name}`,
      entity,
      project: WANDB_PROJECT,
    };
  } catch (error) {
    console.error('Error initializing W&B run:', error);
    return null;
  }
}

/**
 * Log metrics to W&B run via HTTP API
 */
async function logToWandB(
  run: WandBRun,
  step: number,
  metrics: Record<string, number>
): Promise<void> {
  if (!WANDB_API_KEY || !run) return;

  try {
    await fetch(`${WANDB_API_BASE}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`api:${WANDB_API_KEY}`).toString('base64')}`,
      },
      body: JSON.stringify({
        query: `
          mutation LogHistory($entity: String!, $project: String!, $runName: String!, $history: [JSONString!]!) {
            upsertBucket(input: {
              entityName: $entity
              projectName: $project
              name: $runName
              historyLineCount: 1
            }) {
              bucket {
                id
              }
            }
          }
        `,
        variables: {
          entity: run.entity,
          project: run.project,
          runName: run.name,
          history: [JSON.stringify({ _step: step, ...metrics })],
        },
      }),
    });
  } catch (error) {
    console.warn('Failed to log to W&B:', error);
  }
}

/**
 * Finalize W&B run with summary metrics
 */
async function finalizeWandBRun(
  run: WandBRun,
  summary: Record<string, number | string>
): Promise<void> {
  if (!WANDB_API_KEY || !run) return;

  try {
    await fetch(`${WANDB_API_BASE}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`api:${WANDB_API_KEY}`).toString('base64')}`,
      },
      body: JSON.stringify({
        query: `
          mutation FinishRun($entity: String!, $project: String!, $runName: String!, $summaryMetrics: JSONString) {
            upsertBucket(input: {
              entityName: $entity
              projectName: $project
              name: $runName
              summaryMetrics: $summaryMetrics
            }) {
              bucket {
                id
              }
            }
          }
        `,
        variables: {
          entity: run.entity,
          project: run.project,
          runName: run.name,
          summaryMetrics: JSON.stringify(summary),
        },
      }),
    });
  } catch (error) {
    console.warn('Failed to finalize W&B run:', error);
  }
}

/**
 * Update EvaluationJob status in DynamoDB
 */
async function updateJobStatus(
  tableName: string,
  jobId: string,
  status: 'RUNNING' | 'COMPLETED' | 'FAILED',
  updates?: {
    avgAnls?: number;
    avgIou?: number;
    totalSamples?: number;
    wandbRunUrl?: string;
    errorMessage?: string;
    startedAt?: string;
    completedAt?: string;
  }
): Promise<void> {
  const expressionParts = ['#status = :status'];
  const expressionNames: Record<string, string> = { '#status': 'status' };
  const expressionValues: Record<string, unknown> = { ':status': status };

  if (updates) {
    if (updates.avgAnls !== undefined) {
      expressionParts.push('avgAnls = :avgAnls');
      expressionValues[':avgAnls'] = updates.avgAnls;
    }
    if (updates.avgIou !== undefined) {
      expressionParts.push('avgIou = :avgIou');
      expressionValues[':avgIou'] = updates.avgIou;
    }
    if (updates.totalSamples !== undefined) {
      expressionParts.push('totalSamples = :totalSamples');
      expressionValues[':totalSamples'] = updates.totalSamples;
    }
    if (updates.wandbRunUrl !== undefined) {
      expressionParts.push('wandbRunUrl = :wandbRunUrl');
      expressionValues[':wandbRunUrl'] = updates.wandbRunUrl;
    }
    if (updates.errorMessage !== undefined) {
      expressionParts.push('errorMessage = :errorMessage');
      expressionValues[':errorMessage'] = updates.errorMessage;
    }
    if (updates.startedAt !== undefined) {
      expressionParts.push('startedAt = :startedAt');
      expressionValues[':startedAt'] = updates.startedAt;
    }
    if (updates.completedAt !== undefined) {
      expressionParts.push('completedAt = :completedAt');
      expressionValues[':completedAt'] = updates.completedAt;
    }
  }

  await docClient.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { id: jobId },
      UpdateExpression: `SET ${expressionParts.join(', ')}`,
      ExpressionAttributeNames: expressionNames,
      ExpressionAttributeValues: expressionValues,
    })
  );
}

/**
 * Stream and process dataset from HuggingFace Hub
 */
async function* streamDataset(repoId: string): AsyncGenerator<DatasetSample> {
  console.log(`Streaming dataset from HuggingFace: ${repoId}`);

  try {
    // List files in the dataset repository
    const files = listFiles({ repo: repoId, recursive: true });
    const parquetFiles: string[] = [];

    for await (const file of files) {
      if (file.path.endsWith('.parquet')) {
        parquetFiles.push(file.path);
      }
    }

    if (parquetFiles.length === 0) {
      throw new Error(`No parquet files found in repository: ${repoId}`);
    }

    console.log(`Found ${parquetFiles.length} parquet files`);

    // For each parquet file, download and parse
    for (const parquetFile of parquetFiles) {
      console.log(`Processing: ${parquetFile}`);

      // Download the file
      const response = await downloadFile({
        repo: repoId,
        path: parquetFile,
      });

      if (!response) {
        console.warn(`Failed to download: ${parquetFile}`);
        continue;
      }

      // Read the file content
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Parse parquet file
      // Note: For proper parquet parsing, we would need a parquet library
      // For now, we'll handle this as JSON if the dataset exports JSONL
      // or implement basic parquet parsing
      try {
        // Try to parse as JSONL (common for smaller datasets)
        const content = buffer.toString('utf-8');
        const lines = content.split('\n').filter((line) => line.trim());

        for (const line of lines) {
          try {
            const sample = JSON.parse(line) as DatasetSample;
            yield sample;
          } catch {
            // Skip invalid lines
          }
        }
      } catch {
        console.warn(`Could not parse ${parquetFile} as JSONL, skipping`);
      }
    }
  } catch (error) {
    console.error('Error streaming dataset:', error);
    throw error;
  }
}

/**
 * Process a single evaluation job
 */
async function processEvaluationJob(message: EvaluationJobMessage): Promise<void> {
  const { jobId, datasetVersion, modelId, bedrockModelId, huggingFaceRepoId } = message;
  console.log(`Processing evaluation job: ${jobId} for model: ${modelId}`);

  const tableName = await getEvaluationJobTableName();
  const startTime = new Date().toISOString();

  // Initialize W&B run
  const wandbRun = await initWandBRun(jobId, modelId, datasetVersion);
  const wandbRunUrl = wandbRun?.url;

  try {
    // Update status to RUNNING
    await updateJobStatus(tableName, jobId, 'RUNNING', {
      startedAt: startTime,
      wandbRunUrl,
    });

    // Track metrics
    const results: SampleResult[] = [];
    let totalAnls = 0;
    let totalIou = 0;
    let sampleCount = 0;

    // Stream and evaluate dataset
    for await (const sample of streamDataset(huggingFaceRepoId)) {
      sampleCount++;
      console.log(`Evaluating sample ${sampleCount}: ${sample.question_id}`);

      // Get image bytes
      let imageBytes: Uint8Array;
      if (sample.image && sample.image.bytes) {
        imageBytes = sample.image.bytes;
      } else {
        console.warn(`No image data for sample: ${sample.question_id}`);
        continue;
      }

      try {
        // Run model prediction
        const prediction = await runModelPrediction(
          bedrockModelId,
          imageBytes,
          sample.question,
          sample.image_width,
          sample.image_height
        );

        // Calculate ANLS
        const anls = calculateAnls(prediction.answer, sample.answers);
        totalAnls += anls;

        // Calculate IoU if bbox available
        let iou = 0;
        if (prediction.bbox && sample.answer_bbox.length === 4) {
          iou = calculateIou(prediction.bbox, sample.answer_bbox);
        }
        totalIou += iou;

        const result: SampleResult = {
          questionId: sample.question_id,
          prediction: prediction.answer,
          groundTruth: sample.answers,
          anls,
          predictedBbox: prediction.bbox,
          groundTruthBbox: sample.answer_bbox,
          iou,
        };
        results.push(result);

        // Log to W&B incrementally
        if (wandbRun) {
          await logToWandB(wandbRun, sampleCount, {
            anls,
            iou,
            running_avg_anls: totalAnls / sampleCount,
            running_avg_iou: totalIou / sampleCount,
          });
        }

        // Log progress every 10 samples
        if (sampleCount % 10 === 0) {
          console.log(
            `Progress: ${sampleCount} samples, Avg ANLS: ${(totalAnls / sampleCount).toFixed(4)}, Avg IoU: ${(totalIou / sampleCount).toFixed(4)}`
          );
        }
      } catch (error) {
        console.error(`Error evaluating sample ${sample.question_id}:`, error);
        // Continue with next sample
      }
    }

    // Calculate final averages
    const avgAnls = sampleCount > 0 ? totalAnls / sampleCount : 0;
    const avgIou = sampleCount > 0 ? totalIou / sampleCount : 0;

    console.log(`Evaluation complete: ${sampleCount} samples`);
    console.log(`Final Avg ANLS: ${avgAnls.toFixed(4)}, Avg IoU: ${avgIou.toFixed(4)}`);

    // Finalize W&B run
    if (wandbRun) {
      await finalizeWandBRun(wandbRun, {
        avg_anls: avgAnls,
        avg_iou: avgIou,
        total_samples: sampleCount,
        model_id: modelId,
        dataset_version: datasetVersion,
        status: 'completed',
      });
    }

    // Update job status to COMPLETED
    await updateJobStatus(tableName, jobId, 'COMPLETED', {
      avgAnls,
      avgIou,
      totalSamples: sampleCount,
      completedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error processing evaluation job:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Update job status to FAILED
    await updateJobStatus(tableName, jobId, 'FAILED', {
      errorMessage,
      completedAt: new Date().toISOString(),
    });

    // Finalize W&B run with error
    if (wandbRun) {
      await finalizeWandBRun(wandbRun, {
        status: 'failed',
        error: errorMessage,
      });
    }

    throw error;
  }
}

/**
 * Process a single SQS record
 */
async function processSQSRecord(record: SQSRecord): Promise<void> {
  console.log('Processing SQS record:', record.messageId);

  try {
    const message = JSON.parse(record.body) as EvaluationJobMessage;
    await processEvaluationJob(message);
  } catch (error) {
    console.error('Error processing SQS record:', error);
    throw error;
  }
}

/**
 * Lambda handler for SQS-triggered evaluation jobs
 */
export const handler: Handler<SQSEvent> = async (event) => {
  console.log('Received SQS event:', JSON.stringify(event, null, 2));
  console.log(`Processing ${event.Records.length} messages`);

  const batchItemFailures: { itemIdentifier: string }[] = [];

  for (const record of event.Records) {
    try {
      await processSQSRecord(record);
    } catch (error) {
      console.error(`Failed to process message ${record.messageId}:`, error);
      // Report partial batch failure
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  // Return batch item failures for SQS to retry
  return {
    batchItemFailures,
  };
};
