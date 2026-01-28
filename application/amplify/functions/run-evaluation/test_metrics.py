"""
Unit Tests for Evaluation Metrics

Tests for ANLS, IoU, and coordinate handling functions.
Run with: pytest test_metrics.py -v
"""
import pytest
from metrics import (
    calculate_anls,
    calculate_single_anls,
    levenshtein_distance,
    calculate_iou,
    normalize_bbox,
    scale_bbox,
    validate_bbox,
)


# =============================================================================
# Levenshtein Distance Tests
# =============================================================================


class TestLevenshteinDistance:
    """Tests for Levenshtein distance calculation."""

    def test_identical_strings(self):
        """Identical strings have distance 0."""
        assert levenshtein_distance("hello", "hello") == 0

    def test_empty_strings(self):
        """Distance between empty strings is 0."""
        assert levenshtein_distance("", "") == 0

    def test_one_empty_string(self):
        """Distance is the length of the non-empty string."""
        assert levenshtein_distance("hello", "") == 5
        assert levenshtein_distance("", "world") == 5

    def test_single_insertion(self):
        """Single character difference."""
        assert levenshtein_distance("cat", "cats") == 1
        assert levenshtein_distance("car", "cart") == 1

    def test_single_deletion(self):
        """Single deletion."""
        assert levenshtein_distance("hello", "helo") == 1

    def test_single_substitution(self):
        """Single substitution."""
        assert levenshtein_distance("cat", "bat") == 1
        assert levenshtein_distance("dog", "fog") == 1

    def test_multiple_edits(self):
        """Multiple edit operations."""
        assert levenshtein_distance("kitten", "sitting") == 3
        assert levenshtein_distance("saturday", "sunday") == 3

    def test_completely_different(self):
        """Completely different strings."""
        assert levenshtein_distance("abc", "xyz") == 3

    def test_japanese_text(self):
        """Japanese characters work correctly."""
        assert levenshtein_distance("東京", "東京") == 0
        assert levenshtein_distance("東京", "大阪") == 2
        assert levenshtein_distance("こんにちは", "こんばんは") == 2


# =============================================================================
# ANLS Single Calculation Tests
# =============================================================================


class TestCalculateSingleAnls:
    """Tests for single ANLS calculation."""

    def test_exact_match(self):
        """Exact match returns 1.0."""
        assert calculate_single_anls("hello", "hello") == 1.0
        assert calculate_single_anls("12345", "12345") == 1.0

    def test_case_insensitive(self):
        """ANLS is case-insensitive."""
        assert calculate_single_anls("Hello", "hello") == 1.0
        assert calculate_single_anls("WORLD", "world") == 1.0

    def test_whitespace_normalized(self):
        """Leading/trailing whitespace is trimmed."""
        assert calculate_single_anls("  hello  ", "hello") == 1.0
        assert calculate_single_anls("hello", "  hello  ") == 1.0

    def test_both_empty(self):
        """Both empty strings return 1.0."""
        assert calculate_single_anls("", "") == 1.0
        assert calculate_single_anls("   ", "   ") == 1.0

    def test_one_empty(self):
        """One empty string returns 0.0."""
        assert calculate_single_anls("hello", "") == 0.0
        assert calculate_single_anls("", "hello") == 0.0
        assert calculate_single_anls("hello", "   ") == 0.0

    def test_below_threshold(self):
        """ANLS below threshold returns 0.0."""
        # "abc" vs "xyz" has ANLS = 0 (completely different)
        assert calculate_single_anls("abc", "xyz") == 0.0
        # "cat" vs "dog" has ANLS = 0 (too different)
        assert calculate_single_anls("cat", "dog") == 0.0

    def test_above_threshold(self):
        """ANLS above threshold returns the actual score."""
        # "hello" vs "hallo" has ANLS = 0.8 (1 out of 5 chars different)
        anls = calculate_single_anls("hello", "hallo")
        assert anls == 0.8

    def test_custom_threshold(self):
        """Custom threshold works correctly."""
        # "abc" vs "abd" has ANLS = 0.667 (1 out of 3 chars different)
        assert calculate_single_anls("abc", "abd", threshold=0.5) > 0
        assert calculate_single_anls("abc", "abd", threshold=0.7) == 0.0

    def test_japanese_exact_match(self):
        """Japanese text exact match."""
        assert calculate_single_anls("東京都", "東京都") == 1.0
        assert calculate_single_anls("¥12,580", "¥12,580") == 1.0

    def test_currency_values(self):
        """Currency values match correctly."""
        assert calculate_single_anls("$100.00", "$100.00") == 1.0
        # Small difference in price
        anls = calculate_single_anls("$100.00", "$100.01")
        assert anls > 0.5  # High similarity

    def test_date_formats(self):
        """Date format matching."""
        assert calculate_single_anls("2026/01/28", "2026/01/28") == 1.0
        # Different day
        anls = calculate_single_anls("2026/01/28", "2026/01/29")
        assert anls > 0.5  # High similarity


