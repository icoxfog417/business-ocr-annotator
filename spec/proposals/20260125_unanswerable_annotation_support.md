# Proposal: Unanswerable Annotation Support ("No Answer" Option)

**Date**: 2026-01-25
**Author**: Claude Agent
**Status**: Proposed

## Background

Not all business documents contain answers to every default question. For example:
- Not every receipt has a 登録番号 (registration number)
- Some invoices lack tax breakdown
- Contracts may not have specific clauses

Currently, annotators must either skip the question or enter placeholder text, which degrades dataset quality. We need a standardized way to mark questions as "unanswerable" for the given document.

## Proposal

Add explicit support for marking annotations as "unanswerable" with:

1. **New field**: `isUnanswerable: boolean` on Annotation model
2. **UI button**: "No Answer" button in annotation flow
3. **Behavior**: When marked unanswerable, answer and bounding box are optional/blank

### Data Model Change

```typescript
// In amplify/data/resource.ts - Annotation model
Annotation: a.model({
  // ... existing fields
  answer: a.string().required(),           // "" when unanswerable
  isUnanswerable: a.boolean().default(false),  // NEW field
  boundingBoxes: a.json(),                 // [] when unanswerable
})
```

### UI Change

In `AnnotationFlow.tsx`, add a "No Answer" button alongside "Skip":

```
┌─────────────────────────────────────────┐
│ Q3 of 5: 登録番号は何ですか?            │
│                                         │
│ [Draw Box]  [📖 Read]  [No Answer]      │
│                                         │
│ Answer: ________________    [Next →]    │
└─────────────────────────────────────────┘
```

When "No Answer" is clicked:
- Set `isUnanswerable = true`
- Set `answer = ""`
- Set `boundingBoxes = []`
- Auto-advance to next question

### Export Handling

On dataset export, unanswerable annotations can be formatted as:
- `answer: ""` with `is_unanswerable: true` (recommended)
- `answer: "N/A"` (for compatibility with some datasets)
- Excluded entirely (optional filter)

## Impact

### Requirements
- Add to REQ-AW section: "Annotators shall mark questions as unanswerable when document lacks the information"

### Design
- Update Annotation interface in design.md with `isUnanswerable` field
- Update export format documentation

### Tasks
- Add tasks to Sprint 3 Unit F (Annotation Flow)

## Alternatives Considered

1. **Use special answer text ("N/A", "該当なし")**: Rejected - ambiguous, language-dependent, could conflict with actual document text
2. **Skip without recording**: Rejected - loses valuable "negative" training data
3. **Separate "unanswerable questions" list**: Rejected - overcomplicates data model

## Implementation Plan

1. Update `amplify/data/resource.ts` - add `isUnanswerable` field
2. Update `AnnotationFlow.tsx` - add "No Answer" button
3. Update `QuestionNavigator.tsx` - show unanswerable status in progress dots
4. Update save logic to handle unanswerable state
5. Test flow: mark as unanswerable → verify saved → verify can edit later

## Acceptance Criteria

- [ ] "No Answer" button visible in annotation flow
- [ ] Clicking "No Answer" saves annotation with `isUnanswerable: true`, empty answer, no boxes
- [ ] Progress dots show unanswerable questions distinctly (e.g., gray checkmark or dash)
- [ ] Unanswerable annotations can be edited later (change to answerable)
- [ ] Export includes `is_unanswerable` field
