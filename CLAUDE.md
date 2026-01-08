# Claude Agent Workflow Guidelines

This document outlines the workflow and rules for AI-assisted development on the Business OCR Annotator project.

## Project Overview

This project creates a Visual dialogue dataset platform for evaluating OCR accuracy of generative AI models in business scenarios. It uses AWS Amplify Gen2 for infrastructure and integrates with Hugging Face for dataset management.

## Specification Management

### Directory Structure

All project specifications are maintained in the `spec/` directory:

```
spec/
├── requirements.md    # User experience and necessary features
├── design.md         # Architecture and component design
├── tasks.md          # Implementation task list (todo tracking)
└── proposals/        # Design proposal documents
    └── yyyyMMdd_{proposal_name}.md
```

### Specification Files

#### requirements.md
- Defines user experience flows
- Lists all necessary features
- Describes user personas and use cases
- Outlines functional and non-functional requirements

#### design.md
- Documents system architecture
- Describes component design and interactions
- Defines data models and schemas
- Specifies API contracts and interfaces
- Includes technical decisions and rationale

#### tasks.md
- Maintains implementation task list
- Tracks progress on features and bug fixes
- Organizes tasks by priority and dependencies
- Records completion status

### Change Management Process

**IMPORTANT**: When making changes to `requirements.md`, `design.md`, or `tasks.md`, you MUST follow this process:

1. **Create a Proposal Document**
   - Location: `spec/proposals/`
   - Naming convention: `yyyyMMdd_{your_proposal_name}.md`
   - Example: `20260104_add_batch_upload_feature.md`

2. **Proposal Document Structure**
   ```markdown
   # Proposal: [Title]

   **Date**: YYYY-MM-DD
   **Author**: [Name or "Claude Agent"]
   **Status**: [Proposed/Approved/Implemented/Rejected]

   ## Background
   [Why this change is needed]

   ## Proposal
   [Detailed description of the proposed changes]

   ## Impact
   - Requirements: [What changes in requirements.md]
   - Design: [What changes in design.md]
   - Tasks: [What new tasks will be added to tasks.md]

   ## Alternatives Considered
   [Other approaches and why they were not chosen]

   ## Implementation Plan
   [Step-by-step plan if approved]
   ```

3. **Update Specification Files**
   - After creating the proposal, update the relevant spec files
   - Reference the proposal document in commit messages
   - Ensure consistency across all three spec files

### Example Workflow

```bash
# 1. Create proposal
# File: spec/proposals/20260104_implement_qwen_integration.md

# 2. Update requirements.md
# Add: "Support Qwen model for OCR annotation generation"

# 3. Update design.md
# Add: Architecture diagram showing Qwen integration

# 4. Update tasks.md
# Add: Tasks for Qwen model integration

# 5. Commit with reference
git commit -m "Add Qwen integration proposal (see spec/proposals/20260104_implement_qwen_integration.md)"
```

## Development Guidelines

### Before Starting Work

1. Review `spec/requirements.md` to understand user needs
2. Check `spec/design.md` for architectural constraints
3. Consult `spec/tasks.md` for current priorities
4. Check existing proposals in `spec/proposals/` for context

### Making Changes

1. For new features or significant changes:
   - Create a proposal document first
   - Update all relevant spec files
   - Ensure consistency across documentation

2. For bug fixes or minor improvements:
   - Update `tasks.md` to track the work
   - Update `design.md` if implementation details change
   - Create a proposal only if the fix requires design changes

3. For documentation updates:
   - Keep README.md in sync with spec files
   - Update inline code documentation as needed

### Testing and Validation

- Ensure changes align with requirements in `spec/requirements.md`
- Validate against architecture in `spec/design.md`
- Update task status in `spec/tasks.md`
- Run all tests before committing

### Commit Messages

- Reference proposal documents when applicable
- Use conventional commit format: `feat:`, `fix:`, `docs:`, `refactor:`, etc.
- Include context and rationale

Example:
```
feat: Add Qwen model integration for OCR annotation

Implements automatic question generation using Qwen open-weight model.
See spec/proposals/20260104_implement_qwen_integration.md for details.

Closes #123
```

## Code Quality Standards

### Principles

We maintain high code quality through automated tooling and consistent practices:

1. **Zero Warnings Policy**: All code must pass linting with zero warnings
2. **Consistent Formatting**: All code is auto-formatted using Prettier
3. **Type Safety**: TypeScript strict mode enabled, no `any` types without justification
4. **Automated Enforcement**: Pre-commit hooks ensure quality before code is committed
5. **Minimal Dependencies**: Only include dependencies that are truly necessary

### Tooling

**ESLint** - Catches bugs and enforces best practices:
- TypeScript-aware linting
- React hooks rules (prevents common mistakes)
- Zero warnings allowed in commits
- Auto-fix enabled where possible

**Prettier** - Ensures consistent code formatting:
- Single quotes
- Semicolons required
- 100 character line width
- 2-space indentation
- Auto-format on commit

**Husky + lint-staged** - Automated pre-commit checks:
- Runs Prettier on all staged files
- Runs ESLint with auto-fix on TypeScript files
- Prevents commits with linting errors
- Formats JSON, CSS, and Markdown files

### Workflow

**During Development:**
```bash
# Manual formatting (optional, pre-commit hook will do this)
npm run format

# Manual linting check
npm run lint
```

**Before Committing:**
- Pre-commit hook automatically runs:
  1. Prettier formats all staged files
  2. ESLint checks and fixes TypeScript files
  3. Commit is blocked if errors remain

**In CI/CD:**
```bash
npm run lint  # Fail build on any warnings
npm test      # All tests must pass
```

### Best Practices

1. **Write Clean Code First**: Don't rely solely on auto-fix
2. **Review Linter Warnings**: Understand why they appear
3. **Document Complex Logic**: Add comments for non-obvious code
4. **Keep Functions Small**: Single responsibility principle
5. **Use Descriptive Names**: Variables and functions should be self-documenting
6. **Avoid Premature Optimization**: Make it work, then make it fast
7. **Test Edge Cases**: Don't just test the happy path

### Code Review Checklist

Before requesting review, ensure:
- ✅ All linting passes with zero warnings
- ✅ Code is properly formatted
- ✅ TypeScript types are explicit and correct
- ✅ No console.log statements (use proper logging)
- ✅ Comments explain "why", not "what"
- ✅ Tests cover new functionality
- ✅ No hardcoded secrets or credentials
- ✅ Error handling is appropriate

### Lambda Function Quality

Lambda functions have additional requirements:
- Each function has its own `package.json`
- Dependencies are isolated to each function
- Use structured logging (AWS Lambda Powertools)
- Include error handling and retries
- Set appropriate timeout and memory limits
- No unused dependencies

### Security Considerations

- Never commit secrets or API keys
- Use environment variables for configuration
- Sanitize user inputs
- Validate data at system boundaries
- Keep dependencies up to date
- Run security audits regularly: `npm audit`

## Communication

- Use clear, descriptive language in all documentation
- Explain technical decisions in design.md
- Keep proposals focused and actionable
- Update documentation as the project evolves

## Questions and Issues

If you encounter ambiguity or need clarification:
1. Check existing proposals for similar discussions
2. Review requirements.md and design.md for context
3. Create a proposal to document the question and proposed resolution
4. Seek human input for critical architectural decisions

## Version Control

- All spec files are version-controlled
- Proposals serve as historical record of decisions
- Tag major milestones for easy reference
- Keep documentation in sync with implementation

---

**Last Updated**: 2026-01-04
**Maintained By**: Project Team
