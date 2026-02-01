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
from metrics import calculate_anls, calculate_iou
from prompts import get_evaluation_prompt

# AWS clients
dynamodb = boto3.resource('dynamodb')
bedrock_client = boto3.client('bedrock-runtime')
ssm_client = boto3.client('ssm')

# Environment variables
WANDB_PROJECT = os.environ.get('WANDB_PROJECT', 'biz-doc-vqa')

# Module-level caches
_table_cache: Dict[str, object] = {}
_secrets_cache: Dict[str, str] = {}


# Table name overrides passed via SQS message from the data-stack trigger.
# This avoids circular dependency between function and data CloudFormation stacks.
_table_name_overrides: Dict[str, str] = {}


def get_table(prefix: str):
    """Get DynamoDB table by name from SQS message overrides."""
    if prefix not in _table_cache:
        table_name = _table_name_overrides.get(prefix)
        if not table_name:
            raise ValueError(f"Table name for '{prefix}' not provided in SQS message")
        print(f'Using table: {table_name}')
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

    # Table name is passed from the data-stack trigger to avoid circular
    # CloudFormation dependency between function and data stacks.
    eval_table_name = message.get('evaluationJobTableName')
    if not eval_table_name:
        raise ValueError('evaluationJobTableName not provided in SQS message')
    _table_name_overrides['EvaluationJob'] = eval_table_name

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
        hf_token = get_secret('HF_TOKEN_SSM_PARAM')
        dataset_dir = snapshot_download(
            hf_repo_id,
            repo_type='dataset',
            local_dir='/tmp/hf_dataset',
            token=hf_token if hf_token else None,
        )
        dataset = load_imagefolder_dataset(dataset_dir)
        total_samples = len(dataset)
        print(f'Loaded {total_samples} samples')

        # Run evaluation
        running_anls = 0.0
        running_iou = 0.0
        samples_evaluated = 0
        samples_failed = 0
        failed_sample_errors: List[str] = []
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
                        'progress/samples_failed': samples_failed,
                        'progress/running_anls': running_anls,
                        'progress/running_iou': running_iou,
                        'sample/anls': anls,
                        'sample/iou': iou,
                    })

                results_data.append({
                    'annotation_id': sample.get('annotation_id', f'a{i}'),
                    'question': sample['question'],
                    'ground_truth': '\n'.join(sample['answers']) if sample['answers'] else '',
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
                samples_failed += 1
                error_msg = f'Sample {i}: {str(e)[:100]}'
                print(f'Error evaluating sample {i}: {str(e)}')
                # Keep first 10 error messages for diagnostics
                if len(failed_sample_errors) < 10:
                    failed_sample_errors.append(error_msg)
                continue

        # Log failure summary
        if samples_failed > 0:
            print(
                f'Warning: {samples_failed}/{total_samples} samples failed to evaluate. '
                f'First errors: {failed_sample_errors[:3]}'
            )

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
            wandb.summary['failed_samples'] = samples_failed

            wandb_run_url = wandb_run.url or ''

        # Determine final status based on sample failures
        # COMPLETED: at least some samples evaluated successfully
        # FAILED: no samples evaluated (all failed)
        if samples_evaluated == 0 and total_samples > 0:
            raise RuntimeError(
                f'All {total_samples} samples failed to evaluate. '
                f'Errors: {"; ".join(failed_sample_errors[:3])}'
            )

        # Update job status to COMPLETED
        now = datetime.now(timezone.utc).isoformat()
        error_summary = (
            f'{samples_failed} samples failed: {"; ".join(failed_sample_errors[:3])}'
            if samples_failed > 0
            else None
        )
        job_table.update_item(
            Key={'id': evaluation_job_id},
            UpdateExpression=(
                'SET #s = :status, avgAnls = :anls, avgIou = :iou, '
                'totalSamples = :total, failedSamples = :failed, '
                'wandbRunUrl = :url, completedAt = :now, updatedAt = :now'
                + (', errorMessage = :error' if error_summary else '')
            ),
            ExpressionAttributeNames={'#s': 'status'},
            ExpressionAttributeValues={
                ':status': 'COMPLETED',
                ':anls': Decimal(str(round(running_anls, 6))),
                ':iou': Decimal(str(round(running_iou, 6))),
                ':total': samples_evaluated,
                ':failed': samples_failed,
                ':url': wandb_run_url,
                ':now': now,
                **(({':error': error_summary}) if error_summary else {}),
            },
        )

        print(
            f'Evaluation complete for {model_id}: '
            f'ANLS={running_anls:.4f}, IoU={running_iou:.4f}, '
            f'Samples={samples_evaluated}, Failed={samples_failed}'
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
    """Invoke Bedrock model with image and question, return parsed answer + bbox.

    Uses language-specific prompts synchronized with annotation prompts
    for consistent answer formatting (see prompts.py).
    """
    # Convert PIL Image to JPEG bytes
    img_buffer = BytesIO()
    if image.mode == 'RGBA':
        image = image.convert('RGB')
    image.save(img_buffer, format='JPEG', quality=85)
    img_bytes = img_buffer.getvalue()

    # Use language-specific prompt for consistent formatting with annotation
    prompt = get_evaluation_prompt(question, language)

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


# Metrics functions (calculate_anls, calculate_iou) are imported from metrics.py
