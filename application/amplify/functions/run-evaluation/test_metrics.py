"""
Unit Tests for Evaluation Metrics

Strategy: Compare our implementation against the `anls` reference package
(from the DocVQA competition). If outputs match, our implementation is correct.
Differences are explicitly documented and tested.

Run with: pytest test_metrics.py -v
"""
import pytest
from anls import anls_score as reference_anls
from metrics import calculate_anls, calculate_iou, normalize_bbox, validate_bbox


# =============================================================================
# ANLS: Compare our implementation vs reference package
# =============================================================================

# Test cases: (prediction, gold_labels, threshold)
ANLS_CASES = [
    # Basic
    ("hello", ["hello"], 0.5),
    ("Hello", ["hello"], 0.5),          # case insensitivity
    ("  hello  ", ["hello"], 0.5),      # whitespace
    ("hallo", ["hello"], 0.5),          # near match
    ("abc", ["xyz"], 0.5),              # no match
    # OCR-realistic
    ("¥12,580", ["¥12,580"], 0.5),      # exact currency
    ("¥12,580", ["¥12,581"], 0.5),      # off-by-one digit
    ("2026/01/28", ["2026/01/28"], 0.5), # date
    ("T1234567890123", ["T1234567890123"], 0.5),  # registration number
    # Japanese
    ("東京都", ["東京都"], 0.5),
    ("コーヒー", ["コーヒー"], 0.5),
    # Threshold boundary (at default τ=0.5, both implementations agree)
    ("abc", ["abd"], 0.5),              # ANLS=0.667, NLD=0.333 < 0.5 → kept
    # Edge cases
    ("", [""], 0.5),
    ("", ["hello"], 0.5),
    ("hello", [""], 0.5),
]


class TestAnlsVsReference:
    """Our single-answer ANLS must match the reference package exactly."""

    @pytest.mark.parametrize("pred,golds,threshold", ANLS_CASES)
    def test_matches_reference(self, pred, golds, threshold):
        ours = calculate_anls(pred, golds, threshold)
        ref = reference_anls(pred, golds, threshold)
        assert ours == pytest.approx(ref, abs=1e-9), (
            f"pred={pred!r}, golds={golds!r}, threshold={threshold}: "
            f"ours={ours}, ref={ref}"
        )


class TestAnlsDocumentedDifferences:
    """Known semantic differences between our implementation and the reference.

    These are intentional design choices, not bugs. Each test documents
    what our code returns vs. the reference and explains why they differ.
    """

    def test_multi_gold_labels_semantics(self):
        """Reference: multiple gold_labels = alternative acceptable answers (best match).
        Ours: multiple ground_truths = list items (average across all).

        This is intentional. In our OCR evaluation, questions like
        "what items were purchased?" have multiple ground truth items,
        and the model must output ALL of them to score high.
        The reference package's semantics (best match) is for VQA where
        annotators may give different answers to the same question.
        """
        # Reference: "hello" matches "hello" perfectly → 1.0 (best of alternatives)
        assert reference_anls("hello", ["hello", "hi", "hey"], 0.5) == 1.0
        # Ours: ["hello", "hi", "hey"] = 3 list items → "hello" matches only 1/3
        assert calculate_anls("hello", ["hello", "hi", "hey"], 0.5) == pytest.approx(
            1 / 3, rel=0.01
        )

    def test_threshold_semantics(self):
        """Reference: threshold τ applies to NLD (distance). Score=0 when NLD ≥ τ.
        Ours: threshold applies to ANLS (similarity). Score=0 when ANLS < threshold.

        These agree at the default τ=0.5 but diverge at other values.
        Example: "abc" vs "abd" → ANLS=0.667, NLD=0.333
        - At τ=0.5: Both → 0.667 (NLD 0.333 < 0.5 ✓, ANLS 0.667 ≥ 0.5 ✓)
        - At τ=0.7: Ref → 0.667 (NLD 0.333 < 0.7 ✓), Ours → 0.0 (ANLS 0.667 < 0.7 ✗)

        Since we always use the default threshold (0.5), this does not affect production.
        """
        # Both agree at default threshold
        assert calculate_anls("abc", ["abd"], 0.5) == pytest.approx(
            reference_anls("abc", ["abd"], 0.5), abs=1e-9
        )
        # Diverge at threshold=0.7
        assert reference_anls("abc", ["abd"], 0.7) == pytest.approx(0.667, rel=0.01)
        assert calculate_anls("abc", ["abd"], 0.7) == 0.0


