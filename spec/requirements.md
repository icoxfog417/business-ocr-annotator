# Requirements Specification

**Project**: Business OCR Annotator
**Version**: 1.0
**Last Updated**: 2026-01-04

## 1. Overview

The Business OCR Annotator is a platform for creating high-quality Visual dialogue datasets to evaluate OCR accuracy of generative AI models in business document scenarios.

## 2. User Personas

### 2.1 Dataset Curator
- **Role**: Manages the overall dataset creation process
- **Goals**:
  - Create diverse, high-quality OCR datasets
  - Monitor dataset statistics and quality metrics
  - Publish datasets to Hugging Face
- **Technical Level**: Intermediate to Advanced

### 2.2 Annotator
- **Role**: Validates and refines AI-generated annotations
- **Goals**:
  - Review AI-generated questions and answers
  - Correct bounding boxes and annotations
  - Ensure accuracy of dataset entries
- **Technical Level**: Basic to Intermediate

### 2.3 Dataset Consumer
- **Role**: Uses published datasets for model training/evaluation
- **Goals**:
  - Access high-quality business OCR datasets
  - Understand dataset composition and statistics
  - Download versioned datasets
- **Technical Level**: Intermediate to Advanced

## 3. Functional Requirements

### 3.1 Image Upload and Management

#### 3.1.1 Image Upload
- **REQ-IU-001**: Users shall be able to upload images in common formats (JPEG, PNG, PDF)
- **REQ-IU-002**: System shall support batch upload of multiple images
- **REQ-IU-003**: Maximum single image size shall be 20MB (original), with automatic compression to ≤4MB for model processing
- **REQ-IU-004**: System shall validate image format and size before upload
- **REQ-IU-005**: Users shall be able to preview images before upload
- **REQ-IU-006**: System shall automatically compress images larger than 4MB for model processing while preserving originals
- **REQ-IU-007**: System shall preserve original high-resolution images for final dataset export
- **REQ-IU-008**: Mobile users shall be able to capture photos directly from device camera
- **REQ-IU-009**: System shall support progressive image upload with resume capability for poor network conditions
- **REQ-IU-010**: System shall generate thumbnails (≤100KB) for gallery view performance

#### 3.1.2 Document Classification
- **REQ-DC-001**: Users shall categorize images by document type:
  - Receipts
  - Invoices
  - Order forms
  - Tax forms
  - Business contracts
  - Application forms
  - Other (with custom label)
- **REQ-DC-002**: System shall auto-suggest document type based on image analysis
- **REQ-DC-003**: Users shall be able to manually override document type
- **REQ-DC-004**: Users shall specify document language on upload (ja, en, zh, ko, etc.)

#### 3.1.3 Image Management
- **REQ-IM-001**: Users shall view all uploaded images in a gallery view
- **REQ-IM-002**: Users shall filter images by document type, upload date, and annotation status
- **REQ-IM-003**: Users shall search images by metadata (filename, date, type)
- **REQ-IM-004**: Users shall delete uploaded images
- **REQ-IM-005**: System shall track image processing status (uploaded, processing, annotated, validated)

### 3.2 AI-Powered Question Generation

#### 3.2.1 Automatic Annotation via NVIDIA Nemotron Nano 12B
- **REQ-BR-001**: System shall use NVIDIA Nemotron Nano 12B for vision model inference
- **REQ-BR-002**: System shall integrate with Nemotron Nano 12B API for annotation generation
- **REQ-QG-001**: System shall automatically generate questions for uploaded images using Nemotron vision models
- **REQ-QG-002**: System shall generate diverse question types:
  - Extractive ("What is the total amount?")
  - Abstractive ("What is the highest priced item?")
  - Boolean ("Does this receipt include tax?")
  - Counting ("How many items are listed?")
  - Reasoning ("What is the change due if paid with ¥20,000?")
- **REQ-QG-003**: System shall generate 3-10 questions per image based on content complexity
- **REQ-QG-004**: System shall provide candidate answers for each question
- **REQ-QG-005**: System shall generate bounding box coordinates (absolute pixels) for answer evidence
- **REQ-QG-006**: System shall extract text content from bounding box regions (via vision model)
- **REQ-QG-007**: System shall classify question types (extractive, abstractive, boolean, counting, reasoning)
- **REQ-QG-008**: System shall classify answer types (span, free_form, yes_no, number)

#### 3.2.2 Multi-Language Support
- **REQ-ML-001**: System shall support multiple document languages (Japanese, English, Chinese, Korean)
- **REQ-ML-002**: System shall generate annotations in the same language as the document
- **REQ-ML-003**: System shall use language-specific prompts for each supported language
- **REQ-ML-004**: Annotations shall include language metadata (ISO 639-1 code)

