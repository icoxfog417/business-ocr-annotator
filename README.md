# Business OCR Annotator

A platform for creating high-quality Visual Question Answering (VQA) datasets to evaluate OCR accuracy of generative AI models on business documents.

## Why This Project?

There are few high-quality datasets for evaluating OCR accuracy on business documents. This platform enables:

- **Crowdsourced annotation** of business documents (receipts, invoices, contracts, etc.)
- **AI-assisted workflow** using Amazon Bedrock for text extraction
- **Multi-language support** (Japanese, English, Chinese, Korean)
- **Quality tracking** with validation status and contribution statistics

## Features

### 📷 Image Upload
- Drag & drop or camera capture (mobile)
- Automatic 3-tier compression (original → compressed → thumbnail)
- Support for JPEG, PNG up to 20MB

### 📝 Smart Annotation
- Question-by-question workflow
- Draw bounding box → AI reads text → Confirm answer
- Keyboard shortcuts for desktop (←→ navigate, D draw, S skip)
- Touch-friendly interface for mobile

### 📊 Dashboard
- Track annotation progress
- View AI vs human contribution stats
- Monitor document type distribution

### 🌐 Multi-Language
- Document languages: Japanese, English, Chinese, Korean
- Default questions per document type and language
- UI supports multiple languages

## Technology Stack

| Component | Technology |
|-----------|------------|
| Frontend | React 18 + TypeScript + Vite |
| Backend | AWS Amplify Gen2 |
| Authentication | Amazon Cognito (Google OAuth) |
| Database | Amazon DynamoDB |
| Storage | Amazon S3 (3-tier) |
| AI | Amazon Bedrock (Claude 3.5 Sonnet) |
| Image Processing | AWS Lambda + Sharp |

## Getting Started

### Prerequisites
- Node.js 20+
- AWS Account with Bedrock access
- Google OAuth credentials

### Local Development

```bash
# Clone and install
git clone https://github.com/icoxfog417/business-ocr-annotator.git
cd business-ocr-annotator/application
npm install

# Set up secrets
npx ampx sandbox secret set GOOGLE_CLIENT_ID
npx ampx sandbox secret set GOOGLE_CLIENT_SECRET

# Start sandbox (backend + frontend)
npx ampx sandbox
npm run dev
```

### Admin Setup

The Dataset Management page is restricted to administrators. To add admin users:

1. **Open AWS Console** → Cognito → User Pools
2. **Select your user pool** (e.g., `amplify-xxxxx-main-branch-xxxxx`)
3. **Create the Admins group** (if not exists):
   - Go to "Groups" tab → "Create group"
   - Group name: `Admins`
   - Description: "Dataset management administrators"
4. **Add users to the group**:
   - Go to "Users" tab → Select user
   - Click "Add user to group" → Select "Admins"

Users in the `Admins` group can access:
- Dataset Management page
- Export datasets to HuggingFace
- Trigger model evaluations

### Production Deployment

#### Prerequisites

1. AWS account with Amplify access
2. GitHub repository connected
3. CDK bootstrapped: `npx cdk bootstrap aws://ACCOUNT_ID/REGION`
4. Sharp Lambda layer deployed (see `application/layers/sharp-layer/README.md`)

#### 1. Create Amplify App

