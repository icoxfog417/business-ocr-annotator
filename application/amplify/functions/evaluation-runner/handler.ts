import type { Handler, EventBridgeEvent, APIGatewayProxyEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
  QueryCommand,
  ScanCommand
} from '@aws-sdk/lib-dynamodb';
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

// W&B SDK import (using dynamic import for CommonJS compatibility)
let wandb: typeof import('wandb') | null = null;

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const bedrockClient = new BedrockRuntimeClient({});
const s3Client = new S3Client({});

// Environment variables
const WANDB_API_KEY = process.env.WANDB_API_KEY;
const WANDB_PROJECT = process.env.WANDB_PROJECT || 'biz-doc-vqa';
const WANDB_ENTITY = process.env.WANDB_ENTITY;

// Table names (passed via environment)
const EVALUATION_JOB_TABLE = process.env.EVALUATION_JOB_TABLE_NAME || '';
const ANNOTATION_TABLE = process.env.ANNOTATION_TABLE_NAME || '';
const IMAGE_TABLE = process.env.IMAGE_TABLE_NAME || '';
const STORAGE_BUCKET = process.env.STORAGE_BUCKET_NAME || '';

// Model configurations
const MODEL_CONFIGS: Record<string, { modelId: string; displayName: string }> = {
  'Amazon Nova Pro': { modelId: 'amazon.nova-pro-v1:0', displayName: 'Amazon Nova Pro' },
  'Claude 3.5 Sonnet': { modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0', displayName: 'Claude 3.5 Sonnet' },
  'Nemotron Nano 12B': { modelId: 'nvidia.nemotron-nano-12b', displayName: 'Nemotron Nano 12B' }
};

interface EvaluationEvent {
  jobId?: string;
  modelName?: string;
  datasetVersion?: string;
  triggeredBy?: string;
  triggerType?: 'SCHEDULED' | 'MANUAL';
}

interface AnnotationData {
  id: string;
  imageId: string;
  question: string;
  answer: string;
  language: string;
  boundingBoxes: number[][];
  questionType: string;
}

interface ImageData {
  id: string;
  fileName: string;
  s3Key: string;
  width: number;
  height: number;
}

interface EvaluationResult {
  annotationId: string;
  predicted: string;
  groundTruth: string;
  exactMatch: number;
  f1Score: number;
  iou: number;
  predictedBbox?: number[];
}

async function initWandb(): Promise<void> {
  if (!wandb) {
    wandb = await import('wandb');
  }
}

async function updateJobStatus(
  jobId: string,
  status: string,
  updates: Record<string, unknown>
): Promise<void> {
  const updateParts: string[] = [];
  const expressionValues: Record<string, unknown> = {};

  Object.entries({ status, ...updates }).forEach(([key, value]) => {
    if (value !== undefined) {
      updateParts.push(`${key} = :${key}`);
      expressionValues[`:${key}`] = value;
    }
  });

  try {
    await docClient.send(new UpdateCommand({
      TableName: EVALUATION_JOB_TABLE,
      Key: { id: jobId },
      UpdateExpression: `SET ${updateParts.join(', ')}`,
      ExpressionAttributeValues: expressionValues
    }));
  } catch (error) {
    console.error(`Failed to update job ${jobId}:`, error);
    throw error;
  }
}

async function getApprovedAnnotations(): Promise<AnnotationData[]> {
  try {
    const result = await docClient.send(new ScanCommand({
      TableName: ANNOTATION_TABLE,
      FilterExpression: 'validationStatus = :status',
      ExpressionAttributeValues: {
        ':status': 'APPROVED'
      }
    }));
    return result.Items as AnnotationData[] || [];
  } catch (error) {
    console.error('Failed to get approved annotations:', error);
    return [];
  }
}

async function getImage(imageId: string): Promise<ImageData | null> {
  try {
    const result = await docClient.send(new GetCommand({
      TableName: IMAGE_TABLE,
      Key: { id: imageId }
    }));
    return result.Item as ImageData | null;
  } catch (error) {
    console.error(`Failed to get image ${imageId}:`, error);
    return null;
  }
}

async function getImageFromS3(s3Key: string): Promise<Buffer | null> {
  try {
    const response = await s3Client.send(new GetObjectCommand({
      Bucket: STORAGE_BUCKET,
      Key: s3Key
    }));
    const bytes = await response.Body?.transformToByteArray();
    return bytes ? Buffer.from(bytes) : null;
  } catch (error) {
    console.error(`Failed to get image from S3 ${s3Key}:`, error);
    return null;
  }
}

async function callModel(
  modelId: string,
  imageBuffer: Buffer,
  question: string
): Promise<{ answer: string; bbox?: number[] }> {
  const prompt = `You are evaluating an OCR model. Look at this business document image and answer the following question.

Question: ${question}

Return your response as JSON with this format:
{
  "answer": "the extracted answer from the document",
  "boundingBox": [x0, y0, x1, y1]  // normalized coordinates 0-1
}

If you cannot find the answer, return {"answer": "", "boundingBox": null}`;

  try {
    const command = new ConverseCommand({
      modelId,
      messages: [{
        role: 'user',
        content: [
          { text: prompt },
          {
            image: {
              format: 'jpeg',
              source: { bytes: imageBuffer }
            }
          }
        ]
      }],
      inferenceConfig: {
        temperature: 0.1,
        maxTokens: 500
      }
    });

    const response = await bedrockClient.send(command);
    const responseText = response.output?.message?.content?.[0]?.text || '';

    // Try to parse JSON response
    try {
      const parsed = JSON.parse(responseText);
      return {
        answer: parsed.answer || '',
        bbox: parsed.boundingBox
      };
    } catch {
      // If JSON parsing fails, return raw text
      return { answer: responseText };
    }
  } catch (error) {
    console.error('Model call failed:', error);
    return { answer: '' };
  }
}

function calculateExactMatch(predicted: string, groundTruth: string): number {
  const predNorm = predicted.trim().toLowerCase();
  const gtNorm = groundTruth.trim().toLowerCase();
  return predNorm === gtNorm ? 1.0 : 0.0;
}

function calculateF1Score(predicted: string, groundTruth: string): number {
  const predTokens = new Set(predicted.toLowerCase().split(/\s+/).filter(t => t.length > 0));
  const gtTokens = new Set(groundTruth.toLowerCase().split(/\s+/).filter(t => t.length > 0));

  if (predTokens.size === 0 && gtTokens.size === 0) return 1.0;

  const intersection = new Set([...predTokens].filter(t => gtTokens.has(t)));
  if (intersection.size === 0) return 0.0;

  const precision = intersection.size / predTokens.size;
  const recall = intersection.size / gtTokens.size;

  return 2 * (precision * recall) / (precision + recall);
}

function calculateIoU(bbox1?: number[], bbox2?: number[][]): number {
  if (!bbox1 || !bbox2 || bbox2.length === 0) return 0.0;

  // Use the first ground truth bounding box
  const gtBbox = bbox2[0];
  if (gtBbox.length < 4 || bbox1.length < 4) return 0.0;

  const [x1Min, y1Min, x1Max, y1Max] = bbox1;
  const [x2Min, y2Min, x2Max, y2Max] = gtBbox;

  // Calculate intersection
  const xInterMin = Math.max(x1Min, x2Min);
  const yInterMin = Math.max(y1Min, y2Min);
  const xInterMax = Math.min(x1Max, x2Max);
  const yInterMax = Math.min(y1Max, y2Max);

  if (xInterMax <= xInterMin || yInterMax <= yInterMin) return 0.0;

  const interArea = (xInterMax - xInterMin) * (yInterMax - yInterMin);

  // Calculate union
  const area1 = (x1Max - x1Min) * (y1Max - y1Min);
  const area2 = (x2Max - x2Min) * (y2Max - y2Min);
  const unionArea = area1 + area2 - interArea;

  return unionArea > 0 ? interArea / unionArea : 0.0;
}

async function runEvaluation(
  modelName: string,
  datasetVersion: string,
  jobId: string
): Promise<{
  results: EvaluationResult[];
  exactMatchRate: number;
  f1Score: number;
  avgIoU: number;
  wandbRunUrl: string;
}> {
  await initWandb();
  if (!wandb) {
    throw new Error('Failed to initialize W&B SDK');
  }

  const modelConfig = MODEL_CONFIGS[modelName];
  if (!modelConfig) {
    throw new Error(`Unknown model: ${modelName}`);
  }

  // Get approved annotations
  const annotations = await getApprovedAnnotations();
  if (annotations.length === 0) {
    throw new Error('No approved annotations found for evaluation');
  }

  console.log(`Starting evaluation of ${modelName} on ${annotations.length} annotations`);

  // Initialize W&B run
  const run = await wandb.init({
    project: WANDB_PROJECT,
    entity: WANDB_ENTITY || undefined,
    name: `eval-${modelName.toLowerCase().replace(/\s+/g, '-')}-${jobId}`,
    tags: ['evaluation', modelName, datasetVersion],
    config: {
      model: modelName,
      modelId: modelConfig.modelId,
      datasetVersion,
      jobId,
      sampleCount: annotations.length,
      timestamp: new Date().toISOString()
    }
  });

  // Create evaluation artifact
  const evalArtifact = new wandb.Artifact(
    `${modelName.toLowerCase().replace(/\s+/g, '-')}-eval`,
    'evaluation',
    {
      description: `Evaluation of ${modelName} on VQA dataset`,
      metadata: {
        model: modelName,
        dataset_version: datasetVersion,
        evaluated_date: new Date().toISOString()
      }
    }
  );

  // Create results table
  const resultsTable = new wandb.Table({
    columns: ['annotation_id', 'predicted', 'ground_truth', 'exact_match', 'f1_score', 'iou']
  });

  const results: EvaluationResult[] = [];
  let totalEM = 0;
  let totalF1 = 0;
  let totalIoU = 0;

  // Evaluate each annotation
  for (let i = 0; i < annotations.length; i++) {
    const annotation = annotations[i];

    try {
      // Get image
      const image = await getImage(annotation.imageId);
      if (!image) {
        console.warn(`Image ${annotation.imageId} not found, skipping`);
        continue;
      }

      const imageBuffer = await getImageFromS3(image.s3Key);
      if (!imageBuffer) {
        console.warn(`Failed to load image from S3, skipping`);
        continue;
      }

      // Call model
      const prediction = await callModel(modelConfig.modelId, imageBuffer, annotation.question);

      // Calculate metrics
      const em = calculateExactMatch(prediction.answer, annotation.answer);
      const f1 = calculateF1Score(prediction.answer, annotation.answer);

      // Normalize ground truth bbox for IoU calculation (if available)
      let normalizedGtBbox: number[][] | undefined;
      if (annotation.boundingBoxes && annotation.boundingBoxes.length > 0) {
        normalizedGtBbox = annotation.boundingBoxes.map(bbox => [
          bbox[0] / image.width,
          bbox[1] / image.height,
          bbox[2] / image.width,
          bbox[3] / image.height
        ]);
      }

      const iou = calculateIoU(prediction.bbox, normalizedGtBbox);

      // Update running totals
      totalEM += em;
      totalF1 += f1;
      totalIoU += iou;

      const result: EvaluationResult = {
        annotationId: annotation.id,
        predicted: prediction.answer,
        groundTruth: annotation.answer,
        exactMatch: em,
        f1Score: f1,
        iou,
        predictedBbox: prediction.bbox
      };
      results.push(result);

      // Add to table
      resultsTable.addData(
        annotation.id,
        prediction.answer,
        annotation.answer,
        em,
        f1,
        iou
      );

      // Log incremental progress
      run.log({
        'progress/samples_evaluated': i + 1,
        'progress/running_exact_match': totalEM / (i + 1),
        'progress/running_f1_score': totalF1 / (i + 1),
        'progress/running_iou': totalIoU / (i + 1),
        'sample/exact_match': em,
        'sample/f1_score': f1,
        'sample/iou': iou
      });

    } catch (error) {
      console.error(`Error evaluating annotation ${annotation.id}:`, error);
    }
  }

  // Calculate final metrics
  const sampleCount = results.length;
  const exactMatchRate = sampleCount > 0 ? totalEM / sampleCount : 0;
  const avgF1 = sampleCount > 0 ? totalF1 / sampleCount : 0;
  const avgIoU = sampleCount > 0 ? totalIoU / sampleCount : 0;

  // Add results to artifact
  evalArtifact.add(resultsTable, 'evaluation_results');
  run.logArtifact(evalArtifact);

  // Log to run history
  run.log({ evaluation_results: resultsTable });

  // Log summary
  wandb.summary['exact_match_rate'] = exactMatchRate;
  wandb.summary['avg_f1_score'] = avgF1;
  wandb.summary['avg_iou'] = avgIoU;
  wandb.summary['model_name'] = modelName;
  wandb.summary['samples_evaluated'] = sampleCount;

  await evalArtifact.wait();
  const wandbRunUrl = run.url;

  await run.finish();

  console.log(`Evaluation complete: EM=${exactMatchRate.toFixed(3)}, F1=${avgF1.toFixed(3)}, IoU=${avgIoU.toFixed(3)}`);

  return {
    results,
    exactMatchRate,
    f1Score: avgF1,
    avgIoU,
    wandbRunUrl
  };
}

export const handler: Handler = async (event: EvaluationEvent | EventBridgeEvent<string, unknown> | APIGatewayProxyEvent) => {
  console.log('Evaluation runner invoked:', JSON.stringify(event, null, 2));

  // Parse event to get parameters
  let params: EvaluationEvent = {};

  if ('source' in event && event.source === 'aws.events') {
    // EventBridge scheduled event
    params = {
      modelName: 'Amazon Nova Pro',
      datasetVersion: 'latest',
      triggeredBy: 'EventBridge',
      triggerType: 'SCHEDULED'
    };
  } else if ('body' in event && event.body) {
    // API Gateway request
    params = JSON.parse(event.body);
    params.triggerType = 'MANUAL';
  } else {
    // Direct invocation
    params = event as EvaluationEvent;
  }

  const {
    jobId = `eval-${Date.now()}`,
    modelName = 'Amazon Nova Pro',
    datasetVersion = 'latest',
    triggeredBy = 'system',
    triggerType = 'MANUAL'
  } = params;

  try {
    // Update job status to RUNNING
    await updateJobStatus(jobId, 'RUNNING', {
      startedAt: new Date().toISOString(),
      modelName,
      datasetVersion,
      triggeredBy,
      triggerType
    });

    // Run evaluation
    const result = await runEvaluation(modelName, datasetVersion, jobId);

    // Update job status to COMPLETED
    await updateJobStatus(jobId, 'COMPLETED', {
      completedAt: new Date().toISOString(),
      exactMatchRate: result.exactMatchRate,
      f1Score: result.f1Score,
      avgIoU: result.avgIoU,
      sampleCount: result.results.length,
      wandbRunUrl: result.wandbRunUrl
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        jobId,
        exactMatchRate: result.exactMatchRate,
        f1Score: result.f1Score,
        avgIoU: result.avgIoU,
        sampleCount: result.results.length,
        wandbRunUrl: result.wandbRunUrl
      })
    };

  } catch (error) {
    console.error('Evaluation failed:', error);

    // Update job status to FAILED
    await updateJobStatus(jobId, 'FAILED', {
      completedAt: new Date().toISOString(),
      errorMessage: error instanceof Error ? error.message : 'Unknown error'
    });

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        jobId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};
