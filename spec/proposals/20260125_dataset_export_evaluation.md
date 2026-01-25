# Proposal: Dataset Export and Parallel Model Evaluation

**Date**: 2026-01-25
**Author**: Claude Agent
**Status**: Proposed

## Background

Sprint 4 requires implementing dataset version control and model evaluation with W&B integration. After reviewing academic standards and user requirements, we need:

1. **Dataset Export**: Compile validated annotations into Hugging Face datasets with compressed images
2. **Evaluation Pipeline**: Run parallel model evaluations using ANLS and IoU metrics (DocVQA standard)
3. **Manual Trigger**: Start with manual invocation, auto-trigger as future enhancement

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Dataset Storage | Hugging Face Hub (not S3) | Avoid forcing users to download from our S3; HF handles hosting |
| Image Format | Compressed images embedded in Parquet | Self-contained dataset, no external dependencies |
| Coordinate Format | Normalized 0-1 range with width/height provided | Standard for VQA datasets, scale-independent |
| Primary Metrics | ANLS + IoU | DocVQA standard; ANLS for text, IoU for bounding boxes |
| Evaluation Config | JSON file in repo | Git-tracked, enables future auto-trigger on change |
| Trigger Method | Manual (UI buttons) | Simpler initial implementation; auto-trigger deferred |

## Proposal

### 1. Evaluation Metrics (DocVQA Standard)

#### ANLS (Average Normalized Levenshtein Similarity)

Primary metric for text answer accuracy, accounting for OCR errors and format variations.

```python
def calculate_anls(prediction: str, ground_truths: list, threshold: float = 0.5) -> float:
    """
    ANLS = 1 - NLD (Normalized Levenshtein Distance)
    Returns ANLS if >= threshold, else 0
    
    Range: 0-1 (1 = perfect match)
    """
    max_anls = 0
    pred_norm = prediction.lower().strip()
    
    for gt in ground_truths:
        gt_norm = gt.lower().strip()
        lev_dist = levenshtein_distance(pred_norm, gt_norm)
        max_len = max(len(pred_norm), len(gt_norm), 1)
        anls = 1 - (lev_dist / max_len)
        
        # Threshold distinguishes OCR errors from wrong answers
        if anls < threshold:
            anls = 0
        
        max_anls = max(max_anls, anls)
    
    return max_anls
```

**Why threshold 0.5?**
- Correct answer with minor OCR error: ANLS ~0.85 → credited
- Completely wrong answer: ANLS ~0.1 → 0 (no credit)

#### IoU (Intersection over Union)

Primary metric for bounding box accuracy.

```python
def calculate_iou(pred_bbox: list, gt_bbox: list) -> float:
    """
    IoU for bounding boxes in normalized 0-1 coordinates [x0, y0, x1, y1]
    
    Range: 0-1 (1 = perfect overlap)
    """
    x1 = max(pred_bbox[0], gt_bbox[0])
    y1 = max(pred_bbox[1], gt_bbox[1])
    x2 = min(pred_bbox[2], gt_bbox[2])
    y2 = min(pred_bbox[3], gt_bbox[3])
    
    intersection = max(0, x2 - x1) * max(0, y2 - y1)
    
    pred_area = (pred_bbox[2] - pred_bbox[0]) * (pred_bbox[3] - pred_bbox[1])
    gt_area = (gt_bbox[2] - gt_bbox[0]) * (gt_bbox[3] - gt_bbox[1])
    union = pred_area + gt_area - intersection
    
    return intersection / union if union > 0 else 0
```

### 2. Data Models

#### DatasetVersion
```typescript
DatasetVersion: a.model({
  version: a.string().required(),           // e.g., "v1.0.0"
  huggingFaceRepoId: a.string().required(), // e.g., "icoxfog417/biz-doc-vqa"
  huggingFaceUrl: a.string().required(),    // Full URL
  annotationCount: a.integer().required(),
  imageCount: a.integer().required(),
  status: a.enum(['CREATING', 'READY', 'EVALUATING', 'FINALIZED']),
  createdAt: a.datetime().required(),
  finalizedAt: a.datetime(),
})
```

#### DatasetExportProgress (Checkpoint for Resume)
```typescript
DatasetExportProgress: a.model({
  exportId: a.string().required(),
  version: a.string().required(),
  lastProcessedAnnotationId: a.string(),    // Checkpoint
  processedCount: a.integer().required(),
  totalCount: a.integer().required(),
  status: a.enum(['IN_PROGRESS', 'COMPLETED', 'FAILED']),
  errorMessage: a.string(),
  startedAt: a.datetime().required(),
  updatedAt: a.datetime(),
})
```

#### EvaluationJob
```typescript
EvaluationJob: a.model({
  jobId: a.string().required(),
  datasetVersion: a.string().required(),
  modelId: a.string().required(),
  status: a.enum(['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED']),
  avgAnls: a.float(),                       // 0-1 scale
  avgIou: a.float(),                        // 0-1 scale
  totalSamples: a.integer(),
  wandbRunUrl: a.string(),
  errorMessage: a.string(),
  startedAt: a.datetime(),
  completedAt: a.datetime(),
})
```

### 3. Dataset Schema (Hugging Face)