# =============================================================================
# ANLS Multiple Ground Truths Tests
# =============================================================================


class TestCalculateAnls:
    """Tests for ANLS with multiple ground truths."""

    def test_empty_ground_truths(self):
        """Empty ground truths list returns 0.0."""
        assert calculate_anls("any prediction", []) == 0.0

    def test_single_ground_truth(self):
        """Single ground truth delegates to calculate_single_anls."""
        assert calculate_anls("hello", ["hello"]) == 1.0
        assert calculate_anls("hello", ["world"]) == 0.0

    def test_multiple_ground_truths_exact_match(self):
        """All items match perfectly."""
        prediction = "apple\nbanana\ncherry"
        ground_truths = ["apple", "banana", "cherry"]
        assert calculate_anls(prediction, ground_truths) == 1.0

    def test_multiple_ground_truths_partial_match(self):
        """Some items match."""
        prediction = "apple\nbanana"
        ground_truths = ["apple", "banana", "cherry"]
        # 2 out of 3 match perfectly
        anls = calculate_anls(prediction, ground_truths)
        assert anls == pytest.approx(2 / 3, rel=0.01)

    def test_multiple_ground_truths_no_match(self):
        """No items match."""
        prediction = "x\ny\nz"
        ground_truths = ["apple", "banana", "cherry"]
        assert calculate_anls(prediction, ground_truths) == 0.0

    def test_order_independent(self):
        """Order of items doesn't matter."""
        prediction = "cherry\napple\nbanana"
        ground_truths = ["apple", "banana", "cherry"]
        assert calculate_anls(prediction, ground_truths) == 1.0

    def test_empty_prediction_multi(self):
        """Empty prediction returns 0.0."""
        assert calculate_anls("", ["apple", "banana"]) == 0.0
        assert calculate_anls("   ", ["apple", "banana"]) == 0.0

    def test_extra_prediction_items(self):
        """Extra items in prediction don't penalize."""
        prediction = "apple\nbanana\ncherry\nextra"
        ground_truths = ["apple", "banana", "cherry"]
        assert calculate_anls(prediction, ground_truths) == 1.0

    def test_japanese_multi_item(self):
        """Japanese multi-item matching."""
        prediction = "りんご\nみかん"
        ground_truths = ["りんご", "みかん"]
        assert calculate_anls(prediction, ground_truths) == 1.0

    def test_receipt_items(self):
        """Real-world receipt item matching."""
        prediction = "コーヒー\nサンドイッチ\nケーキ"
        ground_truths = ["コーヒー", "サンドイッチ", "ケーキ"]
        assert calculate_anls(prediction, ground_truths) == 1.0


# =============================================================================
# IoU Calculation Tests
# =============================================================================


class TestCalculateIou:
    """Tests for IoU bounding box calculation."""

    def test_perfect_overlap(self):
        """Identical boxes have IoU = 1.0."""
        bbox = [0.2, 0.2, 0.8, 0.8]
        assert calculate_iou(bbox, bbox) == 1.0

    def test_no_overlap(self):
        """Non-overlapping boxes have IoU = 0.0."""
        bbox1 = [0.0, 0.0, 0.2, 0.2]
        bbox2 = [0.5, 0.5, 0.8, 0.8]
        assert calculate_iou(bbox1, bbox2) == 0.0

    def test_partial_overlap(self):
        """Partial overlap returns correct IoU."""
        bbox1 = [0.0, 0.0, 0.5, 0.5]  # Area = 0.25
        bbox2 = [0.25, 0.25, 0.75, 0.75]  # Area = 0.25
        # Intersection: [0.25, 0.25, 0.5, 0.5] = 0.0625
        # Union: 0.25 + 0.25 - 0.0625 = 0.4375
        # IoU = 0.0625 / 0.4375 = 0.1429
        iou = calculate_iou(bbox1, bbox2)
        assert iou == pytest.approx(0.0625 / 0.4375, rel=0.01)

    def test_contained_box(self):
        """Smaller box fully contained in larger box."""
        outer = [0.0, 0.0, 1.0, 1.0]  # Area = 1.0
        inner = [0.25, 0.25, 0.75, 0.75]  # Area = 0.25
        # Intersection = 0.25
        # Union = 1.0 + 0.25 - 0.25 = 1.0
        # IoU = 0.25
        iou = calculate_iou(outer, inner)
        assert iou == pytest.approx(0.25, rel=0.01)

    def test_invalid_format_short(self):
        """Invalid format (too few elements) returns 0.0."""
        assert calculate_iou([0.1, 0.2, 0.3], [0.1, 0.2, 0.3, 0.4]) == 0.0
        assert calculate_iou([0.1, 0.2, 0.3, 0.4], [0.1, 0.2]) == 0.0

    def test_invalid_format_empty(self):
        """Empty lists return 0.0."""
        assert calculate_iou([], [0.1, 0.2, 0.3, 0.4]) == 0.0
        assert calculate_iou([0.1, 0.2, 0.3, 0.4], []) == 0.0

    def test_zero_area_box(self):
        """Zero-area box returns 0.0."""
        zero_area = [0.5, 0.5, 0.5, 0.5]  # Point, no area
        normal = [0.1, 0.1, 0.9, 0.9]
        assert calculate_iou(zero_area, normal) == 0.0

    def test_touching_boxes(self):
        """Boxes that touch but don't overlap have IoU = 0.0."""
        left = [0.0, 0.0, 0.5, 1.0]
        right = [0.5, 0.0, 1.0, 1.0]
        assert calculate_iou(left, right) == 0.0

    def test_high_overlap(self):
        """High overlap scenario."""
        bbox1 = [0.1, 0.1, 0.6, 0.6]  # Area = 0.25
        bbox2 = [0.15, 0.15, 0.65, 0.65]  # Area = 0.25
        # High overlap
        iou = calculate_iou(bbox1, bbox2)
        assert iou > 0.5

    def test_symmetric(self):
        """IoU is symmetric."""
        bbox1 = [0.1, 0.2, 0.5, 0.6]
        bbox2 = [0.3, 0.4, 0.8, 0.9]
        assert calculate_iou(bbox1, bbox2) == calculate_iou(bbox2, bbox1)


