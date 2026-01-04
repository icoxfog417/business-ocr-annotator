# Proposal: Standardize Dataset Format for Academic Compatibility and Japanese Language Support

**Date**: 2026-01-04
**Author**: Claude Agent
**Status**: Proposed
**Related Survey**: J-BizDoc Grounded Visual Question Answering Benchmark

## 1. Background

The current Business OCR Annotator project has a basic data model for storing images, annotations, and bounding boxes. However, after reviewing academic standards from major conferences (ACL, ICDAR) and established benchmarks (DocVQA, LayoutLM, SROIE, SlideVQA), we need to align our dataset format with:

1. **Academic Research Standards**: Enable researchers to use our datasets without format conversion
2. **Japanese Language Requirements**: Support the complexity of Japanese business documents (Kanji, Hiragana, Katakana, vertical text, Hanko seals)
3. **Explainability**: Provide visual grounding (evidence) for answers, critical for high-stakes business auditing
4. **Interoperability**: Ensure compatibility with state-of-the-art models (LayoutLM, Qwen-VL, etc.)
5. **Efficiency**: Optimize storage and streaming for large-scale datasets on Hugging Face

## 2. Proposal

### 2.1 Standardized JSON Schema

Adopt a research-grade JSON schema that aligns with DocVQA and LayoutLM standards:

```json
{
  "dataset_version": "1.0",
  "dataset_metadata": {
    "name": "business-ocr-annotator-dataset",
    "description": "Grounded Visual Question Answering for Business Documents",
    "language": "ja",
    "license": "CC-BY-SA-4.0",
    "citation": "...",
    "created_at": "2026-01-04T00:00:00Z"
  },
  "data": [
    {
      "question_id": "uuid-v4",
      "image_id": "uuid-v4",
      "image_url": "s3://bucket/path/image.webp",
      "image_metadata": {
        "width": 2048,
        "height": 1536,
        "file_size": 245678,
        "format": "webp",
        "dpi": 300
      },
      "document_metadata": {
        "category": "receipt|invoice|tax_form|order_form|contract|other",
        "subcategory": "restaurant_receipt",
        "is_handwritten": false,
        "orientation": "portrait",
        "language": "ja",
        "contains_seal": true,
        "text_direction": "horizontal|vertical|mixed"
      },
      "qa_pairs": [
        {
          "question": "支払者の氏名は何ですか？",
          "answer": "山田 太郎",
          "question_type": "extractive|abstractive|boolean|counting",
          "evidence_segments": [
            {
              "box_2d": [150, 200, 450, 230],
              "text": "山田 太郎",
              "label": "payer_name",
              "confidence": 0.95
            }
          ],
          "answer_type": "span|free_form|yes_no|number",
          "difficulty": "easy|medium|hard",
          "requires_reasoning": false
        }
      ],
      "ocr_tokens": [
        {
          "text": "氏名",
          "box_2d": [100, 200, 140, 230],
          "confidence": 0.98,
          "token_id": 0
        },
        {
          "text": "山田",
          "box_2d": [150, 200, 220, 230],
          "confidence": 0.96,
          "token_id": 1
        },
        {
          "text": "太郎",
          "box_2d": [230, 200, 300, 230],
          "confidence": 0.97,
          "token_id": 2
        }
      ],
      "annotation_metadata": {
        "generated_by": "qwen-vl-max|human",
        "model_version": "qwen-vl-max-2024",
        "annotator_id": "user-uuid",
        "validation_status": "approved|rejected|pending|flagged",
        "validated_by": "user-uuid",
        "validated_at": "2026-01-04T12:00:00Z",
        "generation_time_ms": 1200,
        "edit_count": 2
      }
    }
  ]
}
```

### 2.2 Bounding Box Normalization Strategy

**Current State**: We use 0-1 normalized coordinates
**Proposed**: Support **BOTH** formats for maximum compatibility

#### Format 1: Absolute Coordinates (Pixel-based)
```json
{
  "box_2d": [x_min, y_min, x_max, y_max],
  "format": "xyxy_absolute"
}
```

#### Format 2: LayoutLM Standard (0-1000 normalized)
```json
{
  "box_2d": [x_min, y_min, x_max, y_max],
  "format": "xyxy_normalized_1000"
}
```

**Normalization Formula** (for export):
```
normalized_x = int((pixel_x / image_width) * 1000)
normalized_y = int((pixel_y / image_height) * 1000)
```

