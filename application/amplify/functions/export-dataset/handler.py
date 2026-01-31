"""
Dataset Export Lambda Handler

Exports approved annotations to Hugging Face Hub in ImageFolder format
(metadata.jsonl + image files). Compatible with `datasets.load_dataset()`.
Implements checkpoint/resume capability for large datasets.

Risk 1 fix: Uses GSI query instead of full table scan.
Risk 2 fix: Uses environment variables for DynamoDB table names.
"""
import json
import os
import tempfile
import boto3
from datetime import datetime, timezone
from typing import Dict, List, Optional
from huggingface_hub import HfApi
from PIL import Image
from io import BytesIO

# AWS clients
dynamodb = boto3.resource('dynamodb')
s3 = boto3.client('s3')
ssm = boto3.client('ssm')

# Environment variables
ANNOTATION_INDEX_NAME = os.environ.get('ANNOTATION_INDEX_NAME', 'annotationsByValidationStatus')

# Module-level caches
_table_cache: Dict[str, object] = {}
_hf_token: Optional[str] = None


# Map model name prefix to environment variable name
_TABLE_ENV_VARS = {
    'Annotation': 'ANNOTATION_TABLE_NAME',
    'Image': 'IMAGE_TABLE_NAME',
    'DatasetVersion': 'DATASET_VERSION_TABLE_NAME',
    'DatasetExportProgress': 'DATASET_EXPORT_PROGRESS_TABLE_NAME',
}


def get_table(prefix: str):
    """Get DynamoDB table by prefix using environment variable for table name."""
    if prefix not in _table_cache:
        env_var = _TABLE_ENV_VARS.get(prefix)
        if not env_var:
            raise ValueError(f"No environment variable mapping for table prefix '{prefix}'")
        table_name = os.environ.get(env_var)
        if not table_name:
            raise ValueError(f"{env_var} environment variable not set")
        print(f'Using table: {table_name}')
        _table_cache[prefix] = dynamodb.Table(table_name)
    return _table_cache[prefix]


def get_hf_token() -> str:
    """Read HF token from SSM Parameter Store with caching."""
    global _hf_token
    if _hf_token is None:
        param_name = os.environ.get('HF_TOKEN_SSM_PARAM', '')
        if not param_name:
            raise ValueError('HF_TOKEN_SSM_PARAM environment variable is not set')
        response = ssm.get_parameter(Name=param_name, WithDecryption=True)
        _hf_token = response['Parameter']['Value']
    return _hf_token


