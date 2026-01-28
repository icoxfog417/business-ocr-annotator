"""
Unit Tests for Evaluation Prompts

Tests for multi-language prompt generation and synchronization with annotation prompts.
Run with: pytest test_prompts.py -v
"""
import pytest
from prompts import (
    get_evaluation_prompt,
    get_supported_languages,
    EVALUATION_PROMPTS,
    DEFAULT_LANGUAGE,
)


class TestGetEvaluationPrompt:
    """Tests for get_evaluation_prompt function."""

    def test_english_prompt(self):
        """English prompt contains question."""
        question = "What is the total amount?"
        prompt = get_evaluation_prompt(question, 'en')
        assert question in prompt
        assert "answer" in prompt.lower()
        assert "bbox" in prompt.lower()

    def test_japanese_prompt(self):
        """Japanese prompt contains question and Japanese text."""
        question = "合計金額は?"
        prompt = get_evaluation_prompt(question, 'ja')
        assert question in prompt
        assert "回答ルール" in prompt  # Answer rules in Japanese
        assert "JSON" in prompt

    def test_chinese_prompt(self):
        """Chinese prompt contains question and Chinese text."""
        question = "总金额是多少?"
        prompt = get_evaluation_prompt(question, 'zh')
        assert question in prompt
        assert "回答规则" in prompt  # Answer rules in Chinese
        assert "JSON" in prompt

    def test_korean_prompt(self):
        """Korean prompt contains question and Korean text."""
        question = "총 금액은 얼마입니까?"
        prompt = get_evaluation_prompt(question, 'ko')
        assert question in prompt
        assert "답변 규칙" in prompt  # Answer rules in Korean
        assert "JSON" in prompt

    def test_unknown_language_fallback(self):
        """Unknown language falls back to English."""
        question = "What is the date?"
        prompt_unknown = get_evaluation_prompt(question, 'xx')
        prompt_english = get_evaluation_prompt(question, 'en')
        assert prompt_unknown == prompt_english

    def test_prompt_contains_bbox_instruction(self):
        """All prompts contain bounding box instructions."""
        for lang in get_supported_languages():
            prompt = get_evaluation_prompt("test question", lang)
            assert "bbox" in prompt.lower()
            assert "0-1" in prompt or "0" in prompt  # Normalized coordinates


class TestPromptConsistency:
    """Tests for prompt consistency with annotation prompts."""

    def test_japanese_amount_rule(self):
        """Japanese prompt has amount extraction rule."""
        prompt = EVALUATION_PROMPTS['ja']
        assert "金額" in prompt
        assert "数字" in prompt

    def test_english_amount_rule(self):
        """English prompt has amount extraction rule."""
        prompt = EVALUATION_PROMPTS['en']
        assert "amount" in prompt.lower()
        assert "numbers only" in prompt.lower()

    def test_japanese_date_rule(self):
        """Japanese prompt has date format rule."""
        prompt = EVALUATION_PROMPTS['ja']
        assert "日付" in prompt
        assert "yyyy/MM/dd" in prompt

    def test_english_date_rule(self):
        """English prompt has date format rule."""
        prompt = EVALUATION_PROMPTS['en']
        assert "date" in prompt.lower()
        assert "yyyy/MM/dd" in prompt

    def test_japanese_item_rule(self):
        """Japanese prompt has item extraction rule."""
        prompt = EVALUATION_PROMPTS['ja']
        assert "品目" in prompt or "商品" in prompt
        assert "名前" in prompt or "名" in prompt

    def test_english_item_rule(self):
        """English prompt has item extraction rule."""
        prompt = EVALUATION_PROMPTS['en']
        assert "items" in prompt.lower() or "products" in prompt.lower()
        assert "names only" in prompt.lower() or "product names" in prompt.lower()

    def test_multi_item_newline_rule(self):
        """All prompts mention newline for multiple items."""
        for lang in get_supported_languages():
            prompt = EVALUATION_PROMPTS[lang]
            # Check for newline-related instruction
            has_newline_instruction = any([
                "newline" in prompt.lower(),
                "改行" in prompt,  # Japanese
                "换行" in prompt,  # Chinese
                "줄바꿈" in prompt,  # Korean
                "1行に1つ" in prompt,  # Japanese
                "한 줄에 하나" in prompt,  # Korean
                "每行一个" in prompt,  # Chinese
            ])
            assert has_newline_instruction, f"Language {lang} missing newline instruction"


class TestGetSupportedLanguages:
    """Tests for get_supported_languages function."""

    def test_returns_list(self):
        """Returns a list of language codes."""
        languages = get_supported_languages()
        assert isinstance(languages, list)
        assert len(languages) > 0

    def test_contains_required_languages(self):
        """Contains all required languages."""
        languages = get_supported_languages()
        assert 'ja' in languages
        assert 'en' in languages
        assert 'zh' in languages
        assert 'ko' in languages

    def test_default_language_supported(self):
        """Default language is in the supported list."""
        languages = get_supported_languages()
        assert DEFAULT_LANGUAGE in languages


class TestPromptFormat:
    """Tests for prompt format and structure."""

    def test_all_prompts_have_question_placeholder(self):
        """All prompts use {question} placeholder."""
        for lang, template in EVALUATION_PROMPTS.items():
            assert "{question}" in template, f"Language {lang} missing {{question}} placeholder"

    def test_all_prompts_have_json_example(self):
        """All prompts include JSON format example."""
        for lang, template in EVALUATION_PROMPTS.items():
            assert '"answer"' in template, f"Language {lang} missing answer key in JSON"
            assert '"bbox"' in template, f"Language {lang} missing bbox key in JSON"

    def test_prompts_not_empty(self):
        """No empty prompts."""
        for lang, template in EVALUATION_PROMPTS.items():
            assert len(template.strip()) > 100, f"Language {lang} prompt too short"

    def test_prompt_formatting_works(self):
        """Format string substitution works correctly."""
        for lang in get_supported_languages():
            try:
                prompt = get_evaluation_prompt("Test question?", lang)
                assert "Test question?" in prompt
            except (KeyError, ValueError) as e:
                pytest.fail(f"Language {lang} prompt formatting failed: {e}")


class TestRealWorldQuestions:
    """Tests with real-world question examples."""

    def test_japanese_receipt_question(self):
        """Japanese receipt question formatting."""
        question = "登録番号は?(番号のみ)"
        prompt = get_evaluation_prompt(question, 'ja')
        assert question in prompt
        assert "T" in prompt  # Registration number starts with T

    def test_english_invoice_question(self):
        """English invoice question formatting."""
        question = "What is the invoice date?"
        prompt = get_evaluation_prompt(question, 'en')
        assert question in prompt

    def test_chinese_tax_question(self):
        """Chinese tax document question formatting."""
        question = "税额是多少?"
        prompt = get_evaluation_prompt(question, 'zh')
        assert question in prompt

    def test_korean_product_question(self):
        """Korean product listing question formatting."""
        question = "구매한 상품은 무엇입니까?"
        prompt = get_evaluation_prompt(question, 'ko')
        assert question in prompt


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