**Why 0-1000 instead of 0-1?**
- LayoutLM series uses 0-1000 as standard
- Avoids floating-point precision issues
- Direct integer representation for embeddings
- Widely adopted in document understanding research

**Implementation**:
- Store as 0-1 normalized in DynamoDB (current)
- Convert to 0-1000 on export for Hugging Face
- Support both on import for flexibility

### 2.3 Enhanced OCR Token Support

Add OCR token extraction and storage to support:
- Fine-grained text localization
- Token-level confidence scores
- Reading order reconstruction
- Layout analysis

**Data Flow**:
1. Image uploaded → OCR engine extracts tokens
2. Store tokens with bounding boxes
3. AI model uses tokens for question generation
4. Annotators validate both QA pairs and OCR tokens
5. Export includes full token information

### 2.4 Image Format Optimization

**Recommendation**: Support multiple formats with optimization

| Use Case | Format | Quality | Max Size |
|----------|--------|---------|----------|
| Original (Archive) | PNG/JPEG | Lossless/95 | 20MB |
| Model Processing | WebP | 85 | 4MB |
| Thumbnail | WebP | 75 | 100KB |
| Export (HuggingFace) | WebP | 85 | 4MB |

**WebP Benefits**:
- ~35% smaller than PNG
- ~25-30% smaller than JPEG at same quality
- Supports both lossy and lossless
- Sharp edge gradients for OCR
- Wide browser support (>95%)

**Migration Strategy**:
- Add WebP support alongside existing JPEG/PNG
- Gradually convert existing images
- Keep originals for archival

### 2.5 Export Format Strategy

**Formats to Support**:

1. **JSON** (Human-readable, debugging)
   - Single file or multi-file
   - Pretty-printed for readability

2. **JSONL** (Streaming, large datasets)
   - One record per line
   - Easy to process incrementally
   - Standard for many ML tools

3. **Parquet** (Hugging Face recommended)
   - Columnar format for efficient streaming
   - Smaller size than JSON (~40-60% reduction)
   - Fast filtering and querying
   - Native support in `datasets` library
   - Supports nested structures (QA pairs, bounding boxes)

**Hugging Face Integration**:
```python
# Users can stream our dataset efficiently
from datasets import load_dataset

dataset = load_dataset(
    "organization/business-ocr-annotator",
    streaming=True  # Only loads what's needed
)

for example in dataset['train']:
    # Process without downloading entire dataset
    process_example(example)
```

### 2.6 Licensing and Legal Framework

**Recommended License**: **CC BY-SA 4.0**

**Rationale**:
- Allows commercial use (important for startups)
- Requires attribution (protects contributors)
- Share-alike ensures derivatives remain open
- Compatible with academic research

**Japanese Legal Context**:
- Align with Japanese Copyright Act Article 30-4
- Permits use for "information analysis" (AI training)
- Document this in dataset card for international users

**Privacy Protection**:
- Implement PII detection and blurring
- Redact sensitive fields (phone numbers, addresses)
- Keep business-relevant text (amounts, dates, item names)
- Document PII handling in dataset card

### 2.7 Document Metadata Enrichment

Expand document categorization for Japanese business context:

```typescript
interface DocumentMetadata {
  // Primary classification
  category: 'receipt' | 'invoice' | 'tax_form' | 'order_form' |
            'contract' | 'application_form' | 'other';
  subcategory?: string; // e.g., "restaurant_receipt", "tax_withholding_form"

  // Japanese-specific attributes
  is_handwritten: boolean;
  contains_seal: boolean;  // Hanko stamps
  text_direction: 'horizontal' | 'vertical' | 'mixed';
  script_types: ('kanji' | 'hiragana' | 'katakana' | 'romaji')[];

  // Layout attributes
  orientation: 'portrait' | 'landscape';
  has_tables: boolean;
  has_logos: boolean;
  page_count: number;

  // Business context
  industry?: string;  // e.g., "restaurant", "retail", "manufacturing"
  region?: string;    // e.g., "Tokyo", "Osaka"
  year_range?: string; // Document era, e.g., "2020-2025"
}
```

## 3. Impact Analysis

### 3.1 Impact on requirements.md

**Additions**:
- **REQ-EF-006**: System shall export datasets in Parquet format for Hugging Face streaming
- **REQ-EF-007**: System shall normalize bounding boxes to 0-1000 scale on export
- **REQ-EF-008**: System shall include OCR tokens with confidence scores in exports
- **REQ-DC-004**: System shall support enhanced document metadata including Japanese-specific attributes
- **REQ-QG-006**: System shall extract and store OCR tokens with bounding boxes
- **REQ-NF-C-004**: System shall comply with Japanese Copyright Act Article 30-4
- **REQ-NF-C-005**: System shall detect and redact PII in uploaded documents

