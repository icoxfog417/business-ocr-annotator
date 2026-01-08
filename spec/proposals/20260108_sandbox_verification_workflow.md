# Proposal: Sandbox Verification Workflow

**Date**: 2026-01-08
**Author**: Claude Agent
**Status**: Proposed

## Background

Before implementing the full Business OCR Annotator application, we need to verify that all core AWS Amplify Gen2 components and integrations work as expected. This includes:

- Static React site deployment with Amplify Gen2
- Lambda function execution with Bedrock API access
- Authentication with Google OAuth
- Storage integration (S3)
- API Gateway configuration
- Image processing capabilities

Without verification, we risk discovering compatibility issues or configuration problems late in development, which could require significant rework.

## Proposal

Introduce a **Sandbox Verification Workflow** that allows developers (human or AI) to:

1. Create isolated test samples in a `.sandbox/` directory
2. Test individual Amplify Gen2 features independently
3. Document findings in a Q&A format at `spec/implementation_qa.md`
4. Reference verified patterns when implementing production features

### Directory Structure

```
.sandbox/
├── README.md                          # Overview of sandbox purpose
├── static-react-site/                 # Test: Basic Amplify Gen2 React deployment
│   ├── amplify/
│   ├── src/
│   └── package.json
├── bedrock-image-lambda/              # Test: Lambda with Bedrock image processing
│   ├── amplify/
│   ├── lambda/
│   └── package.json
├── google-oauth/                      # Test: Google OAuth integration
│   ├── amplify/
│   └── src/
├── s3-storage/                        # Test: S3 storage operations
│   ├── amplify/
│   └── src/
└── api-gateway/                       # Test: API Gateway configuration
    ├── amplify/
    └── lambda/
```

### Q&A Document Format

The `spec/implementation_qa.md` file will follow this structure:

```markdown
# Implementation Q&A

This document records questions and answers discovered during sandbox verification of AWS Amplify Gen2 and related technologies.

## Questions

### Q1: How to build a static React site in Amplify Gen2?

**Answer**: [Detailed explanation with code samples]

**Verified in**: `.sandbox/static-react-site/`

**Key Findings**:
- [Finding 1]
- [Finding 2]

**Gotchas**:
- [Potential issues to watch out for]

---

### Q2: How to implement Lambda that receives images and processes with Amazon Bedrock?

...
```

### Workflow Process

1. **Identify Verification Need**: Before implementing a feature, identify what needs verification
2. **Create Sandbox Sample**: Create minimal reproducible sample in `.sandbox/{feature-name}/`
3. **Test and Iterate**: Test the sample, fix issues, document findings
4. **Document Q&A**: Add question and answer to `spec/implementation_qa.md`
5. **Reference in Production**: When implementing production code, reference the Q&A and sandbox sample

### Sandbox Guidelines

- **Isolated**: Each sandbox should be independent and self-contained
- **Minimal**: Include only what's necessary to verify the specific feature
- **Documented**: Include README.md explaining what's being tested
- **Disposable**: Sandbox code is for learning, not production use
- **Version Controlled**: Commit sandbox samples so others can learn from them

## Impact

- **Requirements**: No changes needed (verification supports existing requirements)
- **Design**: No changes needed (verification validates design assumptions)
- **Tasks**: New task type for "Verify {feature}" before implementation tasks
- **CLAUDE.md**: Add new section "Sandbox Verification Workflow"

## Alternatives Considered

1. **Direct Implementation Without Verification**
   - Risk: Discover issues late in development
   - Rejected: Too risky for complex AWS integrations

2. **Separate Test Repository**
   - Benefit: Keeps main repo clean
   - Rejected: Harder to reference, loses context

3. **Documentation Only (No Code Samples)**
   - Benefit: Lighter weight
   - Rejected: Code samples are essential for understanding

## Implementation Plan

1. Create `.sandbox/` directory with README
2. Create initial `spec/implementation_qa.md` template
3. Update `CLAUDE.md` with new workflow section
4. Add `.sandbox/` to `.gitignore` selectively (ignore node_modules, build artifacts)
5. Create first sandbox sample (static React site)
6. Document findings in Q&A format
7. Iterate through remaining verification tasks

## Benefits

- **Risk Reduction**: Catch integration issues early
- **Knowledge Building**: Document solutions for future reference
- **Faster Development**: Reference verified patterns during implementation
- **Team Learning**: Sandbox samples serve as examples for team members
- **Confidence**: Know that core features work before building on them

## Success Criteria

- All core Amplify Gen2 features verified
- At least 5-7 Q&A entries in `implementation_qa.md`
- Each sandbox sample runs successfully
- Production implementation can reference verification work
