# Sprint 2 Review: Annotation Support Feature

**Date**: 2026-01-11
**Reviewer**: Claude Agent
**Components**:
- `amplify/functions/generate-annotation/`
- `src/pages/AnnotationWorkspace.tsx`
- `src/pages/Dashboard.tsx`
- `amplify/data/resource.ts`

**Status**: Review Complete

---

## Executive Summary

The annotation support feature implements AI-assisted Q&A generation using Amazon Bedrock with multi-language prompts and a user-friendly validation workflow. The frontend integration is comprehensive with proper loading states and approve/reject flows. However, **critical issues with API endpoint configuration, type safety, and JSON parsing reliability** require fixes before production.

| Aspect | Rating | Notes |
|--------|--------|-------|
| Functionality | 7/10 | Core features work, mock fallback masks issues |
| Security | 5/10 | Overly permissive IAM, missing input validation |
| Type Safety | 5/10 | Local types, missing enums, unsafe casts |
| Code Quality | 7/10 | Clean structure, good UI/UX design |
| Spec Compliance | 6/10 | Missing per-user tracking, rejection reasons |
| **Overall** | **6/10** | Feature complete but needs hardening |

---

## Critical Issues (P0)

### 1. Missing API Endpoint Configuration - BLOCKER

**Location**: `AnnotationWorkspace.tsx` line 136

```typescript
// CURRENT:
const response = await fetch('/api/generate-annotation', {
  method: 'POST',
  // ...
});
```

**Problem**:
- No `/api/generate-annotation` endpoint is defined in backend.ts
- Lambda function exists but has no HTTP trigger (API Gateway or Function URL)
- **Feature will return 404 in production**

**Required Fix**:
Option A: Add Lambda Function URL
```typescript
// backend.ts
import { FunctionUrlAuthType } from 'aws-cdk-lib/aws-lambda';

backend.generateAnnotation.resources.lambda.addFunctionUrl({
  authType: FunctionUrlAuthType.AWS_IAM,
  cors: { allowedOrigins: ['*'] },
});
```

Option B: Create API Gateway integration

**Effort**: 2-3 hours

### 2. Fragile JSON Parsing - High Risk of Silent Failures

**Location**: `generate-annotation/handler.ts` lines 218-222

```typescript
// CURRENT:
const jsonMatch = responseText.match(/\{[\s\S]*\}/);
if (!jsonMatch) {
  throw new Error('No JSON found in response');
}
const parsedResponse = JSON.parse(jsonMatch[0]);
```

**Problems**:
- Regex `/\{[\s\S]*\}/` is greedy - matches first `{` to last `}`
- If model outputs explanation before JSON, parsing will fail
- If model outputs multiple JSON objects, wrong data extracted
- No schema validation after parsing

**Required Fix**:
```typescript
// Better approach: Enforce JSON-only response in prompt OR
// Use response_format: { type: "json_object" } in Bedrock if supported

// And add schema validation:
import { z } from 'zod';

const AnnotationResponseSchema = z.object({
  annotations: z.array(z.object({
    question: z.string(),
    answer: z.string(),
    boundingBox: z.object({
      x0: z.number().min(0).max(1),
      y0: z.number().min(0).max(1),
      x1: z.number().min(0).max(1),
      y1: z.number().min(0).max(1),
    }),
    confidence: z.number().min(0).max(1),
  })),
});
```

### 3. Type Safety Mismatch - Frontend vs Backend

**Location**: Multiple files

| Component | Type | Schema Expectation |
|-----------|------|-------------------|
| generate-annotation handler | `boundingBox: [x0, y0, x1, y1]` | Single tuple |
| AnnotationWorkspace | `boundingBoxes: BoundingBox[]` | Array of arrays |
| data/resource.ts | `boundingBoxes: a.json()` | JSON (unknown) |

**Problem**: Handler returns single bbox as tuple, but schema expects array of bboxes

**Current Workaround** (fragile):
```typescript
// AnnotationWorkspace.tsx line 207
boundingBoxes: JSON.stringify([suggestion.boundingBox])
```

**Required Fix**: Standardize on `boundingBox[][]` format throughout

---

## High Priority Issues (P1)

### 4. Overly Permissive Bedrock IAM Policy

**Location**: `backend.ts` lines 28-34

```typescript
// CURRENT:
new PolicyStatement({
  actions: ['bedrock:InvokeModel'],
  resources: ['arn:aws:bedrock:*::foundation-model/*'],  // ALL models!
})
```

**Security Risk**: Allows invocation of any foundation model, not just the configured one

**Required Fix**:
```typescript
new PolicyStatement({
  actions: ['bedrock:InvokeModel'],
  resources: [
    'arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-pro-v1:0',
  ],
})
```

### 5. Missing Input Validation

**Location**: `generate-annotation/handler.ts`

**Missing Validations**:
- `language` parameter not validated against allowed values (ja, en, zh, ko)
- `imageId` not validated (could be empty or malformed)
- `s3Key` path not validated
- Bounding boxes not validated for bounds (0-1 range)

