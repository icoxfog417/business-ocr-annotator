# Proposal: Test Evaluation Metrics and Prompt Synchronization

**Date**: 2026-01-28
**Author**: Claude Agent
**Status**: Proposed

## Background

Sprint 4 has implemented the core model evaluation pipeline with ANLS and IoU metrics. Before finalizing this release, we need to ensure measurement confidence through:

1. **Unit tests for metrics calculation** - The current implementation has metrics functions embedded directly in the Lambda handler, making them difficult to test in isolation.

2. **Prompt synchronization** - Evaluation prompts (English-only) differ from annotation prompts (multi-language with context-aware rules), which may affect accuracy measurement.

3. **Coordinate validation** - Bounding box coordinates in the dataset need validation to ensure they represent reasonable areas that annotators actually marked.

## Proposal

### 1. Extract and Test Metrics Functions

**Current State:**
- `calculate_anls()`, `calculate_single_anls()`, `levenshtein_distance()`, `calculate_iou()` are embedded in `run-evaluation/handler.py` (lines 401-507)
- No unit tests exist

**Proposed Changes:**
- Extract metrics functions to `amplify/functions/run-evaluation/metrics.py`
- Create comprehensive unit tests in `amplify/functions/run-evaluation/test_metrics.py`
- Test edge cases:
  - Empty strings
  - Identical strings (perfect match)
  - Single character difference
  - Multi-line answers (list items)
  - Various ANLS threshold scenarios
  - Overlapping, non-overlapping, and fully contained bounding boxes
  - Edge case IoU (zero area, invalid coordinates)

**Test Coverage:**
```python
# ANLS tests
- test_anls_exact_match() -> 1.0
- test_anls_empty_strings() -> edge cases
- test_anls_below_threshold() -> 0.0 penalty
- test_anls_single_character_diff() -> high similarity
- test_anls_multiple_ground_truths() -> best match
- test_anls_multi_line_answers() -> list item matching

# IoU tests
- test_iou_perfect_overlap() -> 1.0
- test_iou_no_overlap() -> 0.0
- test_iou_partial_overlap() -> correct calculation
- test_iou_contained_box() -> correct calculation
- test_iou_invalid_format() -> 0.0 fallback
- test_iou_zero_area() -> 0.0 fallback
```

### 2. Multi-Language Evaluation Prompts

**Current State:**
- Annotation prompts (TypeScript `handler.ts`):
  - Multi-language support (ja, en, zh, ko)
  - Context-aware extraction rules (amounts → numbers, dates → yyyy/MM/dd, items → names only)
  - Returns plain text

- Evaluation prompt (Python `handler.py`):
  - English only
  - Generic instruction format
  - Returns JSON with bbox

**Issues:**
- Language mismatch: Japanese questions evaluated with English-only prompt
- Format mismatch: Annotation extracts values without labels; evaluation doesn't specify this
- The model may format answers differently during evaluation vs annotation

**Proposed Changes:**
- Create `amplify/functions/run-evaluation/prompts.py` with multi-language prompt templates
- Align evaluation prompts with annotation prompts:
  - Same extraction rules (amounts → numbers, dates → format, items → names only)
  - Match the language of the question in the dataset
- Add language-aware prompt selection in `invoke_model()`

**Prompt Template Structure:**
```python
EVALUATION_PROMPTS = {
    'ja': """画像を見て質問に答えてください。
回答ルール:
- 「金額」「合計」「税」→ 数字のみ
- 「日付」→ yyyy/MM/dd形式
- 「品目」「商品」→ 商品名のみ（価格・数量除外）
- 「番号」「登録番号」→ 番号のみ
- 複数ある場合 → 1行に1つ

質問: {question}

JSON形式で返答: {{"answer": "回答テキスト", "bbox": [x0, y0, x1, y1]}}
""",
    'en': """...""",
    'zh': """...""",
    'ko': """...""",
}
```

