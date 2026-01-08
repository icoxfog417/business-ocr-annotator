# Sandbox Directory

This directory contains isolated test samples for verifying AWS Amplify Gen2 functionality and related integrations.

## Purpose

The sandbox serves as a safe space to:
- Test AWS Amplify Gen2 features independently
- Verify integration patterns before production implementation
- Document findings and gotchas
- Create reference examples for the team

## Structure

Each subdirectory represents a specific verification test:

```
.sandbox/
├── static-react-site/          # Basic Amplify Gen2 React deployment
├── bedrock-image-lambda/       # Lambda with Bedrock image processing
├── google-oauth/               # Google OAuth integration
├── s3-storage/                 # S3 storage operations
└── api-gateway/                # API Gateway configuration
```

## Guidelines

### Creating a Sandbox Sample

1. **Create Directory**: `mkdir .sandbox/{feature-name}`
2. **Add README**: Explain what's being tested
3. **Minimal Code**: Only include necessary code
4. **Test**: Verify it works as expected
5. **Document**: Add findings to `spec/implementation_qa.md`

### Running Sandbox Samples

Each sample should be self-contained and runnable:

```bash
cd .sandbox/{feature-name}
npm install
npm run dev  # or appropriate command
```

### What to Include

- ✅ Minimal code to test specific feature
- ✅ README explaining the test
- ✅ package.json with dependencies
- ✅ Configuration files (amplify/, etc.)
- ✅ Sample data if needed

### What NOT to Include

- ❌ Production code
- ❌ Unnecessary dependencies
- ❌ Large binary files
- ❌ Secrets or credentials
- ❌ node_modules (add to .gitignore)

## Verification Workflow

1. **Before Implementation**: Identify what needs verification
2. **Create Sample**: Build minimal test in sandbox
3. **Iterate**: Test, debug, fix issues
4. **Document**: Record findings in Q&A format
5. **Reference**: Use verified patterns in production

## Documentation

All findings should be documented in `spec/implementation_qa.md` with:
- Clear question
- Detailed answer
- Code samples or references
- Key findings and gotchas
- Reference to sandbox directory

## Maintenance

- Keep samples up to date with Amplify Gen2 versions
- Remove outdated samples that no longer apply
- Update documentation when patterns change
- Archive samples that are no longer needed

## Examples

See `spec/implementation_qa.md` for detailed Q&A entries referencing each sandbox sample.

---

**Note**: Sandbox code is for learning and verification only. Production code should follow the architecture defined in `spec/design.md`.
