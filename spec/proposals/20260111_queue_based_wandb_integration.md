# Proposal: Queue-Based W&B Integration for Dataset and Evaluation

**Date**: 2026-01-11
**Author**: Claude Agent
**Status**: Proposed

## Background

Sprint 3 initially planned to implement direct W&B integration where:
- Users create datasets manually via UI
- Datasets are exported to W&B on-demand
- Full dataset management UI in the application

However, after W&B verification (Q10 & Q11), a more efficient architecture emerged:
- Verified annotations → Queue → Periodic batch processing → W&B
- UI shows job status and links to W&B (not full dataset UI)
- Leverage W&B's native dataset/evaluation UI instead of rebuilding it

## Proposal

Implement a **queue-based batch processing architecture** for W&B integration:

### Architecture Components

1. **SQS Queue**: Collect verified annotations
2. **Scheduled Lambda** (EventBridge): Process queue periodically (daily/weekly)
3. **Job Tracking** (DynamoDB): Track build/evaluation job status
4. **Status UI**: Show queue stats, job history, and W&B links
5. **W&B Native UI**: Users view datasets/evaluations in W&B (not in app)

### W&B Configuration

**Project Name**: `biz-doc-vqa` (Business Document Visual Question Answering)

- All datasets will be logged to the `biz-doc-vqa` project in Weights & Biases
- Dataset artifact name: `business-ocr-vqa-dataset`
- Evaluation runs will be tagged with model names and versions
- Users will access datasets and evaluations through W&B UI at `https://wandb.ai/<entity>/biz-doc-vqa`

### Workflow

```
User Approves Annotation
    ↓
Send to SQS Queue (instant, non-blocking)
    ↓
Mark as queuedForDataset=true
    ↓
[Scheduled trigger: Daily at 2 AM UTC]
    ↓
Lambda processes batch (e.g., 50 annotations)
    ↓
Create DatasetBuildJob (status=RUNNING)
    ↓
Update W&B artifact (incremental)
    ↓
Update job (status=COMPLETED, wandbUrl=...)
    ↓
User views status in UI, clicks "View in W&B"
```

### Key Benefits

1. **Performance**: Non-blocking annotation workflow
2. **Cost**: Batch processing cheaper than per-annotation updates
3. **Reliability**: Automatic retries with Dead Letter Queue
4. **Simplicity**: Simpler UI (just status tracking)
5. **Quality**: Use W&B's excellent native dataset/evaluation UI
6. **Scalability**: Queue handles annotation spikes

## Impact

### Requirements (requirements.md)

**Changes needed:**
- Update "Dataset Management" section:
  - FROM: "Users can create and manage datasets via UI"
  - TO: "Users can trigger dataset builds and view status; datasets viewed in W&B"
- Update "Evaluation" section:
  - FROM: "Run evaluations and view results in app"
  - TO: "Schedule evaluations and view results in W&B"

**New requirements:**
- System shall queue verified annotations for batch processing
- System shall provide job status tracking for dataset builds
- System shall provide links to W&B for viewing datasets/evaluations
- System shall support both scheduled and manual dataset builds

### Design (design.md)

**New components:**
- SQS Queue: `verified-annotations-queue`
- EventBridge Rules: `daily-dataset-build`, `weekly-evaluation`
- Lambda Functions: `wandb-processor`, `evaluation-runner`
- DynamoDB Models: `DatasetBuildJob`, `EvaluationJob`, `QueueStats`

**Updated data schema:**
```typescript
Annotation: {
  // ... existing fields
  queuedForDataset: boolean,
  processedAt: datetime
}

DatasetBuildJob: {
  jobId: string,
  status: enum['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED'],
  startedAt: datetime,
  completedAt: datetime,
  annotationCount: integer,
  wandbRunUrl: url,
  wandbArtifactVersion: string,
  errorMessage: string
}

EvaluationJob: {
  jobId: string,
  status: enum['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED'],
  modelName: string,
  datasetVersion: string,
  exactMatchRate: float,
  f1Score: float,
  avgIoU: float,
  wandbRunUrl: url
}

QueueStats: {
  id: string,
  pendingAnnotations: integer,
  lastDatasetBuild: datetime,
  nextScheduledBuild: datetime
}
```

