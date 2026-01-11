# Proposal: Annotation Workflow with AI Assistance

**Date**: 2026-01-11
**Author**: Claude Agent
**Status**: Proposed

## Background

Sprint 1 delivered manual annotation capabilities. Sprint 2 requires AI-assisted annotation with a structured workflow that guides annotators from image upload through finalization. The current system lacks:
- Default questions per document category
- AI-assisted question generation
- AI-assisted answer suggestions with evidence regions
- Finalization workflow with re-open capability
- Contribution tracking for annotators

## Proposal

### User Journey

1. **Upload image** → specify category + language (existing)
2. **Start annotation** → default questions (admin-configurable) auto-added
3. **AI suggests additional questions** → automatic generation, annotator adopts/rejects
4. **Answer questions** → AI proposes answer + single evidence region, annotator confirms/edits
5. **Finalize** → human confirms all answers (soft lock, status = VALIDATED)
6. **Self re-open** → annotator can re-open their own finalized work
7. **Check contribution** → view images annotated + questions answered

### Design Decisions

- **Extractive questions only**: No calculated/reasoning questions (answer must be visible in image)
- **Single bounding box**: One evidence region per question-answer pair
- **Default questions have language**: Questions are language-specific (e.g., Japanese receipts get Japanese questions)
- **Self re-open**: Annotators can freely re-open their own finalized annotations without curator approval

## Impact

### Requirements (requirements.md)

Add new section **3.4 Annotation Workflow**:

```markdown
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
```

Also renumber existing sections:
- 3.4 Dataset Statistics → 3.5 Dataset Statistics
- 3.5 Dataset Version Management → 3.6 Dataset Version Management

### Design (design.md)

#### New Data Model: DefaultQuestion Table

Add after Annotation Table section in **2.1 Database Schema**:

```typescript
#### DefaultQuestion Table
interface DefaultQuestion {
  id: string;                    // Partition Key (UUID)
  
  // Classification
  documentType: DocumentType;    // RECEIPT, INVOICE, etc.
  language: string;              // ISO 639-1 code (ja, en, zh, ko)
  
  // Question content
  questionText: string;          // e.g., "What is the shop name?"
  questionType: QuestionType;    // EXTRACTIVE only
  
  // Ordering
  displayOrder: number;          // Sort order within category+language
  
  // Status
  isActive: boolean;             // Can be disabled without deletion
  
  // User tracking
  createdBy: string;             // Admin who created
  createdAt: string;
  updatedBy?: string;
  updatedAt?: string;
}

// Authorization Rules:
// - Anyone authenticated can read
// - Only Admins can create, update, delete

// Secondary Indexes:
// - defaultQuestionsByDocumentType: Query by documentType
// - Filter by language in application layer
```

#### New GraphQL Operations

Add to **2.2 GraphQL Schema**:

```graphql
# Queries
type Query {
  # ... existing queries ...
  
  # Default Questions
  listDefaultQuestions(documentType: DocumentType!, language: String!): [DefaultQuestion]
  
  # AI Suggestions
  generateQuestionSuggestions(imageId: ID!): GenerateQuestionsResult
  generateAnswerSuggestion(imageId: ID!, question: String!): AnswerSuggestion
  
  # Contribution Stats
  getMyContributions: ContributionStats
}

# Mutations
type Mutation {
  # ... existing mutations ...
  
  # Default Questions (Admin only)
  createDefaultQuestion(input: CreateDefaultQuestionInput!): DefaultQuestion
  updateDefaultQuestion(id: ID!, input: UpdateDefaultQuestionInput!): DefaultQuestion
  deleteDefaultQuestion(id: ID!): DeleteResult
  
  # Annotation Workflow
  finalizeAnnotation(imageId: ID!): Image
  reopenAnnotation(imageId: ID!): Image
}

# New Types
type DefaultQuestion {
  id: ID!
  documentType: DocumentType!
  language: String!
  questionText: String!
  questionType: QuestionType!
  displayOrder: Int!
  isActive: Boolean!
  createdAt: AWSDateTime!
}

type QuestionSuggestion {
  questionText: String!
  questionType: QuestionType!
  confidence: Float
}

type GenerateQuestionsResult {
  suggestions: [QuestionSuggestion!]!
  modelVersion: String
}

type AnswerSuggestion {
  answer: String!
  boundingBox: [Int!]!          # [x0, y0, x1, y1]
  confidence: Float
}

type ContributionStats {
  imagesAnnotated: Int!
  questionsAnswered: Int!
}
```

#### Updated Component Hierarchy

Update in **3.1 Frontend Components**:

```
│   │   ├── AnnotationWorkspace
│   │   │   ├── ImageViewer
│   │   │   │   ├── CanvasAnnotator
│   │   │   │   └── ZoomControls
│   │   │   ├── QuestionPanel
│   │   │   │   ├── QuestionList
│   │   │   │   ├── AISuggestionList
│   │   │   │   └── QuestionItem
│   │   │   ├── AnswerEditor
│   │   │   │   ├── AIAnswerSuggestion
│   │   │   │   └── BoundingBoxSelector
│   │   │   └── FinalizeControls
│   │   ├── Settings
│   │   │   ├── DefaultQuestionManager  // NEW
│   │   │   ├── ModelConfiguration
│   │   │   └── HuggingFaceSettings
│   │   └── Dashboard
│   │       ├── StatisticsCards
│   │       ├── ContributionStats       // NEW
│   │       └── RecentActivity
```

### Tasks (tasks.md)

Add to **Sprint 2: AI-Assisted Annotation**:

```markdown
### Default Questions Configuration
- ⬜ Add DefaultQuestion model to `amplify/data/resource.ts`
- ⬜ Create DefaultQuestionManager admin page
- ⬜ Seed initial default questions for each document type

### Annotation Workflow UI
- ⬜ Update AnnotationWorkspace with QuestionPanel
- ⬜ Implement QuestionList with default questions loading
- ⬜ Implement AISuggestionList with adopt/reject buttons
- ⬜ Implement AnswerEditor with AI suggestion button
- ⬜ Implement FinalizeControls with finalize/re-open buttons

### AI Integration
- ⬜ Create Lambda function for question generation
- ⬜ Create Lambda function for answer suggestion
- ⬜ Integrate Nemotron API for inference

### Contribution Tracking
- ⬜ Add ContributionStats component to Dashboard
- ⬜ Implement getMyContributions query
```

## Alternatives Considered

1. **Curator approval for re-open**: Rejected - adds friction without significant benefit for MVP
2. **Multiple bounding boxes per answer**: Rejected - simplifies UI and data model
3. **Include reasoning questions**: Rejected - answers must be visible in image for evidence marking

## Implementation Plan

1. Create DefaultQuestion data model and admin UI
2. Update AnnotationWorkspace with question panel
3. Integrate AI question generation (Nemotron)
4. Integrate AI answer suggestion (Nemotron)
5. Implement finalization workflow
6. Add contribution tracking to dashboard

---

**Estimated Effort**: 2-3 weeks (Sprint 2)
