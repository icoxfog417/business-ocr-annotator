# Proposal: Fix Mobile Annotation Flow Issues

**Date**: 2026-01-12
**Author**: Claude Agent
**Status**: Proposed

## Background

The mobile annotation screen has two critical bugs:
1. Cannot render existing annotations when editing
2. Cannot draw bounding box region for second question

## Root Cause Analysis

### Issue 1: Existing Annotations Not Rendering

**Problem**: Type mismatch between bounding box formats.

- `TouchCanvas.BoundingBox` expects: `{x, y, width, height}` (object format)
- Database stores: `[[x0, y0, x1, y1], ...]` (HuggingFace array format)
- `types/index.ts BoundingBox` is: `[x0, y0, x1, y1]` (array format)

In `AnnotationFlow.tsx`, when initializing answers from existing annotations:
```typescript
const boxes = typeof existing.boundingBoxes === 'string' 
  ? JSON.parse(existing.boundingBoxes)
  : existing.boundingBoxes;

if (boxes && boxes.length > 0) {
  const [x0, y0, x1, y1] = boxes[0];  // Correctly destructures array
  boundingBox = {
    x: x0,
    y: y0,
    width: x1 - x0,
    height: y1 - y0
  };
}
```

This conversion looks correct, but the issue is that `existing.boundingBoxes` from the GraphQL response may already be parsed or have a different structure.

### Issue 2: Cannot Draw Box for Second Question

**Problem**: State management flow issue.

The flow when navigating questions:
1. User draws box for Q1 → `handleBoxCreated` called → `updateCurrentAnswer` updates `answers[0]`
2. User clicks Next → `goToQuestion(1)` called
3. `goToQuestion` sets `mode = 'view'` and `currentIndex = 1`
4. `currentAnswer` now points to `answers[1]` which has no box
5. `currentBoxes = currentAnswer?.boundingBox ? [currentAnswer.boundingBox] : []` = `[]`
6. User clicks "Select Area" button → `toggleMode()` → mode becomes 'draw'
7. User draws box → `handleBoxCreated` should be called

The issue is in the `DrawBoxButton` onClick handler:
```typescript
onClick={() => {
  if (currentAnswer?.boundingBox) {
    // Clear existing box and allow redraw
    updateCurrentAnswer({ boundingBox: null });  // This clears Q2's box (which is already null)
  }
  toggleMode();
}}
```

This is not the bug. Let me trace further...

Actually, the real issue is that `handleBoxCreated` in `AnnotationFlow` calls `updateCurrentAnswer` which uses `currentIndex` from closure. If `currentIndex` is stale, it updates the wrong question.

## Proposed Solution

### Fix 1: Ensure Bounding Box Format Consistency

Create a utility function to normalize bounding box format and use it consistently:

```typescript
// In AnnotationFlow.tsx
function normalizeBoundingBox(boxes: any): BoundingBox | null {
  if (!boxes) return null;
  
  // Parse if string
  const parsed = typeof boxes === 'string' ? JSON.parse(boxes) : boxes;
  
  // Handle array of arrays format [[x0, y0, x1, y1]]
  if (Array.isArray(parsed) && parsed.length > 0) {
    const first = parsed[0];
    if (Array.isArray(first) && first.length === 4) {
      const [x0, y0, x1, y1] = first;
      return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
    }
    // Handle single array format [x0, y0, x1, y1]
    if (typeof first === 'number' && parsed.length === 4) {
      const [x0, y0, x1, y1] = parsed;
      return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
    }
  }
  
  // Already in object format
  if (parsed && typeof parsed.x === 'number') {
    return parsed;
  }
  
  return null;
}
```

### Fix 2: Fix State Update for Multi-Question Flow

The `updateCurrentAnswer` callback captures `currentIndex` in its closure. When questions change rapidly, this can cause stale updates.

Solution: Use functional update pattern with explicit index:

```typescript
const updateAnswer = useCallback(
  (index: number, updates: Partial<AnnotationAnswer>) => {
    setAnswers((prev) =>
      prev.map((a, i) => (i === index ? { ...a, ...updates } : a))
    );
  },
  []
);

// Then in handleBoxCreated:
const handleBoxCreated = useCallback(
  (box: BoundingBox) => {
    updateAnswer(currentIndex, { boundingBox: box });
  },
  [currentIndex, updateAnswer]
);
```

### Fix 3: Debug Logging Cleanup

Remove debug overlays and excessive console.logs after fixing.

## Impact

- **Requirements**: No changes
- **Design**: No changes  
- **Tasks**: Update Sprint 3 Unit F status

## Implementation Plan

1. Add `normalizeBoundingBox` utility function
2. Update `AnnotationFlow` initialization to use normalizer
3. Fix `updateCurrentAnswer` to use explicit index
4. Test with existing annotations
5. Test multi-question flow
6. Remove debug code

## Alternatives Considered

1. **Unify BoundingBox type globally**: Would require changes to many files and the database schema. Too invasive.

2. **Convert at API layer**: Could add conversion in GraphQL resolvers, but this adds complexity and the frontend should handle display formats.

## Testing

1. Load image with existing annotations → boxes should render
2. Draw box for Q1 → Next → Draw box for Q2 → both should be saved
3. Navigate back to Q1 → box should still be visible
4. Complete flow and verify all annotations saved correctly
