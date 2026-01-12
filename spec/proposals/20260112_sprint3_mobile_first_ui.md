# Proposal: Sprint 3 - UX & Mobile UI Optimization

**Date**: 2026-01-12
**Author**: Claude Agent
**Status**: Proposed

## Background

Sprint 2 (AI-Assisted Annotation) is complete. The current implementation has functional features but lacks a streamlined user experience. The annotation workflow can be optimized for efficiency on **all devices** - desktop and mobile alike.

## Proposal

**Sprint 3** focuses on three complementary goals:

1. **UX Optimization**: Streamlined annotation cycle for all users
2. **Mobile UI**: Responsive design + touch support + camera capture
3. **Legal & Consent**: Data usage consent + AI model tracking for transparency

### The Optimized Annotation Cycle

This workflow benefits **both desktop and mobile users**:

```
┌─────────────────────────────────────────────────────────────────┐
│                    STREAMLINED ANNOTATION CYCLE                  │
│                     (Desktop & Mobile)                           │
└─────────────────────────────────────────────────────────────────┘

    ┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐
    │  Upload  │  →   │  Answer  │  →   │ Finalize │  →   │  Next    │
    │  Image   │      │ Questions│      │          │      │  Image   │
    └──────────┘      └──────────┘      └──────────┘      └──────────┘
         │                 │                 │                 │
         ▼                 ▼                 ▼                 ▼
    ┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐
    │ Desktop: │      │ Question │      │ Summary  │      │ Return   │
    │ Drag&Drop│      │ by       │      │ + Submit │      │ to       │
    │ Mobile:  │      │ Question │      │          │      │ Upload   │
    │ Camera   │      │ Flow     │      │          │      │          │
    └──────────┘      └──────────┘      └──────────┘      └──────────┘
```

### Sprint 3 Scope

| Include | Exclude (Future Sprint) |
|---------|------------------------|
| Streamlined annotation cycle | Complex gesture library |
| **Question selection on Upload** | Pinch-to-zoom |
| Question-by-question flow | Offline support |
| **Box-first workflow** | PWA features |
| **[📖 Read] button (AI text extraction)** | Haptic feedback |
| Progress indicators | Skeleton loading |
| Responsive layouts | |
| Mobile navigation | |
| Camera capture (mobile) | |
| Touch-friendly bounding box | |
| **User consent dialog (multi-language)** | |
| **AI model tracking on annotations** | |

**Duration**: 1 week (5-6 working days)

## Part 1: UX Optimization (All Devices)

### 1.1 Question-by-Question Flow (Box First, Then Read)

**Current**: User types answer first, then draws bounding box.

**Optimized**: User draws bounding box first, then AI reads the text from that region.

```
┌─────────────────────────────────────────────────────────────┐
│                  ANNOTATION FLOW PER QUESTION                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   Step 1: See the question                                   │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  Q3: What is the total amount?                      │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                              │
│   Step 2: Draw bounding box on the answer area               │
│   ┌─────────────────────────────────────────────────────┐   │
│   │                                                     │   │
│   │   📄 Document Image                                 │   │
│   │         ┌─────────────┐                             │   │
│   │         │ ¥1,280      │ ← User draws box here       │   │
│   │         └─────────────┘                             │   │
│   │                                                     │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                              │
│   Step 3: AI reads text from the box (or type manually)      │
│   ┌──────────────────────────────────┐  ┌─────────────┐     │
│   │ ¥1,280                           │  │  📖 Read    │     │
│   └──────────────────────────────────┘  └─────────────┘     │
│                                          ↑ AI fills answer   │
│                                                              │
│   Step 4: Confirm and proceed                                │
│   ┌─────────┐              ┌─────────┐   ┌─────────────┐   │
│   │ ◀ Prev  │              │  Skip   │   │  Next ▶     │   │
│   └─────────┘              └─────────┘   └─────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### The "Read" Button

The **[📖 Read]** button uses AI to extract text from the selected bounding box region:

| User Action | Result |
|-------------|--------|
| Draw box around "¥1,280" | Box is created |
| Click **[📖 Read]** | AI reads "¥1,280" and fills the answer field |
| Edit if needed | User can correct any mistakes |
| Click **[Next ▶]** | Move to next question |

**Why "Read"?**
- Simple, intuitive verb
- Conveys "reading from image"
- Works across languages (読む, Read)
- Short enough for mobile buttons

**Benefits:**
- No typing for complex text (receipt IDs, amounts, addresses)
- Visual confirmation of answer location
- AI assists but user controls
- Faster annotation cycle

### 1.2 Unified Upload → Annotate → Finalize Flow

```
Step 1: UPLOAD + SELECT QUESTIONS
┌────────────────────────────────────┐
│  Upload Image                      │
│  ┌──────────────────────────────┐  │
│  │  Drag & drop or click        │  │  ← Desktop
│  │  [📷 Camera] [📁 Browse]     │  │  ← Mobile options
│  └──────────────────────────────┘  │
│                                    │
│  Document Type: [Receipt     ▼]    │  ← Auto-loads default questions
│  Language:      [Japanese    ▼]    │
│                                    │
│  ┌──────────────────────────────┐  │
│  │ Questions to Answer:         │  │
│  │                              │  │
│  │ ☑ What is the shop name?    │  │  ← Default questions
│  │ ☑ What is the date?         │  │    (pre-checked)
│  │ ☑ What is the total amount? │  │
│  │ ☑ What is the payment method?│  │
│  │ ☐ What is the receipt number?│  │  ← Optional
│  │                              │  │
│  │ [+ Add Custom Question]      │  │  ← Add own question
│  └──────────────────────────────┘  │
│                                    │
│  [Upload & Start Annotation]       │
└────────────────────────────────────┘
                 ↓
