from __future__ import annotations

from typing import Sequence

import numpy as np
from colour import delta_E

from app.color import rgb_to_lab
from app.palette_presets import get_default_colors


def suggest_mix(
    target_rgb: tuple[int, int, int],
    current_rgb: tuple[int, int, int],
    bases: Sequence[dict] | None = None,
    max_components: int = 3,
) -> dict:
    """
    Heuristic mix suggestion: non-negative weights on base swatches in Lab space.
    MVP — linear blend toward target, not physical paint model.
    """
    palette = list(bases) if bases is not None else get_default_colors()
    if not palette:
        return {
            "available": False,
            "message": "Add base colors to the active palette set",
            "components": [],
        }

    target_lab = np.array(rgb_to_lab(target_rgb))
    current_lab = np.array(rgb_to_lab(current_rgb))
    gap = target_lab - current_lab
    gap_norm = float(np.linalg.norm(gap))

    scored: list[dict] = []
    for entry in palette:
        name = entry["name"]
        rgb = tuple(entry["rgb"])
        lab = np.array(rgb_to_lab(rgb))  # type: ignore[arg-type]
        direction = lab - current_lab
        norm = float(np.linalg.norm(direction))
        if norm < 1e-6:
            continue
        alignment = float(np.dot(direction, gap) / (norm * gap_norm + 1e-9))
        if alignment <= 0:
            continue
        weight = alignment * (gap_norm / norm)
        scored.append(
            {
                "name": name,
                "rgb": {"r": rgb[0], "g": rgb[1], "b": rgb[2]},
                "weight": round(weight, 3),
                "deltaE_to_target": round(
                    float(
                        delta_E(
                            lab,
                            target_lab,
                            method="CIE 2000",
                        )
                    ),
                    2,
                ),
            }
        )

    scored.sort(key=lambda x: x["weight"], reverse=True)
    top = scored[:max_components]
    total_w = sum(c["weight"] for c in top) or 1.0
    for c in top:
        c["percent"] = round(100.0 * c["weight"] / total_w, 1)

    return {
        "available": True,
        "deltaE_current_to_target": round(
            float(
                delta_E(
                    current_lab,
                    target_lab,
                    method="CIE 2000",
                )
            ),
            2,
        ),
        "components": top,
    }
