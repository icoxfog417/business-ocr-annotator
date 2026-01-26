---
name: unit-kickoff
description: Generate context and setup for starting work on any sprint unit. Use when the user says "start Unit X", "kick off", "begin work on", "set up for", or wants to quickly onboard to a specific task.
---

# Unit Kickoff

Quickly onboard to any work unit with full context.

## Usage

When user says "Start Unit X" or similar:

1. Find the unit in `spec/tasks.md`
2. Extract tasks, files, and dependencies
3. Generate kickoff briefing

## Kickoff Briefing Template

```markdown
## Unit {X}: {Title}

### Context
- **Sprint**: {N}
- **Phase**: {Phase name}
- **Dependencies**: {Units that must complete first, or "None"}

### Tasks
- [ ] Task 1
- [ ] Task 2

### Files to Create/Modify
| File | Action | Notes |
|------|--------|-------|
| path/to/file | Create/Modify | Description |

### Related Resources
- Proposal: `spec/proposals/{related}.md`
- Pattern reference: `amplify/functions/{similar}/`

### Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

### Quick Start
1. First command or action
2. Second step
```

## Unit Type Mapping

### Lambda Functions (Units C, D, F in Sprint 4)

**Files to create**:
```
amplify/functions/{function-name}/
├── resource.ts    # defineFunction() config
├── handler.ts     # Lambda implementation
└── package.json   # Function dependencies
```

**Pattern reference**: `amplify/functions/process-image/`

**Backend integration**: Add to `amplify/backend.ts`:
```typescript
import { myFunction } from './functions/my-function/resource';

const backend = defineBackend({
  // ... existing
  myFunction,
});
```

### React Components

**Files to create**:
```
src/components/{component-name}/
├── {ComponentName}.tsx
├── index.ts       # Re-export
└── {ComponentName}.css (if needed)
```

**Pattern reference**: `src/components/annotation/`

### React Hooks

**Files to create**:
```
src/hooks/use{HookName}.ts
```

**Pattern reference**: `src/hooks/useDefaultQuestions.ts`

### Configuration Files

**Location**: `src/config/{name}.json`

**Pattern reference**: `src/config/defaultQuestions.json`

### Pages

**Files to create**:
```
src/pages/{PageName}.tsx
src/pages/{PageName}.css (if needed)
```

**Add route in** `src/App.tsx`

## Sprint 4 Quick Reference

### Phase 1: Foundation
| Unit | Type | Files |
|------|------|-------|
| A | Data Models | `amplify/data/resource.ts` |
| B | Config + Hook | `src/config/evaluation-models.json`, `src/hooks/useEvaluationModels.ts` |
| E | Backend | `amplify/backend.ts` |

### Phase 2: Lambda Functions
| Unit | Type | Files |
|------|------|-------|
| C | Lambda (Python) | `amplify/functions/export-dataset/` |
| D | Lambda (Python) | `amplify/functions/run-evaluation/` |
| F | Lambda (Node.js) | `amplify/functions/trigger-evaluation/` |

### Phase 3: Frontend
| Unit | Type | Files |
|------|------|-------|
| G | Page | `src/pages/DatasetManagement.tsx` |

## Dependencies Quick Check

Before starting, verify dependencies are complete:

```bash
# Check current sprint progress
git log --oneline -5

# Check tasks.md for unit status
grep -A 20 "Unit {X}" spec/tasks.md
```

## After Completion

1. Mark tasks as done in `spec/tasks.md` (change `⬜` to `✅`)
2. Update "Last Updated" date
3. Create PR if feature is complete
