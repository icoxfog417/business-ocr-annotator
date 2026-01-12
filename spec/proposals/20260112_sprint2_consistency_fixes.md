# Proposal: Sprint 2 Consistency Fixes

**Date**: 2026-01-12
**Author**: Claude Agent
**Status**: Implemented

## Background

Sprint 2 implementation introduced design changes that caused inconsistencies between documentation and implementation. Additionally, code analysis revealed duplicate and redundant code patterns that should be consolidated before Sprint 3. This proposal outlines a comprehensive fix plan.

## Issues Summary

| Priority | Category | Count |
|----------|----------|-------|
| P0 - Critical | Code bugs | 1 |
| P1 - High | Code duplication | 4 |
| P2 - Medium | Doc/Code mismatch | 3 |
| P3 - Medium | Code quality | 4 |
| P4 - Low | Documentation cleanup | 2 |

---

## Fix Plan

### Phase 1: Code Fixes (P0)

#### 1.1 Remove Duplicate Null Check
**File**: `src/pages/AnnotationWorkspace.tsx`
**Issue**: Duplicate `if (!image)` check at lines ~430 and ~440
**Action**: Remove second duplicate check

```typescript
// REMOVE this duplicate block (around line 440):
if (!image) {
  return <div style={{ padding: '2rem' }}>Image not found</div>;
}
```

**Effort**: 5 minutes

---

### Phase 1.5: Code Duplication Consolidation (P1)

#### 1.5.1 Create Shared API Client
**Issue**: Amplify client initialized separately in 4 pages
**Files affected**:
- `src/pages/Dashboard.tsx` (line 7)
- `src/pages/FileUpload.tsx` (line 7)
- `src/pages/ImageGallery.tsx` (line 7)
- `src/pages/AnnotationWorkspace.tsx` (line 15)

**Action**: Create shared client utility

**New file**: `src/lib/apiClient.ts`
```typescript
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

export const client = generateClient<Schema>();
```

**Impact**:
- Eliminates 4 duplicate client instantiations
- Single source of truth for API client configuration
- Easier to add middleware or interceptors globally

**Effort**: 15 minutes

#### 1.5.2 Consolidate Language Constants
**Issue**: LANGUAGES constant duplicated with slight inconsistencies
**Files affected**:
- `src/pages/FileUpload.tsx` (lines 9-14) - includes English translations
- `src/pages/AnnotationWorkspace.tsx` (lines 42-47) - native labels only

**Current inconsistency**:
```typescript
// FileUpload.tsx
{ code: 'ja', label: '日本語 (Japanese)' }

// AnnotationWorkspace.tsx
{ code: 'ja', label: '日本語' }
```

**Action**: Create shared constants file

**New file**: `src/lib/constants.ts`
```typescript
export const LANGUAGES = [
  { code: 'ja', label: '日本語 (Japanese)' },
  { code: 'en', label: 'English' },
  { code: 'zh', label: '中文 (Chinese)' },
  { code: 'ko', label: '한국어 (Korean)' },
] as const;

export const DOCUMENT_TYPES = [
  { code: 'RECEIPT', label: 'Receipt' },
  { code: 'INVOICE', label: 'Invoice' },
  { code: 'ORDER_FORM', label: 'Order Form' },
  { code: 'TAX_FORM', label: 'Tax Form' },
  { code: 'CONTRACT', label: 'Contract' },
  { code: 'APPLICATION_FORM', label: 'Application Form' },
  { code: 'OTHER', label: 'Other' },
] as const;

export type LanguageCode = typeof LANGUAGES[number]['code'];
export type DocumentTypeCode = typeof DOCUMENT_TYPES[number]['code'];
```

**Impact**:
- Eliminates duplicate constant definitions
- Consistent language labels across all pages
- Type-safe document type handling

**Effort**: 15 minutes

#### 1.5.3 Consolidate CSS Animations
**Issue**: Duplicate @keyframes spin definition
**Files affected**:
- `src/pages/ImageGallery.tsx` (lines 298-301)
- `src/pages/AnnotationWorkspace.tsx` (lines 1143-1146)

**Current duplication**:
```typescript
<style>{`
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`}</style>
```

**Action**: Move to global CSS

**New file**: `src/styles/animations.css`
```css
@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```

**Update**: `src/main.tsx`
```typescript
import './styles/animations.css';
```

