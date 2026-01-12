# Proposal: Align Desktop UX with Mobile Annotation Flow

**Date**: 2026-01-12
**Author**: Claude Agent
**Status**: Proposed

## Background

The mobile annotation flow (`AnnotationFlow` component) implements the streamlined UX designed in Sprint 3:
- Question-by-question navigation
- Box-first workflow (draw box → read/type answer)
- [📖 Read] button for AI text extraction
- Progress dots showing completion status
- Finalize screen with summary

However, the desktop annotation workspace (`AnnotationWorkspace.tsx`) still uses the legacy UX:
- Free-form question creation during annotation
- Answer-first workflow (type answer → draw box)
- No question navigation
- Multiple unused status filters and controls
- Does not load default questions from Image metadata

## Current Issues

### 1. Desktop Does Not Load Default Questions
When navigating from Gallery to annotation (without going through Upload), the desktop workspace:
- Does not receive `questions` from location state
- Falls back to inline `getFallbackQuestions()` which only provides 3 generic questions
- Does not use the comprehensive `defaultQuestions.json` config

### 2. Desktop Allows Question Creation During Annotation
The Sprint 3 design specifies:
> "No question management here! Just focus on answering."

But desktop still has:
- "Add Manual Annotation" form with question input
- Ability to create new questions mid-flow
- No structured question-by-question navigation

### 3. Box-First Workflow Not Implemented on Desktop
Mobile flow: Draw box → Click [Read] → AI fills answer
Desktop flow: Type question → Type answer → Draw box → Save

### 4. Unused UI Elements on Desktop
- Status filter dropdown (ALL/PENDING/APPROVED/REJECTED)
- Status summary badges (Pending: X, Approved: Y, Rejected: Z)
- AI Suggestions panel (legacy from Sprint 2)
- Validation status per annotation

These are validation workflow elements that should be in a separate review screen, not the annotation screen.

## Proposed Solution

### Unify Desktop and Mobile to Use `AnnotationFlow`

Replace the desktop-specific rendering in `AnnotationWorkspace.tsx` with `AnnotationFlow` for all devices.

```
BEFORE:
┌─────────────────────────────────────────────────────────────┐
│ if (useMobileFlow) {                                        │
│   return <AnnotationFlow ... />  // Mobile only             │
│ }                                                           │
│ return <DesktopLegacyUI ... />   // Desktop legacy          │
└─────────────────────────────────────────────────────────────┘

AFTER:
┌─────────────────────────────────────────────────────────────┐
│ // Always use AnnotationFlow for both desktop and mobile    │
│ return <AnnotationFlow ... />                               │
└─────────────────────────────────────────────────────────────┘
```

### Changes Required

#### 1. Remove `useMobileFlow` Conditional
- Delete the `isMobileDevice` and `useMobileFlow` logic
- Always render `AnnotationFlow` component

#### 2. Load Default Questions from Config
When no questions are passed via location state:
```typescript
// Use useDefaultQuestions hook
const { defaultQuestions, optionalQuestions } = useDefaultQuestions(
  image?.documentType || 'OTHER',
  image?.language || 'ja'
);

// Convert to SelectedQuestion format
const questions = defaultQuestions.map(q => ({
  id: q.id,
  text: q.text,
  type: q.type,
  isCustom: false
}));
```

#### 3. Remove Legacy Desktop UI Code
Delete from `AnnotationWorkspace.tsx`:
- Status filter dropdown and state
- Status summary badges
- AI Suggestions panel
- "Add Manual Annotation" form
- Legacy annotation list with validation controls
- `statusCounts` calculation
- `filteredAnnotations` logic

#### 4. Adapt `AnnotationFlow` for Desktop Layout
The `AnnotationFlow` component should be responsive:
- Mobile: Stacked layout (image above, controls below)
- Desktop: Side-by-side layout (image left, controls right)

```typescript
// In AnnotationFlow.tsx
const { isMobile } = useBreakpoint();

return (
  <div style={{ 
    display: 'flex', 
    flexDirection: isMobile ? 'column' : 'row',
    height: '100%' 
  }}>
    {/* Canvas area */}
    <div style={{ flex: isMobile ? 'none' : 1 }}>
      <TouchCanvas ... />
    </div>
    
    {/* Controls area */}
    <div style={{ 
      width: isMobile ? '100%' : '400px',
      padding: 16 
    }}>
      {/* Question, answer input, navigation */}
    </div>
  </div>
);
```

#### 5. Keep Keyboard Shortcuts for Desktop
Add keyboard navigation in `AnnotationFlow`:
- `→` or `Enter`: Next question
- `←`: Previous question
- `D`: Toggle draw mode
- `R`: Trigger Read button
- `S`: Skip question
- `Esc`: Cancel draw mode

## Impact

### Requirements
No changes - this aligns implementation with existing Sprint 3 requirements.

### Design
No changes - this implements the design already specified.

### Tasks
Update Sprint 3 tasks:
- Mark "Update `src/pages/AnnotationWorkspace.tsx`" as complete after implementation
- Add new task: "Remove legacy desktop annotation UI"

## Implementation Plan

### Phase 1: Simplify AnnotationWorkspace (30 min)
1. Remove `useMobileFlow` conditional
2. Remove legacy desktop UI code
3. Always render `AnnotationFlow`

### Phase 2: Load Default Questions (15 min)
1. Import `useDefaultQuestions` hook
2. Load questions when not passed via state
3. Handle existing annotations case

### Phase 3: Desktop Layout in AnnotationFlow (30 min)
1. Add responsive layout logic
2. Adjust canvas and controls sizing
3. Test on desktop viewport

### Phase 4: Keyboard Shortcuts (20 min)
1. Add `useKeyboardShortcuts` hook usage
2. Implement shortcut handlers
3. Show shortcut hints on desktop

### Phase 5: Cleanup (15 min)
1. Remove unused imports
2. Remove unused state variables
3. Test full flow on both devices

## Alternatives Considered

### 1. Keep Separate Desktop and Mobile UIs
**Rejected**: Duplicates code, harder to maintain, inconsistent UX.

### 2. Create New Unified Component
**Rejected**: `AnnotationFlow` already implements the correct UX, just needs minor adaptations.

### 3. Add Desktop Features to Mobile Flow
**Rejected**: The mobile flow is the correct design. Desktop should adopt it, not the other way around.

## Testing Checklist

- [ ] Desktop: Navigate from Gallery → Annotation loads default questions
- [ ] Desktop: Question-by-question flow works
- [ ] Desktop: Draw box → Read → Answer fills correctly
- [ ] Desktop: Progress dots update correctly
- [ ] Desktop: Finalize screen shows summary
- [ ] Desktop: Keyboard shortcuts work
- [ ] Mobile: Existing flow still works
- [ ] Both: Existing annotations load correctly when editing