#### 3.2.3 Model Configuration
- **REQ-MC-001**: Administrators shall configure NVIDIA Nemotron Nano 12B for annotation generation
- **REQ-MC-002**: System shall support Nemotron model parameter tuning (temperature, max tokens)
- **REQ-MC-003**: System shall track which Nemotron model version generated each annotation
- **REQ-MC-004**: System shall provide model performance metrics (latency, accuracy)
- **REQ-MC-005**: System shall support model endpoint configuration (self-hosted or API)

### 3.3 Human Validation Workflow

#### 3.3.1 Annotation Review Interface
- **REQ-AR-001**: Users shall view images with overlaid bounding boxes
- **REQ-AR-002**: Users shall see all generated questions and answers for an image
- **REQ-AR-003**: Users shall zoom and pan on images for detailed inspection
- **REQ-AR-004**: Interface shall highlight selected bounding box when reviewing a question
- **REQ-AR-005**: Interface shall display compressed images by default with option to view original resolution
- **REQ-AR-006**: Mobile interface shall support touch gestures (pinch-to-zoom, swipe navigation)
- **REQ-AR-007**: Interface shall be responsive and optimized for smartphone screens (minimum 375px width)

#### 3.3.2 Annotation Editing
- **REQ-AE-001**: Users shall edit question text
- **REQ-AE-002**: Users shall edit answer text
- **REQ-AE-003**: Users shall adjust bounding box coordinates by dragging corners/edges
- **REQ-AE-004**: Users shall add new bounding boxes manually
- **REQ-AE-005**: Users shall delete bounding boxes
- **REQ-AE-006**: Users shall add additional questions manually
- **REQ-AE-007**: Touch interface shall provide adequately sized touch targets (minimum 44x44px) for mobile editing
- **REQ-AE-008**: Bounding box corners and edges shall be touch-friendly (minimum 12px touch area)

#### 3.3.3 Validation Actions
- **REQ-VA-001**: Users shall approve individual question-answer pairs
- **REQ-VA-002**: Users shall reject individual question-answer pairs with reason
- **REQ-VA-003**: Users shall approve entire image annotations
- **REQ-VA-004**: Users shall flag images for review by another annotator
- **REQ-VA-005**: System shall track validation history and annotator identity

#### 3.3.4 Workflow Management
- **REQ-WM-001**: System shall assign images to annotators for review
- **REQ-WM-002**: Users shall view their assigned annotation queue
- **REQ-WM-003**: Users shall mark images as complete after validation
- **REQ-WM-004**: System shall support multi-annotator validation (consensus building)

### 3.4 Annotation Workflow

#### 3.4.1 Default Questions
- **REQ-AW-001**: Admins shall configure default questions per document type and language
- **REQ-AW-002**: Default questions shall auto-populate when annotator starts annotation
- **REQ-AW-003**: Default questions shall be limited to extractive question types only

#### 3.4.2 AI-Assisted Question Generation
- **REQ-AW-004**: System shall automatically generate additional question suggestions via AI
- **REQ-AW-005**: Annotators shall adopt or reject each AI-suggested question
- **REQ-AW-006**: Adopted questions shall be added to the annotation question list

#### 3.4.3 AI-Assisted Answering
- **REQ-AW-007**: System shall provide AI-suggested answers with evidence regions on demand
- **REQ-AW-008**: Each question-answer pair shall have exactly one bounding box
- **REQ-AW-009**: Annotators shall confirm or edit AI suggestions before saving

#### 3.4.4 Finalization
- **REQ-AW-010**: Annotators shall finalize annotations when all questions are answered
- **REQ-AW-011**: Finalized annotations shall be soft-locked (status = VALIDATED)
- **REQ-AW-012**: Annotators shall be able to self re-open their own finalized annotations

#### 3.4.5 Contribution Tracking
- **REQ-AW-013**: System shall track total images annotated per user
- **REQ-AW-014**: System shall track total questions answered per user
- **REQ-AW-015**: Users shall view their contribution statistics on the dashboard

### 3.5 Dataset Statistics and Monitoring

#### 3.5.1 Diversity Metrics
- **REQ-DM-001**: System shall display distribution of document types
- **REQ-DM-002**: System shall display distribution of question types
- **REQ-DM-003**: System shall track unique vendors/entities in dataset
- **REQ-DM-004**: System shall show temporal distribution (document dates)
- **REQ-DM-005**: System shall identify underrepresented categories

#### 3.5.2 Accuracy Metrics
- **REQ-AM-001**: System shall track approval rate of AI-generated annotations
- **REQ-AM-002**: System shall track edit frequency (how often annotations are modified)
- **REQ-AM-003**: System shall measure inter-annotator agreement
- **REQ-AM-004**: System shall track average time spent per annotation
- **REQ-AM-005**: System shall display model confidence scores vs validation results

