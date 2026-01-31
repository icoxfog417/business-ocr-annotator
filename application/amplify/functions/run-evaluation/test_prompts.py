"""
Unit Tests for Evaluation Prompts

Verifies multi-language prompts are well-formed and stay synchronized
with annotation prompts (generate-annotation/handler.ts).
Run with: pytest test_prompts.py -v
"""
from prompts import get_evaluation_prompt, get_supported_languages, EVALUATION_PROMPTS


class TestPromptGeneration:
    """Each language produces a valid, formatted prompt."""

    def test_all_languages_produce_prompt(self):
        for lang in get_supported_languages():
            prompt = get_evaluation_prompt("test?", lang)
            assert "test?" in prompt
            assert '"answer"' in prompt
            assert '"bbox"' in prompt

    def test_unknown_language_falls_back_to_english(self):
        assert get_evaluation_prompt("q?", "xx") == get_evaluation_prompt("q?", "en")

    def test_supported_languages(self):
        langs = get_supported_languages()
        assert set(langs) == {"ja", "en", "zh", "ko"}


class TestPromptSyncWithAnnotation:
    """Evaluation prompts must contain the same extraction rules as
    annotation prompts in generate-annotation/handler.ts.
    If annotation prompts change, these tests should catch the drift."""

    def test_amount_rule_present(self):
        """All languages instruct: amounts → numbers only."""
        checks = {
            "ja": "数字",
            "en": "numbers only",
            "zh": "数字",
            "ko": "숫자",
        }
        for lang, keyword in checks.items():
            assert keyword in EVALUATION_PROMPTS[lang], f"{lang} missing amount rule"

    def test_date_format_rule_present(self):
        """All languages instruct: dates → yyyy/MM/dd."""
        for lang in get_supported_languages():
            assert "yyyy/MM/dd" in EVALUATION_PROMPTS[lang], f"{lang} missing date rule"

    def test_multi_item_newline_rule_present(self):
        """All languages instruct: multiple items → one per line."""
        newline_keywords = {
            "ja": "1行に1つ",
            "en": "one per line",
            "zh": "每行一个",
            "ko": "한 줄에 하나",
        }
        for lang, keyword in newline_keywords.items():
            assert keyword in EVALUATION_PROMPTS[lang], f"{lang} missing newline rule"

    def test_item_extraction_rule_present(self):
        """All languages instruct: items → product names only."""
        item_keywords = {
            "ja": "名前のみ",
            "en": "product names only",
            "zh": "商品名称",
            "ko": "이름만",
        }
        for lang, keyword in item_keywords.items():
            assert keyword in EVALUATION_PROMPTS[lang], f"{lang} missing item rule"
