# Proposal: Fix Annotation Workflow Implementation

**Date**: 2026-01-11
**Author**: Claude Agent
**Status**: Proposed

## Background

Current Sprint 2 implementation has three critical issues:
1. **Lambda not accessible**: Frontend calls `/api/generate-annotation` which doesn't exist
2. **Missing question-first workflow**: Should load default questions first, then get AI suggestions
3. **Bounding boxes not visible**: Canvas annotation component not properly displaying boxes

## Issues Identified

### Issue 1: Lambda Function Not Accessible
- Frontend tries to call `/api/generate-annotation` endpoint
- No API Gateway or Function URL configured
- Should use Amplify's function invocation or add proper API endpoint

### Issue 2: Wrong Workflow Implementation
- Current: "Generate AI Annotations" creates complete Q&A pairs
- Required: Load default questions first, then get AI suggestions for additional questions
- Missing: AI-assisted answering (get answer for specific question)

### Issue 3: Bounding Box Visibility
- Canvas component exists but boxes may not be rendering properly
- Need to verify canvas overlay and coordinate system

## Proposed Solution

### 1. Fix Lambda Access
Add GraphQL custom query to invoke Lambda function:
```typescript
// In amplify/data/resource.ts
generateAnnotations: a
  .query()
  .arguments({
    imageId: a.string().required(),
    language: a.string().required(),
    documentType: a.string().required(),
  })
  .returns(a.json())
  .handler(a.handler.function(generateAnnotation))
```

### 2. Implement Correct Workflow
- Load default questions on annotation start
- Add "Get AI Question Suggestions" button
- Add "Get AI Answer" button per question
- Separate question generation from answer generation

### 3. Fix Bounding Box Display
- Verify canvas coordinate system
- Ensure proper rendering of bounding boxes
- Add visual feedback for selected boxes

## Implementation Plan

1. **Add GraphQL Query** (5 min)
   - Update data schema with custom query
   - Test Lambda invocation

2. **Fix Workflow UI** (15 min)
   - Load default questions on start
   - Separate question and answer generation
   - Update button labels and flow

3. **Fix Canvas Display** (10 min)
   - Debug bounding box rendering
   - Ensure proper coordinate conversion

## Impact

- **Requirements**: No changes needed (already specified correctly)
- **Design**: Minor updates to component interaction flow
- **Tasks**: Update Sprint 2 completion status

## Testing

- Verify Lambda function is called successfully
- Test default question loading
- Test AI question suggestion generation
- Test AI answer generation with bounding boxes
- Verify bounding boxes are visible on canvas
