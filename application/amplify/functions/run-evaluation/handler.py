"""
Model Evaluation Lambda Handler

Evaluates AI models on the VQA dataset using ANLS and IoU metrics.
Triggered by SQS messages for parallel per-model evaluation.

Metrics:
  - ANLS (Average Normalized Levenshtein Similarity): text accuracy (DocVQA standard)
  - IoU (Intersection over Union): bounding box spatial accuracy
"""
import json
import os
import boto3
import wandb
from datetime import datetime, timezone
from decimal import Decimal
from typing import Dict, List, Optional
from huggingface_hub import snapshot_download
from PIL import Image
from io import BytesIO

# AWS clients
dynamodb = boto3.resource('dynamodb')
dynamodb_client = boto3.client('dynamodb')
bedrock_client = boto3.client('bedrock-runtime')
ssm_client = boto3.client('ssm')

# Environment variables
WANDB_PROJECT = os.environ.get('WANDB_PROJECT', 'biz-doc-vqa')

# Module-level caches
_table_cache: Dict[str, object] = {}
_secrets_cache: Dict[str, str] = {}


def get_table(prefix: str):
    """Discover DynamoDB table name by prefix (same pattern as process-image)."""
    if prefix not in _table_cache:
        response = dynamodb_client.list_tables()
        table_name = next(
            (name for name in response.get('TableNames', []) if name.startswith(f'{prefix}-')),
            None,
        )
        if not table_name:
            raise ValueError(f"Table with prefix '{prefix}' not found")
        print(f'Discovered table: {table_name}')
        _table_cache[prefix] = dynamodb.Table(table_name)
    return _table_cache[prefix]


def get_secret(ssm_param_env_key: str) -> str:
    """Read secret from SSM Parameter Store with caching.

    The environment variable contains the SSM parameter path (e.g. '/business-ocr/wandb-api-key').
    """
    ssm_param = os.environ.get(ssm_param_env_key, '')
    if not ssm_param:
        print(f'Warning: {ssm_param_env_key} environment variable is not set')
        return ''
    if ssm_param not in _secrets_cache:
        response = ssm_client.get_parameter(Name=ssm_param, WithDecryption=True)
        _secrets_cache[ssm_param] = response['Parameter']['Value']
    return _secrets_cache[ssm_param]


def handler(event, context):
    """
    SQS event handler for model evaluation.

    SQS message body format:
    {
        "evaluationJobId": "amplify-record-id",
        "jobId": "job-uuid",
        "datasetVersion": "v1.0.0",
        "huggingFaceRepoId": "icoxfog417/biz-doc-vqa",
        "modelId": "claude-sonnet-4-5",
        "modelName": "Claude Sonnet 4.5",
        "modelBedrockId": "global.anthropic.claude-sonnet-4-5-20250929-v1:0"
    }
    """
    batch_item_failures = []

    for record in event.get('Records', []):
        try:
            message = json.loads(record['body'])
            process_evaluation_job(message)
        except Exception as e:
            print(f"Error processing message {record.get('messageId')}: {str(e)}")
            batch_item_failures.append({'itemIdentifier': record['messageId']})

    return {'batchItemFailures': batch_item_failures}


