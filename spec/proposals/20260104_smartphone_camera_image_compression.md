# Proposal: Smartphone Camera Support and Image Compression

**Date**: 2026-01-04
**Author**: Claude Agent (based on user requirement)
**Status**: Proposed

## Background

The Business OCR Annotator is designed to be primarily used on smartphones, where users will capture photos of business documents using their device cameras. This introduces several important technical considerations:

1. **Large Image Sizes**: Modern smartphone cameras produce high-resolution images (12MP+), often resulting in files larger than 4MB
2. **Model Context Limits**: OCR models like Qwen have context size limitations that restrict the maximum image size that can be processed
3. **Network Constraints**: Large image uploads on mobile networks can be slow and consume significant data
4. **Quality Requirements**: We need to preserve original high-resolution images for dataset quality while providing optimized versions for model processing

## Proposal

Implement a dual-image storage strategy that maintains both original and compressed versions of uploaded images:

### 1. Image Processing Pipeline

```
User Upload (Smartphone Camera)
    ↓
Original Image (Full Resolution)
    → Store in S3 (original/)
    → Preserve for final dataset
    ↓
Compression Process
    ↓
Compressed Image (≤4MB, optimized for model)
    → Store in S3 (compressed/)
    → Use for AI annotation generation
    → Use for annotation UI (faster loading)
```

### 2. Compression Strategy

**Target Specifications:**
- Maximum file size: 4MB (leaves headroom under typical model limits)
- Format: JPEG with progressive encoding
- Quality: Dynamic based on original size (75-90% quality)
- Maximum dimensions: 2048x2048 pixels (maintains readability for OCR)

**Compression Algorithm:**
```typescript
async function compressImage(originalBuffer: Buffer): Promise<Buffer> {
  const metadata = await sharp(originalBuffer).metadata();

  // Calculate dimensions to maintain aspect ratio
  const maxDimension = 2048;
  let width = metadata.width;
  let height = metadata.height;

  if (width > maxDimension || height > maxDimension) {
    if (width > height) {
      height = Math.round((height / width) * maxDimension);
      width = maxDimension;
    } else {
      width = Math.round((width / height) * maxDimension);
      height = maxDimension;
    }
  }

  // Start with 90% quality and reduce if needed
  let quality = 90;
  let compressed;

  do {
    compressed = await sharp(originalBuffer)
      .resize(width, height, { fit: 'inside' })
      .jpeg({ quality, progressive: true })
      .toBuffer();

    // Reduce quality if still too large
    if (compressed.length > 4 * 1024 * 1024) {
      quality -= 5;
    }
  } while (compressed.length > 4 * 1024 * 1024 && quality > 50);

  return compressed;
}
```

### 3. Mobile-First UI Enhancements

**Camera Integration:**
- Direct camera access via HTML5 `<input type="file" capture="camera">`
- Show live preview before upload
- Compress on client-side before upload (optional, for faster upload)
- Progressive upload with resumable support

**Responsive Design:**
- Optimize annotation UI for mobile screens
- Touch-friendly bounding box manipulation
- Gesture support (pinch-to-zoom, swipe navigation)
- Reduce data usage by loading compressed images by default

### 4. Storage Structure

```
s3://bucket-name/
├── datasets/
│   └── {datasetId}/
│       ├── original/
│       │   └── {imageId}.jpg          # Full resolution (5-20MB)
│       └── compressed/
│           ├── {imageId}.jpg          # Model-optimized (≤4MB)
│           └── {imageId}_thumb.jpg    # Thumbnail (≤100KB)
```

### 5. Database Schema Updates

Update `Image` table to track both versions:

```typescript
interface Image {
  // ... existing fields
  s3KeyOriginal: string;        // Path to original image
  s3KeyCompressed: string;      // Path to compressed image
  s3KeyThumbnail: string;       // Path to thumbnail
  originalSize: number;         // Bytes (original)
  compressedSize: number;       // Bytes (compressed)
  compressionRatio: number;     // compressedSize / originalSize
  dimensions: {
    original: { width: number; height: number };
    compressed: { width: number; height: number };
  };
}
```

## Impact

### Requirements Changes (`requirements.md`)

**Update REQ-IU-003:**
- OLD: Maximum single image size shall be 10MB
- NEW: Maximum single image size shall be 20MB (original), with automatic compression to ≤4MB for model processing

**Add new requirements:**
- **REQ-IU-006**: System shall automatically compress images larger than 4MB for model processing
- **REQ-IU-007**: System shall preserve original high-resolution images for final dataset export
- **REQ-IU-008**: Mobile users shall be able to capture photos directly from device camera
- **REQ-IU-009**: System shall support progressive image upload with resume capability
- **REQ-IU-010**: Annotation UI shall display compressed images by default with option to view original

**Update REQ-NF-P-001:**
- Add: "Image compression shall complete within 5 seconds for images up to 20MB"

### Design Changes (`design.md`)

**Update ImageProcessor Lambda:**
```typescript
async function handler(event: S3Event) {
  // 1. Get original image from S3
  const original = await s3.getObject({ Key: s3KeyOriginal });

  // 2. Extract metadata
  const metadata = await extractMetadata(original);

  // 3. Generate compressed version (≤4MB)
  const compressed = await compressImage(original, { maxSize: 4 * 1024 * 1024 });

  // 4. Generate thumbnail (≤100KB)
  const thumbnail = await generateThumbnail(original, { maxSize: 100 * 1024 });

  // 5. Upload compressed and thumbnail to S3
  await Promise.all([
    s3.putObject({ Key: s3KeyCompressed, Body: compressed }),
    s3.putObject({ Key: s3KeyThumbnail, Body: thumbnail })
  ]);

  // 6. Update DynamoDB with all metadata
  await updateImageRecord({
    s3KeyOriginal,
    s3KeyCompressed,
    s3KeyThumbnail,
    originalSize: original.length,
    compressedSize: compressed.length,
    metadata
  });

  // 7. Trigger annotation generation with compressed image
  await triggerAnnotationGeneration(s3KeyCompressed);
}
```