**Architecture diagram update:**
```
┌─────────────────┐
│  Annotation UI  │
└────────┬────────┘
         │ Approve
         ↓
┌─────────────────┐
│   SQS Queue     │
└────────┬────────┘
         │ Scheduled (EventBridge)
         ↓
┌─────────────────┐     ┌──────────────┐
│ Lambda Processor│────→│  W&B Dataset │
└────────┬────────┘     └──────────────┘
         │
         ↓
┌─────────────────┐
│ DynamoDB Jobs   │
└────────┬────────┘
         │
         ↓
┌─────────────────┐     ┌──────────────┐
│   Status UI     │────→│  W&B Web UI  │
└─────────────────┘     └──────────────┘
```

### Tasks (tasks.md)

**Replace Sprint 3 tasks:**

**Remove:**
- Dataset CRUD UI (DatasetList, DatasetForm, DatasetDetails pages)
- In-app dataset viewer
- Complex export UI

**Add:**
- SQS queue setup in `amplify/backend.ts`
- EventBridge schedule configuration
- Lambda `wandb-processor` function
- Lambda `evaluation-runner` function
- Job tracking models in `amplify/data/resource.ts`
- Simple Status UI pages (DatasetStatus, EvaluationStatus)
- Queue management API
- Manual trigger functionality

**Estimated effort reduction:** ~30% less work (simpler UI, leverage W&B native UI)

## Alternatives Considered

### Alternative 1: Direct W&B Updates (Original Plan)

**Approach:** Update W&B immediately when annotation approved

**Pros:**
- Instant dataset updates
- Simpler architecture (no queue)

**Cons:**
- Blocks annotation workflow (waiting for W&B API)
- More expensive (many small API calls)
- Higher failure rate (network issues affect annotation)
- No batch optimization

**Decision:** Rejected - performance and cost concerns

### Alternative 2: Full Dataset Management UI

**Approach:** Build complete dataset CRUD UI in the application

**Pros:**
- All features in one place
- No external dependencies

**Cons:**
- Significant development effort
- Duplicate W&B functionality (tables, visualizations, comparisons)
- Maintenance burden
- Inferior UX compared to W&B native UI

**Decision:** Rejected - W&B native UI is superior and already built

### Alternative 3: Hybrid Approach

**Approach:** Queue for dataset builds, but build evaluation UI in-app

**Pros:**
- More control over evaluation presentation

**Cons:**
- Still significant UI development
- Inconsistent UX (some in W&B, some in app)
- W&B evaluation UI is excellent

**Decision:** Rejected - keep it consistent, use W&B for both

### Alternative 4: Real-time Queue Processing

**Approach:** Process queue items immediately (no scheduled batching)

**Pros:**
- Near-instant dataset updates

**Cons:**
- Higher Lambda costs (runs frequently)
- More W&B API calls
- Less efficient batching

**Decision:** Rejected - scheduled batching is more efficient

## Implementation Plan

### Phase 1: Queue Infrastructure (Week 1)

1. Update data schema in `amplify/data/resource.ts`
   - Add `queuedForDataset` and `processedAt` to Annotation
   - Add `DatasetBuildJob` model
   - Add `EvaluationJob` model
   - Add `QueueStats` model

2. Set up SQS queue in `amplify/backend.ts`
   - Create `verified-annotations-queue`
   - Configure Dead Letter Queue
   - Set visibility timeout (15 min)
   - Set retention period (14 days)

3. Update annotation workflow
   - Add "Queue for Dataset" action on approved annotations
   - Send message to SQS
   - Update `queuedForDataset` flag

### Phase 2: Batch Processor (Week 1-2)

4. Create `amplify/functions/wandb-processor/`
   - Implement SQS handler
   - W&B initialization
   - Incremental table building
   - Artifact versioning
   - Job status updates
   - Error handling with DLQ

