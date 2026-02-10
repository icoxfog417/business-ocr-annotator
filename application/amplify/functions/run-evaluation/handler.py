"""
Model Evaluation Lambda Handler

Evaluates AI models on the VQA dataset using ANLS and IoU metrics.
Triggered by SQS messages for parallel per-model evaluation.

Supports checkpoint/resume: when the Lambda approaches its timeout,
it saves progress to DynamoDB and re-enqueues the job to SQS so the
next invocation continues from where the previous one stopped.

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
sqs_client = boto3.client('sqs')
ssm_client = boto3.client('ssm')

# Environment variables
WANDB_PROJECT = os.environ.get('WANDB_PROJECT', 'biz-doc-vqa')

# Time (ms) reserved before Lambda timeout for saving checkpoint and re-enqueueing.
# 120 seconds gives enough headroom for DynamoDB write + SQS send + W&B finish.
CHECKPOINT_BUFFER_MS = 120_000

# Module-level caches
_table_cache: Dict[str, object] = {}
_secrets_cache: Dict[str, str] = {}


# Table name overrides passed via SQS message from the data-stack trigger.
# This avoids circular dependency between function and data CloudFormation stacks.
_table_name_overrides: Dict[str, str] = {}

# Lambda context reference for timeout checking
_lambda_context = None


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
        "modelBedrockId": "global.anthropic.claude-sonnet-4-5-20250929-v1:0",
        "evaluationJobTableName": "EvaluationJob-xxx",
        "evaluationQueueUrl": "https://sqs.us-east-1.amazonaws.com/..."
    }
    """
    global _lambda_context
    _lambda_context = context

    batch_item_failures = []

    for record in event.get('Records', []):
        try:
            message = json.loads(record['body'])
            process_evaluation_job(message)
        except Exception as e:
            print(f"Error processing message {record.get('messageId')}: {str(e)}")
            batch_item_failures.append({'itemIdentifier': record['messageId']})

    return {'batchItemFailures': batch_item_failures}


def is_approaching_timeout() -> bool:
    """Check if the Lambda is approaching its timeout.

    Returns True when remaining execution time is less than CHECKPOINT_BUFFER_MS.
    """
    if _lambda_context is None:
        return False
    remaining_ms = _lambda_context.get_remaining_time_in_millis()
    return remaining_ms < CHECKPOINT_BUFFER_MS


