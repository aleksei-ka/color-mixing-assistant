from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from colour import XYZ_to_Lab, delta_E, sRGB_to_XYZ


@dataclass
class ColorReading:
    rgb: tuple[int, int, int]
    hex: str
    hsl: tuple[float, float, float]
    lab: tuple[float, float, float]
    cmyk: tuple[float, float, float, float]


def _rgb_u8_to_float(rgb: tuple[int, int, int]) -> np.ndarray:
    return np.array([c / 255.0 for c in rgb], dtype=np.float64)


def rgb_to_hex(rgb: tuple[int, int, int]) -> str:
    r, g, b = rgb
    return f"#{r:02X}{g:02X}{b:02X}"


def rgb_to_hsl(rgb: tuple[int, int, int]) -> tuple[float, float, float]:
    r, g, b = (c / 255.0 for c in rgb)
    mx, mn = max(r, g, b), min(r, g, b)
    l = (mx + mn) / 2.0
    if mx == mn:
        return 0.0, 0.0, round(l * 100, 1)
    d = mx - mn
    s = d / (2.0 - mx - mn) if l > 0.5 else d / (mx + mn)
    if mx == r:
        h = (g - b) / d + (6 if g < b else 0)
    elif mx == g:
        h = (b - r) / d + 2
    else:
        h = (r - g) / d + 4
    h /= 6.0
    return round(h * 360, 1), round(s * 100, 1), round(l * 100, 1)


def rgb_to_lab(rgb: tuple[int, int, int]) -> tuple[float, float, float]:
    arr = _rgb_u8_to_float(rgb)
    xyz = sRGB_to_XYZ(arr)
    lab = XYZ_to_Lab(xyz)
    return round(float(lab[0]), 2), round(float(lab[1]), 2), round(float(lab[2]), 2)


def rgb_to_cmyk(rgb: tuple[int, int, int]) -> tuple[float, float, float, float]:
    """Simple device-independent CMYK estimate from sRGB (not print ICC)."""
    r, g, b = (c / 255.0 for c in rgb)
    k = 1.0 - max(r, g, b)
    if k >= 1.0 - 1e-6:
        return 0.0, 0.0, 0.0, 100.0
    c = (1.0 - r - k) / (1.0 - k)
    m = (1.0 - g - k) / (1.0 - k)
    y = (1.0 - b - k) / (1.0 - k)
    return (
        round(c * 100, 1),
        round(m * 100, 1),
        round(y * 100, 1),
        round(k * 100, 1),
    )


def analyze_rgb(rgb: tuple[int, int, int]) -> ColorReading:
    return ColorReading(
        rgb=rgb,
        hex=rgb_to_hex(rgb),
        hsl=rgb_to_hsl(rgb),
        lab=rgb_to_lab(rgb),
        cmyk=rgb_to_cmyk(rgb),
    )


def delta_e_2000(
    a_rgb: tuple[int, int, int], b_rgb: tuple[int, int, int]
) -> float:
    lab_a = np.array(rgb_to_lab(a_rgb))
    lab_b = np.array(rgb_to_lab(b_rgb))
    return round(float(delta_E(lab_a, lab_b, method="CIE 2000")), 2)


class EmaSmoother:
    """Exponential moving average for RGB channels."""

    def __init__(self, alpha: float) -> None:
        self.alpha = alpha
        self._value: np.ndarray | None = None

    def reset(self) -> None:
        self._value = None

    def update(self, rgb: tuple[int, int, int]) -> tuple[int, int, int]:
        if self.alpha <= 0:
            return rgb
        sample = np.array(rgb, dtype=np.float64)
        if self._value is None:
            self._value = sample
        else:
            self._value = self.alpha * sample + (1.0 - self.alpha) * self._value
        return tuple(int(round(c)) for c in self._value.clip(0, 255))


def reading_to_dict(reading: ColorReading) -> dict:
    h, s, l = reading.hsl
    L, a, b = reading.lab
    c, m, y, k = reading.cmyk
    r, g, b = reading.rgb
    return {
        "rgb": {"r": r, "g": g, "b": b},
        "hex": reading.hex,
        "hsl": {"h": h, "s": s, "l": l},
        "lab": {"l": L, "a": a, "b": b},
        "cmyk": {"c": c, "m": m, "y": y, "k": k},
    }