def handler(event, context):
    """
    Lambda handler for dataset export.

    Event format:
    {
        "datasetVersionId": "amplify-record-id",
        "datasetVersion": "v1.0.0",
        "huggingFaceRepoId": "icoxfog417/biz-doc-vqa",
        "exportId": "export-uuid",
        "storageBucketName": "amplify-...-bucket-...",
        "resumeFrom": "annotation-id"  // Optional checkpoint
    }
    """
    export_id = None
    progress_table = None

    try:
        dataset_version_id = event['datasetVersionId']
        dataset_version = event['datasetVersion']
        hf_repo_id = event['huggingFaceRepoId']
        export_id = event['exportId']
        storage_bucket = event['storageBucketName']
        resume_from = event.get('resumeFrom')

        print(f'Starting export: {export_id} for version {dataset_version}')

        # Get Hugging Face token (passed directly to HfApi, no login() needed)
        hf_token = get_hf_token()

        # Discover DynamoDB tables
        annotation_table = get_table('Annotation')
        image_table = get_table('Image')
        progress_table = get_table('DatasetExportProgress')
        version_table = get_table('DatasetVersion')

        now = datetime.now(timezone.utc).isoformat()

        if not resume_from:
            # Create export progress record
            progress_table.put_item(
                Item={
                    'id': export_id,
                    'exportId': export_id,
                    'version': dataset_version,
                    'processedCount': 0,
                    'totalCount': 0,
                    'status': 'IN_PROGRESS',
                    'startedAt': now,
                    'createdAt': now,
                    'updatedAt': now,
                }
            )

        # Fetch approved annotations using GSI query (Risk 1 fix)
        annotations = fetch_approved_annotations(annotation_table, resume_from)
        total_count = len(annotations)

        print(f'Found {total_count} approved annotations')

        # Update total count in progress
        progress_table.update_item(
            Key={'id': export_id},
            UpdateExpression='SET totalCount = :total, updatedAt = :now',
            ExpressionAttributeValues={':total': total_count, ':now': now},
        )

        # Process annotations and build ImageFolder dataset in /tmp
        with tempfile.TemporaryDirectory() as tmpdir:
            metadata_rows: List[Dict] = []
            processed_count = 0
            image_ids_seen: set = set()

            # Cache for image records (DynamoDB metadata) to avoid redundant
            # lookups when multiple annotations reference the same image.
            # Note: we intentionally do NOT cache PIL Image objects because
            # decoded images consume significant memory in Lambda.
            image_record_cache: Dict[str, Optional[Dict]] = {}

            for annotation in annotations:
                try:
                    record = process_annotation(
                        annotation, image_table, storage_bucket,
                        image_record_cache,
                    )
                    if record:
                        # Save image as JPEG
                        img_filename = f"{record['annotation_id']}.jpg"
                        img_path = os.path.join(tmpdir, img_filename)
                        pil_image = record['image']
                        if pil_image.mode == 'RGBA':
                            pil_image = pil_image.convert('RGB')
                        pil_image.save(img_path, format='JPEG', quality=85)

                        # Build metadata row (file_name is the HF ImageFolder key)
                        metadata_rows.append({
                            'file_name': img_filename,
                            'annotation_id': record['annotation_id'],
                            'image_width': record['image_width'],
                            'image_height': record['image_height'],
                            'question': record['question'],
                            'answers': record['answers'],
                            'answer_bbox': record['answer_bbox'],
                            'document_type': record['document_type'],
                            'question_type': record['question_type'],
                            'language': record['language'],
                        })
                        image_ids_seen.add(annotation.get('imageId', ''))

                    processed_count += 1

                    # Checkpoint every 100 annotations
                    if processed_count % 100 == 0:
                        checkpoint_now = datetime.now(timezone.utc).isoformat()
                        progress_table.update_item(
                            Key={'id': export_id},
                            UpdateExpression='SET processedCount = :count, lastProcessedAnnotationId = :aid, updatedAt = :now',
                            ExpressionAttributeValues={
                                ':count': processed_count,
                                ':aid': annotation['id'],
                                ':now': checkpoint_now,
                            },
                        )
                        print(f'Checkpoint: {processed_count}/{total_count}')

                except Exception as e:
                    print(f"Error processing annotation {annotation.get('id', 'unknown')}: {str(e)}")
                    continue

            if not metadata_rows:
                raise ValueError('No valid records to export')

            # Write metadata.jsonl (HuggingFace ImageFolder format)
            metadata_path = os.path.join(tmpdir, 'metadata.jsonl')
            with open(metadata_path, 'w', encoding='utf-8') as f:
                for row in metadata_rows:
                    f.write(json.dumps(row, ensure_ascii=False) + '\n')

            # Upload to Hugging Face Hub
            print(f'Uploading {len(metadata_rows)} records to {hf_repo_id}...')
            api = HfApi(token=hf_token)
            api.create_repo(hf_repo_id, repo_type='dataset', exist_ok=True)
            api.upload_folder(
                folder_path=tmpdir,
                repo_id=hf_repo_id,
                repo_type='dataset',
                path_in_repo='data',
                delete_patterns='*.parquet',
                commit_message=f'Export {dataset_version} ({processed_count} annotations)',
            )

            # Generate and upload dataset card (README.md) so HF viewer works
            card = generate_dataset_card(
                dataset_version, hf_repo_id, processed_count,
                len(image_ids_seen), metadata_rows,
            )
            api.upload_file(
                path_or_fileobj=card.encode('utf-8'),
                path_in_repo='README.md',
                repo_id=hf_repo_id,
                repo_type='dataset',
                commit_message=f'Update dataset card for {dataset_version}',
            )

        hf_url = f'https://huggingface.co/datasets/{hf_repo_id}'

        # Update progress to COMPLETED
        now = datetime.now(timezone.utc).isoformat()
        progress_table.update_item(
            Key={'id': export_id},
            UpdateExpression='SET #s = :status, processedCount = :count, totalCount = :total, updatedAt = :now',
            ExpressionAttributeNames={'#s': 'status'},
            ExpressionAttributeValues={
                ':status': 'COMPLETED',
                ':count': processed_count,
                ':total': total_count,
                ':now': now,
            },
        )

        # Update DatasetVersion record
        version_table.update_item(
            Key={'id': dataset_version_id},
            UpdateExpression='SET #s = :status, huggingFaceUrl = :url, annotationCount = :acount, imageCount = :icount, updatedAt = :now',
            ExpressionAttributeNames={'#s': 'status'},
            ExpressionAttributeValues={
                ':status': 'READY',
                ':url': hf_url,
                ':acount': processed_count,
                ':icount': len(image_ids_seen),
                ':now': now,
            },
        )

        return {
            'statusCode': 200,
            'body': json.dumps({
                'exportId': export_id,
                'version': dataset_version,
                'processedCount': processed_count,
                'imageCount': len(image_ids_seen),
                'huggingFaceUrl': hf_url,
            }),
        }

    except Exception as e:
        print(f'Export failed: {str(e)}')

        if export_id and progress_table:
            try:
                progress_table.update_item(
                    Key={'id': export_id},
                    UpdateExpression='SET #s = :status, errorMessage = :error, updatedAt = :now',
                    ExpressionAttributeNames={'#s': 'status'},
                    ExpressionAttributeValues={
                        ':status': 'FAILED',
                        ':error': str(e)[:1000],
                        ':now': datetime.now(timezone.utc).isoformat(),
                    },
                )
            except Exception:
                pass

        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)}),
        }


