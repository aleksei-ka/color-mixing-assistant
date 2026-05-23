from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from colour import delta_E

from app.color import rgb_to_lab

PALETTE_PATH = Path(__file__).resolve().parents[1] / "data" / "base_colors.json"


def load_base_colors() -> list[dict]:
    if not PALETTE_PATH.exists():
        return []
    with PALETTE_PATH.open(encoding="utf-8") as f:
        return json.load(f)


def suggest_mix(
    target_rgb: tuple[int, int, int],
    current_rgb: tuple[int, int, int],
    max_components: int = 3,
) -> dict:
    """
    Heuristic mix suggestion: non-negative weights on base swatches in Lab space.
    MVP — linear blend toward target, not physical paint model.
    """
    bases = load_base_colors()
    if not bases:
        return {
            "available": False,
            "message": "Добавьте базовые цвета в backend/data/base_colors.json",
            "components": [],
        }

    target_lab = np.array(rgb_to_lab(target_rgb))
    current_lab = np.array(rgb_to_lab(current_rgb))
    gap = target_lab - current_lab
    gap_norm = float(np.linalg.norm(gap))

    scored: list[dict] = []
    for entry in bases:
        name = entry["name"]
        rgb = tuple(entry["rgb"])
        lab = np.array(rgb_to_lab(rgb))  # type: ignore[arg-type]
        direction = lab - current_lab
        norm = float(np.linalg.norm(direction))
        if norm < 1e-6:
            continue
        # How much this swatch moves toward target along the gap vector
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
        "legend": (
            "Проценты — не объём краски. Это доли вклада трёх пигментов из "
            "base_colors.json в сдвиг от текущего цвета палитры к образцу. "
            "Сумма всегда 100% у показанных строк."
        ),
    }