Step 2: ANNOTATE (question by question - just answer!)
┌────────────────────────────────────┐
│  ← Back         Receipt_001.jpg    │
│  ┌──────────────────────────────┐  │
│  │   [Image]    ┌──────────┐    │  │
│  │              │ Box here │    │  │
│  │              └──────────┘    │  │
│  └──────────────────────────────┘  │
│  ● ○ ○ ○  Question 1/4             │
│  Q: What is the shop name?         │
│                                    │
│  ① [Draw Box]  ← First: select area│
│                                    │
│  ② Answer: [________] [📖 Read]   │
│             ↑ AI fills or type     │
│                                    │
│  [◀ Prev] [Skip] [Next ▶]         │
└────────────────────────────────────┘
      ↑ No question management here!
      Just focus on answering.
                 ↓ (repeat for each selected question)
                 ↓
Step 3: FINALIZE
┌────────────────────────────────────┐
│  ✅ Annotation Complete            │
│                                    │
│  Summary:                          │
│  • 4 questions answered            │
│  • 4 bounding boxes drawn          │
│                                    │
│  [📷 Upload Next Image]  ← Primary │
│  [Back to Gallery]       ← Secondary│
└────────────────────────────────────┘
```

### 1.3 Question Selection on Upload

**Why select questions before annotation?**

| Before (Complex) | After (Simple) |
|------------------|----------------|
| Upload image | Upload image |
| Start annotating | **Select questions** |
| Manage questions while working | Start annotating |
| Add/remove questions mid-flow | **Just answer questions** |
| Cognitive overload | Focused workflow |

**Question Selection Features:**

1. **Auto-load defaults**: When document type is selected, default questions for that type are pre-checked
2. **Toggle questions**: Uncheck questions you don't want to answer
3. **Add custom**: Add your own questions if needed
4. **Remember preferences**: Last used questions can be remembered per document type

```
Document Type Selected: Receipt (Japanese)
                    ↓
