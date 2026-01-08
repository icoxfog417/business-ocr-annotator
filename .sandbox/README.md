# Sandbox Directory

This directory contains isolated test samples for verifying AWS Amplify Gen2 functionality and related integrations.

## Purpose

The sandbox serves as a safe space to:
- Test AWS Amplify Gen2 features independently
- Verify integration patterns before production implementation
- Document findings and gotchas
- Create reference examples for the team

## Structure

Each subdirectory represents a specific verification test, numbered to match Q&A entries:

```
.sandbox/
├── 01-react-amplify-init/      # Q1: 🔴 React + Amplify Gen2 initialization
├── 02-google-oauth/            # Q2: 🔴 Google OAuth authentication
├── 03-amplify-data/            # Q3: 🔴 Amplify Gen2 Data (AppSync + DynamoDB)
├── 04-s3-storage/              # Q4: 🟠 S3 storage configuration
├── 05-lambda-functions/        # Q5: 🟠 Lambda function creation
├── 06-bedrock-lambda/          # Q6: 🟠 Bedrock integration
├── 07-sharp-compression/       # Q7: 🟡 Sharp image compression
├── 08-huggingface-integration/ # Q8: 🟡 Hugging Face Hub API
└── 09-secrets-management/      # Q9: 🟡 Secrets and environment variables
```

**Naming Convention**: `{NN-feature-name}/` where NN matches the question number in `spec/implementation_qa.md`

**Priority Indicators**:
- 🔴 Critical (Q1-Q3): Must verify before Sprint 0
- 🟠 High (Q4-Q6): Verify before Sprint 1-2
- 🟡 Medium (Q7-Q9): Verify as needed in later sprints

## Guidelines

### Creating a Sandbox Sample (Question-First Approach)

**IMPORTANT**: Always start with a question, not code.

1. **Formulate Question**: Write a clear technical question in `spec/implementation_qa.md`
   - Example: "How to configure 3-tier S3 storage in Amplify Gen2?"
   - Status: ⏳ Pending Verification

2. **Create Directory**: `mkdir -p .sandbox/{NN-feature-name}` (use number from Q&A)
   - Example: `.sandbox/04-s3-storage/`

3. **Update Status**: Change question status to 🔬 In Progress

4. **Add README**: Explain what question you're answering

5. **Minimal Code**: Write only necessary code to answer the question

6. **Test**: Verify it works as expected

7. **Document Answer**: Update `spec/implementation_qa.md` with:
   - Detailed answer with code samples
   - Key findings and gotchas
   - References to documentation
   - Status: ✅ Verified

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

## Verification Workflow (Question-First)

```
┌─────────────────────────────────────────────────┐
│ 1. QUESTION FIRST                               │
│    Write question in spec/implementation_qa.md  │
│    Status: ⏳ Pending Verification              │
└────────────────┬────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────┐
│ 2. CREATE SANDBOX                               │
│    mkdir .sandbox/{NN-feature-name}/            │
│    Status: 🔬 In Progress                       │
└────────────────┬────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────┐
│ 3. TEST & ITERATE                               │
│    Build minimal code, test, debug              │
└────────────────┬────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────┐
│ 4. WRITE ANSWER                                 │
│    Document findings in implementation_qa.md    │
│    Status: ✅ Verified                          │
└────────────────┬────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────┐
│ 5. REFERENCE IN PRODUCTION                      │
│    Use verified patterns when implementing      │
└─────────────────────────────────────────────────┘
```

### Key Principles

1. **Question Before Code**: Always formulate the question first
2. **Document Before Testing**: Add question to Q&A before creating sandbox
3. **Verify Before Production**: Never implement unverified patterns
4. **Share Knowledge**: Document findings for the entire team

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
