# Production Deployment Guide

## Prerequisites

1. AWS account with Amplify access
2. GitHub repository connected
3. CDK bootstrapped: `npx cdk bootstrap aws://ACCOUNT_ID/REGION`
4. Sharp Lambda layer deployed (see `application/layers/sharp-layer/README.md`)

## First-Time Setup

### 1. Create Amplify App

1. Go to [Amplify Console](https://console.aws.amazon.com/amplify/home)
2. Click **Create new app** → **GitHub**
3. Select repository and branch (`main`)
4. Set **Monorepo**: Yes, **Root directory**: `application`
5. Create/select a **Service Role** with Amplify permissions

### 2. Set Secrets

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

### 3. Set Up External Services

#### HuggingFace (Dataset Export)

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

#### Weights & Biases (Evaluation Logging)

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

#### Configure Repository Names (Optional)

The HuggingFace repo and W&B project names are configured in:
- `src/config/exportConfig.ts` - Frontend repo ID
- `amplify/functions/export-dataset/resource.ts` - Export Lambda
- `amplify/functions/run-evaluation/resource.ts` - Evaluation Lambda

Default configuration:
| Environment | HuggingFace Repo | W&B Project |
|-------------|------------------|-------------|
| Production (main) | `icoxfog417/biz-doc-vqa` | `biz-doc-vqa` |
| Development | `icoxfog417/biz-doc-vqa-test` | `biz-doc-vqa-dev` |

### 4. Update OAuth Callback URLs

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

### 5. Update Google OAuth Console

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

## Environment Differences

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

## Troubleshooting

### "Amplify has not been configured"
- Ensure `preBuild` step runs `ampx generate outputs`

### "InvalidOriginException" (OAuth)
- Add production URL to `callbackUrls` in `amplify/auth/resource.ts`
- Redeploy backend

### "UserUnAuthenticatedException"
- Expected before login, handled gracefully in code

### CDK Bootstrap Error
- Run: `npx cdk bootstrap aws://ACCOUNT_ID/REGION`
- Ensure service role has SSM read permissions

### Sharp/Image Processing Fails
- Verify layer exists: `aws lambda get-layer-version --layer-name sharp-layer --version-number 1`
- Check CloudWatch logs for `processImage` Lambda

### Dataset Export Fails (HuggingFace)
- Verify SSM parameter exists: `aws ssm get-parameter --name "/business-ocr/hf-token" --with-decryption`
- Check token has **write** permissions
- Verify you own the target repository namespace
- Check CloudWatch logs for `exportDataset` Lambda

### Evaluation Job Fails (W&B)
- Verify SSM parameter exists: `aws ssm get-parameter --name "/business-ocr/wandb-api-key" --with-decryption`
- Check W&B project exists and is accessible
- Check CloudWatch logs for `runEvaluation` Lambda

## Useful Commands

```bash
# List Amplify apps
aws amplify list-apps

# Get app details
aws amplify get-app --app-id <APP_ID>

# List Cognito user pools
aws cognito-idp list-user-pools --max-results 20

# Get Cognito domain
aws cognito-idp describe-user-pool --user-pool-id <POOL_ID> --query 'UserPool.Domain'

# Check Lambda layer
aws lambda get-layer-version --layer-name sharp-layer --version-number 1
```