# =============================================================================
# Bounding Box Normalization Tests
# =============================================================================


class TestNormalizeBbox:
    """Tests for bounding box normalization."""

    def test_standard_normalization(self):
        """Standard normalization to 0-1 range."""
        bbox = [100, 200, 300, 400]
        width, height = 1000, 1000
        result = normalize_bbox(bbox, width, height)
        assert result == [0.1, 0.2, 0.3, 0.4]

    def test_full_image(self):
        """Full image bbox normalizes to [0, 0, 1, 1]."""
        bbox = [0, 0, 800, 600]
        result = normalize_bbox(bbox, 800, 600)
        assert result == [0.0, 0.0, 1.0, 1.0]

    def test_zero_dimensions(self):
        """Zero dimensions return full image fallback."""
        bbox = [100, 200, 300, 400]
        assert normalize_bbox(bbox, 0, 600) == [0.0, 0.0, 1.0, 1.0]
        assert normalize_bbox(bbox, 800, 0) == [0.0, 0.0, 1.0, 1.0]
        assert normalize_bbox(bbox, 0, 0) == [0.0, 0.0, 1.0, 1.0]

    def test_out_of_bounds_clamping(self):
        """Values outside bounds are clamped to 0-1."""
        bbox = [-100, -50, 1200, 800]
        width, height = 1000, 600
        result = normalize_bbox(bbox, width, height)
        assert result[0] == 0.0  # -100 clamped to 0
        assert result[1] == 0.0  # -50 clamped to 0
        assert result[2] == 1.0  # 1200 clamped to 1
        assert result[3] == 1.0  # 800 clamped to 1

    def test_decimal_input(self):
        """Decimal input values work correctly."""
        bbox = [100.5, 200.7, 300.2, 400.9]
        width, height = 1000, 1000
        result = normalize_bbox(bbox, width, height)
        assert result[0] == pytest.approx(0.1005, rel=0.001)


# =============================================================================
# Bounding Box Scaling Tests
# =============================================================================


class TestScaleBbox:
    """Tests for bounding box scaling between coordinate spaces."""

    def test_same_dimensions(self):
        """Same dimensions return unchanged bbox."""
        bbox = [100, 200, 300, 400]
        result = scale_bbox(bbox, 1000, 800, 1000, 800)
        assert result == bbox

    def test_scale_down(self):
        """Scaling down to smaller dimensions."""
        bbox = [200, 200, 400, 400]
        # From 1000x1000 to 500x500
        result = scale_bbox(bbox, 1000, 1000, 500, 500)
        assert result == [100, 100, 200, 200]

    def test_scale_up(self):
        """Scaling up to larger dimensions."""
        bbox = [100, 100, 200, 200]
        # From 500x500 to 1000x1000
        result = scale_bbox(bbox, 500, 500, 1000, 1000)
        assert result == [200, 200, 400, 400]

    def test_aspect_ratio_change(self):
        """Different aspect ratios scale correctly."""
        bbox = [100, 100, 200, 200]
        # From 1000x1000 to 500x1000 (different aspect)
        result = scale_bbox(bbox, 1000, 1000, 500, 1000)
        assert result == [50, 100, 100, 200]

    def test_zero_original_dimensions(self):
        """Zero original dimensions return unchanged bbox."""
        bbox = [100, 200, 300, 400]
        assert scale_bbox(bbox, 0, 800, 500, 600) == bbox
        assert scale_bbox(bbox, 1000, 0, 500, 600) == bbox

    def test_zero_target_dimensions(self):
        """Zero target dimensions return unchanged bbox."""
        bbox = [100, 200, 300, 400]
        assert scale_bbox(bbox, 1000, 800, 0, 600) == bbox
        assert scale_bbox(bbox, 1000, 800, 500, 0) == bbox