#### 3.5.3 Dashboard
- **REQ-DB-001**: Users shall view overall dataset statistics on a dashboard
- **REQ-DB-002**: Dashboard shall show:
  - Total images processed
  - Total validated annotations
  - Approval vs rejection rate
  - Document type distribution
  - Progress over time
- **REQ-DB-003**: Users shall filter statistics by date range
- **REQ-DB-004**: Users shall export statistics as CSV/JSON

### 3.6 Dataset Version Management

#### 3.6.1 Version Creation
- **REQ-VC-001**: Users shall create dataset versions/releases
- **REQ-VC-002**: Users shall specify version number (semantic versioning)
- **REQ-VC-003**: Users shall add version notes/changelog
- **REQ-VC-004**: System shall freeze dataset content for each version
- **REQ-VC-005**: Users shall select which annotations to include in a version (filtering by quality)

#### 3.6.2 Hugging Face Integration
- **REQ-HF-001**: System shall publish datasets to Hugging Face Hub
- **REQ-HF-002**: Users shall configure Hugging Face credentials
- **REQ-HF-003**: System shall format datasets according to Hugging Face standards
- **REQ-HF-004**: System shall support dataset card generation with metadata
- **REQ-HF-005**: System shall track published versions and their Hugging Face URLs

#### 3.6.3 Export Formats
- **REQ-EF-001**: System shall export datasets in JSON format
- **REQ-EF-002**: System shall export datasets in JSONL format (one record per line)
- **REQ-EF-003**: System shall export datasets in Parquet format for efficient Hugging Face streaming
- **REQ-EF-004**: Export shall include:
  - Image references (S3 URLs)
  - Questions and answers with language metadata
  - Bounding box coordinates (configurable: absolute or normalized)
  - Evidence boxes with optional text content and labels
  - Metadata (document type, language, validation status, timestamps, model version)
- **REQ-EF-005**: Users shall download dataset versions locally
- **REQ-EF-006**: System shall normalize bounding boxes to 0-1000 scale (LayoutLM standard) on export
- **REQ-EF-007**: Users shall select coordinate format on export (absolute, normalized 0-1, normalized 0-1000, or all)
- **REQ-EF-008**: System shall generate dataset cards with metadata, citation, and legal information for Hugging Face
- **REQ-EF-009**: Export format shall conform to academic standards (DocVQA, LayoutLM, ICDAR)
- **REQ-EF-010**: Export shall support multi-language datasets with language tags per annotation

## 4. Non-Functional Requirements

### 4.1 Performance
- **REQ-NF-P-001**: Image upload shall complete within 15 seconds for files under 20MB on 4G networks
- **REQ-NF-P-002**: AI annotation generation shall complete within 30 seconds per image
- **REQ-NF-P-003**: Interface shall load annotation view within 2 seconds
- **REQ-NF-P-004**: Dashboard statistics shall refresh within 3 seconds
- **REQ-NF-P-005**: System shall support concurrent access by 10+ annotators
- **REQ-NF-P-006**: Image compression shall complete within 5 seconds for images up to 20MB
- **REQ-NF-P-007**: Thumbnail generation shall complete within 2 seconds
- **REQ-NF-P-008**: Mobile UI shall achieve 60fps scrolling and gesture response
- **REQ-NF-P-009**: Compressed images shall load within 3 seconds on 3G networks

### 4.2 Scalability
- **REQ-NF-S-001**: System shall handle up to 10,000 images in a single dataset
- **REQ-NF-S-002**: System shall handle up to 100,000 annotations
- **REQ-NF-S-003**: Database shall be partitionable for larger datasets

### 4.3 Usability
- **REQ-NF-U-001**: Interface shall be responsive and mobile-first (smartphone, tablet, desktop)
- **REQ-NF-U-002**: System shall provide keyboard shortcuts for common actions (desktop)
- **REQ-NF-U-003**: System shall provide inline help and tooltips
- **REQ-NF-U-004**: Error messages shall be clear and actionable
- **REQ-NF-U-005**: Mobile interface shall support device camera access with appropriate permissions
- **REQ-NF-U-006**: Interface shall work offline with local caching and sync when connection restored
- **REQ-NF-U-007**: System shall provide visual feedback for all touch interactions (ripple, highlight)
- **REQ-NF-U-008**: System shall support both portrait and landscape orientations on mobile devices

### 4.4 Security
- **REQ-NF-SE-001**: System shall authenticate users via AWS Cognito
- **REQ-NF-SE-002**: System shall support role-based access control (Admin, Curator, Annotator)
- **REQ-NF-SE-003**: Uploaded images shall be stored securely in S3 with encryption
- **REQ-NF-SE-004**: API endpoints shall require authentication
- **REQ-NF-SE-005**: Hugging Face API tokens shall be stored securely

