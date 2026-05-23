from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field

from app.capture import CameraManager, probe_cameras
from app.color import delta_e_2000
from app.config import settings
from app.mixer import suggest_mix
from app.roles import CameraRole
from app.roi_state import roi_store

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

manager = CameraManager()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    manager.start()
    logger.info(
        "Cameras: target=%s palette=%s",
        manager.target_index,
        manager.palette_index,
    )
    yield
    manager.stop()


app = FastAPI(
    title="Color Matcher API",
    description="Dual webcam color sampling for palette matching",
    version="0.1.0",
    lifespan=lifespan,
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


def _role(role: str) -> CameraRole:
    try:
        return CameraRole(role)
    except ValueError as exc:
        raise HTTPException(400, f"Unknown role: {role}") from exc


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/config")
def get_config() -> dict:
    return {
        "cameraTargetIndex": manager.target_index,
        "cameraPaletteIndex": manager.palette_index,
        "roiSize": settings.roi_size,
        "frameWidth": settings.frame_width,
        "frameHeight": settings.frame_height,
        "mockOnFailure": settings.mock_on_failure,
        "cameraProbeMax": settings.camera_probe_max,
    }


@app.get("/api/cameras")
def list_cameras(max_index: int | None = Query(default=None, ge=1, le=16)) -> dict:
    if max_index is None:
        max_index = settings.camera_probe_max
    busy = {manager.target_index, manager.palette_index}
    devices = probe_cameras(max_index, skip_indices=busy)
    known = {d["index"] for d in devices}
    for idx in sorted(busy):
        if idx not in known:
            devices.append(
                {
                    "index": idx,
                    "width": settings.frame_width,
                    "height": settings.frame_height,
                    "inUse": True,
                    "streaming": True,
                }
            )
    devices.sort(key=lambda d: d["index"])
    for d in devices:
        d["inUse"] = d["index"] in busy
    return {"devices": devices}


class CameraSelectBody(BaseModel):
    target_index: int | None = Field(default=None, alias="targetIndex", ge=0)
    palette_index: int | None = Field(default=None, alias="paletteIndex", ge=0)

    model_config = {"populate_by_name": True}


@app.post("/api/cameras/select")
def select_cameras(body: CameraSelectBody) -> dict:
    if body.target_index is None and body.palette_index is None:
        raise HTTPException(400, "Specify targetIndex and/or paletteIndex")
    if body.target_index is not None:
        manager.set_camera(CameraRole.TARGET, body.target_index)
    if body.palette_index is not None:
        manager.set_camera(CameraRole.PALETTE, body.palette_index)
    return get_config()


@app.get("/api/status")
def status() -> dict:
    def stream_info(role: CameraRole) -> dict:
        s = manager.get(role)
        return {
            "role": role.value,
            "deviceIndex": s.device_index,
            "mock": s.is_mock,
            "error": s.error,
        }

    return {
        "streams": [
            stream_info(CameraRole.TARGET),
            stream_info(CameraRole.PALETTE),
        ]
    }


@app.get("/api/roi/{role}")
def get_roi(role: str) -> dict:
    return roi_store.get(_role(role)).to_api()


class RoiUpdateBody(BaseModel):
    mode: str | None = None
    size: int | None = Field(default=None, ge=8, le=400)
    center_x: int | None = Field(default=None, alias="centerX")
    center_y: int | None = Field(default=None, alias="centerY")
    reset_center: bool | None = Field(default=None, alias="resetCenter")
    points: list[list[int]] | None = None

    model_config = {"populate_by_name": True}


@app.put("/api/roi/{role}")
def update_roi(role: str, body: RoiUpdateBody) -> dict:
    camera_role = _role(role)
    if body.mode is not None and body.mode not in ("square", "polygon"):
        raise HTTPException(400, "mode must be square or polygon")
    state = roi_store.update(
        camera_role,
        mode=body.mode,
        size=body.size,
        center_x=body.center_x,
        center_y=body.center_y,
        clear_center=bool(body.reset_center),
        points=body.points,
    )
    return state.to_api()


@app.post("/api/roi/{role}/reset")
def reset_roi(role: str) -> dict:
    return roi_store.reset_square(_role(role)).to_api()


@app.post("/api/roi/{role}/redraw")
def redraw_polygon(role: str) -> dict:
    return roi_store.redraw_polygon(_role(role)).to_api()


class RgbBody(BaseModel):
    r: int = Field(ge=0, le=255)
    g: int = Field(ge=0, le=255)
    b: int = Field(ge=0, le=255)


@app.post("/api/analyze-rgb")
def analyze_rgb_endpoint(body: RgbBody) -> dict:
    from app.color import analyze_rgb, reading_to_dict

    return reading_to_dict(analyze_rgb((body.r, body.g, body.b)))


@app.get("/api/color/{role}")
def get_color(role: str) -> dict:
    stream = manager.get(_role(role))
    color = stream.get_color()
    if color is None:
        raise HTTPException(503, "No frame yet")
    return {"role": role, "color": color, "mock": stream.is_mock}


def _resolve_color(
    role: CameraRole,
    override_rgb: tuple[int, int, int] | None,
) -> tuple[dict, bool]:
    """Return (color_payload, from_capture)."""
    if override_rgb is not None:
        from app.color import analyze_rgb, reading_to_dict

        return reading_to_dict(analyze_rgb(override_rgb)), True
    live = manager.get(role).get_color()
    if not live:
        raise HTTPException(503, f"Waiting for {role.value} camera")
    return live, False


@app.get("/api/match")
def get_match(
    target_r: int | None = Query(default=None, alias="targetR", ge=0, le=255),
    target_g: int | None = Query(default=None, alias="targetG", ge=0, le=255),
    target_b: int | None = Query(default=None, alias="targetB", ge=0, le=255),
    palette_r: int | None = Query(
        default=None, alias="paletteR", ge=0, le=255
    ),
    palette_g: int | None = Query(
        default=None, alias="paletteG", ge=0, le=255
    ),
    palette_b: int | None = Query(
        default=None, alias="paletteB", ge=0, le=255
    ),
) -> dict:
    target_override = None
    if target_r is not None and target_g is not None and target_b is not None:
        target_override = (target_r, target_g, target_b)

    palette_override = None
    if palette_r is not None and palette_g is not None and palette_b is not None:
        palette_override = (palette_r, palette_g, palette_b)

    target, target_captured = _resolve_color(CameraRole.TARGET, target_override)
    palette, palette_captured = _resolve_color(CameraRole.PALETTE, palette_override)

    t_rgb = (
        target["rgb"]["r"],
        target["rgb"]["g"],
        target["rgb"]["b"],
    )
    p_rgb = (
        palette["rgb"]["r"],
        palette["rgb"]["g"],
        palette["rgb"]["b"],
    )
    return {
        "deltaE": delta_e_2000(t_rgb, p_rgb),
        "target": target,
        "palette": palette,
        "targetCaptured": target_captured,
        "paletteCaptured": palette_captured,
        "mix": suggest_mix(t_rgb, p_rgb),
    }


async def _mjpeg_generator(role: CameraRole):
    boundary = b"frame"
    stream = manager.get(role)
    while True:
        jpeg = stream.get_frame_jpeg()
        if jpeg:
            yield (
                b"--"
                + boundary
                + b"\r\nContent-Type: image/jpeg\r\n\r\n"
                + jpeg
                + b"\r\n"
            )
        await asyncio.sleep(1 / 20)


@app.get("/stream/{role}")
async def video_stream(role: str) -> StreamingResponse:
    camera_role = _role(role)
    return StreamingResponse(
        _mjpeg_generator(camera_role),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


@app.get("/api/snapshot/{role}")
def snapshot(role: str, overlay: bool = True) -> Response:
    stream = manager.get(_role(role))
    jpeg = stream.get_frame_jpeg(overlay=overlay)
    if not jpeg:
        raise HTTPException(503, "No frame")
    return Response(content=jpeg, media_type="image/jpeg")
