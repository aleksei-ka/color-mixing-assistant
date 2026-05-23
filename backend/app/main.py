from __future__ import annotations

import logging

from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from app.color import analyze_rgb, delta_e_2000, reading_to_dict
from app.config import settings
from app.mixer import suggest_mix
from app.palette_presets import (
    DEFAULT_PRESET_ID,
    get_default_colors,
    get_preset_colors,
    list_preset_summaries,
)
from app.schemas import (
    BaseColorEntry,
    BaseColorsResponse,
    ColorReadingResponse,
    ConfigResponse,
    HealthResponse,
    MatchRequestBody,
    MatchResponse,
    MixSuggestion,
    PalettePresetColorsResponse,
    PalettePresetsResponse,
    RgbBody,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Color Matcher API",
    description=(
        "Color analysis and paint-mix hints. Cameras and ROI live in the browser; "
        "the server only receives RGB values via query parameters or JSON body."
    ),
    version="0.3.0",
    openapi_tags=[
        {
            "name": "health",
            "description": "Liveness and UI defaults.",
        },
        {
            "name": "colors",
            "description": "RGB → Lab/HSL/CMYK and base paint catalog.",
        },
        {
            "name": "palettes",
            "description": "Server-defined base color presets (read-only, in code).",
        },
        {
            "name": "match",
            "description": "ΔE and mix suggestion from browser-sampled RGB pairs.",
        },
    ],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _lang_from_header(accept_language: str | None) -> str:
    if accept_language and accept_language.lower().startswith("ru"):
        return "ru"
    return "en"


def _bases_from_entries(entries: list[BaseColorEntry]) -> list[dict]:
    return [{"name": e.name, "rgb": list(e.rgb)} for e in entries]


def _build_match(
    target_rgb: tuple[int, int, int],
    palette_rgb: tuple[int, int, int],
    bases: list[dict] | None,
) -> MatchResponse:
    target = reading_to_dict(analyze_rgb(target_rgb))
    palette = reading_to_dict(analyze_rgb(palette_rgb))
    mix_raw = suggest_mix(target_rgb, palette_rgb, bases=bases)
    return MatchResponse(
        deltaE=delta_e_2000(target_rgb, palette_rgb),
        target=target,
        palette=palette,
        targetCaptured=True,
        paletteCaptured=True,
        mix=MixSuggestion.model_validate(mix_raw),
    )


@app.get(
    "/api/health",
    tags=["health"],
    summary="Health check",
    response_model=HealthResponse,
)
def health() -> HealthResponse:
    return HealthResponse(status="ok")


@app.get(
    "/api/config",
    tags=["health"],
    summary="UI defaults",
    response_model=ConfigResponse,
)
def get_config() -> ConfigResponse:
    """Default ROI size and reference frame dimensions (cameras run in the browser)."""
    return ConfigResponse(
        roiSize=settings.roi_size,
        frameWidth=settings.frame_width,
        frameHeight=settings.frame_height,
    )


@app.get(
    "/api/palette-presets",
    tags=["palettes"],
    summary="List server palette presets",
    response_model=PalettePresetsResponse,
)
def list_palette_presets(
    accept_language: str | None = Header(default=None, alias="Accept-Language"),
) -> PalettePresetsResponse:
    """Tagged base-color sets defined in code (count / manufacturer)."""
    lang = _lang_from_header(accept_language)
    return PalettePresetsResponse(
        defaultPresetId=DEFAULT_PRESET_ID,
        presets=list_preset_summaries(lang),
    )


@app.get(
    "/api/palette-presets/{preset_id}",
    tags=["palettes"],
    summary="Get preset colors",
    response_model=PalettePresetColorsResponse,
    responses={404: {"description": "Unknown preset id"}},
)
def get_palette_preset(preset_id: str) -> PalettePresetColorsResponse:
    colors = get_preset_colors(preset_id)
    if not colors:
        raise HTTPException(404, f"Unknown preset: {preset_id}")
    return PalettePresetColorsResponse(presetId=preset_id, colors=colors)


@app.get(
    "/api/base-colors",
    tags=["colors"],
    summary="Default base paint catalog",
    response_model=BaseColorsResponse,
    deprecated=True,
)
def get_base_colors() -> BaseColorsResponse:
    """Legacy alias for the default server preset (`classic-10`)."""
    return BaseColorsResponse(colors=get_default_colors())


@app.post(
    "/api/analyze-rgb",
    tags=["colors"],
    summary="Analyze RGB",
    response_model=ColorReadingResponse,
)
def analyze_rgb_endpoint(body: RgbBody) -> ColorReadingResponse:
    """Convert a single RGB sample (from canvas/ROI) to Lab, HSL, CMYK, and hex."""
    return ColorReadingResponse.model_validate(
        reading_to_dict(analyze_rgb((body.r, body.g, body.b)))
    )


def _rgb_from_query(
    r: int | None, g: int | None, b: int | None
) -> tuple[int, int, int] | None:
    if r is None and g is None and b is None:
        return None
    if r is None or g is None or b is None:
        raise HTTPException(400, "Provide R, G, and B together")
    return r, g, b


@app.post(
    "/api/match",
    tags=["match"],
    summary="Match with client base colors",
    response_model=MatchResponse,
)
def post_match(body: MatchRequestBody) -> MatchResponse:
    """
    Compare target vs palette using the active base paint set from the browser.

    User-edited palettes stay on the client; only RGB triplets are sent here.
    """
    target_rgb = (body.target.r, body.target.g, body.target.b)
    palette_rgb = (body.palette.r, body.palette.g, body.palette.b)
    bases = _bases_from_entries(body.base_colors) if body.base_colors else None
    return _build_match(target_rgb, palette_rgb, bases)


@app.get(
    "/api/match",
    tags=["match"],
    summary="Match target vs palette (default server preset)",
    response_model=MatchResponse,
    responses={
        400: {
            "description": "Missing or incomplete RGB query parameters",
        },
    },
)
def get_match(
    target_r: int | None = Query(
        default=None,
        alias="targetR",
        ge=0,
        le=255,
        description="Target color red (0–255). Required with targetG and targetB.",
        examples=[200],
    ),
    target_g: int | None = Query(
        default=None,
        alias="targetG",
        ge=0,
        le=255,
        description="Target color green (0–255).",
        examples=[120],
    ),
    target_b: int | None = Query(
        default=None,
        alias="targetB",
        ge=0,
        le=255,
        description="Target color blue (0–255).",
        examples=[80],
    ),
    palette_r: int | None = Query(
        default=None,
        alias="paletteR",
        ge=0,
        le=255,
        description="Palette color red (0–255). Required with paletteG and paletteB.",
        examples=[180],
    ),
    palette_g: int | None = Query(
        default=None,
        alias="paletteG",
        ge=0,
        le=255,
        description="Palette color green (0–255).",
        examples=[100],
    ),
    palette_b: int | None = Query(
        default=None,
        alias="paletteB",
        ge=0,
        le=255,
        description="Palette color blue (0–255).",
        examples=[70],
    ),
) -> MatchResponse:
    """
    Compare two browser-sampled colors using the default server preset.

    Prefer `POST /api/match` with `baseColors` when the user edits palettes locally.
    """
    target_rgb = _rgb_from_query(target_r, target_g, target_b)
    palette_rgb = _rgb_from_query(palette_r, palette_g, palette_b)
    if target_rgb is None or palette_rgb is None:
        raise HTTPException(
            400,
            "Provide targetR/G/B and paletteR/G/B (colors are sampled in the browser)",
        )
    return _build_match(target_rgb, palette_rgb, bases=None)
