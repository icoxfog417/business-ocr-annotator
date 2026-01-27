# Proposal: Context-Aware OCR Prompt for Receipt Items

**Date**: 2026-01-26
**Author**: Claude Agent
**Status**: Tested ✅ - Ready for Implementation

## Background

The current Read button prompt instructs the model to return "答えの値だけ" (only the value). This works well for numeric fields (money, dates) but fails for text items like product names.

### Current Problem

When user asks "購入品目は?" (What are the items?) on a receipt:
```
りんご        ¥200
バナナ        ¥150
```

The model interprets "値" (value) as numeric → returns `200, 150` instead of `りんご, バナナ`.

### Root Cause

The prompt lacks context-awareness. It doesn't guide the model to:
1. Understand what type of answer the question expects (text vs numeric)
2. Extract the appropriate content based on question semantics

## Proposal

Redesign the prompt using prompt engineering best practices:

### Key Principles

1. **Chain-of-Thought**: Guide model to first understand the question type
2. **Few-Shot Examples**: Show expected input/output pairs
3. **Explicit Disambiguation**: Clarify what to extract for each question type
4. **Artifact Removal**: Specify what to exclude (labels, symbols, irrelevant data)

### New Prompt Design (Japanese) - TESTED ✅

```
画像を見て質問に答えてください。答えのみを簡潔に返してください。

質問: {{QUESTION}}

回答ルール:
- 「金額」「合計」「税」「対象」を聞かれたら → 数字のみ出力
- 「日付」を聞かれたら → yyyy/MM/dd形式で出力
- 「品目」「商品」「購入したもの」を聞かれたら → 商品の名前のみ出力（価格・数量・「合計」は除外）
- 「番号」「登録番号」を聞かれたら → Tで始まる番号のみ出力
- 複数ある場合 → 1行に1つ

説明文は不要。答えのみ。
```

### Test Results (2026-01-26)

| Test | Old Prompt | New Prompt | Status |
|------|------------|------------|--------|
| Items (購入品目) | 10 items including "合計", "内消費税等" | 4 actual product names only | ✅ **Fixed** |
| Money (合計金額) | 528 | 528 | ✅ Same |
| Date (日付) | 2026/01/22 | 2026/01/22 | ✅ Same |
| Registration (登録番号) | T2011001045931 | T2011001045931 | ✅ Same |
| 10% Tax (10%対象) | 3 | 38 | ✅ More accurate |
| Shop Name (店名) | LAWSON | LAWSON | ✅ Same |

### New Prompt Design (English) - Based on Japanese tested version

```
Look at the image and answer the question. Return only the answer, concisely.

Question: {{QUESTION}}

Answer rules:
- If asking for "amount", "total", "tax" → output numbers only
- If asking for "date" → output in yyyy/MM/dd format
- If asking for "items", "products", "purchases" → output product names only (exclude prices, quantities, "total")
- If asking for "number", "registration number" → output the number only (starting with T if applicable)
- If multiple items → one per line

No explanations needed. Answer only.
```

### New Prompt Design (Chinese) - Based on Japanese tested version

```
查看图像并回答问题。只返回答案，简洁明了。

问题: {{QUESTION}}

回答规则:
- 询问「金额」「合计」「税」→ 只输出数字
- 询问「日期」→ 以yyyy/MM/dd格式输出
- 询问「品目」「商品」「购买的东西」→ 只输出商品名称（排除价格、数量、「合计」）
- 询问「号码」「登记号」→ 只输出号码（如适用以T开头）
- 多个项目 → 每行一个

不需要解释。只要答案。
```

### New Prompt Design (Korean) - Based on Japanese tested version

```
이미지를 보고 질문에 답하세요. 답만 간결하게 반환하세요.

질문: {{QUESTION}}

답변 규칙:
- 「금액」「합계」「세금」을 물으면 → 숫자만 출력
- 「날짜」를 물으면 → yyyy/MM/dd 형식으로 출력
- 「품목」「상품」「구매한 것」을 물으면 → 상품 이름만 출력 (가격, 수량, 「합계」 제외)
- 「번호」「등록번호」를 물으면 → 번호만 출력 (해당되면 T로 시작)
- 여러 항목 → 한 줄에 하나씩

설명 불필요. 답만.
```

## Impact

- **Requirements**: No change (REQ-AW-007 already covers AI-assisted answering)
- **Design**: Update Lambda handler prompt only
- **Tasks**: Update `application/amplify/functions/generate-annotation/handler.ts`

## Implementation Plan

1. Update `SINGLE_QUESTION_PROMPTS` in handler.ts for all 4 languages
2. Test with sandbox using various question types
3. Deploy to production
4. Verify with actual receipts

## Testing Plan

### Test Cases

| Question | Expected Output | Validates |
|----------|-----------------|-----------|
| 合計金額は？ | `528` | Money extraction |
| 日付は？ | `2026/01/22` | Date formatting |
| 購入品目は？ | `りんご\nバナナ\n牛乳` | Item names (not prices) |
| 登録番号は？ | `T2011001045931` | ID extraction |
| 店名は？ | `セブンイレブン` | Text extraction |

### Test Script

```bash
cd .sandbox/read-prompt-test
# Update test-prompt.js with new prompt
node test-prompt.js sample_recipt.jpeg
```

## Alternatives Considered

1. **Question-type detection in code**: Detect question type and use different prompts
   - Rejected: Complex, error-prone, requires maintaining multiple prompts

2. **Post-processing cleanup**: Clean up model output based on question type
   - Rejected: Unreliable, can't fix wrong extraction

3. **Chain-of-thought with explicit reasoning (chosen)**: Guide model to understand question semantics
   - Chosen: Most robust, works for all question types

## Rollback Plan

If the new prompt causes issues:
1. Revert handler.ts to previous version
2. Deploy immediately
3. Investigate specific failure cases

## Success Criteria

- ✅ Money questions return numbers only
- ✅ Date questions return yyyy/MM/dd format
- ✅ Item questions return item names (not prices)
- ✅ ID questions return IDs only (no labels)
- ✅ All 4 languages work correctly
