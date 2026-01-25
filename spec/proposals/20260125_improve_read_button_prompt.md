# Proposal: Improve Read Button Prompt for Value Extraction

**Date**: 2026-01-25
**Author**: Claude Agent
**Status**: ✅ Implemented

## Background

The current Read button prompt is too simple and returns raw text including labels. Users need:
1. Only the value (exclude labels like "登録番号", "日付")
2. Formatted output based on question context (money, date, items)

## Current Behavior

Prompt: "Look at this image and answer the following question. Question: {{QUESTION}}. Return only the answer text."

Problems:
- Returns "登録番号: T1234567890123" instead of "T1234567890123"
- Returns "2024年1月15日" instead of "2024/01/15"
- No formatting guidance for money, dates, lists

## Proposal

Update `SINGLE_QUESTION_PROMPTS` to include:
1. Instruction to extract value only (exclude labels)
2. Format detection based on question keywords
3. Language-specific formatting rules

### Prompt Structure

```
Extract the value from the selected area to answer this question.

Question: {{QUESTION}}

Rules:
1. Return ONLY the value, exclude any labels or field names
2. Format based on question type:
   - Money: numeric value only (e.g., "1,234")
   - Date: yyyy/MM/dd format (e.g., "2024/01/15")
   - Items/List: one item per line
   - Registration numbers: alphanumeric only
   - Other: clean text value

Examples:
- If area shows "合計金額: ¥1,234", return "1,234"
- If area shows "日付 2024年1月15日", return "2024/01/15"
- If area shows "登録番号: T1234567890123", return "T1234567890123"
```

## Impact

- **Requirements**: No change (REQ-AW-007 already covers AI-assisted answering)
- **Design**: Update Lambda handler prompt only
- **Tasks**: Update `application/amplify/functions/generate-annotation/handler.ts`

## Implementation Plan

1. Update `SINGLE_QUESTION_PROMPTS` in handler.ts for all languages (ja, en, zh, ko)
2. Add format detection logic based on question keywords
3. Test with various document types and questions

## Alternatives Considered

1. **Post-processing in frontend**: Too complex, language-dependent
2. **Separate Lambda for formatting**: Overkill for this use case
3. **Prompt engineering (chosen)**: Simple, effective, no code changes needed

## Testing Plan

Before implementation, we should test the prompt effectiveness:

### Step 1: Create Sandbox Test
Create `.sandbox/read-prompt-test/` to verify prompt behavior:

1. Set up minimal Lambda with new prompt
2. Test with sample images containing:
   - Money fields: `合計金額: ¥1,234`
   - Date fields: `日付 2024年1月15日`
   - Registration: `登録番号: T1234567890123`
   - Item lists: Multiple product names

### Step 2: Verify Output Format
Expected results:
- ✅ Money: Returns `1,234` (not `¥1,234` or `合計金額: ¥1,234`)
- ✅ Date: Returns `2024/01/15` (not `2024年1月15日`)
- ✅ Registration: Returns `T1234567890123` (not `登録番号: T1234567890123`)
- ✅ Items: Returns list format (one per line)

### Step 3: Multi-Language Testing
Test all 4 languages (ja, en, zh, ko) with equivalent prompts

### Step 4: Edge Cases
- Empty fields
- Multiple values in one area
- Mixed formats (e.g., "¥1,234 (税込)")

## Next Steps

1. **Create sandbox test** (`.sandbox/read-prompt-test/`)
2. **Run tests** with sample images
3. **Document results** in `spec/implementation_qa.md`
4. **If successful**: Implement in production
5. **If issues found**: Iterate on prompt design

## Testing

Test cases:
- Money questions: "合計金額は？" → "1,234" (not "¥1,234")
- Date questions: "日付は？" → "2024/01/15" (not "2024年1月15日")
- Registration: "登録番号は？" → "T1234567890123" (not "登録番号: T1234567890123")
- Items: "商品名は？" → "商品A\n商品B\n商品C" (list format)
