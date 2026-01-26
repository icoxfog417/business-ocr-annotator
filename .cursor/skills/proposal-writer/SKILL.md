---
name: proposal-writer
description: Create properly formatted proposal documents in spec/proposals/. Use when making significant changes to requirements, design, or tasks. Triggers on "create proposal", "document change", "propose feature", or when changes need formal documentation.
---

# Proposal Writer

Create change proposals following project conventions.

## When to Create a Proposal

**Required for**:
- New features
- Architecture changes
- Significant design decisions
- Changes to `spec/requirements.md`, `spec/design.md`, or `spec/tasks.md`

**Not needed for**:
- Bug fixes (unless design changes)
- Minor improvements
- Documentation updates

## Proposal Location & Naming

```
spec/proposals/yyyyMMdd_{proposal_name}.md
```

**Examples**:
- `20260126_add_export_feature.md`
- `20260126_improve_performance.md`

Use snake_case, descriptive but concise names.

## Proposal Template

```markdown
# Proposal: {Title}

**Date**: YYYY-MM-DD
**Author**: {Name or "Claude Agent"}
**Status**: Proposed

## Background

{Why this change is needed. 2-3 sentences.}

## Current Behavior

{What happens now. Include code snippets if relevant.}

## Proposal

{Detailed description of the proposed changes.}

### {Sub-section if needed}

{Details, code examples, diagrams.}

## Impact

- **Requirements**: {What changes in requirements.md, or "No change"}
- **Design**: {What changes in design.md, or "No change"}
- **Tasks**: {What new tasks will be added to tasks.md}

## Alternatives Considered

1. **{Alternative 1}**: {Why not chosen}
2. **{Alternative 2}**: {Why not chosen}

## Implementation Plan

1. Step 1
2. Step 2
3. Step 3

## Testing Plan

{How to verify the changes work correctly.}

- Test case 1
- Test case 2
```

## Status Values

| Status | Meaning |
|--------|---------|
| Proposed | Initial draft, awaiting review |
| Approved | Accepted, ready for implementation |
| Implemented | Changes have been made |
| Rejected | Not accepted (keep for record) |

## After Creating Proposal

1. **Update spec files** as described in Impact section:
   - `spec/requirements.md` - Add new requirements
   - `spec/design.md` - Add architecture changes
   - `spec/tasks.md` - Add implementation tasks

2. **Reference in commits**:
   ```
   feat: Add export feature
   
   See spec/proposals/20260126_add_export_feature.md for details.
   ```

3. **Update proposal status** after implementation

## Example: Simple Feature Proposal

```markdown
# Proposal: Add Dark Mode Support

**Date**: 2026-01-26
**Author**: Claude Agent
**Status**: Proposed

## Background

Users have requested dark mode for better viewing in low-light conditions.

## Current Behavior

App only supports light theme. Colors are hardcoded in CSS.

## Proposal

Add theme toggle in settings with system preference detection.

### Implementation

1. Create CSS variables for theme colors
2. Add ThemeContext for state management
3. Add toggle in Settings page
4. Persist preference in localStorage

## Impact

- **Requirements**: Add REQ-UI-015 "Support dark mode"
- **Design**: Add theme system to design.md
- **Tasks**: Add Sprint 5 tasks for implementation

## Alternatives Considered

1. **CSS-only with prefers-color-scheme**: Less control, no user override
2. **Third-party library**: Overkill for this use case

## Implementation Plan

1. Create theme CSS variables
2. Add ThemeContext
3. Add Settings toggle
4. Test on all pages

## Testing Plan

- Toggle works in Settings
- System preference detected on first load
- Preference persists across sessions
- All pages render correctly in both themes
```

## Quick Commands

```bash
# Create new proposal file
touch spec/proposals/$(date +%Y%m%d)_proposal_name.md

# List recent proposals
ls -la spec/proposals/ | tail -10

# Check proposal status
grep "Status:" spec/proposals/*.md
```

## Linking Proposals in tasks.md

When adding tasks, link to the proposal:

```markdown
### Feature Name
**Proposal**: See [spec/proposals/20260126_feature_name.md](proposals/20260126_feature_name.md)

- ⬜ Task 1
- ⬜ Task 2
```