def fetch_approved_annotations(table, resume_from: Optional[str] = None) -> List[Dict]:
    """Fetch approved annotations using GSI query (Risk 1 fix: no full table scan)."""
    all_annotations: List[Dict] = []

    query_params = {
        'IndexName': ANNOTATION_INDEX_NAME,
        'KeyConditionExpression': 'validationStatus = :status',
        'ExpressionAttributeValues': {':status': 'APPROVED'},
    }

    response = table.query(**query_params)
    all_annotations.extend(response.get('Items', []))

    while 'LastEvaluatedKey' in response:
        query_params['ExclusiveStartKey'] = response['LastEvaluatedKey']
        response = table.query(**query_params)
        all_annotations.extend(response.get('Items', []))

    # Handle resume from checkpoint
    if resume_from:
        resume_index = next(
            (i for i, a in enumerate(all_annotations) if a['id'] == resume_from),
            -1,
        )
        if resume_index >= 0:
            all_annotations = all_annotations[resume_index + 1:]
            print(f'Resuming from annotation {resume_from}, {len(all_annotations)} remaining')

    return all_annotations


def process_annotation(
    annotation: Dict,
    image_table,
    bucket_name: str,
    image_record_cache: Optional[Dict[str, Optional[Dict]]] = None,
) -> Optional[Dict]:
    """Process a single annotation into dataset format.

    Uses an optional cache for DynamoDB image records to avoid redundant
    lookups when multiple annotations reference the same image.
    """
    image_id = annotation.get('imageId')
    if not image_id:
        return None

    # Check image record cache first
    if image_record_cache is not None and image_id in image_record_cache:
        image_record = image_record_cache[image_id]
    else:
        image_response = image_table.get_item(Key={'id': image_id})
        image_record = image_response.get('Item')
        if image_record_cache is not None:
            image_record_cache[image_id] = image_record

    if not image_record:
        print(f"Image not found for annotation {annotation['id']}, imageId={image_id}")
        return None

    # Download compressed image from S3
    s3_key = image_record.get('s3KeyCompressed')
    if not s3_key:
        print(f"No compressed image for annotation {annotation['id']}")
        return None

    try:
        image_obj = s3.get_object(Bucket=bucket_name, Key=s3_key)
        image_bytes = image_obj['Body'].read()
        image = Image.open(BytesIO(image_bytes))
    except Exception as e:
        print(f"Failed to load image for annotation {annotation['id']}, s3Key={s3_key}: {e}")
        return None

    # Get image dimensions
    # BBoxes are stored in ORIGINAL image coordinates (width/height from upload).
    # We export the COMPRESSED image, so we need to:
    # 1. Scale bbox from original to compressed coordinate space
    # 2. Normalize by compressed dimensions
    original_width = int(image_record.get('width', 0))
    original_height = int(image_record.get('height', 0))
    compressed_width = int(image_record.get('compressedWidth', 0) or image.width)
    compressed_height = int(image_record.get('compressedHeight', 0) or image.height)

    # Parse bounding boxes (stored as JSON in DynamoDB)
    bboxes = annotation.get('boundingBoxes')
    if isinstance(bboxes, str):
        bboxes = json.loads(bboxes)

    # Normalize first bounding box to 0-1 range
    normalized_bbox = [0.0, 0.0, 1.0, 1.0]  # Default to full image
    if bboxes and len(bboxes) > 0:
        bbox = bboxes[0]
        if isinstance(bbox, list) and len(bbox) == 4:
            raw = bbox
        elif isinstance(bbox, dict):
            raw = [
                bbox.get('x0', 0),
                bbox.get('y0', 0),
                bbox.get('x1', compressed_width),
                bbox.get('y1', compressed_height),
            ]
        else:
            raw = None

        if raw:
            # Convert to float (DynamoDB returns decimal.Decimal)
            raw = [float(v) for v in raw]

            # Scale bbox from original to compressed coordinate space if dimensions differ
            if original_width and original_height and original_width != compressed_width:
                scale_x = compressed_width / original_width
                scale_y = compressed_height / original_height
                raw = [raw[0] * scale_x, raw[1] * scale_y, raw[2] * scale_x, raw[3] * scale_y]

            normalized_bbox = normalize_bbox(raw, compressed_width, compressed_height)

    # Build answers list - split multi-line answers into separate items
    answer = annotation.get('answer', '')
    if answer:
        # Split by newline and filter empty lines
        answers = [line.strip() for line in answer.split('\n') if line.strip()]
        if not answers:
            answers = ['']
    else:
        answers = ['']

    return {
        'annotation_id': annotation['id'],
        'image': image,
        'image_width': compressed_width,
        'image_height': compressed_height,
        'question': annotation.get('question', ''),
        'answers': answers,
        'answer_bbox': normalized_bbox,
        'document_type': image_record.get('documentType', 'OTHER'),
        'question_type': annotation.get('questionType', 'EXTRACTIVE'),
        'language': annotation.get('language', 'en'),
    }