┌─────────────────────────────────────┐
│  Default Questions (auto-checked):  │
│  ☑ 店名は何ですか？                 │
│  ☑ 日付はいつですか？               │
│  ☑ 合計金額はいくらですか？          │
│  ☑ 支払い方法は何ですか？            │
│                                     │
│  Optional Questions:                │
│  ☐ レシート番号は何ですか？          │
│  ☐ 税額はいくらですか？              │
│                                     │
│  [+ カスタム質問を追加]              │
└─────────────────────────────────────┘
```

### 1.4 Progress Indicators

**Question Progress:**
```
● ● ● ○ ○   3 of 5 answered
✓ ✓ ● ○ ○   (with checkmarks for completed)
```

**Overall Session Progress:**
```
Today: 12 images annotated | 47 questions answered
```

### 1.5 Keyboard Shortcuts (Desktop)

| Shortcut | Action |
|----------|--------|
| `→` or `Enter` | Next question |
| `←` | Previous question |
| `D` | Toggle draw mode |
| `R` | Read text from box (AI) |
| `S` | Skip question |
| `Esc` | Cancel drawing |
| `Ctrl+Enter` | Finalize annotation |

## Part 2: Mobile UI Optimization

### 2.1 Responsive Layout Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                    RESPONSIVE BREAKPOINTS                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Mobile (< 768px)          Tablet (768-1024px)              │
│  ┌──────────────┐          ┌─────────────────────┐          │
│  │   Stacked    │          │  Image  │  Q&A     │          │
│  │   Layout     │          │         │  Panel   │          │
│  │              │          │         │          │          │
│  │  [Image]     │          └─────────────────────┘          │
│  │  [Q&A Form]  │                                           │
│  │  [Actions]   │          Desktop (> 1024px)               │
│  │  [Bottom Nav]│          ┌─────────────────────────────┐  │
│  └──────────────┘          │ Sidebar │ Image │ Q&A Panel │  │
│                            │         │       │           │  │
│                            └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Mobile Navigation

```
Bottom Navigation Bar (Mobile Only)
┌────────────────────────────────────────────┐
│   🏠        📷        📋        👤         │
│  Home    Upload    Gallery    Profile      │
└────────────────────────────────────────────┘
Height: 60px + safe area
```

### 2.3 Camera Capture (Mobile)

```html
<!-- Simple HTML5 approach - works everywhere -->
<input type="file" accept="image/*" capture="environment" />
```

**Mobile Upload Screen:**
```
┌────────────────────────┐
│  ←  Upload Image       │
├────────────────────────┤
│  ┌──────────────────┐  │
│  │  📷 Take Photo   │  │  ← Primary
│  └──────────────────┘  │
│  ┌──────────────────┐  │
│  │ 🖼️ From Gallery  │  │  ← Secondary
│  └──────────────────┘  │
│                        │
│  ┌──────────────────┐  │
│  │ [Preview image]  │  │  ← After capture
│  └──────────────────┘  │
│                        │
│  Document: [Receipt ▼] │
│  Language: [日本語  ▼] │
│                        │
├────────────────────────┤
│  Questions to Answer:  │
│  ☑ 店名               │
│  ☑ 日付               │
│  ☑ 合計金額           │
│  ☑ 支払い方法         │
│  [+ 追加]              │
├────────────────────────┤
│  [Cancel]   [Start →] │
└────────────────────────┘
```

**Mobile Question Selection:**
- Default questions auto-loaded based on document type
- Tap checkbox to toggle
- Scrollable list if many questions
- [+ 追加] to add custom question

### 2.4 Touch-Friendly Annotation

**Touch Canvas (no external library):**

Based on sandbox verification (see Q13 in `spec/implementation_qa.md`), the recommended approach uses **explicit draw mode** with **tappable mode indicator**:

```
┌─────────────────────────────────────────────────────────────┐
│  VIEW MODE (default)          │  DRAW MODE                  │
├───────────────────────────────┼─────────────────────────────┤
│  • One finger = scroll        │  • One finger = draw box    │
│  • Two fingers = scroll       │  • Two fingers = scroll     │
│  • Touch layer: pass-through  │  • Touch layer: captures    │
├───────────────────────────────┴─────────────────────────────┤
│  MODE TOGGLE OPTIONS (implement all three):                 │
│  1. "Draw Box" button - primary action                      │
│  2. Mode badge (top-right corner) - tap to toggle ⭐ QUICK  │
│  3. Cancel button - appears in draw mode                    │
└─────────────────────────────────────────────────────────────┘
```

**Key UX Insight**: The **tappable mode badge** (always visible in top-right corner) was found to be highly useful during testing. Users can quickly tap it to toggle draw mode without scrolling to find the Draw Box button.

```typescript
// Simplified state
type TouchMode = 'view' | 'draw';

// CSS for touch layer
touchAction: isDrawMode ? 'pan-x pan-y' : 'auto'  // Allow two-finger scroll in draw mode
pointerEvents: isDrawMode ? 'auto' : 'none'       // Pass-through in view mode
```

**Mobile Annotation Layout:**
```
┌────────────────────────┐
│ ← Receipt_001  [VIEW⚡]│  40px header + mode badge (tap to toggle!)
├────────────────────────┤
│                        │
│  ┌──────────────────┐  │
│  │                  │  │
│  │   Document       │  │  50% viewport
│  │   Image          │  │
│  │   ┌────────┐     │  │
│  │   │ Box    │     │  │
│  │   └────────┘     │  │
│  └──────────────────┘  │
│                        │
│  [−] [+] [Fit]         │  Zoom controls
│                        │
├────────────────────────┤
│  ● ○ ○ ○ ○   1/5       │  Progress dots
├────────────────────────┤
│  What is the shop name?│  Question
│                        │
│  ① [✏️ Draw Box]       │  First: draw box (or tap mode badge)
│                        │
│  ② ┌──────────┐ [📖]  │  Then: Read or type
│    │ Answer   │ Read  │
│    └──────────┘       │
│                        │
├────────────────────────┤
│ ◀ Prev  │ Skip │ Next ▶│  Navigation (48px)
└────────────────────────┘
│  🏠   📷   📋   👤    │  Bottom nav
└────────────────────────┘

