# Proposal: Store Compressed Image Dimensions

**Date**: 2026-01-25
**Author**: Claude Agent
**Status**: Proposed

## Background

Currently, the Image model stores only original image dimensions (`width`, `height`). When images are compressed by the `process-image` Lambda, the compressed dimensions are not saved.

This causes issues for:
1. Dataset users who need coordinates in compressed image scale
2. Accurate coordinate conversion between original and compressed images

## Proposal

Add `compressedWidth` and `compressedHeight` fields to the Image model and update the `process-image` Lambda to save these values after compression.

## Changes

### 1. Data Model (`amplify/data/resource.ts`)
```typescript
Image: a.model({
  // ... existing fields
  compressedWidth: a.integer(),
  compressedHeight: a.integer(),
})
```

### 2. Process Image Lambda (`amplify/functions/process-image/handler.ts`)
- Extract compressed image dimensions after compression
- Save to DynamoDB along with other compression metadata

## Benefits

Dataset users can:
```python
# Original scale
bbox_original = [x0, y0, x1, y1]

# Compressed scale
scale_x = image['compressedWidth'] / image['width']
scale_y = image['compressedHeight'] / image['height']
bbox_compressed = [x * scale_x for x in bbox_original]

# Normalized scale (0-1)
bbox_normalized = [
    x0 / image['width'],
    y0 / image['height'],
    x1 / image['width'],
    y1 / image['height']
]
```

## Impact

- **Requirements**: No change
- **Design**: Minor schema update
- **Tasks**: Update Sprint 2 compression task notes

## Implementation Plan

1. Update `amplify/data/resource.ts` - Add fields
2. Update `amplify/functions/process-image/handler.ts` - Save dimensions
3. Test with sandbox
4. Update existing images (optional migration)