def normalize_bbox(bbox: List, width: int, height: int) -> List[float]:
    """Normalize bounding box from pixel coordinates to 0-1 range."""
    x0, y0, x1, y1 = [float(v) for v in bbox]
    if width <= 0 or height <= 0:
        return [0.0, 0.0, 1.0, 1.0]
    return [
        max(0.0, min(1.0, x0 / width)),
        max(0.0, min(1.0, y0 / height)),
        max(0.0, min(1.0, x1 / width)),
        max(0.0, min(1.0, y1 / height)),
    ]


def generate_dataset_card(
    version: str, hf_repo_id: str, annotation_count: int,
    image_count: int, metadata_rows: List[Dict],
) -> str:
    """Generate a HuggingFace dataset card (README.md) with YAML frontmatter."""
    languages = sorted({row.get('language', 'en') for row in metadata_rows})
    doc_types = sorted({row.get('document_type', 'OTHER') for row in metadata_rows})
    lang_yaml = '\n'.join(f'- {lang}' for lang in languages)

    return f"""---
license: cc-by-sa-4.0
task_categories:
- document-question-answering
- visual-question-answering
language:
{lang_yaml}
size_categories:
- n<1K
configs:
- config_name: default
  data_files:
  - split: train
    path: data/*
  default: true
dataset_info:
  features:
  - name: image
    dtype: image
  - name: annotation_id
    dtype: string
  - name: image_width
    dtype: int32
  - name: image_height
    dtype: int32
  - name: question
    dtype: string
  - name: answers
    sequence: string
  - name: answer_bbox
    sequence: float32
    length: 4
  - name: document_type
    dtype: string
  - name: question_type
    dtype: string
  - name: language
    dtype: string
  splits:
  - name: train
    num_examples: {annotation_count}
---

# Business Document VQA Dataset

Visual Question Answering dataset for business document OCR evaluation.

## Version: {version}

- **Annotations**: {annotation_count}
- **Images**: {image_count}
- **Languages**: {', '.join(languages)}
- **Document Types**: {', '.join(doc_types)}

## Schema

| Field | Type | Description |
|-------|------|-------------|
| image | Image | Document image |
| annotation_id | string | Annotation ID |
| question | string | Question about the document |
| answers | list[string] | Correct answers |
| answer_bbox | list[float] | Bounding box [x0, y0, x1, y1] (0-1 range) |
| document_type | string | Type of business document |
| question_type | string | Category of question |
| language | string | ISO 639-1 language code |

## Usage

```python
from datasets import load_dataset

ds = load_dataset("{hf_repo_id}")
print(ds["train"][0])
# Image will be automatically loaded as PIL.Image
```
"""
