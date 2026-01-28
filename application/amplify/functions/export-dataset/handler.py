"""
Dataset Export Lambda Handler

Exports approved annotations to Hugging Face Hub in Parquet format.
Implements checkpoint/resume capability for large datasets.

Risk 1 fix: Uses GSI query instead of full table scan.
Risk 2 fix: Uses table discovery pattern (ListTables) for DynamoDB table names.
"""
import json
import os
import boto3
from datetime import datetime, timezone
from decimal import Decimal
from typing import Dict, List, Optional
from datasets import Dataset, Features, Value, Sequence, Image as HFImage
from huggingface_hub import login
from PIL import Image
from io import BytesIO

# AWS clients
dynamodb = boto3.resource('dynamodb')
dynamodb_client = boto3.client('dynamodb')
s3 = boto3.client('s3')
ssm = boto3.client('ssm')

# Environment variables
STORAGE_BUCKET_NAME = os.environ.get('STORAGE_BUCKET_NAME', '')
ANNOTATION_INDEX_NAME = os.environ.get('ANNOTATION_INDEX_NAME', 'annotationsByValidationStatus')

# Module-level caches
_table_cache: Dict[str, object] = {}
_hf_token: Optional[str] = None


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


def get_hf_token() -> str:
    """Read HF token from SSM Parameter Store with caching."""
    global _hf_token
    if _hf_token is None:
        param_name = os.environ.get('HF_TOKEN_SSM_PARAM', '')
        if param_name:
            response = ssm.get_parameter(Name=param_name, WithDecryption=True)
            _hf_token = response['Parameter']['Value']
        else:
            _hf_token = os.environ.get('HF_TOKEN', '')
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
        resume_from = event.get('resumeFrom')

        print(f'Starting export: {export_id} for version {dataset_version}')

        # Login to Hugging Face
        hf_token = get_hf_token()
        login(token=hf_token)

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

        # Process annotations incrementally
        dataset_records = []
        processed_count = 0
        image_ids_seen = set()

        for annotation in annotations:
            try:
                record = process_annotation(annotation, image_table)
                if record:
                    dataset_records.append(record)
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

        if not dataset_records:
            raise ValueError('No valid records to export')

        # Create Hugging Face dataset
        print('Creating Hugging Face dataset...')
        features = define_dataset_features()
        dataset = Dataset.from_list(dataset_records, features=features)

        # Push to Hugging Face Hub
        print(f'Pushing {len(dataset_records)} records to {hf_repo_id}...')
        dataset.push_to_hub(
            hf_repo_id,
            commit_message=f'Export {dataset_version} ({processed_count} annotations)',
            private=False,
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


def process_annotation(annotation: Dict, image_table) -> Optional[Dict]:
    """Process a single annotation into dataset format."""
    image_id = annotation.get('imageId')
    if not image_id:
        return None

    image_response = image_table.get_item(Key={'id': image_id})
    image_record = image_response.get('Item')

    if not image_record:
        print(f"Image not found for annotation {annotation['id']}, imageId={image_id}")
        return None

    # Download compressed image from S3
    s3_key = image_record.get('s3KeyCompressed')
    if not s3_key:
        print(f"No compressed image for annotation {annotation['id']}")
        return None

    image_obj = s3.get_object(Bucket=STORAGE_BUCKET_NAME, Key=s3_key)
    image_bytes = image_obj['Body'].read()
    image = Image.open(BytesIO(image_bytes))

    # Get image dimensions
    image_width = int(image_record.get('compressedWidth', 0) or image.width)
    image_height = int(image_record.get('compressedHeight', 0) or image.height)

    # Parse bounding boxes (stored as JSON in DynamoDB)
    bboxes = annotation.get('boundingBoxes')
    if isinstance(bboxes, str):
        bboxes = json.loads(bboxes)

    # Normalize first bounding box to 0-1 range
    normalized_bbox = [0.0, 0.0, 1.0, 1.0]  # Default to full image
    if bboxes and len(bboxes) > 0:
        bbox = bboxes[0]
        if isinstance(bbox, list) and len(bbox) == 4:
            normalized_bbox = normalize_bbox(bbox, image_width, image_height)
        elif isinstance(bbox, dict):
            raw = [
                bbox.get('x0', 0),
                bbox.get('y0', 0),
                bbox.get('x1', image_width),
                bbox.get('y1', image_height),
            ]
            normalized_bbox = normalize_bbox(raw, image_width, image_height)

    # Build answers list
    answer = annotation.get('answer', '')
    answers = [answer] if answer else ['']

    return {
        'annotation_id': annotation['id'],
        'image': image,
        'image_width': image_width,
        'image_height': image_height,
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


def define_dataset_features() -> Features:
    """Define Hugging Face dataset schema."""
    return Features({
        'annotation_id': Value('string'),
        'image': HFImage(),
        'image_width': Value('int32'),
        'image_height': Value('int32'),
        'question': Value('string'),
        'answers': Sequence(Value('string')),
        'answer_bbox': Sequence(Value('float32'), length=4),
        'document_type': Value('string'),
        'question_type': Value('string'),
        'language': Value('string'),
    })
