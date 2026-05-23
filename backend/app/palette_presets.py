from __future__ import annotations

from typing import TypedDict


class PalettePreset(TypedDict):
    id: str
    tag: str
    category: str
    label_en: str
    label_ru: str
    description_en: str
    description_ru: str
    colors: list[dict]


# Presets are defined in code only (no admin UI).
CLASSIC_10: list[dict] = [
    {"name": "Cadmium Red Medium", "rgb": [227, 38, 54]},
    {"name": "Cadmium Yellow Medium", "rgb": [255, 218, 3]},
    {"name": "Ultramarine", "rgb": [18, 10, 143]},
    {"name": "Phthalo Green (Blue Shade)", "rgb": [0, 130, 92]},
    {"name": "Titanium White", "rgb": [245, 245, 240]},
    {"name": "Ivory Black", "rgb": [41, 36, 33]},
    {"name": "Yellow Ochre", "rgb": [203, 169, 86]},
    {"name": "Burnt Sienna", "rgb": [138, 54, 15]},
    {"name": "Raw Umber", "rgb": [99, 74, 43]},
    {"name": "Dioxazine Purple", "rgb": [55, 5, 85]},
]

MINIMAL_5: list[dict] = [
    {"name": "Cadmium Red Medium", "rgb": [227, 38, 54]},
    {"name": "Cadmium Yellow Medium", "rgb": [255, 218, 3]},
    {"name": "Ultramarine", "rgb": [18, 10, 143]},
    {"name": "Titanium White", "rgb": [245, 245, 240]},
    {"name": "Ivory Black", "rgb": [41, 36, 33]},
]

WINSOR_NEWTON: list[dict] = [
    {"name": "W&N Cadmium Red", "rgb": [220, 45, 50]},
    {"name": "W&N Cadmium Yellow Pale", "rgb": [255, 230, 120]},
    {"name": "W&N French Ultramarine", "rgb": [20, 25, 150]},
    {"name": "W&N Phthalo Blue GS", "rgb": [0, 90, 160]},
    {"name": "W&N Permanent Green Light", "rgb": [0, 150, 70]},
    {"name": "W&N Titanium White", "rgb": [250, 250, 245]},
    {"name": "W&N Ivory Black", "rgb": [35, 32, 30]},
    {"name": "W&N Burnt Umber", "rgb": [95, 60, 35]},
]

SCHMINCKE: list[dict] = [
    {"name": "Schmincke Cadmium Red Light", "rgb": [235, 55, 45]},
    {"name": "Schmincke Cadmium Yellow", "rgb": [252, 210, 0]},
    {"name": "Schmincke Ultramarine Finest", "rgb": [15, 20, 140]},
    {"name": "Schmincke Phthalo Green", "rgb": [0, 125, 85]},
    {"name": "Schmincke Magenta", "rgb": [200, 0, 90]},
    {"name": "Schmincke Titanium White", "rgb": [248, 248, 242]},
    {"name": "Schmincke Ivory Black", "rgb": [40, 38, 36]},
    {"name": "Schmincke Transparent Oxide Red", "rgb": [150, 70, 45]},
]

PRESETS: list[PalettePreset] = [
    {
        "id": "classic-10",
        "tag": "count:10",
        "category": "count",
        "label_en": "Classic set (10 colors)",
        "label_ru": "Классический набор (10 цветов)",
        "description_en": "Balanced starter palette for general mixing.",
        "description_ru": "Сбалансированная стартовая палитра для смешивания.",
        "colors": CLASSIC_10,
    },
    {
        "id": "minimal-5",
        "tag": "count:5",
        "category": "count",
        "label_en": "Minimal set (5 colors)",
        "label_ru": "Минимальный набор (5 цветов)",
        "description_en": "Primary + white + black only.",
        "description_ru": "Только основные + белый + чёрный.",
        "colors": MINIMAL_5,
    },
    {
        "id": "winsor-newton",
        "tag": "brand:winsor-newton",
        "category": "manufacturer",
        "label_en": "Winsor & Newton (8)",
        "label_ru": "Winsor & Newton (8)",
        "description_en": "Manufacturer-style naming, 8 tubes.",
        "description_ru": "Имена в стиле производителя, 8 туб.",
        "colors": WINSOR_NEWTON,
    },
    {
        "id": "schmincke",
        "tag": "brand:schmincke",
        "category": "manufacturer",
        "label_en": "Schmincke (8)",
        "label_ru": "Schmincke (8)",
        "description_en": "Manufacturer-style naming, 8 tubes.",
        "description_ru": "Имена в стиле производителя, 8 туб.",
        "colors": SCHMINCKE,
    },
]

DEFAULT_PRESET_ID = "classic-10"

_PRESET_BY_ID = {p["id"]: p for p in PRESETS}


def list_preset_summaries(lang: str = "en") -> list[dict]:
    use_ru = lang.lower().startswith("ru")
    return [
        {
            "id": p["id"],
            "tag": p["tag"],
            "category": p["category"],
            "label": p["label_ru"] if use_ru else p["label_en"],
            "description": p["description_ru"] if use_ru else p["description_en"],
            "colorCount": len(p["colors"]),
        }
        for p in PRESETS
    ]


def get_preset_colors(preset_id: str) -> list[dict]:
    preset = _PRESET_BY_ID.get(preset_id)
    if preset is None:
        return []
    return [dict(c) for c in preset["colors"]]


def get_default_colors() -> list[dict]:
    return get_preset_colors(DEFAULT_PRESET_ID)