class TestAnlsMultiItem:
    """Multi-item matching is OUR extension (not in the reference package).
    These tests verify the newline-splitting wrapper logic."""

    def test_all_items_match(self):
        pred = "apple\nbanana\ncherry"
        gt = ["apple", "banana", "cherry"]
        assert calculate_anls(pred, gt) == 1.0

    def test_partial_match(self):
        pred = "apple\nbanana"
        gt = ["apple", "banana", "cherry"]
        assert calculate_anls(pred, gt) == pytest.approx(2 / 3, rel=0.01)

    def test_order_independent(self):
        pred = "cherry\napple\nbanana"
        gt = ["apple", "banana", "cherry"]
        assert calculate_anls(pred, gt) == 1.0

    def test_empty_prediction(self):
        assert calculate_anls("", ["apple", "banana"]) == 0.0

    def test_empty_ground_truths(self):
        assert calculate_anls("anything", []) == 0.0

    def test_japanese_items(self):
        pred = "コーヒー\nサンドイッチ\nケーキ"
        gt = ["コーヒー", "サンドイッチ", "ケーキ"]
        assert calculate_anls(pred, gt) == 1.0

    def test_japanese_items_with_subtle_mismatch(self):
        """Realistic receipt OCR: model extracts items with subtle errors.

        Ground truth (annotation): ["コーヒー", "ケーキ", "お団子"]
        Prediction (model output): ["コーヒー200ml", "ケーキ", "特製団子"]

        Per-item breakdown:
          "コーヒー" vs best pred "コーヒー200ml":
            dist=5, maxlen=9, raw=0.444 → below threshold → 0.0
            Model added quantity "200ml" — short Japanese word + long suffix
            is penalized heavily because 5 extra chars on a 4-char word
            drops ANLS below the 0.5 threshold.
          "ケーキ" vs best pred "ケーキ":
            exact match → 1.0
          "お団子" vs best pred "特製団子":
            dist=2, maxlen=4, raw=0.500 → exactly at threshold → 0.5
            "お" replaced by "特製" (1 delete + 1 substitute = 2 edits).

        Final = (0.0 + 1.0 + 0.5) / 3 = 0.5
        """
        pred = "コーヒー200ml\nケーキ\n特製団子"
        gt = ["コーヒー", "ケーキ", "お団子"]
        assert calculate_anls(pred, gt) == pytest.approx(0.5, abs=1e-9)


# =============================================================================
# IoU: Verified by hand-computed geometry
# =============================================================================


class TestIou:
    """IoU is simple geometry — verified with manual calculation."""

    def test_perfect_overlap(self):
        bbox = [0.2, 0.2, 0.8, 0.8]
        assert calculate_iou(bbox, bbox) == 1.0

    def test_no_overlap(self):
        assert calculate_iou([0.0, 0.0, 0.2, 0.2], [0.5, 0.5, 0.8, 0.8]) == 0.0

    def test_partial_overlap(self):
        a = [0.0, 0.0, 0.5, 0.5]       # area=0.25
        b = [0.25, 0.25, 0.75, 0.75]    # area=0.25
        # intersection: [0.25,0.25]→[0.5,0.5] = 0.0625
        # union: 0.25+0.25-0.0625 = 0.4375
        assert calculate_iou(a, b) == pytest.approx(0.0625 / 0.4375, rel=0.01)

    def test_invalid_input(self):
        assert calculate_iou([0.1, 0.2], [0.1, 0.2, 0.3, 0.4]) == 0.0

    def test_symmetric(self):
        a = [0.1, 0.2, 0.5, 0.6]
        b = [0.3, 0.4, 0.8, 0.9]
        assert calculate_iou(a, b) == calculate_iou(b, a)


# =============================================================================
# Coordinates: normalization and validation
# =============================================================================


class TestCoordinates:
    def test_normalize_standard(self):
        assert normalize_bbox([100, 200, 300, 400], 1000, 1000) == [0.1, 0.2, 0.3, 0.4]

    def test_normalize_clamps_out_of_bounds(self):
        assert normalize_bbox([-100, -50, 1200, 800], 1000, 600) == [0.0, 0.0, 1.0, 1.0]

    def test_normalize_zero_dimensions_fallback(self):
        assert normalize_bbox([100, 200, 300, 400], 0, 0) == [0.0, 0.0, 1.0, 1.0]

    def test_validate_valid(self):
        assert validate_bbox([0.2, 0.2, 0.8, 0.8]) is True

    def test_validate_full_image_rejected(self):
        assert validate_bbox([0.0, 0.0, 1.0, 1.0]) is False

    def test_validate_too_small_rejected(self):
        assert validate_bbox([0.1, 0.1, 0.11, 0.11], min_size_ratio=0.01) is False

    def test_validate_inverted_rejected(self):
        assert validate_bbox([0.8, 0.2, 0.2, 0.8]) is False


# =============================================================================
# Integration
# =============================================================================


class TestIntegration:
    def test_real_world_ocr_scenario(self):
        """Realistic receipt: exact text + close bbox."""
        anls = calculate_anls("¥12,580", ["¥12,580"])
        iou = calculate_iou([0.3, 0.4, 0.5, 0.5], [0.32, 0.38, 0.52, 0.52])
        assert anls == 1.0
        assert iou > 0.5