**Modifications**:
- **REQ-EF-001-004**: Update to include new schema structure
- **REQ-HF-003**: Update to specify Parquet as primary format for Hugging Face
- **REQ-IU-006-007**: Add WebP format support

### 3.2 Impact on design.md

**Data Model Changes**:

```typescript
// Add to Annotation table
interface Annotation {
  // ... existing fields ...

  // NEW: OCR token support
  ocrTokens?: OCRToken[];

  // NEW: Evidence segments (more detailed than boundingBoxes)
  evidenceSegments: EvidenceSegment[];

  // NEW: Question/answer type classification
  questionType: 'extractive' | 'abstractive' | 'boolean' | 'counting';
  answerType: 'span' | 'free_form' | 'yes_no' | 'number';
  difficulty?: 'easy' | 'medium' | 'hard';
  requiresReasoning: boolean;
}

interface OCRToken {
  text: string;
  box_2d: [number, number, number, number]; // Absolute coordinates
  confidence: number;
  tokenId: number;
  wordId?: number;  // For word grouping
  lineId?: number;  // For line grouping
}

interface EvidenceSegment {
  box_2d: [number, number, number, number]; // Absolute coordinates
  text: string;
  label?: string;
  confidence?: number;
}

// Enhance Image table
interface Image {
  // ... existing fields ...

  // NEW: WebP support
  s3KeyWebP?: string;
  webpSize?: number;

  // NEW: Enhanced metadata
  documentMetadata: DocumentMetadata;

  // NEW: OCR extraction status
  ocrStatus: 'pending' | 'completed' | 'failed';
  ocrEngine?: string; // e.g., "tesseract-5.0", "google-vision-v1"
}

interface DocumentMetadata {
  category: string;
  subcategory?: string;
  isHandwritten: boolean;
  containsSeal: boolean;
  textDirection: 'horizontal' | 'vertical' | 'mixed';
  scriptTypes: string[];
  orientation: 'portrait' | 'landscape';
  hasTables: boolean;
  hasLogos: boolean;
  pageCount: number;
  industry?: string;
  region?: string;
  yearRange?: string;
}
```

**Export Pipeline Updates**:

```typescript
// New export service
interface DatasetExportService {
  exportToJSON(datasetId: string, version: string): Promise<ExportResult>;
  exportToJSONL(datasetId: string, version: string): Promise<ExportResult>;
  exportToParquet(datasetId: string, version: string): Promise<ExportResult>;

  // Normalization utilities
  normalizeToLayoutLM(annotations: Annotation[]): NormalizedAnnotation[];
  convertToHuggingFaceFormat(data: any[]): HuggingFaceDataset;
}

interface ExportResult {
  s3Url: string;
  format: 'json' | 'jsonl' | 'parquet';
  size: number;
  recordCount: number;
  checksum: string;
}
```

**New Lambda Functions**:
- `OCRTokenExtractor`: Extract OCR tokens from images
- `PIIRedactor`: Detect and redact sensitive information
- `ParquetExporter`: Convert JSON to Parquet format

### 3.3 Impact on tasks.md

**New Tasks to Add**:

**Phase 1: Infrastructure**
- [ ] Add OCRTokenExtractor Lambda function
- [ ] Add PIIRedactor Lambda function
- [ ] Update DynamoDB schema to support OCR tokens and enhanced metadata
- [ ] Add WebP image processing to ImageProcessor Lambda

**Phase 2: Frontend**
- [ ] Add OCR token visualization in annotation interface
- [ ] Add PII redaction controls
- [ ] Update metadata input form with Japanese-specific fields
- [ ] Add support for viewing vertical text

**Phase 3: Backend**
- [ ] Integrate OCR engine (Tesseract or Google Vision API)
- [ ] Implement PII detection using regex and ML models
- [ ] Implement Parquet export using Apache Arrow
- [ ] Add bounding box normalization to 0-1000 on export
- [ ] Update Hugging Face publisher to use Parquet format

**Phase 4: Testing**
- [ ] Test OCR token extraction accuracy for Japanese text
- [ ] Test PII redaction effectiveness
- [ ] Test Parquet export and Hugging Face streaming
- [ ] Validate bounding box normalization across different image sizes