Mode Badge States:
• [VIEW] - Gray, tap to enter draw mode
• [DRAW] - Blue pulsing, tap to cancel/exit
```

**Flow on Mobile:**
1. See question at top
2. Tap **[✏️ Draw Box]** → draw on image
3. Tap **[📖 Read]** → AI fills answer (or type manually)
4. Tap **[Next ▶]** → proceed to next question

### 2.5 Touch Target Requirements

| Element | Minimum Size |
|---------|-------------|
| Buttons | 48 × 48 px |
| Form inputs | 48 px height |
| Nav items | 48 × 48 px |
| Box corners | 32 × 32 px touch area |
| List items | 48 px height |

## Implementation Plan

### Phase 1: UX Flow Refactor (Day 1-2)

**Tasks:**
- [ ] Create `src/config/defaultQuestions.json` config file
  - All document types (RECEIPT, INVOICE, ORDER_FORM, TAX_FORM, CONTRACT, APPLICATION_FORM, OTHER)
  - All languages (ja, en, zh, ko)
  - Default + optional questions per type/language
- [ ] Create `useDefaultQuestions` hook to load from config
- [ ] Create `QuestionSelector` component (on Upload screen)
  - Load questions from config by document type + language
  - Checkbox list for question selection
  - Add custom question input
  - Pass selected questions to annotation flow
- [ ] Create `QuestionNavigator` component
  - Previous/Next navigation
  - Progress dots indicator
  - Current question highlight
- [ ] Create `AnnotationFlow` container
  - Question-by-question state management
  - Box-first workflow (draw → read → confirm)
  - Auto-advance on save
  - Skip functionality
  - **No question management** (read-only list from upload)
- [ ] Create `ReadButton` component (AI text extraction)
  - Calls existing Bedrock Lambda with bounding box region
  - Extracts text from selected area
  - Fills answer field automatically
  - Shows loading state during extraction
  - Handles errors gracefully
- [ ] Create `FinalizeScreen` component
  - Summary of completed annotations
  - "Upload Next" primary action
  - "Back to Gallery" secondary action
- [ ] Add keyboard shortcuts for desktop (including `R` for Read)
- [ ] Update annotation workspace layout (simplified, no question add/remove)

### Phase 2: Responsive Layout (Day 2-3)

**Tasks:**
- [ ] Define CSS breakpoint variables
  ```css
  --breakpoint-mobile: 768px;
  --breakpoint-tablet: 1024px;
  ```
- [ ] Create responsive layout components
  - `ResponsiveContainer` - handles breakpoints
  - `StackedLayout` - mobile
  - `SplitLayout` - tablet/desktop
- [ ] Update existing pages for responsiveness
  - Dashboard
  - Gallery
  - Upload
  - Annotation workspace
- [ ] Create `MobileNavigation` component (bottom bar)

### Phase 3: Mobile-Specific Features (Day 3-4)

**Tasks:**
- [ ] Create `CameraCapture` component
  - HTML5 file input with capture
  - Image preview before upload
  - Gallery fallback option
- [ ] Create `TouchCanvas` component
  - Native touch event handlers (no external library)
  - Explicit draw mode (not always-on)
  - `touch-action: pan-x pan-y` for two-finger scroll in draw mode
  - `pointer-events: none` in view mode for scroll pass-through
  - Single-finger draw, two-finger scroll
  - Auto-exit draw mode after successful box creation
  - Visual feedback (preview box while drawing)
- [ ] Create `ModeBadge` component (tappable mode indicator)
  - Fixed position top-right corner
  - Shows "VIEW" (gray) or "DRAW" (blue pulsing)
  - Tap to toggle draw mode
  - 48px minimum tap area
  - Works alongside Draw Box button
- [ ] Add mobile zoom controls (+/−/Fit buttons)

### Phase 4: Polish & Testing (Day 5-6)

**Tasks:**
- [ ] Touch target audit (all elements ≥48px)
- [ ] Keyboard shortcut testing (desktop)
- [ ] Device testing
  - iPhone Safari
  - Android Chrome
  - iPad Safari
  - Desktop Chrome/Firefox/Safari
- [ ] Flow testing: Upload → Annotate → Finalize → Next
- [ ] Performance check (Lighthouse mobile >70)

## File Structure

```
src/
├── components/
│   ├── layout/
│   │   ├── ResponsiveContainer.tsx  # Breakpoint detection
│   │   ├── MobileNavigation.tsx     # Bottom nav (mobile)
│   │   ├── StackedLayout.tsx        # Mobile layout
│   │   └── SplitLayout.tsx          # Desktop layout
│   ├── annotation/
│   │   ├── QuestionNavigator.tsx    # Question-by-question nav
│   │   ├── ProgressDots.tsx         # Visual progress indicator
│   │   ├── TouchCanvas.tsx          # Touch bounding box (view/draw mode)
│   │   ├── ModeBadge.tsx            # Tappable mode indicator (top-right)
│   │   ├── ReadButton.tsx           # AI text extraction from box
│   │   ├── AnnotationFlow.tsx       # Flow state management
│   │   └── FinalizeScreen.tsx       # Completion screen
│   ├── upload/
│   │   ├── CameraCapture.tsx        # Mobile camera input
│   │   ├── QuestionSelector.tsx     # Select questions before annotation
│   │   └── UnifiedUpload.tsx        # Combined upload UI
│   └── consent/
│       ├── StartContributingBanner.tsx  # Dashboard banner for non-contributors
│       ├── StartContributingDialog.tsx  # Consent modal
│       └── ContributorGate.tsx          # Wrapper for contributor-only actions
├── config/
│   └── defaultQuestions.json        # Default questions config file
├── hooks/
│   ├── useBreakpoint.ts             # Responsive breakpoint hook
│   ├── useKeyboardShortcuts.ts      # Desktop keyboard shortcuts
│   ├── useDefaultQuestions.ts       # Load questions from config
│   ├── useReadText.ts               # AI text extraction hook
│   └── useContributorStatus.ts      # Check/update Cognito contributor status
├── contexts/
│   └── ContributorContext.tsx       # Global contributor state provider
├── i18n/
│   └── consent/
│       ├── en.json                  # English consent messages
│       ├── ja.json                  # Japanese consent messages
│       └── zh.json                  # Chinese consent messages
└── styles/
    ├── breakpoints.css              # CSS variables
    └── mobile.css                   # Mobile-specific styles