# =============================================================================
# Bounding Box Validation Tests
# =============================================================================


class TestValidateBbox:
    """Tests for bounding box validation."""

    def test_valid_bbox(self):
        """Valid bounding box passes validation."""
        assert validate_bbox([0.2, 0.2, 0.8, 0.8]) is True
        assert validate_bbox([0.1, 0.1, 0.5, 0.5]) is True

    def test_full_image_invalid(self):
        """Full image [0,0,1,1] is invalid (default fallback)."""
        assert validate_bbox([0.0, 0.0, 1.0, 1.0]) is False

    def test_zero_area_invalid(self):
        """Zero area (point) is invalid."""
        assert validate_bbox([0.5, 0.5, 0.5, 0.5]) is False

    def test_negative_area_invalid(self):
        """Negative area (x1 < x0 or y1 < y0) is invalid."""
        assert validate_bbox([0.8, 0.2, 0.2, 0.8]) is False  # x1 < x0
        assert validate_bbox([0.2, 0.8, 0.8, 0.2]) is False  # y1 < y0

    def test_too_small_invalid(self):
        """Very small boxes (< 1% of image) are invalid."""
        # Area = 0.001 (0.1% of image)
        assert validate_bbox([0.1, 0.1, 0.11, 0.11], min_size_ratio=0.01) is False

    def test_custom_min_size(self):
        """Custom minimum size works correctly."""
        # Area = 0.01 (1% of image)
        bbox = [0.1, 0.1, 0.2, 0.2]  # 0.1 * 0.1 = 0.01
        assert validate_bbox(bbox, min_size_ratio=0.01) is True
        assert validate_bbox(bbox, min_size_ratio=0.02) is False

    def test_wrong_length_invalid(self):
        """Wrong number of coordinates is invalid."""
        assert validate_bbox([0.1, 0.2, 0.3]) is False
        assert validate_bbox([0.1, 0.2, 0.3, 0.4, 0.5]) is False
        assert validate_bbox([]) is False

    def test_edge_bbox(self):
        """Bounding box at edge of image is valid if has area."""
        assert validate_bbox([0.0, 0.0, 0.5, 0.5]) is True  # Top-left corner
        assert validate_bbox([0.5, 0.5, 1.0, 1.0]) is True  # Bottom-right corner
        assert validate_bbox([0.0, 0.5, 1.0, 0.8]) is True  # Full width strip


# =============================================================================
# Integration Tests
# =============================================================================


class TestIntegration:
    """Integration tests combining multiple functions."""

    def test_normalize_and_iou(self):
        """Normalized boxes can be used for IoU calculation."""
        # Two overlapping boxes in pixel coordinates
        bbox1_px = [100, 100, 300, 300]
        bbox2_px = [200, 200, 400, 400]
        width, height = 500, 500

        # Normalize both
        bbox1_norm = normalize_bbox(bbox1_px, width, height)
        bbox2_norm = normalize_bbox(bbox2_px, width, height)

        # Calculate IoU
        iou = calculate_iou(bbox1_norm, bbox2_norm)
        assert iou > 0  # Should have some overlap

    def test_scale_normalize_chain(self):
        """Scaling then normalizing works correctly."""
        bbox = [100, 100, 200, 200]
        orig_w, orig_h = 1000, 1000
        target_w, target_h = 500, 500

        # Scale first
        scaled = scale_bbox(bbox, orig_w, orig_h, target_w, target_h)

        # Then normalize
        normalized = normalize_bbox(scaled, target_w, target_h)

        # Result should be same as normalizing original
        direct_norm = normalize_bbox(bbox, orig_w, orig_h)
        assert normalized == pytest.approx(direct_norm, rel=0.01)

    def test_real_world_ocr_scenario(self):
        """Realistic OCR evaluation scenario."""
        # Model prediction
        prediction = "¥12,580"
        ground_truth = ["¥12,580"]

        # Bounding boxes
        pred_bbox = [0.3, 0.4, 0.5, 0.5]
        gt_bbox = [0.32, 0.38, 0.52, 0.52]

        # Calculate metrics
        anls = calculate_anls(prediction, ground_truth)
        iou = calculate_iou(pred_bbox, gt_bbox)

        assert anls == 1.0  # Exact text match
        assert iou > 0.5  # Good spatial overlap


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