def process_evaluation_job(message: Dict):
    """Process a single evaluation job for one model."""
    evaluation_job_id = message['evaluationJobId']
    job_id = message['jobId']
    dataset_version = message['datasetVersion']
    hf_repo_id = message['huggingFaceRepoId']
    model_id = message['modelId']
    model_name = message.get('modelName', model_id)
    bedrock_model_id = message['modelBedrockId']

    job_table = get_table('EvaluationJob')
    now = datetime.now(timezone.utc).isoformat()

    # Update status to RUNNING
    job_table.update_item(
        Key={'id': evaluation_job_id},
        UpdateExpression='SET #s = :status, startedAt = :now, updatedAt = :now',
        ExpressionAttributeNames={'#s': 'status'},
        ExpressionAttributeValues={':status': 'RUNNING', ':now': now},
    )

    wandb_run = None

    try:
        # Initialize W&B
        wandb_api_key = get_secret('WANDB_API_KEY_SSM_PARAM')
        if wandb_api_key:
            wandb.login(key=wandb_api_key)
            wandb_run = wandb.init(
                project=WANDB_PROJECT,
                name=f'eval-{model_id}-{dataset_version}',
                config={
                    'model_id': model_id,
                    'model_name': model_name,
                    'bedrock_model_id': bedrock_model_id,
                    'dataset_version': dataset_version,
                    'hf_repo_id': hf_repo_id,
                    'job_id': job_id,
                },
                tags=['evaluation', model_id, dataset_version],
            )

        # Download dataset from HF Hub (ImageFolder format)
        print(f'Downloading dataset from {hf_repo_id}...')
        dataset_dir = snapshot_download(
            hf_repo_id,
            repo_type='dataset',
            local_dir='/tmp/hf_dataset',
        )
        dataset = load_imagefolder_dataset(dataset_dir)
        total_samples = len(dataset)
        print(f'Loaded {total_samples} samples')

        # Run evaluation
        running_anls = 0.0
        running_iou = 0.0
        samples_evaluated = 0
        results_data: List[Dict] = []

        for i, sample in enumerate(dataset):
            try:
                image = Image.open(sample['_image_path'])
                prediction = invoke_model(
                    bedrock_model_id,
                    image,
                    sample['question'],
                    sample.get('language', 'en'),
                )

                # Calculate ANLS (text accuracy)
                anls = calculate_anls(prediction.get('answer', ''), sample['answers'])

                # Calculate IoU (bounding box accuracy)
                iou = calculate_iou(
                    prediction.get('bbox', [0.0, 0.0, 1.0, 1.0]),
                    list(sample['answer_bbox']),
                )

                samples_evaluated += 1
                # Incremental running average
                running_anls += (anls - running_anls) / samples_evaluated
                running_iou += (iou - running_iou) / samples_evaluated

                # Log incrementally to W&B
                if wandb_run:
                    wandb.log({
                        'progress/samples_evaluated': samples_evaluated,
                        'progress/running_anls': running_anls,
                        'progress/running_iou': running_iou,
                        'sample/anls': anls,
                        'sample/iou': iou,
                    })

                results_data.append({
                    'annotation_id': sample.get('annotation_id', f'a{i}'),
                    'question': sample['question'],
                    'ground_truth': sample['answers'][0] if sample['answers'] else '',
                    'prediction': prediction.get('answer', ''),
                    'anls': round(anls, 4),
                    'iou': round(iou, 4),
                })

                if samples_evaluated % 10 == 0:
                    print(
                        f'Progress: {samples_evaluated}/{total_samples} '
                        f'| ANLS: {running_anls:.4f} | IoU: {running_iou:.4f}'
                    )

            except Exception as e:
                print(f'Error evaluating sample {i}: {str(e)}')
                continue

        # Log final results table to W&B
        wandb_run_url = ''
        if wandb_run and results_data:
            columns = ['annotation_id', 'question', 'ground_truth', 'prediction', 'anls', 'iou']
            table = wandb.Table(columns=columns)
            for row in results_data:
                table.add_data(*[row[c] for c in columns])
            wandb.log({'evaluation_results': table})

            wandb.summary['final_anls'] = running_anls
            wandb.summary['final_iou'] = running_iou
            wandb.summary['total_samples'] = samples_evaluated

            wandb_run_url = wandb_run.url or ''

        # Update job status to COMPLETED
        now = datetime.now(timezone.utc).isoformat()
        job_table.update_item(
            Key={'id': evaluation_job_id},
            UpdateExpression=(
                'SET #s = :status, avgAnls = :anls, avgIou = :iou, '
                'totalSamples = :total, wandbRunUrl = :url, completedAt = :now, updatedAt = :now'
            ),
            ExpressionAttributeNames={'#s': 'status'},
            ExpressionAttributeValues={
                ':status': 'COMPLETED',
                ':anls': Decimal(str(round(running_anls, 6))),
                ':iou': Decimal(str(round(running_iou, 6))),
                ':total': samples_evaluated,
                ':url': wandb_run_url,
                ':now': now,
            },
        )

        print(
            f'Evaluation complete for {model_id}: '
            f'ANLS={running_anls:.4f}, IoU={running_iou:.4f}, Samples={samples_evaluated}'
        )

    except Exception as e:
        print(f'Evaluation job failed for {model_id}: {str(e)}')
        now = datetime.now(timezone.utc).isoformat()
        job_table.update_item(
            Key={'id': evaluation_job_id},
            UpdateExpression='SET #s = :status, errorMessage = :error, updatedAt = :now',
            ExpressionAttributeNames={'#s': 'status'},
            ExpressionAttributeValues={
                ':status': 'FAILED',
                ':error': str(e)[:1000],
                ':now': now,
            },
        )
        raise  # Re-raise for SQS retry / DLQ

    finally:
        if wandb_run:
            wandb.finish()