**Impact**:
- Removes duplicate inline styles
- Single location for animation definitions
- Easier to maintain and extend

**Effort**: 10 minutes

#### 1.5.4 Create Status Styles Utility
**Issue**: Status badge styling logic duplicated with different status orders
**Files affected**:
- `src/pages/ImageGallery.tsx` (lines 244-254)
- `src/pages/AnnotationWorkspace.tsx` (lines 654-671)

**Current inconsistency**:
```typescript
// ImageGallery - status order: PROCESSING, UPLOADED, ANNOTATING
backgroundColor:
  image.status === 'PROCESSING' ? '#fef3c7' :
  image.status === 'UPLOADED' ? '#d1fae5' : ...

// AnnotationWorkspace - status order: VALIDATED, PROCESSING, ANNOTATING
backgroundColor:
  image.status === 'VALIDATED' ? '#d1fae5' :
  image.status === 'PROCESSING' ? '#dbeafe' : ...
```

**Action**: Create shared status styles utility

**New file**: `src/lib/statusStyles.ts`
```typescript
export type ImageStatus = 'UPLOADED' | 'PROCESSING' | 'ANNOTATING' | 'VALIDATED';

export interface StatusStyle {
  backgroundColor: string;
  color: string;
}

export const getStatusStyle = (status?: string): StatusStyle => {
  switch (status) {
    case 'PROCESSING':
      return { backgroundColor: '#fef3c7', color: '#92400e' };
    case 'UPLOADED':
      return { backgroundColor: '#d1fae5', color: '#065f46' };
    case 'ANNOTATING':
      return { backgroundColor: '#dbeafe', color: '#1e40af' };
    case 'VALIDATED':
      return { backgroundColor: '#d1fae5', color: '#065f46' };
    default:
      return { backgroundColor: '#f3f4f6', color: '#374151' };
  }
};

export const getProcessingOpacity = (status?: string): number => {
  return status === 'PROCESSING' ? 0.6 : 1;
};
```

**Impact**:
- Consistent status colors across all pages
- Single source of truth for status styling
- Easier to add new statuses

**Effort**: 15 minutes

---

### Phase 2: Documentation Updates (P2)

#### 2.1 Update design.md - Remove Unimplemented GSIs
**File**: `spec/design.md`
**Actions**:

1. Remove FLAGGED from ValidationStatus enum (not needed)
2. Keep Dataset model (needed for Sprint 3)
3. Mark User model as "Future Enhancement"
4. Remove unimplemented GSIs from Image table comments
5. Update "Last Updated" date

**Changes**:

```markdown
#### ValidationStatus enum
// Remove FLAGGED - keep only: PENDING, APPROVED, REJECTED

#### User Table
> **Status**: Future Enhancement - Currently using Cognito directly

#### Image Table - Secondary Indexes
// Keep only:
// - imagesByS3KeyOriginal: Query images by s3KeyOriginal (implemented)
// Remove these unimplemented GSIs:
// - imagesByUploader
// - imagesByStatus
// - imagesByDocumentType
// - imagesByDataset
```

**Effort**: 15 minutes

#### 2.2 Update tasks.md - Correct Sprint 2 Status
**File**: `spec/tasks.md`
**Actions**:

1. Mark "Test model inference with sample images" as ⬜ TODO (not done)
2. Add note that DefaultQuestionManager uses fallback implementation
3. Update "Current Sprint" to Sprint 3

**Effort**: 10 minutes

---

### Phase 3: Code Quality Improvements (P3)

> **Note**: Status color consolidation is now handled in Phase 1.5.4 (Create Status Styles Utility)

#### 3.1 Remove Orphaned Comment
**File**: `src/pages/AnnotationWorkspace.tsx`
**Issue**: Comment about "Re-open annotations" without implementation
**Action**: Remove comment or add TODO marker

```typescript
// Remove or change to:
// TODO: Re-open annotations functionality (mark image as ANNOTATING)
```

**Effort**: 2 minutes

---

### Phase 4: Review Document Updates (P4)

#### 4.1 Mark Resolved Issues in Review Documents
**Files**: 
- `spec/proposals/20260111_sprint2_annotation_support_review.md`
- `spec/proposals/20260111_sprint2_compression_review.md`

**Action**: Add resolution status to P0 issues

```markdown
### 1. Missing API Endpoint Configuration - ~~BLOCKER~~ RESOLVED
**Resolution**: Implemented as GraphQL custom query instead of REST endpoint
**Date Fixed**: 2026-01-11
```

