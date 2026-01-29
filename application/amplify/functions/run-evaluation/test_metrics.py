"""
Unit Tests for Evaluation Metrics

Tests for ANLS (via anls package), IoU, and coordinate handling.
Run with: pytest test_metrics.py -v
"""
import pytest
from metrics import (
    calculate_anls,
    calculate_iou,
    normalize_bbox,
    validate_bbox,
)


class TestAnls:
    """Tests for ANLS calculation — focuses on our multi-item wrapper logic.
    Single-answer ANLS correctness is guaranteed by the anls package."""

    def test_exact_match(self):
        assert calculate_anls("hello", ["hello"]) == 1.0

    def test_empty_ground_truths(self):
        assert calculate_anls("any", []) == 0.0

    def test_threshold_cutoff(self):
        """Completely different strings score 0."""
        assert calculate_anls("abc", ["xyz"]) == 0.0

    def test_near_match(self):
        """One-char difference scores high but < 1.0."""
        anls = calculate_anls("hallo", ["hello"])
        assert 0.5 < anls < 1.0

    def test_multi_item_all_match(self):
        prediction = "apple\nbanana\ncherry"
        ground_truths = ["apple", "banana", "cherry"]
        assert calculate_anls(prediction, ground_truths) == 1.0

    def test_multi_item_partial_match(self):
        """Missing one item reduces score proportionally."""
        prediction = "apple\nbanana"
        ground_truths = ["apple", "banana", "cherry"]
        assert calculate_anls(prediction, ground_truths) == pytest.approx(2 / 3, rel=0.01)

    def test_multi_item_order_independent(self):
        prediction = "cherry\napple\nbanana"
        ground_truths = ["apple", "banana", "cherry"]
        assert calculate_anls(prediction, ground_truths) == 1.0

    def test_japanese_receipt_items(self):
        prediction = "コーヒー\nサンドイッチ\nケーキ"
        ground_truths = ["コーヒー", "サンドイッチ", "ケーキ"]
        assert calculate_anls(prediction, ground_truths) == 1.0


class TestIou:
    """Tests for IoU bounding box calculation."""

    def test_perfect_overlap(self):
        bbox = [0.2, 0.2, 0.8, 0.8]
        assert calculate_iou(bbox, bbox) == 1.0

    def test_no_overlap(self):
        assert calculate_iou([0.0, 0.0, 0.2, 0.2], [0.5, 0.5, 0.8, 0.8]) == 0.0

    def test_partial_overlap(self):
        bbox1 = [0.0, 0.0, 0.5, 0.5]  # area=0.25
        bbox2 = [0.25, 0.25, 0.75, 0.75]  # area=0.25
        # intersection=[0.25,0.25,0.5,0.5]=0.0625, union=0.4375
        assert calculate_iou(bbox1, bbox2) == pytest.approx(0.0625 / 0.4375, rel=0.01)

    def test_invalid_input(self):
        assert calculate_iou([0.1, 0.2], [0.1, 0.2, 0.3, 0.4]) == 0.0
        assert calculate_iou([], []) == 0.0

    def test_symmetric(self):
        a = [0.1, 0.2, 0.5, 0.6]
        b = [0.3, 0.4, 0.8, 0.9]
        assert calculate_iou(a, b) == calculate_iou(b, a)


class TestCoordinates:
    """Tests for bounding box normalization and validation."""

    def test_normalize_standard(self):
        assert normalize_bbox([100, 200, 300, 400], 1000, 1000) == [0.1, 0.2, 0.3, 0.4]

    def test_normalize_clamps_out_of_bounds(self):
        result = normalize_bbox([-100, -50, 1200, 800], 1000, 600)
        assert result == [0.0, 0.0, 1.0, 1.0]

    def test_normalize_zero_dimensions_fallback(self):
        assert normalize_bbox([100, 200, 300, 400], 0, 0) == [0.0, 0.0, 1.0, 1.0]

    def test_validate_valid(self):
        assert validate_bbox([0.2, 0.2, 0.8, 0.8]) is True

    def test_validate_full_image_rejected(self):
        """Full-image [0,0,1,1] is a default fallback, not a real annotation."""
        assert validate_bbox([0.0, 0.0, 1.0, 1.0]) is False

    def test_validate_too_small_rejected(self):
        assert validate_bbox([0.1, 0.1, 0.11, 0.11], min_size_ratio=0.01) is False

    def test_validate_inverted_rejected(self):
        assert validate_bbox([0.8, 0.2, 0.2, 0.8]) is False


class TestIntegration:
    """End-to-end tests combining metrics and coordinates."""

    def test_normalize_then_iou(self):
        """Pixel boxes → normalize → IoU works as a pipeline."""
        b1 = normalize_bbox([100, 100, 300, 300], 500, 500)
        b2 = normalize_bbox([200, 200, 400, 400], 500, 500)
        assert calculate_iou(b1, b2) > 0

    def test_real_world_ocr_scenario(self):
        """Realistic receipt evaluation: exact text + close bbox."""
        anls = calculate_anls("¥12,580", ["¥12,580"])
        iou = calculate_iou([0.3, 0.4, 0.5, 0.5], [0.32, 0.38, 0.52, 0.52])
        assert anls == 1.0
        assert iou > 0.5
