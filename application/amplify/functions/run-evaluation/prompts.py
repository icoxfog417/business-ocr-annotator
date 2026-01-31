"""
Multi-Language Evaluation Prompts

Prompt templates synchronized with annotation prompts (generate-annotation/handler.ts)
to ensure consistent answer formatting during evaluation.

Key principles:
- Same extraction rules as annotation prompts
- Language-specific formatting rules (amounts, dates, items)
- JSON output with answer and bounding box
"""
from typing import Dict

# Multi-language evaluation prompts synchronized with annotation prompts
# See: amplify/functions/generate-annotation/handler.ts (SINGLE_QUESTION_PROMPTS)
EVALUATION_PROMPTS: Dict[str, str] = {
    'ja': """画像を見て質問に答えてください。

質問: {question}

回答ルール:
- 「金額」「合計」「税」「対象」を聞かれたら → 数字のみ出力
- 「日付」を聞かれたら → yyyy/MM/dd形式で出力
- 「品目」「商品」「購入したもの」を聞かれたら → 商品の名前のみ出力（価格・数量・「合計」は除外）
- 「番号」「登録番号」を聞かれたら → Tで始まる番号のみ出力
- 複数ある場合 → 1行に1つ（改行で区切る）

JSON形式で返答してください:
{{"answer": "回答テキスト", "bbox": [x0, y0, x1, y1]}}

bboxは正規化座標（0-1範囲）で、回答が見つかる領域を指定してください。
説明文は不要。JSONのみ返してください。""",

    'en': """Look at the image and answer the question.

Question: {question}

Answer rules:
- If asking for "amount", "total", "tax" → output numbers only
- If asking for "date" → output in yyyy/MM/dd format
- If asking for "items", "products", "purchases" → output product names only (exclude prices, quantities, "total")
- If asking for "number", "registration number" → output the number only (starting with T if applicable)
- If multiple items → one per line (separate with newlines)

Return as JSON format:
{{"answer": "your answer text", "bbox": [x0, y0, x1, y1]}}

bbox should be normalized coordinates (0-1 range) indicating where the answer is found.
No explanations needed. Return ONLY valid JSON.""",

    'zh': """查看图像并回答问题。

问题: {question}

回答规则:
- 询问「金额」「合计」「税」→ 只输出数字
- 询问「日期」→ 以yyyy/MM/dd格式输出
- 询问「品目」「商品」「购买的东西」→ 只输出商品名称（排除价格、数量、「合计」）
- 询问「号码」「登记号」→ 只输出号码（如适用以T开头）
- 多个项目 → 每行一个（用换行符分隔）

以JSON格式返回:
{{"answer": "回答文本", "bbox": [x0, y0, x1, y1]}}

bbox应为正规化坐标（0-1范围），指示答案所在的区域。
不需要解释。只返回有效的JSON。""",

    'ko': """이미지를 보고 질문에 답하세요.

질문: {question}

답변 규칙:
- 「금액」「합계」「세금」을 물으면 → 숫자만 출력
- 「날짜」를 물으면 → yyyy/MM/dd 형식으로 출력
- 「품목」「상품」「구매한 것」을 물으면 → 상품 이름만 출력 (가격, 수량, 「합계」 제외)
- 「번호」「등록번호」를 물으면 → 번호만 출력 (해당되면 T로 시작)
- 여러 항목 → 한 줄에 하나씩 (줄바꿈으로 구분)

JSON 형식으로 반환:
{{"answer": "답변 텍스트", "bbox": [x0, y0, x1, y1]}}

bbox는 정규화된 좌표(0-1 범위)로, 답변이 발견된 영역을 지정하세요.
설명 불필요. 유효한 JSON만 반환하세요.""",
}

# Default prompt (English) for unknown languages
DEFAULT_LANGUAGE = 'en'


def get_evaluation_prompt(question: str, language: str) -> str:
    """
    Get the evaluation prompt for a specific language.

    Args:
        question: The question to ask about the document
        language: ISO 639-1 language code (ja, en, zh, ko)

    Returns:
        Formatted prompt string with the question embedded
    """
    template = EVALUATION_PROMPTS.get(language, EVALUATION_PROMPTS[DEFAULT_LANGUAGE])
    return template.format(question=question)


def get_supported_languages() -> list:
    """
    Get list of supported languages.

    Returns:
        List of ISO 639-1 language codes
    """
    return list(EVALUATION_PROMPTS.keys())


# Legacy prompt (kept for backward compatibility testing)
LEGACY_ENGLISH_PROMPT = """Look at this document image and answer the question.
Return your answer as JSON: {{"answer": "your answer text", "bbox": [x0, y0, x1, y1]}} where bbox is normalized 0-1 coordinates.

If the answer contains multiple items, separate each item with a newline (\\n).
Example: {{"answer": "Item A\\nItem B\\nItem C", "bbox": [0.1, 0.2, 0.5, 0.8]}}

Question: {question}

Return ONLY valid JSON, no explanation."""
