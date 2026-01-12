# Sharp Lambda Layer

This directory contains the script to build and deploy the sharp Lambda layer.

## Usage

```bash
./deploy.sh
```

This will:
1. Install sharp with linux-x64 binaries
2. Package into a Lambda layer zip
3. Deploy to AWS Lambda
4. Output the layer ARN

## Requirements

- AWS CLI configured with appropriate permissions
- Node.js and npm installed

## Layer ARN

After deployment, update `amplify/functions/process-image/resource.ts` with the new layer ARN:

```typescript
layers: {
  sharp: 'arn:aws:lambda:us-east-1:ACCOUNT_ID:layer:sharp-layer:VERSION',
},
```
