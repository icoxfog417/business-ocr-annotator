# Proposal: Move Image Compression to Sprint 2

**Date**: 2026-01-11
**Author**: Claude Agent
**Status**: Implemented

## Background

During Sprint 2 implementation, we tested the NVIDIA Nemotron Nano 12B v2 model on Bedrock and observed:
- 887KB image = 3,553 input tokens
- Model has 128K token context limit
- Without compression, large images could exceed token limits or fail

Image compression was originally planned for Sprint 4, but it affects the data model (s3Key fields) and is critical for AI annotation to work reliably.

## Proposal

Move image compression from Sprint 4 to Sprint 2 with the following changes:

### Data Model Changes

Update `Image` model in `amplify/data/resource.ts`:

```typescript
// Replace single s3Key with 3-tier storage
s3KeyOriginal: a.string().required(),   // Original upload
s3KeyCompressed: a.string(),            // ≤4MB for AI processing
s3KeyThumbnail: a.string(),             // ≤100KB for gallery

// Add file size tracking
originalSize: a.integer(),
compressedSize: a.integer(),
thumbnailSize: a.integer(),

// Add PROCESSING status
status: a.enum(['UPLOADED', 'PROCESSING', 'ANNOTATING', 'VALIDATED']),
```

### Storage Structure Changes

Update `amplify/storage/resource.ts`:

```typescript
access: (allow) => ({
  'images/original/*': [allow.authenticated.to(['read', 'write', 'delete'])],
  'images/compressed/*': [allow.authenticated.to(['read', 'write', 'delete'])],
  'images/thumbnail/*': [allow.authenticated.to(['read', 'write', 'delete'])],
}),
```

### New Lambda Function

Create `amplify/functions/process-image/`:
- Triggered after upload (called from frontend)
- Uses Sharp library for compression
- Generates compressed (≤4MB) and thumbnail (≤100KB) versions
- Updates Image record with new S3 keys and sizes

## Impact

### Requirements (requirements.md)
No changes needed - REQ-IU-006, REQ-IU-007, REQ-IU-010 already specify compression requirements.

### Design (design.md)
- Update Image Table schema to show 3-tier storage keys
- Already has ImageProcessor Lambda specification

### Tasks (tasks.md)
Move from Sprint 4 to Sprint 2:
- Image Compression Lambda tasks
- Storage structure update
- Frontend updates for progressive loading

Remove from Sprint 4:
- Image compression tasks (moved to Sprint 2)

## Implementation Plan

1. Update data schema (`amplify/data/resource.ts`)
2. Update storage structure (`amplify/storage/resource.ts`)
3. Create process-image Lambda function
4. Update backend.ts with new function and permissions
5. Update FileUpload page to call compression after upload
6. Update ImageGallery to use thumbnails
7. Update AnnotationWorkspace to use compressed images
8. Update tasks.md to reflect changes

## Risk Mitigation

- Sharp library is already verified in `.sandbox/07-sharp-compression/`
- Compression targets (4MB, 100KB) are conservative for 128K token limit
- Fallback: If compression fails, original image is still available