def process_evaluation_job(message: Dict):
    """Process a single evaluation job for one model.

    Supports checkpoint/resume: if the previous invocation saved a checkpoint
    (due to approaching Lambda timeout), this invocation resumes from that point.
    The checkpoint stores the sample index, accumulated metrics, and counts in
    the DynamoDB EvaluationJob record.  When approaching timeout, the handler
    saves its progress, re-enqueues the job to SQS, and returns normally so
    the current SQS message is deleted (not counted as a retry failure).
    """
    evaluation_job_id = message['evaluationJobId']
    job_id = message['jobId']
    dataset_version = message['datasetVersion']
    hf_repo_id = message['huggingFaceRepoId']
    model_id = message['modelId']
    model_name = message.get('modelName', model_id)
    bedrock_model_id = message['modelBedrockId']
    queue_url = message.get('evaluationQueueUrl', '')

    # Table name is passed from the data-stack trigger to avoid circular
    # CloudFormation dependency between function and data stacks.
    eval_table_name = message.get('evaluationJobTableName')
    if not eval_table_name:
        raise ValueError('evaluationJobTableName not provided in SQS message')
    _table_name_overrides['EvaluationJob'] = eval_table_name

    job_table = get_table('EvaluationJob')
    now = datetime.now(timezone.utc).isoformat()

    # Read existing checkpoint from DynamoDB (if resuming)
    checkpoint = load_checkpoint(job_table, evaluation_job_id)
    start_index = checkpoint.get('sampleIndex', 0)
    is_resume = start_index > 0

    # Update status to RUNNING (only set startedAt on first invocation)
    if is_resume:
        print(f'Resuming from checkpoint at sample {start_index}')
        job_table.update_item(
            Key={'id': evaluation_job_id},
            UpdateExpression='SET #s = :status, updatedAt = :now',
            ExpressionAttributeNames={'#s': 'status'},
            ExpressionAttributeValues={':status': 'RUNNING', ':now': now},
        )
    else:
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
        run_suffix = f'-part{checkpoint.get("part", 1)}' if is_resume else ''
        if wandb_api_key:
            wandb.login(key=wandb_api_key)
            wandb_run = wandb.init(
                project=WANDB_PROJECT,
                name=f'eval-{model_id}-{dataset_version}{run_suffix}',
                config={
                    'model_id': model_id,
                    'model_name': model_name,
                    'bedrock_model_id': bedrock_model_id,
                    'dataset_version': dataset_version,
                    'hf_repo_id': hf_repo_id,
                    'job_id': job_id,
                    'start_index': start_index,
                    'is_resume': is_resume,
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
        print(f'Loaded {total_samples} samples (starting from index {start_index})')

        # Restore accumulated metrics from checkpoint
        running_anls = checkpoint.get('runningAnls', 0.0)
        running_iou = checkpoint.get('runningIou', 0.0)
        samples_evaluated = checkpoint.get('samplesEvaluated', 0)
        samples_failed = checkpoint.get('samplesFailed', 0)
        failed_sample_errors: List[str] = []
        results_data: List[Dict] = []
        checkpointed = False

        for i in range(start_index, total_samples):
            # Check if we're approaching Lambda timeout
            if is_approaching_timeout():
                print(
                    f'Approaching timeout at sample {i}/{total_samples}. '
                    f'Saving checkpoint and re-enqueueing.'
                )
                save_checkpoint(
                    job_table, evaluation_job_id,
                    sample_index=i,
                    samples_evaluated=samples_evaluated,
                    samples_failed=samples_failed,
                    running_anls=running_anls,
                    running_iou=running_iou,
                    part=checkpoint.get('part', 1) + (1 if is_resume else 1),
                )
                reenqueue_job(message, queue_url)
                checkpointed = True
                break

            sample = dataset[i]
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

        # If we checkpointed, return early (job continues in next invocation)
        if checkpointed:
            print(
                f'Checkpoint saved for {model_id}: '
                f'evaluated={samples_evaluated}, failed={samples_failed}'
            )
            return

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

        # Update job status to COMPLETED and clear checkpoint
        now = datetime.now(timezone.utc).isoformat()
        error_summary = (
            f'{samples_failed} samples failed: {"; ".join(failed_sample_errors[:3])}'
            if samples_failed > 0
            else None
        )
        update_expr = (
            'SET #s = :status, avgAnls = :anls, avgIou = :iou, '
            'totalSamples = :total, failedSamples = :failed, '
            'wandbRunUrl = :url, completedAt = :now, updatedAt = :now'
            + (', errorMessage = :error' if error_summary else '')
            + ' REMOVE checkpoint'
        )
        job_table.update_item(
            Key={'id': evaluation_job_id},
            UpdateExpression=update_expr,
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


def load_checkpoint(job_table, evaluation_job_id: str) -> Dict:
    """Load checkpoint data from DynamoDB EvaluationJob record.

    Returns checkpoint dict with keys: sampleIndex, samplesEvaluated,
    samplesFailed, runningAnls, runningIou, part.  Returns empty dict
    if no checkpoint exists.
    """
    response = job_table.get_item(
        Key={'id': evaluation_job_id},
        ProjectionExpression='checkpoint',
    )
    item = response.get('Item', {})
    checkpoint = item.get('checkpoint')
    if checkpoint:
        # Convert Decimal values back to float/int
        return {
            'sampleIndex': int(checkpoint.get('sampleIndex', 0)),
            'samplesEvaluated': int(checkpoint.get('samplesEvaluated', 0)),
            'samplesFailed': int(checkpoint.get('samplesFailed', 0)),
            'runningAnls': float(checkpoint.get('runningAnls', 0)),
            'runningIou': float(checkpoint.get('runningIou', 0)),
            'part': int(checkpoint.get('part', 1)),
        }
    return {}


def save_checkpoint(
    job_table,
    evaluation_job_id: str,
    sample_index: int,
    samples_evaluated: int,
    samples_failed: int,
    running_anls: float,
    running_iou: float,
    part: int,
):
    """Save checkpoint data to DynamoDB EvaluationJob record."""
    now = datetime.now(timezone.utc).isoformat()
    job_table.update_item(
        Key={'id': evaluation_job_id},
        UpdateExpression='SET checkpoint = :cp, updatedAt = :now',
        ExpressionAttributeValues={
            ':cp': {
                'sampleIndex': sample_index,
                'samplesEvaluated': samples_evaluated,
                'samplesFailed': samples_failed,
                'runningAnls': Decimal(str(round(running_anls, 8))),
                'runningIou': Decimal(str(round(running_iou, 8))),
                'part': part,
            },
            ':now': now,
        },
    )


def reenqueue_job(message: Dict, queue_url: str):
    """Re-enqueue the evaluation job to SQS to continue from checkpoint."""
    if not queue_url:
        print('Warning: evaluationQueueUrl not provided, cannot re-enqueue')
        return

    sqs_client.send_message(
        QueueUrl=queue_url,
        MessageBody=json.dumps(message),
    )
    print(f'Re-enqueued evaluation job {message["evaluationJobId"]} to continue')


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
