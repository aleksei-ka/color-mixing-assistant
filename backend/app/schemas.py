from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class HealthResponse(BaseModel):
    status: str = Field(examples=["ok"])


class ConfigResponse(BaseModel):
    roi_size: int = Field(alias="roiSize", examples=[80])
    frame_width: int = Field(alias="frameWidth", examples=[640])
    frame_height: int = Field(alias="frameHeight", examples=[480])

    model_config = ConfigDict(populate_by_name=True)


class RgbChannels(BaseModel):
    r: int = Field(ge=0, le=255, examples=[200])
    g: int = Field(ge=0, le=255, examples=[120])
    b: int = Field(ge=0, le=255, examples=[80])


class RgbBody(BaseModel):
    """RGB triplet sampled in the browser (0–255 per channel)."""

    r: int = Field(ge=0, le=255, examples=[227])
    g: int = Field(ge=0, le=255, examples=[38])
    b: int = Field(ge=0, le=255, examples=[54])


class HslChannels(BaseModel):
    h: float
    s: float
    l: float


class LabChannels(BaseModel):
    l: float
    a: float
    b: float


class CmykChannels(BaseModel):
    c: float
    m: float
    y: float
    k: float


class ColorReadingResponse(BaseModel):
    rgb: RgbChannels
    hex: str = Field(examples=["#e32636"])
    hsl: HslChannels
    lab: LabChannels
    cmyk: CmykChannels


class BaseColorEntry(BaseModel):
    name: str = Field(examples=["Cadmium Red Medium"])
    rgb: list[int] = Field(
        min_length=3,
        max_length=3,
        examples=[[227, 38, 54]],
    )


class BaseColorsResponse(BaseModel):
    colors: list[BaseColorEntry]


class MixComponent(BaseModel):
    name: str
    rgb: RgbChannels
    weight: float
    delta_e_to_target: float = Field(alias="deltaE_to_target")
    percent: float | None = None

    model_config = ConfigDict(populate_by_name=True)


class MixSuggestion(BaseModel):
    available: bool
    delta_e_current_to_target: float = Field(alias="deltaE_current_to_target")
    components: list[MixComponent]
    legend: str

    model_config = ConfigDict(populate_by_name=True)


class MatchResponse(BaseModel):
    delta_e: float = Field(alias="deltaE", examples=[12.4])
    target: ColorReadingResponse
    palette: ColorReadingResponse
    target_captured: bool = Field(alias="targetCaptured", examples=[True])
    palette_captured: bool = Field(alias="paletteCaptured", examples=[True])
    mix: MixSuggestion

    model_config = ConfigDict(populate_by_name=True)