def load_imagefolder_dataset(repo_dir: str) -> List[Dict]:
    """Load ImageFolder dataset from downloaded HF repo directory.

    Parses data/metadata.jsonl and returns list of samples with image file paths.
    """
    metadata_path = os.path.join(repo_dir, 'data', 'metadata.jsonl')
    if not os.path.exists(metadata_path):
        raise FileNotFoundError(f'metadata.jsonl not found at {metadata_path}')

    data_dir = os.path.join(repo_dir, 'data')
    samples: List[Dict] = []

    with open(metadata_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            row = json.loads(line)
            row['_image_path'] = os.path.join(data_dir, row['file_name'])
            samples.append(row)

    return samples


def invoke_model(bedrock_model_id: str, image, question: str, language: str) -> Dict:
    """Invoke Bedrock model with image and question, return parsed answer + bbox."""
    # Convert PIL Image to JPEG bytes
    img_buffer = BytesIO()
    if image.mode == 'RGBA':
        image = image.convert('RGB')
    image.save(img_buffer, format='JPEG', quality=85)
    img_bytes = img_buffer.getvalue()

    prompt = (
        'Look at this document image and answer the question.\n'
        'Return your answer as JSON: {"answer": "your answer text", '
        '"bbox": [x0, y0, x1, y1]} where bbox is normalized 0-1 coordinates.\n\n'
        f'Question: {question}\n\n'
        'Return ONLY valid JSON, no explanation.'
    )

    response = bedrock_client.converse(
        modelId=bedrock_model_id,
        messages=[
            {
                'role': 'user',
                'content': [
                    {'text': prompt},
                    {
                        'image': {
                            'format': 'jpeg',
                            'source': {'bytes': img_bytes},
                        },
                    },
                ],
            },
        ],
        inferenceConfig={
            'temperature': 0.1,
            'maxTokens': 500,
        },
    )

    content = response.get('output', {}).get('message', {}).get('content', [])
    response_text = content[0].get('text', '') if content else ''

    return parse_model_response(response_text)


def parse_model_response(response_text: str) -> Dict:
    """Parse model JSON response to extract answer and bounding box."""
    result: Dict = {'answer': '', 'bbox': [0.0, 0.0, 1.0, 1.0]}

    try:
        # Remove markdown code fences if present
        text = response_text.strip()
        if text.startswith('```'):
            lines = text.split('\n')
            text = '\n'.join(lines[1:])
            if text.endswith('```'):
                text = text[:-3]
            text = text.strip()

        parsed = json.loads(text)
        result['answer'] = str(parsed.get('answer', ''))

        bbox = parsed.get('bbox', [0, 0, 1, 1])
        if isinstance(bbox, list) and len(bbox) == 4:
            result['bbox'] = [float(v) for v in bbox]

    except (json.JSONDecodeError, ValueError):
        # Fallback: use raw text as answer
        result['answer'] = response_text.strip()

    return result


def calculate_anls(prediction: str, ground_truths: List[str], threshold: float = 0.5) -> float:
    """
    Calculate ANLS (Average Normalized Levenshtein Similarity).

    Standard metric for DocVQA evaluation.
    ANLS = 1 - NLD (Normalized Levenshtein Distance).
    If ANLS < threshold, return 0 (penalize very wrong answers).
    """
    if not ground_truths:
        return 0.0

    pred_norm = prediction.lower().strip()
    max_anls = 0.0

    for gt in ground_truths:
        gt_norm = gt.lower().strip()

        if not pred_norm and not gt_norm:
            max_anls = 1.0
            break

        if not pred_norm or not gt_norm:
            continue

        lev_dist = levenshtein_distance(pred_norm, gt_norm)
        max_len = max(len(pred_norm), len(gt_norm))
        anls = 1.0 - (lev_dist / max_len)

        if anls < threshold:
            anls = 0.0

        max_anls = max(max_anls, anls)

    return max_anls


def levenshtein_distance(s1: str, s2: str) -> int:
    """Compute Levenshtein distance between two strings using dynamic programming."""
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)

    if len(s2) == 0:
        return len(s1)

    prev_row = list(range(len(s2) + 1))

    for i, c1 in enumerate(s1):
        curr_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = prev_row[j + 1] + 1
            deletions = curr_row[j] + 1
            substitutions = prev_row[j] + (c1 != c2)
            curr_row.append(min(insertions, deletions, substitutions))
        prev_row = curr_row

    return prev_row[-1]


def calculate_iou(pred_bbox: List[float], gt_bbox: List[float]) -> float:
    """
    Calculate IoU (Intersection over Union) for bounding boxes.
    Coordinates are normalized [x0, y0, x1, y1] in 0-1 range.
    """
    if len(pred_bbox) != 4 or len(gt_bbox) != 4:
        return 0.0

    x1 = max(pred_bbox[0], gt_bbox[0])
    y1 = max(pred_bbox[1], gt_bbox[1])
    x2 = min(pred_bbox[2], gt_bbox[2])
    y2 = min(pred_bbox[3], gt_bbox[3])

    intersection = max(0.0, x2 - x1) * max(0.0, y2 - y1)

    pred_area = (pred_bbox[2] - pred_bbox[0]) * (pred_bbox[3] - pred_bbox[1])
    gt_area = (gt_bbox[2] - gt_bbox[0]) * (gt_bbox[3] - gt_bbox[1])

    union = pred_area + gt_area - intersection

    if union <= 0:
        return 0.0

    return intersection / union