amplify/
├── auth/
│   └── resource.ts                  # Add custom:contributor attributes
```

### Default Questions Configuration

Instead of database table or hardcoded values, use a **JSON configuration file**:

**File**: `src/config/defaultQuestions.json`

```json
{
  "version": "1.0",
  "documentTypes": {
    "RECEIPT": {
      "ja": {
        "default": [
          { "id": "r-ja-1", "text": "店名は何ですか？", "type": "EXTRACTIVE" },
          { "id": "r-ja-2", "text": "日付はいつですか？", "type": "EXTRACTIVE" },
          { "id": "r-ja-3", "text": "合計金額はいくらですか？", "type": "EXTRACTIVE" },
          { "id": "r-ja-4", "text": "支払い方法は何ですか？", "type": "EXTRACTIVE" }
        ],
        "optional": [
          { "id": "r-ja-5", "text": "レシート番号は何ですか？", "type": "EXTRACTIVE" },
          { "id": "r-ja-6", "text": "税額はいくらですか？", "type": "EXTRACTIVE" }
        ]
      },
      "en": {
        "default": [
          { "id": "r-en-1", "text": "What is the store name?", "type": "EXTRACTIVE" },
          { "id": "r-en-2", "text": "What is the date?", "type": "EXTRACTIVE" },
          { "id": "r-en-3", "text": "What is the total amount?", "type": "EXTRACTIVE" },
          { "id": "r-en-4", "text": "What is the payment method?", "type": "EXTRACTIVE" }
        ],
        "optional": [
          { "id": "r-en-5", "text": "What is the receipt number?", "type": "EXTRACTIVE" },
          { "id": "r-en-6", "text": "What is the tax amount?", "type": "EXTRACTIVE" }
        ]
      },
      "zh": {
        "default": [
          { "id": "r-zh-1", "text": "店名是什么？", "type": "EXTRACTIVE" },
          { "id": "r-zh-2", "text": "日期是什么时候？", "type": "EXTRACTIVE" },
          { "id": "r-zh-3", "text": "总金额是多少？", "type": "EXTRACTIVE" },
          { "id": "r-zh-4", "text": "付款方式是什么？", "type": "EXTRACTIVE" }
        ],
        "optional": []
      },
      "ko": {
        "default": [
          { "id": "r-ko-1", "text": "상점 이름은 무엇입니까?", "type": "EXTRACTIVE" },
          { "id": "r-ko-2", "text": "날짜는 언제입니까?", "type": "EXTRACTIVE" },
          { "id": "r-ko-3", "text": "총 금액은 얼마입니까?", "type": "EXTRACTIVE" },
          { "id": "r-ko-4", "text": "결제 방법은 무엇입니까?", "type": "EXTRACTIVE" }
        ],
        "optional": []
      }
    },
    "INVOICE": {
      "ja": {
        "default": [
          { "id": "i-ja-1", "text": "請求書番号は何ですか？", "type": "EXTRACTIVE" },
          { "id": "i-ja-2", "text": "請求金額はいくらですか？", "type": "EXTRACTIVE" },
          { "id": "i-ja-3", "text": "支払期限はいつですか？", "type": "EXTRACTIVE" },
          { "id": "i-ja-4", "text": "請求先は誰ですか？", "type": "EXTRACTIVE" }
        ],
        "optional": []
      },
      "en": {
        "default": [
          { "id": "i-en-1", "text": "What is the invoice number?", "type": "EXTRACTIVE" },
          { "id": "i-en-2", "text": "What is the invoice amount?", "type": "EXTRACTIVE" },
          { "id": "i-en-3", "text": "When is the due date?", "type": "EXTRACTIVE" },
          { "id": "i-en-4", "text": "Who is the recipient?", "type": "EXTRACTIVE" }
        ],
        "optional": []
      }
    },
    "ORDER_FORM": {
      "ja": {
        "default": [
          { "id": "o-ja-1", "text": "注文番号は何ですか？", "type": "EXTRACTIVE" },
          { "id": "o-ja-2", "text": "注文日はいつですか？", "type": "EXTRACTIVE" },
          { "id": "o-ja-3", "text": "合計金額はいくらですか？", "type": "EXTRACTIVE" }
        ],
        "optional": []
      },
      "en": {
        "default": [
          { "id": "o-en-1", "text": "What is the order number?", "type": "EXTRACTIVE" },
          { "id": "o-en-2", "text": "What is the order date?", "type": "EXTRACTIVE" },
          { "id": "o-en-3", "text": "What is the total amount?", "type": "EXTRACTIVE" }
        ],
        "optional": []
      }
    },
    "TAX_FORM": {
      "ja": {
        "default": [
          { "id": "t-ja-1", "text": "納税者番号は何ですか？", "type": "EXTRACTIVE" },
          { "id": "t-ja-2", "text": "課税年度は何年ですか？", "type": "EXTRACTIVE" },
          { "id": "t-ja-3", "text": "納税額はいくらですか？", "type": "EXTRACTIVE" }
        ],
        "optional": []
      },
      "en": {
        "default": [
          { "id": "t-en-1", "text": "What is the taxpayer ID?", "type": "EXTRACTIVE" },
          { "id": "t-en-2", "text": "What is the tax year?", "type": "EXTRACTIVE" },
          { "id": "t-en-3", "text": "What is the tax amount?", "type": "EXTRACTIVE" }
        ],
        "optional": []
      }
    },
    "CONTRACT": {
      "ja": {
        "default": [
          { "id": "c-ja-1", "text": "契約番号は何ですか？", "type": "EXTRACTIVE" },
          { "id": "c-ja-2", "text": "契約日はいつですか？", "type": "EXTRACTIVE" },
          { "id": "c-ja-3", "text": "契約当事者は誰ですか？", "type": "EXTRACTIVE" }
        ],
        "optional": []
      },
      "en": {
        "default": [
          { "id": "c-en-1", "text": "What is the contract number?", "type": "EXTRACTIVE" },
          { "id": "c-en-2", "text": "What is the contract date?", "type": "EXTRACTIVE" },
          { "id": "c-en-3", "text": "Who are the parties?", "type": "EXTRACTIVE" }
        ],
        "optional": []
      }
    },
    "APPLICATION_FORM": {
      "ja": {
        "default": [
          { "id": "a-ja-1", "text": "申請者名は何ですか？", "type": "EXTRACTIVE" },
          { "id": "a-ja-2", "text": "申請日はいつですか？", "type": "EXTRACTIVE" },
          { "id": "a-ja-3", "text": "申請番号は何ですか？", "type": "EXTRACTIVE" }
        ],
        "optional": []
      },
      "en": {
        "default": [
          { "id": "a-en-1", "text": "What is the applicant name?", "type": "EXTRACTIVE" },
          { "id": "a-en-2", "text": "What is the application date?", "type": "EXTRACTIVE" },
          { "id": "a-en-3", "text": "What is the application number?", "type": "EXTRACTIVE" }
        ],
        "optional": []
      }
    },
    "OTHER": {
      "ja": {
        "default": [
          { "id": "x-ja-1", "text": "文書のタイトルは何ですか？", "type": "EXTRACTIVE" },
          { "id": "x-ja-2", "text": "日付はいつですか？", "type": "EXTRACTIVE" }
        ],
        "optional": []
      },
      "en": {
        "default": [
          { "id": "x-en-1", "text": "What is the document title?", "type": "EXTRACTIVE" },
          { "id": "x-en-2", "text": "What is the date?", "type": "EXTRACTIVE" }
        ],
        "optional": []
      }
    }
  }
}
```

**Usage in Hook**:

```typescript
// src/hooks/useDefaultQuestions.ts
import defaultQuestions from '../config/defaultQuestions.json';

