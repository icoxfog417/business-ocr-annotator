"""
Unit Tests for Visualization Module

Covers bounding-box drawing helpers used to produce annotated images
for the W&B evaluation results table.

Run with: pytest test_visualization.py -v
"""
from PIL import Image

from visualization import draw_bbox, format_bbox_str


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
