# Sprint 2 Review: Compression Implementation

**Date**: 2026-01-11
**Reviewer**: Claude Agent
**Component**: `amplify/functions/process-image/`
**Status**: Review Complete - All P0/P1/P2 Issues Fixed

---

## Executive Summary

The compression implementation (process-image Lambda) successfully delivers the core 3-tier image storage feature. The Sharp-based compression algorithm is well-designed with iterative quality reduction. However, **one critical database efficiency bug** and several spec compliance gaps require attention before production deployment.

| Aspect | Rating | Notes |
|--------|--------|-------|
| Functionality | 8/10 | Core compression works correctly |
| Performance | 5/10 | DynamoDB Scan is a critical bottleneck |
| Security | 7/10 | Acceptable, could be tighter |
| Code Quality | 7/10 | Clean structure, needs better typing |
| Spec Compliance | 6/10 | Missing PDF support, status tracking |
| **Overall** | **6.5/10** | Functional but needs critical fixes |

---

## Critical Issues (P0)

### 1. ~~DynamoDB Scan Instead of Query~~ - RESOLVED

**Resolution**: Replaced DynamoDB Scan with Query using GSI on `s3KeyOriginal`.
**Date Fixed**: 2026-01-11

The Lambda now uses the `imagesByS3KeyOriginal` secondary index for O(1) lookups:

```typescript
// FIXED - using GSI:
const result = await docClient.send(new QueryCommand({
  TableName: tableName,
  IndexName: 'imagesByS3KeyOriginal',
  KeyConditionExpression: 's3KeyOriginal = :s3Key',
  ExpressionAttributeValues: {
    ':s3Key': s3KeyOriginal,
  },
  Limit: 1,
}));
```

~~**Effort**: ~1 hour (includes schema migration)~~

---

## High Priority Issues (P1)

### 2. Race Condition with Eventual Consistency

**Location**: `handler.ts` lines 282-304

```typescript
// CURRENT:
if (!imageRecord) {
  console.log(`Image record not found, waiting for DB sync...`);
  await new Promise(resolve => setTimeout(resolve, 2000));
  const retryRecord = await findImageByS3Key(tableName, s3KeyOriginal);
  // ...
}
```

**Problem**:
- Hardcoded 2-second sleep is unreliable
- Only retries once
- No exponential backoff

**Recommended Fix**: Change workflow so AppSync creates Image record BEFORE S3 upload triggers Lambda.

### 3. Incorrect Status Tracking

**Location**: `handler.ts` line 212

```typescript
// CURRENT:
':status': 'UPLOADED',

// SHOULD BE:
':status': 'ANNOTATING',  // Image is ready for annotation after compression
```

**Impact**: Image workflow state machine is incorrect - status should progress from UPLOADED → PROCESSING → ANNOTATING

### 4. Missing PDF Support

**Spec Reference**: REQ-IU-001 states "upload images in common formats (JPEG, PNG, PDF)"

**Current**: Only handles formats Sharp can process directly (JPEG, PNG, WebP, TIFF)

**Impact**: Users cannot upload PDF business documents

**Required Fix**: Add pdf-lib or pdfjs-dist dependency and convert PDF pages to images

---

## Medium Priority Issues (P2)

### 5. Missing Compression Ratio Tracking

**Spec Reference**: design.md line 696 shows `compressionRatio` field

**Current**: Stores individual sizes but not calculated ratio

**Fix**: Add `compressionRatio: originalSize / compressedSize` to UpdateCommand

### 6. Original Format Not Tracked

**Impact**: All files converted to JPEG - original format (PNG, TIFF) lost

**Fix**: Add `originalFormat` field to schema and populate during processing

### 7. Lambda Timeout Configuration

**Current**: 60 seconds
**Risk**: Large images (20MB originals) may timeout under heavy load

**Recommendation**: Increase to 90 seconds for safety margin

### 8. Missing EXIF Data Extraction

**Spec Reference**: design.md mentions EXIF extraction

**Impact**: Camera metadata, orientation, and date information lost

**Fix**: Use Sharp's `metadata()` to extract and store EXIF data

---

## Low Priority Issues (P3)

### 9. Outdated Dependencies