```typescript
// REQUIRED:
const ALLOWED_LANGUAGES = new Set(['ja', 'en', 'zh', 'ko']);
if (!ALLOWED_LANGUAGES.has(language)) {
  throw new Error(`Invalid language: ${language}`);
}
```

### 6. Mock Data Fallback Masquerades as Real Results

**Location**: `AnnotationWorkspace.tsx` lines 164-189

```typescript
// CURRENT:
catch (error) {
  console.error('Failed to generate annotations:', error);
  const mockSuggestions = [/*...*/];  // Fake data!
  setAiSuggestions(mockSuggestions);
  alert('Using mock data (Lambda not available)...');
}
```

**Problems**:
- Users may not realize they're seeing fake data
- Mock data could accidentally be saved to database
- Masks real API failures during development

**Required Fix**:
- Remove mock fallback OR clearly label in UI
- Show proper error state with retry button
- Use toast notification instead of alert()

### 7. Excessive Lambda Timeout

**Location**: `generate-annotation/resource.ts` line 6

```typescript
timeoutSeconds: 300,  // 5 minutes!
```

**Spec Reference**: REQ-NF-P-002 states "System shall generate suggested questions within 30 seconds"

**Required Fix**: Reduce to 60-90 seconds with proper timeout handling

### 8. Missing Per-User Contribution Tracking

**Spec Reference**: REQ-AW-013, REQ-AW-014

**Current**: Dashboard shows global counts for all users

```typescript
// Dashboard.tsx - counts ALL annotations
const aiAnnotations = annotations.filter((a) => a.generatedBy === 'AI').length;
```

**Required**: Track and display per-user statistics

---

## Medium Priority Issues (P2)

### 9. Missing Rejection Reason Field

**Spec Reference**: REQ-VA-002 "System shall capture validation feedback"

**Current**: Only tracks APPROVED/REJECTED status, no reason why

**Required Fix**: Add `rejectionReason: a.string()` to Annotation schema

### 10. Model Version Hardcoding

**Location**: `AnnotationWorkspace.tsx` line 212

```typescript
modelVersion: 'nemotron-nano-12b',  // Hardcoded!
```

**Problem**: If model is changed in resource.ts, frontend won't update

**Fix**: Include `modelVersion` in Lambda response and use that

### 11. Missing Question Type Classification

**Spec Reference**: REQ-QG-007 "System shall classify question types"

**Current**: `questionType` is optional in schema, not populated by Lambda

**Fix**: Add classification logic to Lambda prompt and response parsing

### 12. Storage Access Over-Permissive

**Location**: `amplify/storage/resource.ts`

```typescript
'images/original/*': [allow.authenticated.to(['read', 'write', 'delete'])],
```

**Problem**: All users can delete any user's images

**Fix**: Use path-based restrictions with `${aws:username}`

### 13. No Retry Logic for Bedrock API

**Current**: Single attempt, failure returns error

**Required**: Implement exponential backoff for transient failures
```typescript
async function invokeWithRetry(maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await bedrockClient.send(command);
    } catch (error) {
      if (!isRetryable(error) || i === maxRetries - 1) throw error;
      await sleep(Math.pow(2, i) * 1000);  // Exponential backoff
    }
  }
}
```

---

## Low Priority Issues (P3)

### 14. Alert() for User Feedback

**Location**: `AnnotationWorkspace.tsx` lines 160, 191-192

**Issue**: Using browser `alert()` instead of toast/notification component

### 15. No Loading State for Individual Actions

**Issue**: No spinner when adopting/rejecting individual suggestions

### 16. Console Logging in Production

**Location**: Multiple `console.error` statements

**Fix**: Use structured logging or remove for production

### 17. Missing Bounds Checking

**Location**: `handler.ts` line 121 (`convertToPixelCoordinates`)

```typescript
// No validation that x0 < x1 and y0 < y1
// No validation that coordinates are within 0-1 range
```

### 18. DefaultQuestion Model Not Integrated

**Status**: Schema exists in data/resource.ts but not loaded in frontend

---

## Security Assessment

| Aspect | Status | Notes |
|--------|--------|-------|
| IAM Permissions | FAIL | Bedrock allows all models |
| S3 Access | WARN | Users can delete others' files |
| Input Validation | FAIL | No validation of language, imageId |
| Rate Limiting | WARN | No throttling on Lambda invocations |
| Error Exposure | OK | Errors logged but not exposed to client |

---

## Specification Compliance

| Requirement | Status | Notes |
|-------------|--------|-------|
| REQ-QG-001: Auto-generate questions | PASS | Lambda generates Q&A pairs |
| REQ-QG-002: Generate diverse types | FAIL | No type classification |
| REQ-QG-003: Generate 3-10 questions | PARTIAL | Prompt requests 3-5 |
| REQ-QG-005: Extract bounding boxes | PASS | Coordinates converted correctly |
| REQ-QG-007: Classify question types | FAIL | Not implemented |
| REQ-ML-001: Multi-language support | PASS | ja, en, zh, ko prompts |
| REQ-VA-001: Review interface | PASS | Good approve/reject UI |
| REQ-VA-002: Capture feedback | FAIL | No rejection reason |
| REQ-AW-013: Per-user image tracking | FAIL | Global counts only |
| REQ-AW-014: Per-user question tracking | FAIL | Global counts only |
| REQ-NF-P-002: 30s generation time | FAIL | Timeout set to 300s |

