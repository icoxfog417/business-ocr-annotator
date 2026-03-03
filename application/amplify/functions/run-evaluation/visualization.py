"""
Visualization Module

Draws bounding-box overlays on images for W&B evaluation output.
Uses PIL.ImageDraw from the existing Pillow dependency — no new packages needed.
"""
from typing import List, Tuple

from PIL import Image, ImageDraw


def draw_bbox(
    image: Image.Image,
    bbox: List[float],
    color: Tuple[int, int, int],
    label: str,
) -> Image.Image:
    """Draw a labelled bounding box on a *copy* of the image.

    Args:
        image: PIL Image (any mode — will be converted to RGB).
        bbox: Normalized coords [x0, y0, x1, y1] in 0-1 range.
        color: RGB tuple, e.g. (220, 0, 0).
        label: Short text drawn at the top-left corner of the box.

    Returns:
        A new RGB image with the rectangle and label drawn.
        If *bbox* is invalid (wrong length, inverted, or contains
        non-finite values) the image copy is returned unmodified.
    """
    out = image.copy().convert('RGB')

    if not _is_valid_bbox(bbox):
        return out

    w, h = out.size
    x0 = int(bbox[0] * w)
    y0 = int(bbox[1] * h)
    x1 = int(bbox[2] * w)
    y1 = int(bbox[3] * h)

    draw = ImageDraw.Draw(out)
    line_width = max(2, min(w, h) // 200)
    draw.rectangle([x0, y0, x1, y1], outline=color, width=line_width)

    # Label background
    text_y = max(0, y0 - 14)
    draw.text((x0 + 2, text_y), label, fill=color)

    return out


def _is_valid_bbox(bbox: List[float]) -> bool:
    """Return True if *bbox* has 4 finite values with x0 < x1 and y0 < y1."""
    if not isinstance(bbox, (list, tuple)) or len(bbox) != 4:
        return False
    try:
        x0, y0, x1, y1 = (float(v) for v in bbox)
    except (TypeError, ValueError):
        return False
    if not all(v == v for v in (x0, y0, x1, y1)):  # NaN check
        return False
    return x0 < x1 and y0 < y1


def normalize_bbox(bbox: List[float], image_size: tuple) -> List[float]:
    """Normalize bounding box coordinates to 0-1 range.

    Models may return pixel coordinates despite the prompt asking for
    normalized values.  If any coordinate exceeds 1.0, assume pixel
    coordinates and scale by image dimensions.
    """
    if not isinstance(bbox, (list, tuple)) or len(bbox) != 4:
        return [0.0, 0.0, 1.0, 1.0]
    try:
        vals = [float(v) for v in bbox]
    except (TypeError, ValueError):
        return [0.0, 0.0, 1.0, 1.0]
    if any(v > 1.0 for v in vals):
        w, h = image_size
        if w > 0 and h > 0:
            return [vals[0] / w, vals[1] / h, vals[2] / w, vals[3] / h]
    return vals


def format_bbox_str(bbox: List[float]) -> str:
    """Format a bbox list as a human-readable string for table columns.

    Example: [0.12, 0.34, 0.56, 0.78] -> "[0.12, 0.34, 0.56, 0.78]"
    Returns "N/A" for invalid input.
    """
    if not isinstance(bbox, (list, tuple)) or len(bbox) != 4:
        return 'N/A'
    try:
        return '[' + ', '.join(f'{float(v):.2f}' for v in bbox) + ']'
    except (TypeError, ValueError):
        return 'N/A'