export function useDefaultQuestions(documentType: string, language: string) {
  const docQuestions = defaultQuestions.documentTypes[documentType];
  const langQuestions = docQuestions?.[language] || docQuestions?.['en'];

  return {
    defaultQuestions: langQuestions?.default || [],
    optionalQuestions: langQuestions?.optional || [],
  };
}
```

**Benefits**:
- Version controlled with code
- No database seeding required
- Easy to edit and review
- Type-safe with TypeScript
- Supports default + optional questions
- Fallback to English if language not found

## Part 3: Legal & Consent Requirements

### 3.1 User Consent Flow

**Purpose**: Ensure users understand and agree to how their contributed data will be used before they can upload any images or annotations.

**Consent Trigger**: First-time upload attempt (image or annotation)

```
┌─────────────────────────────────────────────────────────────┐
│                    DATA USAGE CONSENT                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  📋 Important: Please Read Before Contributing               │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                                                         │ │
│  │  The images and question-answer pairs you submit       │ │
│  │  will be used to build a dataset for evaluating and    │ │
│  │  improving AI model capabilities.                      │ │
│  │                                                         │ │
│  │  This dataset will be published publicly and may be    │ │
│  │  used for both academic research and commercial        │ │
│  │  purposes to accelerate AI development.                │ │
│  │                                                         │ │
│  │  ⚠️ DO NOT submit any personal information or other    │ │
│  │  sensitive information that you would not want to be   │ │
│  │  shared publicly.                                       │ │
│  │                                                         │ │
│  │  By continuing to use this application, you            │ │
│  │  acknowledge and consent to this data sharing.         │ │
│  │                                                         │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ☐ I understand and consent to the above terms              │
│                                                              │
│  [Cancel]                              [I Agree & Continue]  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Multi-Language Support**: Display consent message in the annotator's selected language:

| Language | Title | Key Message |
|----------|-------|-------------|
| English | Data Usage Consent | "The images and Q&A you submit will be used to build a dataset..." |
| Japanese | データ利用への同意 | 「送信された画像とQ&Aはデータセット構築に使用されます...」 |
| Chinese | 数据使用同意 | "您提交的图像和问答将用于构建数据集..." |

