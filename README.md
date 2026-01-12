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

### Production Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

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
├── spec/                 # Specifications
│   ├── requirements.md   # Feature requirements
│   ├── design.md        # Architecture design
│   └── tasks.md         # Sprint tasks
└── DEPLOYMENT.md        # Production deployment guide
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
