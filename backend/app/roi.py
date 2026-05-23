from __future__ import annotations

import cv2
import numpy as np

from app.roi_state import RoiState


def square_roi_bounds(
    frame_height: int, frame_width: int, roi: RoiState
) -> tuple[int, int, int, int]:
    """Return (x0, y0, x1, y1) for a square ROI; center optional."""
    size = roi.size
    cx = roi.center_x if roi.center_x is not None else frame_width // 2
    cy = roi.center_y if roi.center_y is not None else frame_height // 2
    half = size // 2
    x0 = max(0, min(frame_width - size, int(round(cx - half))))
    y0 = max(0, min(frame_height - size, int(round(cy - half))))
    x1 = x0 + size
    y1 = y0 + size
    return x0, y0, x1, y1


def square_center(roi: RoiState, frame_width: int, frame_height: int) -> tuple[int, int]:
    x0, y0, x1, y1 = square_roi_bounds(frame_height, frame_width, roi)
    return (x0 + x1) // 2, (y0 + y1) // 2


def _sample_patch_median(patch: np.ndarray) -> tuple[int, int, int]:
    if patch.size == 0:
        return 0, 0, 0
    pixels = patch.reshape(-1, 3)
    b, g, r = np.median(pixels, axis=0)
    return int(r), int(g), int(b)


def sample_median_rgb(frame_bgr: np.ndarray, roi: RoiState) -> tuple[int, int, int]:
    """Median RGB (0–255) from ROI on a BGR frame."""
    h, w = frame_bgr.shape[:2]
    if roi.mode == "polygon" and len(roi.points) >= 3:
        pts = np.array(roi.points, dtype=np.int32)
        mask = np.zeros((h, w), dtype=np.uint8)
        cv2.fillPoly(mask, [pts], 255)
        pixels = frame_bgr[mask > 0]
        return _sample_patch_median(pixels)

    x0, y0, x1, y1 = square_roi_bounds(h, w, roi)
    patch = frame_bgr[y0:y1, x0:x1]
    return _sample_patch_median(patch)


def draw_roi_overlay(
    frame: np.ndarray,
    roi: RoiState,
    color: tuple[int, int, int] = (0, 255, 255),
) -> np.ndarray:
    """Draw ROI on a BGR frame copy."""
    out = frame.copy()
    h, w = out.shape[:2]

    if roi.mode == "polygon" and roi.points:
        pts = np.array(roi.points, dtype=np.int32)
        closed = len(roi.points) >= 3
        poly = [pts]
        if closed:
            cv2.polylines(out, poly, True, color, 2)
            overlay = out.copy()
            cv2.fillPoly(overlay, poly, color)
            cv2.addWeighted(overlay, 0.12, out, 0.88, 0, out)
        else:
            cv2.polylines(out, poly, False, color, 2)
        for i, (px, py) in enumerate(roi.points):
            pt_color = (0, 200, 255) if i == 0 else color
            cv2.circle(out, (int(px), int(py)), 5, pt_color, -1)
        return out

    x0, y0, x1, y1 = square_roi_bounds(h, w, roi)
    cv2.rectangle(out, (x0, y0), (x1 - 1, y1 - 1), color, 2)
    cross = 8
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    cv2.line(out, (cx - cross, cy), (cx + cross, cy), color, 1)
    cv2.line(out, (cx, cy - cross), (cx, cy + cross), color, 1)
    return out
