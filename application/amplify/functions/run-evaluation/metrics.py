"""
Evaluation Metrics Module

Contains metric calculations for VQA evaluation:
- ANLS (Average Normalized Levenshtein Similarity): text accuracy
- IoU (Intersection over Union): bounding box spatial accuracy

These functions are extracted from handler.py for testability.
"""
from typing import List


def calculate_anls(prediction: str, ground_truths: List[str], threshold: float = 0.5) -> float:
    """
    Calculate ANLS (Average Normalized Levenshtein Similarity).

    Standard metric for DocVQA evaluation.
    ANLS = 1 - NLD (Normalized Levenshtein Distance).
    If ANLS < threshold, return 0 (penalize very wrong answers).

    For single ground truth: Standard ANLS comparison
    For multiple ground truths (list items): Average ANLS across all items
      - Model must output ALL items to score high
      - Prediction is split by newlines and matched against each ground truth

    Args:
        prediction: Model's predicted answer text
        ground_truths: List of acceptable ground truth answers
        threshold: Minimum ANLS to count as correct (default 0.5)

    Returns:
        ANLS score between 0.0 and 1.0
    """
    if not ground_truths:
        return 0.0

    # Single answer: standard ANLS comparison
    if len(ground_truths) == 1:
        return calculate_single_anls(prediction, ground_truths[0], threshold)

    # Multiple answers (list items): model must output ALL items
    # Split prediction into items by newline
    pred_items = [line.strip() for line in prediction.split('\n') if line.strip()]

    if not pred_items:
        return 0.0

    # For each ground truth item, find best matching prediction item
    total_anls = 0.0
    for gt in ground_truths:
        best_anls = 0.0
        for pred in pred_items:
            anls = calculate_single_anls(pred, gt, threshold)
            best_anls = max(best_anls, anls)
        total_anls += best_anls

    # Average across all ground truth items
    return total_anls / len(ground_truths)


def calculate_single_anls(prediction: str, ground_truth: str, threshold: float = 0.5) -> float:
    """
    Calculate ANLS between a single prediction and single ground truth.

    Args:
        prediction: Model's predicted answer
        ground_truth: Expected answer
        threshold: Minimum similarity to count as partially correct

    Returns:
        ANLS score (0.0 if below threshold, otherwise 0.0-1.0)
    """
    pred_norm = prediction.lower().strip()
    gt_norm = ground_truth.lower().strip()

    if not pred_norm and not gt_norm:
        return 1.0

    if not pred_norm or not gt_norm:
        return 0.0

    lev_dist = levenshtein_distance(pred_norm, gt_norm)
    max_len = max(len(pred_norm), len(gt_norm))
    anls = 1.0 - (lev_dist / max_len)

    if anls < threshold:
        anls = 0.0

    return anls


def levenshtein_distance(s1: str, s2: str) -> int:
    """
    Compute Levenshtein distance between two strings using dynamic programming.

    The Levenshtein distance is the minimum number of single-character edits
    (insertions, deletions, or substitutions) required to transform s1 into s2.

    Args:
        s1: First string
        s2: Second string

    Returns:
        Edit distance (integer >= 0)
    """
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)

    if len(s2) == 0:
        return len(s1)

    prev_row = list(range(len(s2) + 1))

    for i, c1 in enumerate(s1):
        curr_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = prev_row[j + 1] + 1
            deletions = curr_row[j] + 1
            substitutions = prev_row[j] + (c1 != c2)
            curr_row.append(min(insertions, deletions, substitutions))
        prev_row = curr_row

    return prev_row[-1]


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


def scale_bbox(
    bbox: List[float],
    original_width: int,
    original_height: int,
    target_width: int,
    target_height: int,
) -> List[float]:
    """
    Scale bounding box from original to target coordinate space.

    Args:
        bbox: Bounding box in original coordinates [x0, y0, x1, y1]
        original_width: Original image width
        original_height: Original image height
        target_width: Target image width
        target_height: Target image height

    Returns:
        Scaled bounding box in target coordinates
    """
    if original_width <= 0 or original_height <= 0:
        return bbox

    if target_width <= 0 or target_height <= 0:
        return bbox

    scale_x = target_width / original_width
    scale_y = target_height / original_height

    return [
        bbox[0] * scale_x,
        bbox[1] * scale_y,
        bbox[2] * scale_x,
        bbox[3] * scale_y,
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

    # Check coordinates are valid (positive area)
    if x0 >= x1 or y0 >= y1:
        return False

    # Check not full image (which is default fallback)
    if x0 == 0.0 and y0 == 0.0 and x1 == 1.0 and y1 == 1.0:
        return False

    # Check minimum size
    area = (x1 - x0) * (y1 - y0)
    if area < min_size_ratio:
        return False

    return True
