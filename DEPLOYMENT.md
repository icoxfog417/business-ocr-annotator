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

### 3. Update OAuth Callback URLs

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

### 4. Update Google OAuth Console

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

| Component | Sandbox | Production |
|-----------|---------|------------|
| `amplify_outputs.json` | Generated locally | Generated in build |
| OAuth URLs | localhost:5173 | amplifyapp.com |
| Sharp layer | Same ARN | Same ARN (account-level) |
| Cognito User Pool | Separate | Separate |
| DynamoDB tables | Separate | Separate |
| S3 bucket | Separate | Separate |

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
