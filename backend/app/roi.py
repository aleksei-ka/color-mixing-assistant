from __future__ import annotations

import numpy as np


def center_roi_bounds(
    frame_height: int, frame_width: int, roi_size: int
) -> tuple[int, int, int, int]:
    """Return (x0, y0, x1, y1) for a square ROI centered on the frame."""
    half = roi_size // 2
    cx, cy = frame_width // 2, frame_height // 2
    x0 = max(0, cx - half)
    y0 = max(0, cy - half)
    x1 = min(frame_width, x0 + roi_size)
    y1 = min(frame_height, y0 + roi_size)
    return x0, y0, x1, y1


def draw_roi_overlay(
    frame: np.ndarray, roi_size: int, color: tuple[int, int, int] = (0, 255, 255)
) -> np.ndarray:
    """Draw center ROI rectangle on a BGR frame (in-place copy)."""
    out = frame.copy()
    h, w = out.shape[:2]
    x0, y0, x1, y1 = center_roi_bounds(h, w, roi_size)
    cv2 = __import__("cv2")
    cv2.rectangle(out, (x0, y0), (x1 - 1, y1 - 1), color, 2)
    cross = 8
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    cv2.line(out, (cx - cross, cy), (cx + cross, cy), color, 1)
    cv2.line(out, (cx, cy - cross), (cx, cy + cross), color, 1)
    return out


def sample_median_rgb(frame_bgr: np.ndarray, roi_size: int) -> tuple[int, int, int]:
    """Median RGB (0–255) from center ROI on a BGR frame."""
    h, w = frame_bgr.shape[:2]
    x0, y0, x1, y1 = center_roi_bounds(h, w, roi_size)
    patch = frame_bgr[y0:y1, x0:x1]
    if patch.size == 0:
        return 0, 0, 0
    pixels = patch.reshape(-1, 3)
    b, g, r = np.median(pixels, axis=0)
    return int(r), int(g), int(b)