**Effort**: 10 minutes

#### 4.2 Document Per-User Tracking Gap
**File**: `spec/tasks.md`
**Action**: Add note in backlog

```markdown
### Deferred from Sprint 2
- ⬜ Per-user contribution tracking (REQ-AW-013, REQ-AW-014)
  - Requires User model implementation
  - Currently shows global stats only
```

**Effort**: 5 minutes

---

## Implementation Order

### Phase 1: Critical Bug Fix (P0)
| Step | Task | File(s) | Effort |
|------|------|---------|--------|
| 1 | Remove duplicate null check | AnnotationWorkspace.tsx | 5 min |

### Phase 1.5: Code Consolidation (P1)
| Step | Task | File(s) | Effort |
|------|------|---------|--------|
| 2 | Create lib directory | src/lib/ | 1 min |
| 3 | Create shared API client | src/lib/apiClient.ts | 5 min |
| 4 | Create shared constants | src/lib/constants.ts | 5 min |
| 5 | Create status styles utility | src/lib/statusStyles.ts | 5 min |
| 6 | Create global animations CSS | src/styles/animations.css | 5 min |
| 7 | Update Dashboard.tsx | Dashboard.tsx | 5 min |
| 8 | Update FileUpload.tsx | FileUpload.tsx | 10 min |
| 9 | Update ImageGallery.tsx | ImageGallery.tsx | 10 min |
| 10 | Update AnnotationWorkspace.tsx | AnnotationWorkspace.tsx | 15 min |
| 11 | Update main.tsx for animations | main.tsx | 2 min |

### Phase 2: Documentation Updates (P2)
| Step | Task | File(s) | Effort |
|------|------|---------|--------|
| 12 | Update design.md | design.md | 15 min |
| 13 | Update tasks.md | tasks.md | 10 min |

### Phase 3: Code Quality (P3)
| Step | Task | File(s) | Effort |
|------|------|---------|--------|
| 14 | Remove orphaned comment | AnnotationWorkspace.tsx | 2 min |

### Phase 4: Documentation Cleanup (P4)
| Step | Task | File(s) | Effort |
|------|------|---------|--------|
| 15 | Update review documents | proposals/*.md | 10 min |

**Total Estimated Effort**: ~105 minutes (~1.75 hours)

---

## Acceptance Criteria

### P0 - Critical
- [x] No duplicate null check in AnnotationWorkspace.tsx

### P1 - Code Consolidation
- [x] Shared API client in `src/lib/apiClient.ts`
- [x] Shared constants in `src/lib/constants.ts` (LANGUAGES, DOCUMENT_TYPES)
- [x] Shared status styles in `src/lib/statusStyles.ts`
- [x] Global animations CSS in `src/styles/animations.css`
- [x] All 4 pages updated to use shared utilities
- [x] No duplicate `generateClient<Schema>()` calls
- [x] No duplicate LANGUAGES constant definitions
- [x] No inline @keyframes definitions

### P2 - Documentation
- [ ] design.md removes unimplemented GSIs and FLAGGED status
- [ ] design.md keeps Dataset model for Sprint 3
- [ ] tasks.md reflects actual completion status

### P3 - Code Quality
- [x] Consistent status colors across all pages
- [x] No orphaned comments

### P4 - Cleanup
- [ ] Review documents show resolution status

### Verification
- [x] Application builds without errors (`npm run build`)
- [ ] Application runs without errors (`npm run dev`)
- [ ] All pages load correctly (Dashboard, FileUpload, ImageGallery, AnnotationWorkspace)

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Import path errors after consolidation | Verify TypeScript compilation passes |
| Status color changes affect UI consistency | Test all pages after changes |
| Documentation changes miss items | Review diff before commit |
| Breaking changes in shared utilities | Test each page after updates |

---

## Notes

- No schema changes required
- Creates new `src/lib/` directory for shared utilities
- Creates new `src/styles/` directory for global CSS
- Documentation changes don't affect runtime behavior
- Can be completed in single PR

## Expected Benefits

- **Code Reduction**: ~100-150 lines of duplicate code eliminated
- **Maintainability**: Single source of truth for constants, colors, and patterns
- **Consistency**: Unified styling and behavior across all pages
- **Type Safety**: Shared types prevent mismatches
- **Future-Proofing**: Easy to add new languages, document types, or statuses