**Consent Storage (Cognito Custom Attributes)**:

Instead of a DynamoDB table, consent is stored as Cognito custom attributes for simplicity:

```typescript
// amplify/auth/resource.ts
export const auth = defineAuth({
  loginWith: { email: true },
  userAttributes: {
    'custom:contributor': {      // "true" when consented
      dataType: 'String',
      mutable: true,
    },
    'custom:consent_date': {     // ISO timestamp
      dataType: 'String',
      mutable: true,
    },
    'custom:consent_version': {  // e.g., "1.0"
      dataType: 'String',
      mutable: true,
    },
  },
});
```

**Benefits of Cognito approach**:
- No extra DynamoDB table needed
- Consent data comes with auth token (zero latency)
- No additional API calls to check consent
- Simpler implementation

**Contributor Flow** (Option C: "Start Contributing" onboarding):

```
┌─────────────────────────────────────────────────────────────┐
│                      USER ACCESS LEVELS                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  VIEWER (no consent)              CONTRIBUTOR (consented)    │
│  ┌──────────────────────┐         ┌──────────────────────┐  │
│  │ ✓ View dashboard     │         │ ✓ Everything viewer  │  │
│  │ ✓ Browse gallery     │         │   can do, plus:      │  │
│  │ ✓ View images        │         │                      │  │
│  │ ✓ View annotations   │         │ ✓ Upload images      │  │
│  │                      │         │ ✓ Create annotations │  │
│  │ ✗ Upload images      │         │ ✓ Edit annotations   │  │
│  │ ✗ Create annotations │         │ ✓ Use [📖 Read] AI   │  │
│  └──────────────────────┘         └──────────────────────┘  │
│           │                                 ▲                │
│           │     [🚀 Start Contributing]     │                │
│           └─────────────────────────────────┘                │
│                 (updates Cognito attributes)                 │
└─────────────────────────────────────────────────────────────┘

Consent Check (on app load):
  1. fetchUserAttributes() from Cognito
  2. Check custom:contributor === "true"
  3. If true → contributor status
  4. If false/empty → viewer status (show banner)

Become Contributor:
  1. User taps "Start Contributing" banner
  2. Show consent dialog
  3. User checks box + clicks "Agree"
  4. updateUserAttributes({
       'custom:contributor': 'true',
       'custom:consent_date': new Date().toISOString(),
       'custom:consent_version': '1.0'
     })
  5. Update ContributorContext → UI re-renders
```

### 3.2 AI Model Usage Tracking

**Purpose**: Record which AI model was used when annotators use the [📖 Read] button for transparency and reproducibility of the dataset.

**When to Record**: Every time the [📖 Read] button successfully extracts text from a bounding box.

**Data Model Update**:

```typescript
// Extended Annotation record
interface Annotation {
  // ... existing fields ...

  // NEW: AI assistance tracking
  aiAssisted: boolean;           // True if [📖 Read] was used
  aiModelId?: string;            // e.g., "anthropic.claude-3-5-sonnet-20241022-v2:0"
  aiModelProvider?: string;      // e.g., "bedrock"
  aiExtractionTimestamp?: string; // When AI extraction occurred
}

// For batch tracking in Image metadata
interface ImageMetadata {
  // ... existing fields ...

  // NEW: AI usage summary
  aiAssistedCount: number;       // Number of Q&A pairs using AI
  aiModelsUsed: string[];        // List of distinct models used
}
```

**Implementation**:

```typescript
// When [📖 Read] is clicked:
const extractTextFromBox = async (boundingBox: BoundingBox) => {
  const response = await invokeBedrockOCR(boundingBox);

  // Record model info in annotation
  return {
    extractedText: response.text,
    modelId: response.modelId,        // e.g., "anthropic.claude-3-5-sonnet-20241022-v2:0"
    modelProvider: "bedrock",
    timestamp: new Date().toISOString()
  };
};
```

**Display in UI (optional future enhancement)**:

```
┌────────────────────────────────────┐
│  Q: What is the total amount?      │
│  A: ¥1,280                         │
│  📍 Box: [120,340,200,380]         │
│  🤖 AI: claude-3-5-sonnet (Bedrock)│  ← Shows AI model used
└────────────────────────────────────┘
```

### 3.3 Implementation Tasks (Legal & Consent)

**Phase 0: Contributor Consent System (Day 1 - parallel with UX)**

- [ ] Add custom attributes to `amplify/auth/resource.ts`
  - `custom:contributor` (string: "true" when consented)
  - `custom:consent_date` (string: ISO timestamp)
  - `custom:consent_version` (string: "1.0")
- [ ] Deploy auth changes (`npx ampx sandbox`)
- [ ] Create `useContributorStatus` hook
  - Fetch user attributes on auth
  - Check `custom:contributor` status
  - `becomeContributor()` function to update attributes
