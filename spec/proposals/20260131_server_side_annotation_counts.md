# Proposal: Server-Side Annotation and Image Counts

**Date**: 2026-01-31
**Author**: Claude Agent
**Status**: Proposed

## Background

Both the Dashboard and DatasetManagement pages currently fetch **all annotation and image records** from DynamoDB via `client.models.Annotation.list()` and `client.models.Image.list()`, then count them client-side. This has two problems:

1. **Wasteful data transfer** — Full records (Q&A text, bounding boxes, metadata) are downloaded just to count them
2. **Incorrect counts** — Amplify's `list()` returns at most ~100 records per page; without pagination, counts are capped and inaccurate for larger datasets

The Annotation model already has a `validationStatus` GSI (`annotationsByValidationStatus`) that the export Lambda uses. DynamoDB supports `Select: 'COUNT'` on GSI queries, which returns only the count without transferring any record data.

## Proposal

Add a `getAnnotationCounts` custom query backed by a lightweight Lambda that uses DynamoDB's `Select: 'COUNT'` to return counts efficiently.

### Lambda: `get-annotation-counts/handler.ts`

A Node.js Lambda that:

1. **Annotation counts by status** — Query the `annotationsByValidationStatus` GSI with `Select: 'COUNT'` for each status (PENDING, APPROVED, REJECTED). Handles pagination of count results (DynamoDB may return partial counts for large datasets requiring multiple query rounds).
2. **Total image count** — Scan the Image table with `Select: 'COUNT'`.
3. **Unique exportable image count** — Query the GSI for PENDING + APPROVED annotations with `ProjectionExpression: 'imageId'` (transfers only imageId per record, not full records), then deduplicate server-side.

Table discovery follows the existing `ListTables` + prefix matching pattern used by all other Lambdas.

### Response format

```json
{
  "annotations": {
    "total": 235,
    "pending": 150,
    "approved": 80,
    "rejected": 5
  },
  "images": {
    "total": 50,
    "exportable": 42
  }
}
```

### Schema change

```typescript
const getAnnotationCountsHandler = defineFunction({
  name: 'getAnnotationCountsHandler',
  entry: '../functions/get-annotation-counts/handler.ts',
  timeoutSeconds: 10,
  memoryMB: 256,
});

// In schema:
getAnnotationCounts: a
  .query()
  .returns(a.json())
  .authorization((allow) => [allow.authenticated()])
  .handler(a.handler.function(getAnnotationCountsHandler)),
```

### IAM permissions (backend.ts)

```typescript
getAnnotationCountsLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['dynamodb:ListTables'],
    resources: ['*'],
  })
);
getAnnotationCountsLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['dynamodb:Query'],
    resources: [
      'arn:aws:dynamodb:*:*:table/Annotation-*',
      'arn:aws:dynamodb:*:*:table/Annotation-*/index/*',
    ],
  })
);
getAnnotationCountsLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['dynamodb:Scan'],
    resources: ['arn:aws:dynamodb:*:*:table/Image-*'],
  })
);
```

### New hook: `useAnnotationCounts`

Replaces `useApprovedAnnotationStats` and the Dashboard's inline fetch logic. Both pages call the same query.

```typescript
interface AnnotationCounts {
  annotations: { total: number; pending: number; approved: number; rejected: number };
  images: { total: number; exportable: number };
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useAnnotationCounts(): AnnotationCounts { ... }
```

### Page updates

**Dashboard** — Replace `client.models.Annotation.list()` + `client.models.Image.list()` with `useAnnotationCounts()`. Remove client-side filtering for status counts. Image count and annotation counts come from the hook. DatasetVersion count remains as-is (small table). AI/Human annotation counts (`generatedBy`) will be removed from the Dashboard — we don't need to distinguish who created the annotation.

**DatasetManagement** — Replace `useApprovedAnnotationStats` with `useAnnotationCounts()`. Derive `totalExportableAnnotationCount` from `pending + approved`. Use `images.exportable` for the unique image count.

### Side effects

1. **Dashboard loses AI/Human annotation counts** — The current Dashboard shows AI-generated and Human-created counts. Since we don't need this distinction, these counters will be removed. If needed later, a GSI on `generatedBy` can be added.
2. **Lambda cold start** — First call after idle period will have ~200-500ms cold start. Acceptable for a stats query that isn't latency-critical.
3. **Eventual consistency** — DynamoDB GSI reads are eventually consistent. After creating/approving annotations, counts may lag by a fraction of a second. This is acceptable for display purposes.

## Impact

- **Requirements**: No change (same feature, better implementation)
- **Design**: Add `getAnnotationCounts` custom query to design.md API section
- **Tasks**: Add implementation tasks for Lambda, schema, hook, and page updates

## Alternatives Considered

1. **AppSync JavaScript resolver** — Direct DynamoDB query without Lambda cold start. More efficient but the project consistently uses Lambda-backed custom queries. Adding a new resolver pattern increases complexity.
2. **Pagination in client-side hooks** — Fix the existing hooks to paginate through all records. Still transfers full record data; doesn't solve the wasteful transfer problem.
3. **DynamoDB Streams + counter table** — Maintain counters updated via streams. Most efficient reads but adds operational complexity (stream processing, eventual consistency).

## Implementation Plan

1. Create Lambda function `get-annotation-counts/handler.ts`
2. Add `getAnnotationCounts` custom query to schema (`resource.ts`)
3. Add IAM permissions and wiring in `backend.ts`
4. Create `useAnnotationCounts` hook
5. Update Dashboard to use the new hook
6. Update DatasetManagement to use the new hook
7. Remove `useApprovedAnnotationStats` hook
8. Run lint and tests