5. Configure Lambda trigger
   - Add SQS event source
   - Set batch size (10 annotations)
   - Set max batching window (5 minutes)
   - Enable partial batch failure reporting

6. Add EventBridge schedule
   - Daily build at 2 AM UTC
   - Weekly evaluation on Sunday 3 AM UTC

### Phase 3: Status UI (Week 2)

7. Create `src/pages/DatasetStatus.tsx`
   - Queue statistics display
   - Recent jobs table
   - Manual trigger button
   - W&B links section

8. Create `src/pages/EvaluationStatus.tsx`
   - Evaluation jobs table
   - Model comparison links
   - Schedule information

9. Update Dashboard
   - Add "Dataset Status" navigation
   - Show queue count widget
   - Show last build time

### Phase 4: Evaluation Runner (Week 2-3)

10. Create `amplify/functions/evaluation-runner/`
    - Fetch dataset from W&B
    - Run model predictions
    - Calculate metrics (EM, F1, IoU)
    - Create evaluation artifact
    - Update job status

11. Add manual evaluation trigger
    - API endpoint to trigger evaluation
    - Model selection
    - Dataset version selection

### Phase 5: Testing & Documentation (Week 3)

12. Test queue processing
    - Submit test annotations
    - Verify batch processing
    - Test retry logic
    - Test DLQ handling

13. Test scheduled jobs
    - Verify EventBridge triggers
    - Test manual triggers
    - Verify status updates

14. Documentation
    - Update README with queue workflow
    - Document job status meanings
    - Add W&B navigation guide
    - Create troubleshooting guide

## Success Metrics

- ✅ Annotations queue successfully (non-blocking)
- ✅ Batch jobs process 50+ annotations in single run
- ✅ W&B datasets update with proper versioning
- ✅ Job status UI shows real-time progress
- ✅ Failed jobs retry automatically
- ✅ Users can view datasets in W&B
- ✅ Evaluation runs complete successfully
- ✅ Cost < $5/month for queue + Lambda (expected ~$1/month)

## Risk Mitigation

### Risk 1: Lambda Timeout (15 min limit)

**Mitigation:**
- Process in batches of 50 annotations max
- Use batch size configuration to tune performance
- Monitor execution time in CloudWatch

### Risk 2: W&B API Rate Limits

**Mitigation:**
- Batch API calls (single artifact update, not per-annotation)
- Add retry logic with exponential backoff
- Monitor W&B API usage

### Risk 3: Queue Backlog Growth

**Mitigation:**
- Monitor queue depth metrics
- Alert when queue > 500 items
- Increase processing frequency if needed
- Add manual "Drain Queue" action

### Risk 4: Failed Jobs Not Noticed

**Mitigation:**
- CloudWatch alarms on failed Lambda executions
- Email notifications on job failures
- DLQ monitoring and alerting
- Prominent error display in UI

## Timeline

- **Week 1**: Queue infrastructure + data models
- **Week 2**: Batch processor + status UI
- **Week 3**: Evaluation runner + testing
- **Total**: 2-3 weeks (as planned for Sprint 3)

## Approval Required

This proposal changes the fundamental architecture of Sprint 3. Please approve before implementation begins.

**Key Decision Points:**
1. ✅ Use queue-based batch processing (not real-time)
2. ✅ Scheduled builds (daily) instead of on-demand
3. ✅ Status UI only (leverage W&B native UI for dataset viewing)
4. ✅ Simplify Sprint 3 scope (remove dataset CRUD UI)

---

**References:**
- [Q10: W&B Incremental Data Storage](../implementation_qa.md#q10)
- [Q11: W&B Incremental Evaluation](../implementation_qa.md#q11)
- [Sprint 3 Queue Architecture](./../.sandbox/SPRINT3_QUEUE_ARCHITECTURE.md)
- [W&B Best Practices](./../.sandbox/WANDB_BEST_PRACTICES.md)