---

## Positive Highlights

1. **Clean Multi-Language Prompts**: Well-structured prompt templates for ja/en/zh/ko
2. **Intuitive Validation UI**: Clear approve/reject/delete buttons with status badges
3. **Confidence Score Display**: Visual feedback on AI certainty
4. **Loading State**: Animated spinner during generation
5. **3-Tier Image Integration**: Correctly uses compressed images for AI processing
6. **Filter by Status**: Users can filter annotations by validation status
7. **Contribution Stats**: Dashboard shows AI vs. Human annotation breakdown

---

## Frontend Code Quality Score

| Category | Score | Key Issues |
|----------|-------|------------|
| Type Safety | 5/10 | Local interfaces, unsafe casts |
| Error Handling | 4/10 | Mock fallback, alert() usage |
| State Management | 8/10 | Clean hooks usage |
| UI/UX Design | 8/10 | Intuitive workflow |
| Accessibility | 5/10 | Missing ARIA labels |
| Testing | 0/10 | No tests present |
| **Overall** | **5/10** | |

---

## Action Items Summary

### Must Complete Before Merge (P0)

| # | Task | Component | Effort |
|---|------|-----------|--------|
| 1 | Add HTTP endpoint for generate-annotation Lambda | backend.ts | 2 hours |
| 2 | Add JSON schema validation for model responses | handler.ts | 1 hour |
| 3 | Standardize boundingBox type format | Multiple | 1 hour |

### Must Complete Before Production (P1)

| # | Task | Component | Effort |
|---|------|-----------|--------|
| 4 | Restrict Bedrock IAM to specific model ARN | backend.ts | 15 min |
| 5 | Add input validation (language, imageId) | handler.ts | 30 min |
| 6 | Remove mock data fallback | AnnotationWorkspace.tsx | 30 min |
| 7 | Reduce Lambda timeout to 60-90s | resource.ts | 5 min |
| 8 | Add per-user contribution tracking | Dashboard.tsx + schema | 3 hours |

### Should Complete Soon (P2)

| # | Task | Component | Effort |
|---|------|-----------|--------|
| 9 | Add rejectionReason field to schema | data/resource.ts | 30 min |
| 10 | Return modelVersion from Lambda | handler.ts | 15 min |
| 11 | Add question type classification | handler.ts | 2 hours |
| 12 | Fix S3 storage permissions | storage/resource.ts | 1 hour |
| 13 | Add Bedrock API retry logic | handler.ts | 1 hour |

### Nice to Have (P3)

| # | Task | Component | Effort |
|---|------|-----------|--------|
| 14 | Replace alert() with toast component | AnnotationWorkspace.tsx | 30 min |
| 15 | Add loading state for adopt/reject | AnnotationWorkspace.tsx | 30 min |
| 16 | Implement structured logging | All Lambdas | 2 hours |
| 17 | Add coordinate bounds validation | handler.ts | 30 min |
| 18 | Integrate DefaultQuestion model | AnnotationWorkspace.tsx | 2 hours |

---

## Test Recommendations

### Integration Tests

1. **Generate Annotations E2E**:
   - Upload image → Trigger generate → Verify Q&A pairs created
   - Test with each language (ja, en, zh, ko)

2. **Validation Workflow**:
   - Generate → Approve → Verify status update
   - Generate → Reject → Verify status update
   - Adopt suggestion → Verify persisted to database

3. **Error Handling**:
   - Invalid image ID → Graceful error
   - Bedrock timeout → Proper error message
   - Invalid language → Validation error

### Unit Tests

1. **JSON Parsing**: Test with various model response formats
2. **Coordinate Conversion**: Test normalized → pixel conversion
3. **Bounding Box Validation**: Test edge cases (negative, out of bounds)

---

## Architecture Concerns

### Current Flow
```
Frontend → /api/generate-annotation (404!) → Lambda → Bedrock
```

### Required Flow
```
Frontend → API Gateway/Function URL → Lambda → Bedrock
           ↑
           Add authentication (IAM or Cognito)
```

### Recommended Architecture
```
Frontend
   ↓
AWS Amplify API (AppSync)
   ↓
Custom Mutation: generateAnnotations(imageId: ID!)
   ↓
Lambda Function Resolver
   ↓
Amazon Bedrock (Nova Pro)
```

This approach leverages existing AppSync authentication and provides type-safe GraphQL interface.

---

## Conclusion

The annotation support feature demonstrates solid UI/UX design with a comprehensive validation workflow. However, **the feature cannot work in production without fixing the API endpoint configuration**. Security issues with IAM permissions and input validation must also be addressed.

**Recommendation**: Address P0 issues before merging. Consider creating a proposal to migrate from direct Lambda invocation to AppSync mutation for better type safety and authentication integration.
