from __future__ import annotations

import logging

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.color import analyze_rgb, delta_e_2000, reading_to_dict
from app.config import settings
from app.mixer import load_base_colors, suggest_mix

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Color Matcher API",
    description="Color analysis and mix hints (no camera capture on server)",
    version="0.2.0",
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


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/config")
def get_config() -> dict:
    """Defaults for UI; cameras are handled in the browser."""
    return {
        "roiSize": settings.roi_size,
        "frameWidth": settings.frame_width,
        "frameHeight": settings.frame_height,
    }


@app.get("/api/base-colors")
def get_base_colors() -> dict:
    return {"colors": load_base_colors()}


class RgbBody(BaseModel):
    r: int = Field(ge=0, le=255)
    g: int = Field(ge=0, le=255)
    b: int = Field(ge=0, le=255)


@app.post("/api/analyze-rgb")
def analyze_rgb_endpoint(body: RgbBody) -> dict:
    return reading_to_dict(analyze_rgb((body.r, body.g, body.b)))


def _rgb_from_query(
    r: int | None, g: int | None, b: int | None
) -> tuple[int, int, int] | None:
    if r is None and g is None and b is None:
        return None
    if r is None or g is None or b is None:
        raise HTTPException(400, "Provide R, G, and B together")
    return r, g, b


@app.get("/api/match")
def get_match(
    target_r: int | None = Query(default=None, alias="targetR", ge=0, le=255),
    target_g: int | None = Query(default=None, alias="targetG", ge=0, le=255),
    target_b: int | None = Query(default=None, alias="targetB", ge=0, le=255),
    palette_r: int | None = Query(default=None, alias="paletteR", ge=0, le=255),
    palette_g: int | None = Query(default=None, alias="paletteG", ge=0, le=255),
    palette_b: int | None = Query(default=None, alias="paletteB", ge=0, le=255),
) -> dict:
    target_rgb = _rgb_from_query(target_r, target_g, target_b)
    palette_rgb = _rgb_from_query(palette_r, palette_g, palette_b)
    if target_rgb is None or palette_rgb is None:
        raise HTTPException(
            400,
            "Provide targetR/G/B and paletteR/G/B (colors are sampled in the browser)",
        )

    target = reading_to_dict(analyze_rgb(target_rgb))
    palette = reading_to_dict(analyze_rgb(palette_rgb))
    t_rgb = (target_rgb[0], target_rgb[1], target_rgb[2])
    p_rgb = (palette_rgb[0], palette_rgb[1], palette_rgb[2])
    return {
        "deltaE": delta_e_2000(t_rgb, p_rgb),
        "target": target,
        "palette": palette,
        "targetCaptured": True,
        "paletteCaptured": True,
        "mix": suggest_mix(t_rgb, p_rgb),
    }
