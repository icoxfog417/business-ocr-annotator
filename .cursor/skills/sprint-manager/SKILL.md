---
name: sprint-manager
description: Enable parallel work by analyzing sprint structure, task dependencies, and project context. Use when starting work on a sprint, coordinating parallel tasks, understanding what can be worked on simultaneously, or checking for conflicts between work units.
---

# Sprint Manager

Enable efficient parallel work through deep project understanding.

## Mission

Help developers and agents work in parallel by:
1. Identifying independent work units
2. Understanding task dependencies
3. Providing project context to avoid conflicts
4. Coordinating changes across the codebase

## Project Structure

```
spec/
├── requirements.md      # User experience & features
├── design.md            # Architecture & component design
├── tasks.md             # Sprint task tracking (source of truth)
├── implementation_qa.md # Technical Q&A from verification
└── proposals/           # Change proposals (yyyyMMdd_name.md)

application/
├── amplify/             # Backend (auth, data, storage, functions)
├── src/
│   ├── components/      # React components
│   ├── pages/           # Page components
│   ├── hooks/           # Custom hooks
│   ├── config/          # Configuration files
│   └── contexts/        # React contexts
└── package.json
```

## Parallel Work Analysis

### Step 1: Identify Current Sprint

Read `spec/tasks.md` and find the active sprint section. Look for:
- Sprint with `⬜` or `🔄` tasks
- Match with current git branch: `feature/sprint{N}-*`

### Step 2: Map Work Units

Each sprint defines parallel units. Extract the dependency graph:

```
Example from Sprint 4:

Phase 1: Foundation (Can run in parallel)
├── Unit A: Data Models          → amplify/data/resource.ts
├── Unit B: Configuration        → src/config/, src/hooks/
└── Unit E: SQS Queue Setup      → amplify/backend.ts

Phase 2: Lambda Functions (Depends on Phase 1)
├── Unit C: Export Lambda        → amplify/functions/export-dataset/
├── Unit D: Evaluation Lambda    → amplify/functions/run-evaluation/
└── Unit F: Trigger Lambda       → amplify/functions/trigger-evaluation/

Phase 3: Frontend UI (Depends on Phase 1)
└── Unit G: Dataset Management   → src/pages/DatasetManagement.tsx
```

### Step 3: Check for Conflicts

Before starting parallel work, verify:

| File/Directory | Safe for Parallel? | Notes |
|----------------|-------------------|-------|
| `amplify/backend.ts` | Coordinate | Central config, merge carefully |
| `amplify/data/resource.ts` | Coordinate | Schema changes need sequencing |
| `src/pages/*.tsx` | Usually safe | Different pages can be parallel |
| `src/components/*` | Usually safe | Different components can be parallel |
| `amplify/functions/*` | Safe | Each function is isolated |
| `src/hooks/*` | Safe | Independent hooks |
| `src/config/*` | Safe | Independent config files |

## Commands

### 1. Start Sprint Work

When beginning sprint work, provide this analysis:

```markdown
## Sprint {N} Parallel Work Plan

### Independent Units (can start immediately)
- Unit A: [description] → [files]
- Unit B: [description] → [files]

### Dependent Units (wait for prerequisites)
- Unit C: Depends on [A, B] → [files]

### Shared Files (coordinate changes)
- amplify/backend.ts - touched by: [Units]
- [other shared files]

### Recommended Parallel Assignments
1. Agent/Dev 1: Unit A + Unit B (no overlap)
2. Agent/Dev 2: Unit E (independent)
```

### 2. Check Parallel Safety

When asked "Can I work on X and Y in parallel?":

1. List files touched by X
2. List files touched by Y
3. Find intersection
4. Report:
   - Safe: No file overlap
   - Coordinate: Shared files exist, merge carefully
   - Sequential: Direct dependency, do X first

### 3. Show Sprint Progress

```markdown
## Sprint {N} Progress

**Completion**: {X}% ({done}/{total} tasks)

### By Unit
| Unit | Progress | Status | Blocker |
|------|----------|--------|---------|
| A    | 2/3      | 🔄     | None    |
| B    | 1/2      | ⬜     | None    |
| C    | 0/5      | ⬜     | Needs A |

### Ready for Parallel Work
- [ ] Unit B: Create useEvaluationModels.ts
- [ ] Unit E: Grant Lambda functions access

### Blocked
- Unit C, D, F: Waiting on Phase 1 completion
```

## Task Status Reference

| Icon | Status | Meaning |
|------|--------|---------|
| ⬜ | TODO | Not started, available for work |
| 🔄 | IN PROGRESS | Someone working on it |
| ✅ | DONE | Completed |
| 🚫 | BLOCKED | Waiting on dependency |
| ⏸️ | ON HOLD | Paused |

## File Ownership by Unit Type

| Unit Type | Typical Files | Parallel Safe |
|-----------|---------------|---------------|
| Data Models | `amplify/data/resource.ts` | One at a time |
| Lambda Functions | `amplify/functions/{name}/` | Yes |
| React Components | `src/components/{name}/` | Yes |
| Pages | `src/pages/{name}.tsx` | Yes |
| Hooks | `src/hooks/{name}.ts` | Yes |
| Config | `src/config/{name}.json` | Yes |
| Backend Config | `amplify/backend.ts` | Coordinate |

## Best Practices

1. **Claim work explicitly**: Mark task as 🔄 before starting
2. **Small PRs**: One unit per PR when possible
3. **Communicate conflicts**: If touching shared files, coordinate
4. **Test in isolation**: Each unit should be testable independently
5. **Update tasks.md**: Keep status current for others to see
