# Implementation Q&A

This document records questions and answers discovered during sandbox verification of AWS Amplify Gen2 and related technologies for the Business OCR Annotator project.

## Overview

Each Q&A entry documents:
- A specific technical question encountered during development
- Detailed answer with code samples and explanations
- Reference to sandbox verification code
- Key findings and potential gotchas
- Best practices and recommendations

## Format

Questions are organized by topic and numbered for easy reference. Each answer includes practical examples verified in the `.sandbox/` directory.

---

## Questions

### Q1: How to build a static React site in Amplify Gen2?

**Status**: ⏳ Pending Verification

**Answer**: [To be documented after verification]

**Verified in**: [`.sandbox/01-static-react-site/`](.sandbox/01-static-react-site/)

**Key Findings**:
- [To be documented]

**Gotchas**:
- [To be documented]

**References**:
- [AWS Amplify Gen2 Documentation]
- [Sandbox Sample]

---

### Q2: How to implement Lambda that receives images and processes with Amazon Bedrock?

**Status**: ⏳ Pending Verification

**Answer**: [To be documented after verification]

**Verified in**: [`.sandbox/02-bedrock-image-lambda/`](.sandbox/02-bedrock-image-lambda/)

**Key Findings**:
- [To be documented]

**Gotchas**:
- [To be documented]

**References**:
- [AWS Bedrock Documentation]
- [Sandbox Sample]

---

### Q3: How to integrate Google OAuth with Amplify Gen2?

**Status**: ⏳ Pending Verification

**Answer**: [To be documented after verification]

**Verified in**: [`.sandbox/03-google-oauth/`](.sandbox/03-google-oauth/)

**Key Findings**:
- [To be documented]

**Gotchas**:
- [To be documented]

**References**:
- [AWS Cognito Documentation]
- [Sandbox Sample]

---

### Q4: How to configure S3 storage for image uploads in Amplify Gen2?

**Status**: ⏳ Pending Verification

**Answer**: [To be documented after verification]

**Verified in**: [`.sandbox/04-s3-storage/`](.sandbox/04-s3-storage/)

**Key Findings**:
- [To be documented]

**Gotchas**:
- [To be documented]

**References**:
- [AWS Amplify Storage Documentation]
- [Sandbox Sample]

---

### Q5: How to set up AppSync GraphQL API with Lambda in Amplify Gen2?

**Status**: ⏳ Pending Verification

**Answer**: [To be documented after verification]

**Verified in**: [`.sandbox/05-appsync-lambda/`](.sandbox/05-appsync-lambda/)

**Key Findings**:
- [To be documented]

**Gotchas**:
- [To be documented]

**References**:
- [AWS API Gateway Documentation]
- [Sandbox Sample]

---

### Q6: How to integrate Hugging Face Datasets API from Lambda?

**Status**: ⏳ Pending Verification

**Answer**: [To be documented after verification]

**Verified in**: [`.sandbox/06-huggingface-integration/`](.sandbox/06-huggingface-integration/)

**Key Findings**:
- [To be documented]

**Gotchas**:
- [To be documented]

**References**:
- [Hugging Face Hub API Documentation]
- [Sandbox Sample]

---

### Q7: How to implement image compression with Sharp in Lambda (3-tier: original/compressed/thumbnail)?

**Status**: ⏳ Pending Verification

**Answer**: [To be documented after verification]

**Verified in**: [`.sandbox/07-image-compression/`](.sandbox/07-image-compression/)

**Key Findings**:
- [To be documented]

**Gotchas**:
- [To be documented]

**References**:
- [Sharp Documentation]
- [AWS Lambda Layer for Sharp]
- [Sandbox Sample]

---

### Q8: How to set up DynamoDB with Amplify Gen2 and implement queries?

**Status**: ⏳ Pending Verification

**Answer**: [To be documented after verification]

**Verified in**: [`.sandbox/08-dynamodb-operations/`](.sandbox/08-dynamodb-operations/)

**Key Findings**:
- [To be documented]

**Gotchas**:
- [To be documented]

**References**:
- [AWS Amplify Gen2 Data Documentation]
- [Sandbox Sample]

---

### Q9: How to manage environment variables and secrets in Amplify Gen2?

**Status**: ⏳ Pending Verification

**Answer**: [To be documented after verification]

**Verified in**: [`.sandbox/09-secrets-management/`](.sandbox/09-secrets-management/)