### 4.5 Reliability
- **REQ-NF-R-001**: System shall have 99.9% uptime
- **REQ-NF-R-002**: System shall auto-save annotation progress every 30 seconds
- **REQ-NF-R-003**: System shall handle model API failures gracefully (retry, fallback)
- **REQ-NF-R-004**: System shall provide data backup and recovery

### 4.6 Maintainability
- **REQ-NF-M-001**: Code shall follow AWS Amplify Gen2 best practices
- **REQ-NF-M-002**: System shall have comprehensive logging
- **REQ-NF-M-003**: System shall have monitoring and alerting
- **REQ-NF-M-004**: Documentation shall be maintained in sync with implementation

### 4.7 Compliance
- **REQ-NF-C-001**: System shall comply with data privacy regulations (GDPR, CCPA)
- **REQ-NF-C-002**: System shall allow users to delete their data
- **REQ-NF-C-003**: System shall track data provenance and licensing
- **REQ-NF-C-004**: System shall detect and redact PII (personally identifiable information) in uploaded documents
- **REQ-NF-C-005**: PII detection shall support multiple languages (Japanese, English, Chinese, Korean)
- **REQ-NF-C-006**: System shall use CC BY-SA 4.0 license for published datasets (or allow users to configure)
- **REQ-NF-C-007**: System shall document legal context and licensing in dataset cards for international users

## 5. User Stories

### 5.1 Mobile Camera Capture
```
As an annotator using a smartphone,
I want to capture photos of business documents directly with my device camera,
So that I can quickly add new documents to the dataset without transferring files.
```

### 5.2 Image Upload
```
As a dataset curator,
I want to upload multiple business document images at once,
So that I can efficiently add new data to the dataset.
```

### 5.3 AI Annotation Review
```
As an annotator,
I want to review AI-generated questions with visual bounding boxes,
So that I can quickly validate the accuracy of annotations.
```

### 5.4 Annotation Correction
```
As an annotator,
I want to adjust bounding boxes by dragging them,
So that I can accurately mark the evidence area for answers.
```

### 5.5 Quality Monitoring
```
As a dataset curator,
I want to see statistics on annotation quality and diversity,
So that I can ensure we're building a high-quality, balanced dataset.
```

### 5.6 Dataset Publishing
```
As a dataset curator,
I want to publish validated datasets to Hugging Face,
So that the research community can use them for model evaluation.
```

### 5.7 Multi-Language Annotation
```
As a dataset curator,
I want to create datasets in multiple languages (Japanese, English, Chinese, Korean),
So that I can build comprehensive multi-language document understanding benchmarks.
```

### 5.8 Academic Dataset Export
```
As a researcher,
I want to download datasets in standard academic formats (LayoutLM-compatible),
So that I can use them directly with state-of-the-art models without format conversion.
```

### 5.9 PII Protection
```
As a dataset curator,
I want the system to automatically detect and redact sensitive personal information in multiple languages,
So that published datasets comply with privacy regulations globally.
```

### 5.10 Nemotron Model Selection
```
As an administrator,
I want to select and configure different Nemotron model parameters,
So that I can optimize for accuracy, cost, and performance based on document types.
```

## 6. Acceptance Criteria

### 6.1 Minimum Viable Product (MVP)
- Image upload and basic management (multi-format support)
- Language selection on upload
- NVIDIA Nemotron Nano 12B-based automatic question generation with bounding boxes
- Support for Nemotron model configuration and parameter tuning
- Manual annotation review and editing interface
- Basic approval/rejection workflow
- Export to JSON and Parquet formats
- Simple statistics dashboard
- Multi-language UI (English, Japanese minimum)

### 6.2 Future Enhancements
- Multi-annotator consensus workflow
- Advanced quality metrics and analytics
- Support for additional Bedrock models
- Additional language support (beyond initial 4)
- Collaborative annotation features
- API for programmatic access
- Advanced PII detection with ML models

## 7. Constraints

- Must use AWS Amplify Gen2 for infrastructure
- Must use NVIDIA Nemotron Nano 12B for vision model inference
- Must integrate with Hugging Face for dataset publishing
- Must support standard bounding box formats (LayoutLM, DocVQA compatible)
- Must use Node.js 20.x for Lambda functions
- Must minimize Amplify UI dependency (only Authenticator)

## 8. Dependencies

- AWS Account with appropriate service access
- NVIDIA Nemotron Nano 12B model access (API or self-hosted)
- Hugging Face account and API access
- Node.js 20.x development environment
- AWS Amplify Gen2 CLI

---

**Document Status**: Initial Draft
**Next Review Date**: TBD
**Approval Status**: Pending Review