1. Go to [Amplify Console](https://console.aws.amazon.com/amplify/home)
2. Click **Create new app** → **GitHub**
3. Select repository and branch (`main`)
4. Set **Monorepo**: Yes, **Root directory**: `application`
5. Create/select a **Service Role** with Amplify permissions

#### 2. Set Google OAuth Secrets

In Amplify Console → App settings → Environment variables:

```
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

Or via CLI:
```bash
npx ampx secret set GOOGLE_CLIENT_ID --branch main
npx ampx secret set GOOGLE_CLIENT_SECRET --branch main
```

#### 3. Set Up External Services

**HuggingFace (Dataset Export)**

1. Create a [HuggingFace account](https://huggingface.co/join)
2. Create an access token at [Settings → Access Tokens](https://huggingface.co/settings/tokens)
   - Token type: **Write** (required for dataset uploads)
3. Create dataset repositories:
   - Production: `your-username/biz-doc-vqa`
   - Development: `your-username/biz-doc-vqa-test`
4. Store the token in AWS SSM Parameter Store:
   ```bash
   aws ssm put-parameter \
     --name "/business-ocr/hf-token" \
     --type SecureString \
     --value "hf_your_token_here"
   ```

**Weights & Biases (Evaluation Logging)**

1. Create a [W&B account](https://wandb.ai/authorize)
2. Get your API key from [Settings](https://wandb.ai/settings)
3. Create projects:
   - Production: `biz-doc-vqa`
   - Development: `biz-doc-vqa-dev`
4. Store the API key in AWS SSM Parameter Store:
   ```bash
   aws ssm put-parameter \
     --name "/business-ocr/wandb-api-key" \
     --type SecureString \
     --value "your_wandb_api_key"
   ```

**Configure Repository Names (Optional)**

The HuggingFace repo and W&B project names are configured in:
- `src/config/exportConfig.ts` - Frontend repo ID
- `amplify/functions/export-dataset/resource.ts` - Export Lambda
- `amplify/functions/run-evaluation/resource.ts` - Evaluation Lambda

Default configuration:
| Environment | HuggingFace Repo | W&B Project |
|-------------|------------------|-------------|
| Production (main) | `icoxfog417/biz-doc-vqa` | `biz-doc-vqa` |
| Development | `icoxfog417/biz-doc-vqa-test` | `biz-doc-vqa-dev` |

#### 4. Update OAuth Callback URLs

Add your Amplify URL to `amplify/auth/resource.ts`:

```typescript
callbackUrls: [
  'http://localhost:5173/',
  'https://main.<APP_ID>.amplifyapp.com/',
],
logoutUrls: [
  'http://localhost:5173/',
  'https://main.<APP_ID>.amplifyapp.com/',
],
```

#### 5. Update Google OAuth Console

Add to [Google Cloud Console](https://console.cloud.google.com/apis/credentials):

**Authorized JavaScript origins:**
```
https://main.<APP_ID>.amplifyapp.com
```

**Authorized redirect URIs:**
```
https://<COGNITO_DOMAIN>.auth.<REGION>.amazoncognito.com/oauth2/idpresponse
```

Find Cognito domain after deployment:
```bash
aws cognito-idp describe-user-pool --user-pool-id <POOL_ID> --query 'UserPool.Domain'
```

#### Environment Differences

| Component | Sandbox/Dev | Production |
|-----------|-------------|------------|
| `amplify_outputs.json` | Generated locally | Generated in build |
| OAuth URLs | localhost:5173 | amplifyapp.com |
| Sharp layer | Same ARN | Same ARN (account-level) |
| Cognito User Pool | Separate | Separate |
| DynamoDB tables | Separate | Separate |
| S3 bucket | Separate | Separate |
| HuggingFace repo | `biz-doc-vqa-test` | `biz-doc-vqa` |
| W&B project | `biz-doc-vqa-dev` | `biz-doc-vqa` |
| SSM parameters | Shared | Shared |

#### Troubleshooting

| Issue | Solution |
|-------|----------|
| "Amplify has not been configured" | Ensure `preBuild` step runs `ampx generate outputs` |
| "InvalidOriginException" (OAuth) | Add production URL to `callbackUrls` in `amplify/auth/resource.ts` |
| CDK Bootstrap Error | Run: `npx cdk bootstrap aws://ACCOUNT_ID/REGION` |
| Sharp/Image Processing Fails | Verify layer: `aws lambda get-layer-version --layer-name sharp-layer --version-number 1` |
| Dataset Export Fails | Verify SSM: `aws ssm get-parameter --name "/business-ocr/hf-token" --with-decryption` |
| Evaluation Job Fails | Verify SSM: `aws ssm get-parameter --name "/business-ocr/wandb-api-key" --with-decryption` |

## Project Structure

```
business-ocr-annotator/
├── application/           # Main application
│   ├── amplify/          # Amplify Gen2 backend
│   │   ├── auth/         # Cognito configuration
│   │   ├── data/         # GraphQL schema
│   │   ├── storage/      # S3 configuration
│   │   └── functions/    # Lambda functions
│   └── src/              # React frontend
└── spec/                 # Specifications
    ├── requirements.md   # Feature requirements
    ├── design.md        # Architecture design
    └── tasks.md         # Sprint tasks
```

## Document Types Supported

- 🧾 Receipts
- 📄 Invoices
- 📋 Order Forms
- 📑 Tax Forms
- 📃 Contracts
- 📝 Application Forms

## Contributing

1. Check `spec/tasks.md` for current sprint tasks
2. Create proposals in `spec/proposals/` for significant changes
3. Follow the workflow in [CLAUDE.md](./CLAUDE.md)

## License

Apache License 2.0 - See [LICENSE](./LICENSE)