**Phase 7: Documentation**
- [ ] Create dataset card template for Hugging Face
- [ ] Document Japanese legal context (Copyright Act Article 30-4)
- [ ] Create citation guidelines
- [ ] Document PII handling policies

## 4. Alternatives Considered

### 4.1 Alternative: Keep 0-1 Normalization Only
**Rejected**: Would require users to convert for LayoutLM compatibility. Better to provide standard format.

### 4.2 Alternative: Use COCO Format
**Rejected**: COCO is designed for object detection, not document VQA. Missing question-answer pairs and text grounding.

### 4.3 Alternative: Skip OCR Tokens
**Rejected**: OCR tokens are valuable for research and improve model performance. Many recent papers use token-level features.

### 4.4 Alternative: Use Only JSON Format
**Rejected**: Parquet is significantly more efficient for large datasets on Hugging Face. JSON can be supplementary.

## 5. Implementation Plan

### Phase 1: Schema & Model Updates (Week 1-2)
1. Update DynamoDB tables with new fields
2. Create migration scripts for existing data
3. Update GraphQL schema
4. Update TypeScript interfaces

### Phase 2: OCR Integration (Week 2-3)
1. Integrate OCR engine (start with Tesseract for open-source)
2. Implement OCRTokenExtractor Lambda
3. Add OCR token visualization in UI
4. Test with Japanese documents

### Phase 3: Export Pipeline (Week 3-4)
1. Implement Parquet export using Apache Arrow
2. Add bounding box normalization
3. Update HuggingFacePublisher Lambda
4. Test streaming with `datasets` library

### Phase 4: PII & Legal (Week 4-5)
1. Implement PII detection
2. Add redaction UI controls
3. Create dataset card template with legal notices
4. Document licensing and compliance

### Phase 5: Testing & Documentation (Week 5-6)
1. Comprehensive testing of new format
2. Update all documentation
3. Create migration guide for existing users
4. Prepare example notebooks for Hugging Face

## 6. Success Metrics

1. **Compatibility**: Dataset can be loaded with `datasets.load_dataset()` without errors
2. **Performance**: Parquet export reduces size by >40% compared to JSON
3. **Accuracy**: OCR token extraction >95% accurate for printed Japanese text
4. **Adoption**: Published datasets get >100 downloads in first month
5. **Compliance**: Zero PII leaks in published datasets

## 7. Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| OCR engine fails on handwritten text | Medium | Set expectations, focus on printed text initially |
| Parquet export performance issues | Low | Optimize batch size, use streaming writes |
| Breaking changes for existing users | High | Provide migration tools, maintain backward compatibility for 6 months |
| PII detection false positives | Medium | Human review before publishing, whitelist common business terms |
| Licensing confusion | Medium | Clear documentation, provide legal FAQ |

## 8. Open Questions

1. **OCR Engine Choice**: Should we use Tesseract (open-source) or Google Vision API (more accurate but paid)?
   - Recommendation: Start with Tesseract, add Google Vision as optional premium feature

2. **PII Detection Scope**: How aggressive should PII redaction be?
   - Recommendation: Conservative approach - only redact clearly sensitive data (full names, phone numbers, email addresses)

3. **Dataset Versioning**: How to handle schema changes across versions?
   - Recommendation: Use semantic versioning, include `dataset_version` field, maintain compatibility for major versions

4. **Japanese Language Support**: Should we support other languages (English, Chinese, Korean)?
   - Recommendation: Start Japanese-first, design schema to be language-agnostic for future expansion

## 9. References

- Mathew et al., "DocVQA: A Dataset for VQA on Document Images", ICDAR 2021
- Huang et al., "ICDAR 2019 Robust Reading Challenge on Scanned Receipts OCR and Information Extraction", ICDAR 2019
- Tanaka et al., "SlideVQA: A Dataset for Document Visual Question Answering on Multiple Images", ACL 2023
- Xu et al., "LayoutLM: Pre-training of Text and Layout for Document Image Understanding", KDD 2020
- Japanese Copyright Act, Article 30-4 (Information Analysis Exception)
- Hugging Face Datasets Documentation: https://huggingface.co/docs/datasets/

## 10. Appendix: Example Export

See `examples/export_format_example.json` for a complete example of the proposed format with Japanese business document.

---

**Next Steps**:
1. Review and approve this proposal
2. Update requirements.md, design.md, and tasks.md
3. Create proof-of-concept Parquet export
4. Validate with sample Japanese documents
5. Begin implementation according to plan