### 3. Coordinate Validation Tests

**Current State:**
- Bounding boxes stored as pixel coordinates in DynamoDB
- Converted to normalized 0-1 range during export (`export-dataset/handler.py` line 403)
- IoU calculation assumes normalized format
- No validation that coordinates represent reasonable areas

**Proposed Changes:**
- Create `amplify/functions/run-evaluation/test_coordinates.py` with:
  - `normalize_bbox()` function extraction for testing
  - Tests for coordinate normalization edge cases
  - Tests for scaling between original and compressed coordinates
  - Validation tests for reasonable bounding box areas

**Test Cases:**
```python
# Normalization tests
- test_normalize_bbox_standard() -> correct 0-1 conversion
- test_normalize_bbox_zero_dimensions() -> fallback to full image
- test_normalize_bbox_out_of_bounds() -> clamping to 0-1

# Scaling tests
- test_scale_bbox_same_dimensions() -> no change
- test_scale_bbox_different_dimensions() -> proportional scaling

# Validation tests
- test_bbox_reasonable_size() -> not too small (>1% of image)
- test_bbox_not_full_image() -> not default [0,0,1,1]
- test_bbox_valid_format() -> [x0, y0, x1, y1] where x0 < x1 and y0 < y1
```

## Impact

### Requirements (no changes)
The requirements remain the same; this proposal improves implementation quality.

### Design (updates)
- `spec/design.md`: Add section on metrics testing strategy
- Document prompt synchronization approach

### Tasks (new tasks)
Add to Sprint 4 Phase 4 (Testing):
- [x] Extract metrics to separate module
- [x] Create unit tests for ANLS calculation
- [x] Create unit tests for IoU calculation
- [x] Add multi-language evaluation prompts
- [x] Create coordinate validation tests
- [x] Test ANLS matches manual calculation
- [x] Test IoU matches manual calculation

## Alternatives Considered

### 1. Test metrics inline without extraction
**Pros**: Less code change
**Cons**: Difficult to import and test in isolation; clutters handler file
**Decision**: Extract for clean separation of concerns

### 2. Keep English-only evaluation prompt
**Pros**: Simpler implementation
**Cons**: May not accurately measure model performance on non-English documents
**Decision**: Add multi-language support for accurate evaluation

### 3. Visual coordinate testing with actual images
**Pros**: Can visually verify bounding boxes
**Cons**: Requires test images and manual verification; adds complexity
**Decision**: Start with unit tests; visual testing can be added later

## Implementation Plan

1. **Phase 1: Metrics Extraction and Testing** (This PR)
   - Extract metrics functions to `metrics.py`
   - Create `test_metrics.py` with comprehensive test cases
   - Run tests locally with pytest

2. **Phase 2: Prompt Synchronization**
   - Create `prompts.py` with multi-language templates
   - Update `invoke_model()` to use language-aware prompts
   - Test with sample dataset

3. **Phase 3: Coordinate Testing**
   - Extract `normalize_bbox()` to metrics module
   - Add coordinate validation tests
   - Add integration test with sample data

## Testing Strategy

```bash
# Run tests locally
cd application/amplify/functions/run-evaluation
pip install pytest
pytest test_metrics.py -v

# Run with coverage
pytest test_metrics.py --cov=metrics --cov-report=term-missing
```

## Success Criteria

- [ ] All unit tests pass
- [ ] Code coverage > 90% for metrics module
- [ ] ANLS calculation verified against known test cases
- [ ] IoU calculation verified against known test cases
- [ ] Multi-language prompts work for ja, en, zh, ko
- [ ] Coordinate normalization tested with edge cases

---

**Related Files:**
- `amplify/functions/run-evaluation/handler.py` - Main evaluation handler
- `amplify/functions/generate-annotation/handler.ts` - Annotation prompts (reference)
- `amplify/functions/export-dataset/handler.py` - Coordinate normalization (reference)