- [ ] Create `ContributorContext` provider (global state)
- [ ] Create `StartContributingBanner` component (dashboard)
  - Shows for non-contributors
  - "Start Contributing" call-to-action
- [ ] Create `StartContributingDialog` component (consent modal)
  - Multi-language message display
  - Checkbox for explicit consent
  - Cancel and Accept buttons
- [ ] Create `ContributorGate` component (action wrapper)
  - Wraps upload/annotate buttons
  - Shows disabled state or tooltip for non-contributors
- [ ] Add consent message translations (EN, JA, ZH)

**Model Tracking (integrated with Phase 1)**

- [ ] Update Annotation data model to include AI model fields
- [ ] Modify `ReadButton` component to capture model info from response
- [ ] Update annotation save logic to persist model info
- [ ] Update Lambda to return model ID in response

## No New Dependencies

Use existing packages only:
- React + React Router (existing)
- Native touch events (browser API)
- CSS media queries (native)
- Keyboard events (native)

**No npm packages to install.**

## Sprint Renumbering

| Old Sprint | New Sprint | Name |
|------------|------------|------|
| Sprint 0 | Sprint 0 | Foundation & Deployment |
| Sprint 1 | Sprint 1 | Image Upload & Manual Annotation |
| Sprint 2 | Sprint 2 | AI-Assisted Annotation |
| *NEW* | **Sprint 3** | **UX & Mobile UI Optimization** |
| Sprint 3 | Sprint 4 | Queue-Based W&B Integration |
| Sprint 4 | Sprint 5 | Multi-Language Support |
| Sprint 5 | Sprint 6 | Advanced Mobile (gestures, offline) |
| Sprint 6 | Sprint 7 | Dataset Publishing & PII |
| Sprint 7 | Sprint 8 | Production Readiness |

## Acceptance Criteria

### UX (All Devices)
- [ ] **Question selection on Upload screen works**
- [ ] Default questions auto-load by document type + language
- [ ] User can add custom questions on Upload screen
- [ ] Question-by-question navigation works
- [ ] Box-first flow: draw box → read/type → next
- [ ] **[📖 Read] button extracts text from bounding box via AI**
- [ ] Progress dots show completion status
- [ ] Keyboard shortcuts work on desktop (including `R` for Read)
- [ ] Finalize screen shows summary
- [ ] "Upload Next" returns to upload page
- [ ] Complete cycle takes <5 minutes

### Legal & Consent (Contributor Flow)
- [ ] **"Start Contributing" banner appears on dashboard for non-contributors**
- [ ] Users can view dataset (gallery, images) without consent
- [ ] Tapping "Start Contributing" opens consent dialog
- [ ] Consent message displays in user's selected language (EN, JA, ZH)
- [ ] User must check checkbox and click "Agree" to proceed
- [ ] **Consent stored in Cognito custom attributes** (not DynamoDB)
- [ ] Upload/annotation buttons disabled until contributor status
- [ ] Contributor status is persistent (Cognito attributes)

### AI Model Tracking
- [ ] **Model ID recorded when [📖 Read] is used**
- [ ] Model provider (bedrock) stored with annotation
- [ ] AI-assisted flag set on annotation record
- [ ] Extraction timestamp recorded
- [ ] Lambda returns model ID in response

### Mobile UI
- [ ] All pages responsive at 375px width
- [ ] Bottom navigation works on mobile
- [ ] Camera capture works on iOS/Android
- [ ] Touch bounding box drawing works
- [ ] All touch targets ≥48px
- [ ] Zoom controls (+/−/Fit) work

### Quality
- [ ] Lighthouse mobile score >70
- [ ] Works on iPhone Safari
- [ ] Works on Android Chrome
- [ ] Works on desktop browsers

## Timeline

| Day | Focus | Deliverables |
|-----|-------|--------------|
| 1 | UX Flow + Consent | QuestionNavigator, ProgressDots, keyboard shortcuts, **Cognito attributes, useContributorStatus** |
| 2 | UX + Layout | AnnotationFlow, FinalizeScreen, breakpoint setup, **StartContributingBanner/Dialog, consent translations** |
| 3 | Responsive | Page layouts, MobileNavigation |
| 4 | Mobile + Model Tracking | CameraCapture, TouchCanvas, **AI model tracking in ReadButton** |
| 5 | Polish | Touch target audit, zoom controls |
| 6 | Testing | Device testing, bug fixes, **consent flow verification** |

**Total: 6 working days (1 week)**

## Out of Scope (Future Sprints)

- Pinch-to-zoom gestures (Sprint 6)
- Two-finger pan (Sprint 6)
- Offline support / PWA (Sprint 6)
- Haptic feedback (Sprint 6)
- Skeleton loading states (Sprint 6)
- Complex animations (Sprint 6)

## Success Metrics

| Metric | Target |
|--------|--------|
| Cycle completion time | <5 minutes |
| Touch accuracy | Box drawn correctly on first try |
| Lighthouse mobile | >70 |
| User test | 2+ users complete without help |

---

**Reviewed By**: Pending
**Approval Date**: Pending