**Add mobile-specific components:**
- `CameraCapture` component for direct camera access
- `TouchAnnotator` component optimized for touch input
- `ProgressiveImageLoader` for optimized mobile loading

### Tasks Changes (`tasks.md`)

**Add to Phase 1 (Infrastructure):**
- Configure S3 folder structure for original/compressed/thumbnail images
- Set up S3 lifecycle policies for thumbnail cleanup

**Add to Phase 2 (Frontend):**
- Implement CameraCapture component for smartphone photo capture
- Create TouchAnnotator for mobile-friendly bounding box editing
- Implement progressive image loading
- Add client-side image compression (optional pre-upload)
- Optimize UI for mobile viewport sizes
- Implement gesture controls (pinch-to-zoom, swipe)

**Add to Phase 3 (Backend):**
- Update ImageProcessor to generate compressed and thumbnail versions
- Implement smart compression algorithm with quality adjustment
- Add compression ratio tracking and optimization
- Update AnnotationGenerator to use compressed images
- Implement resumable upload for large files

**Add to Phase 4 (Testing):**
- Test with various smartphone camera resolutions (12MP, 48MP, 108MP)
- Test compression quality and OCR accuracy correlation
- Test mobile UI on various devices and screen sizes
- Test upload performance on 3G/4G/5G networks
- Test with images up to 20MB

## Alternatives Considered

### Alternative 1: Client-Side Only Compression
**Approach**: Compress images entirely on the client before upload

**Pros:**
- Faster uploads
- Reduced server processing
- Lower bandwidth costs

**Cons:**
- Inconsistent compression quality across devices
- Limited by mobile device processing power
- No original high-resolution image preserved
- Not suitable for dataset publication

**Verdict**: Rejected - We need original images for high-quality dataset

### Alternative 2: On-Demand Compression
**Approach**: Only compress when needed (at annotation generation time)

**Pros:**
- Simpler initial upload flow
- No unnecessary compression

**Cons:**
- Delays annotation generation
- Repeated compression if regenerating annotations
- More complex error handling

**Verdict**: Rejected - Upfront compression is more efficient

### Alternative 3: Multiple Compression Levels
**Approach**: Generate multiple versions (original, high, medium, low, thumbnail)

**Pros:**
- Maximum flexibility for different use cases
- Better mobile performance

**Cons:**
- Increased storage costs (4-5x per image)
- More complex management
- Higher processing time

**Verdict**: Partially accepted - Only use 3 versions (original, compressed, thumbnail)

## Implementation Plan

### Phase 1: Update Specifications ✓
1. Update requirements.md with new image requirements
2. Update design.md with compression architecture
3. Update tasks.md with mobile-specific tasks

### Phase 2: Backend Implementation
1. Update ImageProcessor Lambda to generate multiple versions
2. Implement compression algorithm with quality optimization
3. Update DynamoDB schema to track multiple versions
4. Update S3 folder structure
5. Update AnnotationGenerator to use compressed images
6. Add compression metrics and monitoring

### Phase 3: Frontend Implementation
1. Add camera capture support for mobile devices
2. Implement progressive image loading
3. Update ImageViewer to use compressed version by default
4. Add "View Original" option for high-resolution review
5. Optimize annotation UI for mobile/touch input
6. Add gesture controls

### Phase 4: Testing & Optimization
1. Test compression quality vs OCR accuracy
2. Test with various smartphone cameras
3. Optimize compression parameters
4. Performance testing on mobile networks
5. User acceptance testing on mobile devices

### Phase 5: Documentation
1. Update user documentation for mobile usage
2. Document camera permissions requirements
3. Create mobile-specific user guide
4. Document compression algorithm and settings

## Success Criteria

1. **Compression Effectiveness**: 99% of images compressed to ≤4MB
2. **OCR Accuracy**: Less than 5% accuracy degradation vs original images
3. **Upload Performance**: Average upload time <15 seconds on 4G networks
4. **Storage Efficiency**: Compressed versions average 70-80% smaller than originals
5. **Mobile UX**: 90%+ user satisfaction with mobile annotation experience
6. **Quality Preservation**: Original images preserved at full resolution for dataset export

## Risks & Mitigation

### Risk 1: OCR Accuracy Loss
**Impact**: Medium
**Probability**: Medium
**Mitigation**:
- Test extensively with various compression levels
- Adjust quality parameters based on OCR accuracy testing
- Allow manual quality override for critical documents

### Risk 2: Increased Processing Time
**Impact**: Low
**Probability**: High
**Mitigation**:
- Implement async processing with progress notifications
- Use efficient compression libraries (Sharp)
- Optimize Lambda memory allocation

### Risk 3: Storage Costs
**Impact**: Medium
**Probability**: High
**Mitigation**:
- Implement S3 lifecycle policies for old thumbnails
- Use S3 Intelligent-Tiering for original images
- Monitor and set storage quotas

## Questions for Review

1. Should we allow users to configure compression quality manually?
2. Should we implement client-side compression as an option to reduce upload time?
3. What is the acceptable OCR accuracy degradation threshold?
4. Should we support other formats (PNG, WebP) or standardize on JPEG?
5. Do we need to preserve EXIF data in compressed versions?

---

**Next Steps**:
1. Approve/reject this proposal
2. Update specification documents if approved
3. Add detailed implementation tasks
4. Begin Phase 2 implementation

**Related Documents**:
- spec/requirements.md
- spec/design.md
- spec/tasks.md
