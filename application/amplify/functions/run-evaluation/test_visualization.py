"""
Unit Tests for Visualization Module

Covers bounding-box drawing helpers used to produce annotated images
for the W&B evaluation results table.

Run with: pytest test_visualization.py -v
"""
from PIL import Image

from visualization import draw_bbox, format_bbox_str, normalize_bbox


# =============================================================================
# draw_bbox
# =============================================================================


class TestDrawBbox:
    """draw_bbox must return a new RGB image, never modify the original."""

    def _make_image(self, mode='RGB', size=(200, 100)):
        return Image.new(mode, size, color=(255, 255, 255))

    def test_returns_rgb_copy(self):
        original = self._make_image()
        result = draw_bbox(original, [0.1, 0.1, 0.9, 0.9], (255, 0, 0), 'Test')
        assert result.mode == 'RGB'
        assert result is not original

    def test_original_not_modified(self):
        original = self._make_image()
        original_data = original.tobytes()
        draw_bbox(original, [0.1, 0.1, 0.9, 0.9], (255, 0, 0), 'Test')
        assert original.tobytes() == original_data

    def test_rgba_input_handled(self):
        original = self._make_image(mode='RGBA')
        result = draw_bbox(original, [0.1, 0.1, 0.9, 0.9], (0, 200, 0), 'GT')
        assert result.mode == 'RGB'

    def test_drawing_changes_pixels(self):
        original = self._make_image()
        result = draw_bbox(original, [0.1, 0.1, 0.9, 0.9], (255, 0, 0), 'Box')
        assert result.tobytes() != original.tobytes()

    # -- Invalid / edge-case bboxes that must NOT crash --

    def test_empty_bbox(self):
        img = self._make_image()
        result = draw_bbox(img, [], (255, 0, 0), 'X')
        assert result.mode == 'RGB'

    def test_short_bbox(self):
        img = self._make_image()
        result = draw_bbox(img, [0.1, 0.2], (255, 0, 0), 'X')
        assert result.mode == 'RGB'

    def test_inverted_bbox_skipped(self):
        """x0 > x1 — drawing should be skipped, no crash."""
        img = self._make_image()
        original_data = img.tobytes()
        result = draw_bbox(img, [0.9, 0.1, 0.1, 0.9], (255, 0, 0), 'Inv')
        # Image should be unchanged (only converted to RGB copy)
        assert result.tobytes() == original_data

    def test_nan_bbox_skipped(self):
        img = self._make_image()
        result = draw_bbox(img, [float('nan'), 0.1, 0.5, 0.5], (255, 0, 0), 'N')
        assert result.mode == 'RGB'

    def test_non_numeric_bbox_skipped(self):
        img = self._make_image()
        result = draw_bbox(img, ['a', 'b', 'c', 'd'], (255, 0, 0), 'Bad')
        assert result.mode == 'RGB'

    def test_fallback_bbox_drawn(self):
        """[0, 0, 1, 1] is the model fallback — should still be drawn."""
        img = self._make_image()
        original_data = img.tobytes()
        result = draw_bbox(img, [0.0, 0.0, 1.0, 1.0], (220, 0, 0), 'Pred')
        # The full-image box should change at least some border pixels
        assert result.tobytes() != original_data


# =============================================================================
# format_bbox_str
# =============================================================================


class TestFormatBboxStr:
    def test_normal(self):
        assert format_bbox_str([0.12, 0.34, 0.56, 0.78]) == '[0.12, 0.34, 0.56, 0.78]'

    def test_rounds_to_two_decimals(self):
        assert format_bbox_str([0.123456, 0.0, 1.0, 0.999]) == '[0.12, 0.00, 1.00, 1.00]'

    def test_integers(self):
        assert format_bbox_str([0, 0, 1, 1]) == '[0.00, 0.00, 1.00, 1.00]'

    def test_empty_list(self):
        assert format_bbox_str([]) == 'N/A'

    def test_wrong_length(self):
        assert format_bbox_str([0.1, 0.2]) == 'N/A'

    def test_none(self):
        assert format_bbox_str(None) == 'N/A'

    def test_non_numeric(self):
        assert format_bbox_str(['a', 'b', 'c', 'd']) == 'N/A'


# =============================================================================
# normalize_bbox
# =============================================================================


class TestNormalizeBbox:
    """normalize_bbox converts pixel coords to 0-1 range when values exceed 1."""

    def test_already_normalized(self):
        """Values in 0-1 range are returned unchanged."""
        assert normalize_bbox([0.1, 0.2, 0.5, 0.8], (1000, 800)) == [0.1, 0.2, 0.5, 0.8]

    def test_pixel_coords_scaled(self):
        """Pixel coordinates are divided by image dimensions."""
        result = normalize_bbox([100, 200, 500, 800], (1000, 800))
        assert result == [0.1, 0.25, 0.5, 1.0]

    def test_mixed_coords_treated_as_pixel(self):
        """If any value > 1.0, all are scaled."""
        result = normalize_bbox([0.5, 0.5, 100, 100], (200, 200))
        assert result == [0.0025, 0.0025, 0.5, 0.5]

    def test_invalid_length_returns_fallback(self):
        assert normalize_bbox([0.1, 0.2], (100, 100)) == [0.0, 0.0, 1.0, 1.0]

    def test_empty_returns_fallback(self):
        assert normalize_bbox([], (100, 100)) == [0.0, 0.0, 1.0, 1.0]

    def test_non_numeric_returns_fallback(self):
        assert normalize_bbox(['a', 'b', 'c', 'd'], (100, 100)) == [0.0, 0.0, 1.0, 1.0]

    def test_zero_dimension_image(self):
        """Zero-size image should not cause division by zero."""
        result = normalize_bbox([100, 200, 300, 400], (0, 0))
        assert result == [100.0, 200.0, 300.0, 400.0]

    def test_exact_one_not_scaled(self):
        """Coords of exactly 1.0 should NOT trigger scaling."""
        assert normalize_bbox([0.0, 0.0, 1.0, 1.0], (500, 500)) == [0.0, 0.0, 1.0, 1.0]