```python
from datasets import Features, Value, Sequence, Image

features = Features({
    "question_id": Value("string"),
    "image": Image(),                                    # Compressed image embedded
    "image_width": Value("int32"),                       # compressedWidth (for coord conversion)
    "image_height": Value("int32"),                      # compressedHeight
    "question": Value("string"),
    "answers": Sequence(Value("string")),                # Multiple acceptable answers
    "answer_bbox": Sequence(Value("float32"), length=4), # Normalized 0-1 range [x0, y0, x1, y1]
    "document_type": Value("string"),
    "question_type": Value("string"),
    "language": Value("string"),
})
```

### 4. Configuration File

Location: `application/src/config/evaluation-models.json`

```json
{
  "version": "1.0",
  "models": [
    {
      "id": "claude-3-5-sonnet",
      "name": "Claude 3.5 Sonnet",
      "provider": "bedrock",
      "bedrockModelId": "anthropic.claude-3-5-sonnet-20241022-v2:0",
      "enabled": true
    },
    {
      "id": "amazon-nova-pro",
      "name": "Amazon Nova Pro",
      "provider": "bedrock",
      "bedrockModelId": "amazon.nova-pro-v1:0",
      "enabled": true
    }
  ],
  "metrics": {
    "primary": ["anls", "iou"],
    "anlsThreshold": 0.5,
    "iouThreshold": 0.5
  }
}
```

### 5. Export Pipeline

#### Resume Capability

To handle Lambda timeouts and failures:

1. Create `DatasetExportProgress` record at start
2. Checkpoint every 100 annotations (update `lastProcessedAnnotationId`)
3. On resume, query annotations WHERE id > `lastProcessedAnnotationId`
4. HF Hub supports incremental uploads

#### Coordinate Normalization

Bounding boxes stored in DB as pixel coordinates relative to compressed image.
On export, normalize to 0-1 range:

```python
normalized_bbox = [
    bbox[0] / image['compressedWidth'],   # x0
    bbox[1] / image['compressedHeight'],  # y0
    bbox[2] / image['compressedWidth'],   # x1
    bbox[3] / image['compressedHeight'],  # y1
]
```

### 6. Evaluation Pipeline

#### Flow

```
Manual Trigger (UI) 
    → Create EvaluationJob records (QUEUED)
    → Send SQS messages for each model
    → Lambda processes each message:
        1. Update status to RUNNING
        2. Stream dataset from HF Hub
        3. Run model predictions via Bedrock
        4. Calculate ANLS and IoU per sample
        5. Log to W&B incrementally
        6. Update EvaluationJob with final metrics
```

#### Parallel Execution

- Each model evaluation runs in separate Lambda invocation
- SQS handles parallel dispatch (up to 10 concurrent)
- W&B shows results per model for comparison

## Impact

### Requirements
- Implements REQ-VC-001, REQ-VC-002 (Dataset Version Management)
- Implements REQ-HF-001 to REQ-HF-005 (Hugging Face Integration)
- Follows DocVQA evaluation standard

### Design
- Add 3 new DynamoDB models
- Add 3 new Lambda functions (Python)
- Add 1 new configuration file
- Add 1 new frontend page

### Tasks
- Update tasks.md Sprint 4 section with implementation tasks

## Alternatives Considered

### 1. S3 Storage for Datasets
**Rejected**: Forces users to download from our S3, causing API costs and complexity.
HF Hub provides free hosting with automatic Parquet conversion.

### 2. Auto-Trigger on Config Change
**Deferred**: Adds complexity. Manual trigger is sufficient for initial release.
Can add GitHub Actions or Amplify hooks later.

### 3. Multiple Metrics (EM, F1, ANLS, IoU)
**Simplified**: Focus on ANLS (text) and IoU (bbox) following DocVQA standard.
Other metrics can be added later if needed.

### 4. DynamoDB for Model Config
**Rejected**: User prefers config file for git-tracking and CI/CD integration.

## Implementation Plan

### Parallel Work Units

The following can be implemented independently:

| Unit | Dependencies | Description |
|------|--------------|-------------|
| **Unit A: Data Models** | None | Add models to schema |
| **Unit B: Config File** | None | Create evaluation-models.json |
| **Unit C: Export Lambda** | Unit A | Python Lambda with checkpoint |
| **Unit D: Evaluation Lambda** | Unit A, Unit B | Python Lambda with ANLS/IoU |
| **Unit E: SQS Queue** | None | Configure queue in backend.ts |
| **Unit F: Trigger Lambda** | Unit A, Unit B, Unit E | Node.js Lambda for manual trigger |
| **Unit G: Frontend UI** | Unit A, Unit B, Unit F | DatasetManagement page |

### Recommended Sequence

**Phase 1** (Parallel):
- Unit A: Data Models
- Unit B: Config File
- Unit E: SQS Queue

**Phase 2** (After Phase 1):
- Unit C: Export Lambda
- Unit D: Evaluation Lambda
- Unit F: Trigger Lambda

**Phase 3** (After Phase 2):
- Unit G: Frontend UI

## Success Criteria

- [ ] Dataset export works for 1,000+ annotations
- [ ] Resume works after simulated failure
- [ ] ANLS/IoU metrics match manual calculation
- [ ] W&B shows model comparison dashboard
- [ ] Manual trigger from UI works end-to-end

## References

- DocVQA: Mathew et al., WACV 2021
- ANLS Metric: https://github.com/shunk031/ANLS
- Hugging Face datasets: https://huggingface.co/docs/datasets

---

**Last Updated**: 2026-01-25