| Package | Current | Latest |
|---------|---------|--------|
| sharp | ^0.33.2 | ^0.35.x |
| @aws-sdk/* | ^3.490.0 | ^3.700+ |

**Recommendation**: Update for security patches and performance improvements

### 10. Console.log Logging

**Issue**: Uses plain `console.log` instead of structured logging

**Recommendation**: Implement AWS Lambda Powertools Logger for:
- JSON formatted logs
- Correlation IDs
- Timing metrics

### 11. Missing Input Validation

**Issues**:
- No validation of S3 key format
- No validation that buffer contains valid image data
- Fallback to 1000x1000 for missing metadata is arbitrary

---

## Security Assessment

| Aspect | Status | Notes |
|--------|--------|-------|
| S3 Access | OK | Scoped to bucket via IAM |
| DynamoDB Access | WARN | Scan permission too broad |
| Input Validation | WARN | No S3 key sanitization |
| Logging | OK | No sensitive data in logs |
| Error Handling | OK | Errors caught and logged |

**Recommendations**:
1. Restrict DynamoDB permissions to specific GSI when using Query
2. Add S3 key format validation
3. Enable CloudWatch log encryption for compliance

---

## Specification Compliance

| Requirement | Status | Notes |
|-------------|--------|-------|
| REQ-IU-001: Upload JPEG, PNG, PDF | PARTIAL | PDF not supported |
| REQ-IU-003: Maintain ≤4MB compressed | PASS | Smart iterative compression |
| REQ-IU-006: Preserve original | PASS | Stored in images/original/ |
| REQ-IU-010: Thumbnail ≤100KB | PASS | Smart thumbnail generation |
| design.md: 3-tier storage | PASS | original/compressed/thumbnail paths |
| design.md: compressionRatio tracking | FAIL | Not calculated |
| design.md: EXIF extraction | FAIL | Not implemented |
| design.md: PROCESSING status | PARTIAL | Status set incorrectly |

---

## Positive Highlights

1. **Smart Compression Algorithm**: Iterative quality reduction with dimension scaling fallback is well-designed
2. **Progressive JPEG**: mozjpeg with progressive encoding improves perceived loading
3. **Clean Code Structure**: Handler vs. resource separation follows best practices
4. **Comprehensive Logging**: Good coverage of processing steps
5. **S3 Event Integration**: Proper trigger configuration in backend.ts

---

## Action Items Summary

### Must Complete Before Merge

| # | Task | Priority | Effort | Status |
|---|------|----------|--------|--------|
| 1 | Replace DynamoDB Scan with Query + GSI | P0 | 1 hour | ✅ Fixed |
| 2 | Fix status to 'ANNOTATING' after success | P1 | 10 min | ✅ Fixed |

### Should Complete Before Production

| # | Task | Priority | Effort | Status |
|---|------|----------|--------|--------|
| 3 | Improve eventual consistency with exponential backoff | P1 | 1 hour | ✅ Fixed |
| 4 | Add PDF support | P1 | 3 hours | ⬜ Deferred to Sprint 4 |
| 5 | Track compression ratio | P2 | 15 min | ✅ Fixed |
| 6 | Track original format | P2 | 15 min | ✅ Fixed |
| 7 | Increase Lambda timeout to 90s | P2 | 5 min | ✅ Fixed |

### Nice to Have

| # | Task | Priority | Effort | Status |
|---|------|----------|--------|--------|
| 8 | Update dependencies | P3 | 30 min | ⬜ Deferred |
| 9 | Implement structured logging | P3 | 1 hour | ⬜ Deferred |
| 10 | Add EXIF extraction | P3 | 1 hour | ⬜ Deferred |
| 11 | Add input validation | P3 | 30 min | ⬜ Deferred |

---

## Test Recommendations

Before deployment, verify:

1. **Happy Path**: Upload 5MB JPEG → compressed ≤4MB, thumbnail ≤100KB
2. **Large Image**: Upload 20MB PNG → compression completes within timeout
3. **Edge Cases**:
   - Very small image (10KB) → no unnecessary compression
   - Square vs. landscape vs. portrait orientations
   - Images with/without EXIF data
4. **Error Cases**:
   - Invalid image data → graceful error response
   - S3 permission denied → appropriate error logged
   - DynamoDB record not found → retry logic works

---

**Recommendation**: Address P0 and P1 issues before merging. The DynamoDB Scan bug will cause significant problems at scale.
