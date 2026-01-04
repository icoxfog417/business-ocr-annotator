# Business OCR Annotator

A Visual dialogue dataset creation platform for evaluating OCR accuracy of generative AI models in business scenarios.

## Purpose

Behind many OCR projects, there are only a few high-quality datasets to evaluate OCR accuracy of generative AI models, especially for business documents. This project aims to create a comprehensive Visual dialogue dataset that:

- **Collects diverse business documents**: Receipts, order forms, official application forms, invoices, and other business-related images
- **Generates intelligent questions**: Automatically creates questions with bounding box evidence using open-weight models (e.g., Qwen)
- **Enables human validation**: Provides an interface for validating and refining AI-generated annotations
- **Monitors dataset quality**: Tracks diversity and accuracy statistics to ensure high-quality annotations
- **Manages dataset versions**: Leverages Hugging Face platform for versioning and publishing datasets

## Key Features

### 1. Image Upload and Management
Upload business scene images including:
- Receipts
- Order forms
- Official application forms
- Invoices
- Business contracts
- Other business documents

### 2. AI-Powered Question Generation
Automatically generates questions with bounding box areas as evidence:
- "Please tell me the total of this receipt"
- "What is the highest price item name and price?"
- "What is the invoice number?"
- Questions are generated using open-weight models without license limitations

### 3. Human Validation Workflow
- Review AI-generated questions and answers
- Validate or correct bounding box areas
- Approve or reject annotation pairs
- Ensure high-quality dataset output

### 4. Dataset Statistics and Monitoring
- Track annotation diversity (document types, question types)
- Monitor accuracy metrics
- View dataset growth over time
- Ensure balanced representation across categories

### 5. Version Management with Hugging Face
- Publish datasets to Hugging Face Hub
- Maintain version history
- Enable easy sharing and collaboration
- Support standard dataset formats

## Technology Stack

- **Frontend & Backend**: AWS Amplify Gen2
- **AI Models**: Open-weight models (Qwen, etc.) for annotation assistance
- **Dataset Platform**: Hugging Face Hub for version management and publishing
- **Storage**: AWS S3 for image storage
- **Database**: AWS DynamoDB for metadata and annotations

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- AWS Account
- Hugging Face Account (for dataset publishing)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/business-ocr-annotator.git
cd business-ocr-annotator

# Install dependencies
npm install

# Configure AWS Amplify
npm run amplify configure

# Start development server
npm run dev
```

### Configuration

1. Set up your AWS credentials
2. Configure Hugging Face API token for dataset publishing
3. Configure OCR model endpoints (Qwen or other open-weight models)

## Usage

1. **Upload Images**: Navigate to the upload page and select business document images
2. **Review Annotations**: AI will automatically generate questions and bounding boxes
3. **Validate**: Review and validate the generated annotations
4. **Manage Dataset**: Monitor statistics and manage dataset versions
5. **Publish**: Export and publish validated datasets to Hugging Face Hub

## Project Structure

```
business-ocr-annotator/
├── spec/                  # Project specifications
│   ├── requirements.md    # User experience and features
│   ├── design.md         # Architecture and component design
│   ├── tasks.md          # Implementation task list
│   └── proposals/        # Design proposals and changes
├── amplify/              # AWS Amplify configuration
├── src/                  # Source code
└── README.md            # This file
```

## Contributing

Please refer to [CLAUDE.md](./CLAUDE.md) for guidelines on how to contribute to this project, especially for AI-assisted development workflows.

## License

[To be determined]

## Contact

[To be added]