**Key Findings**:
- [To be documented]

**Gotchas**:
- [To be documented]

**References**:
- [AWS Amplify Environment Variables]
- [AWS Secrets Manager Integration]
- [Sandbox Sample]

---

### Q10: How to configure CORS for AppSync API endpoints in Amplify Gen2?

**Status**: ⏳ Pending Verification

**Answer**: [To be documented after verification]

**Verified in**: [`.sandbox/10-cors-configuration/`](.sandbox/10-cors-configuration/)

**Key Findings**:
- [To be documented]

**Gotchas**:
- [To be documented]

**References**:
- [AWS AppSync CORS Documentation]
- [Sandbox Sample]

---

### Q11: How to implement error handling and structured logging in Lambda with Powertools?

**Status**: ⏳ Pending Verification

**Answer**: [To be documented after verification]

**Verified in**: [`.sandbox/11-lambda-error-handling/`](.sandbox/11-lambda-error-handling/)

**Key Findings**:
- [To be documented]

**Gotchas**:
- [To be documented]

**References**:
- [AWS Lambda Powertools TypeScript]
- [Sandbox Sample]

---

### Q12: How to set up DynamoDB data modeling and GSI (Global Secondary Index)?

**Status**: ⏳ Pending Verification

**Answer**: [To be documented after verification]

**Verified in**: [`.sandbox/12-dynamodb-modeling/`](.sandbox/12-dynamodb-modeling/)

**Key Findings**:
- [To be documented]

**Gotchas**:
- [To be documented]

**References**:
- [AWS Amplify Gen2 API Documentation]
- [AppSync GraphQL Resolvers]
- [Sandbox Sample]

---

## Topics to Verify

The following topics need sandbox verification before production implementation:

### Critical Path (Must verify first)
- [ ] **Q1**: Static React site deployment with Amplify Gen2
- [ ] **Q2**: Lambda function with Bedrock image processing
- [ ] **Q3**: Google OAuth integration with Cognito
- [ ] **Q4**: S3 storage configuration and image uploads
- [ ] **Q5**: API Gateway/AppSync setup and Lambda integration

### Secondary Features
- [ ] **Q6**: Hugging Face Datasets API integration from Lambda
- [ ] **Q7**: Image compression with Sharp (3-tier storage)
- [ ] **Q8**: DynamoDB operations with Amplify Gen2
- [ ] **Q9**: Environment variables and secrets management
- [ ] **Q10**: CORS configuration for API endpoints

### Infrastructure and Tooling
- [ ] **Q11**: Error handling and structured logging with Powertools
- [ ] **Q12**: AppSync GraphQL API with Lambda resolvers

### Additional Considerations
- [ ] Multi-language support in Bedrock prompts
- [ ] Mobile camera capture integration
- [ ] Progressive image upload with resume capability
- [ ] PII redaction for sensitive documents
- [ ] Dataset export formats (JSON/JSONL/Parquet)

## Verification Status Legend

- ⏳ **Pending Verification**: Not yet tested
- 🔬 **In Progress**: Currently being verified
- ✅ **Verified**: Successfully tested and documented
- ⚠️ **Issues Found**: Verified with known issues or limitations
- 🔄 **Needs Update**: Previously verified but may need re-verification

## Contributing to Q&A

When adding new Q&A entries:

1. **Clear Question**: Write a specific, actionable question
2. **Complete Answer**: Provide detailed explanation with code samples
3. **Verification**: Reference the sandbox sample that proves it works
4. **Key Findings**: Highlight important discoveries
5. **Gotchas**: Warn about potential issues or common mistakes
6. **References**: Link to official documentation and resources

## Template for New Entries

```markdown
### Q#: [Your question here]?

**Status**: ⏳ Pending Verification

**Answer**: [Detailed explanation]

**Code Sample**:
```typescript
// Minimal code example
```

**Verified in**: `.sandbox/{directory}/`

**Key Findings**:
- Finding 1
- Finding 2

**Gotchas**:
- Potential issue 1
- Potential issue 2

**References**:
- [Documentation link]
- [Related Q&A entries]

---
```

## Maintenance

- Update verification status as work progresses
- Keep code samples current with latest Amplify Gen2 versions
- Archive outdated answers with migration notes
- Cross-reference related Q&A entries

---

**Last Updated**: 2026-01-08
**Total Verified**: 0 / 12
**Maintained By**: Project Team
