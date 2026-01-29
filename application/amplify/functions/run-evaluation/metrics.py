"""
Evaluation Metrics Module

Contains metric calculations for VQA evaluation:
- ANLS (Average Normalized Levenshtein Similarity): text accuracy
  Uses the `anls` package — reference implementation from DocVQA competition.
  See: https://pypi.org/project/anls/
- IoU (Intersection over Union): bounding box spatial accuracy

These functions are extracted from handler.py for testability.
"""
from typing import List

from anls import anls_score


def calculate_anls(prediction: str, ground_truths: List[str], threshold: float = 0.5) -> float:
    """
    Calculate ANLS (Average Normalized Levenshtein Similarity).

    For single ground truth: delegates to the `anls` package directly.
    For multiple ground truths (list items): splits prediction by newlines
    and matches each ground truth to the best prediction line, then averages.

    Args:
        prediction: Model's predicted answer text
        ground_truths: List of acceptable ground truth answers
        threshold: Minimum ANLS to count as correct (default 0.5)

    Returns:
        ANLS score between 0.0 and 1.0
    """
    if not ground_truths:
        return 0.0

    # Single answer: use anls package directly
    if len(ground_truths) == 1:
        return anls_score(prediction, ground_truths, threshold)

    # Multiple answers (list items): model must output ALL items
    # Split prediction into items by newline
    pred_items = [line.strip() for line in prediction.split('\n') if line.strip()]

    if not pred_items:
        return 0.0

    # For each ground truth item, find best matching prediction line
    total_anls = 0.0
    for gt in ground_truths:
        best = max(anls_score(pred, [gt], threshold) for pred in pred_items)
        total_anls += best

    # Average across all ground truth items
    return total_anls / len(ground_truths)


def calculate_iou(pred_bbox: List[float], gt_bbox: List[float]) -> float:
    """
    Calculate IoU (Intersection over Union) for bounding boxes.

    Coordinates are normalized [x0, y0, x1, y1] in 0-1 range where:
    - (x0, y0) is the top-left corner
    - (x1, y1) is the bottom-right corner

    Args:
        pred_bbox: Predicted bounding box [x0, y0, x1, y1]
        gt_bbox: Ground truth bounding box [x0, y0, x1, y1]

    Returns:
        IoU score between 0.0 and 1.0
    """
    if len(pred_bbox) != 4 or len(gt_bbox) != 4:
        return 0.0

    # Calculate intersection coordinates
    x1 = max(pred_bbox[0], gt_bbox[0])
    y1 = max(pred_bbox[1], gt_bbox[1])
    x2 = min(pred_bbox[2], gt_bbox[2])
    y2 = min(pred_bbox[3], gt_bbox[3])

    # Calculate intersection area
    intersection = max(0.0, x2 - x1) * max(0.0, y2 - y1)

    # Calculate individual areas
    pred_area = (pred_bbox[2] - pred_bbox[0]) * (pred_bbox[3] - pred_bbox[1])
    gt_area = (gt_bbox[2] - gt_bbox[0]) * (gt_bbox[3] - gt_bbox[1])

    # Calculate union
    union = pred_area + gt_area - intersection

    if union <= 0:
        return 0.0

    return intersection / union


def normalize_bbox(bbox: List[float], width: int, height: int) -> List[float]:
    """
    Normalize bounding box from pixel coordinates to 0-1 range.

    Args:
        bbox: Bounding box in pixel coordinates [x0, y0, x1, y1]
        width: Image width in pixels
        height: Image height in pixels

    Returns:
        Normalized bounding box [x0, y0, x1, y1] with values in 0-1 range
    """
    x0, y0, x1, y1 = [float(v) for v in bbox]

    if width <= 0 or height <= 0:
        return [0.0, 0.0, 1.0, 1.0]

    return [
        max(0.0, min(1.0, x0 / width)),
        max(0.0, min(1.0, y0 / height)),
        max(0.0, min(1.0, x1 / width)),
        max(0.0, min(1.0, y1 / height)),
    ]


def validate_bbox(bbox: List[float], min_size_ratio: float = 0.01) -> bool:
    """
    Validate that a bounding box is reasonable.

    A valid bounding box:
    - Has 4 coordinates
    - Has x0 < x1 and y0 < y1 (positive area)
    - Is not the full image [0, 0, 1, 1] (default fallback)
    - Has a minimum size (default 1% of image area)

    Args:
        bbox: Normalized bounding box [x0, y0, x1, y1]
        min_size_ratio: Minimum area as ratio of image (default 0.01 = 1%)

    Returns:
        True if valid, False otherwise
    """
    if len(bbox) != 4:
        return False

    x0, y0, x1, y1 = bbox

    if x0 >= x1 or y0 >= y1:
        return False

    if x0 == 0.0 and y0 == 0.0 and x1 == 1.0 and y1 == 1.0:
        return False

    area = (x1 - x0) * (y1 - y0)
    if area < min_size_ratio:
        return False

    return True
