from __future__ import annotations

import logging
import threading
import time
import cv2
import numpy as np

from app.config import settings
from app.color import EmaSmoother, analyze_rgb, reading_to_dict
from app.roi import draw_roi_overlay, sample_median_rgb
from app.roi_state import roi_store

from app.roles import CameraRole

logger = logging.getLogger(__name__)


class CameraStream:
    """Background reader for one camera (or mock frames)."""

    def __init__(self, role: CameraRole, device_index: int) -> None:
        self.role = role
        self.device_index = device_index
        self._lock = threading.Lock()
        self._frame_raw: np.ndarray | None = None
        self._frame: np.ndarray | None = None
        self._running = False
        self._thread: threading.Thread | None = None
        self._cap: cv2.VideoCapture | None = None
        self._mock = False
        self._smoother = EmaSmoother(settings.color_ema_alpha)
        self._last_color: dict | None = None
        self._error: str | None = None

    @property
    def is_mock(self) -> bool:
        return self._mock

    @property
    def error(self) -> str | None:
        return self._error

    def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._running = False
        thread = self._thread
        self._thread = None
        if thread and thread.is_alive():
            thread.join(timeout=3.0)
        if self._cap is not None:
            self._cap.release()
            self._cap = None
        time.sleep(0.25)

    def _open_capture(self) -> bool:
        backends: list[int] = []
        if settings.use_dshow:
            backends.extend([cv2.CAP_DSHOW, cv2.CAP_MSMF])
        backends.append(cv2.CAP_ANY)

        for api in backends:
            cap = cv2.VideoCapture(self.device_index, api)
            if not cap.isOpened():
                cap.release()
                continue
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, settings.frame_width)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, settings.frame_height)
            # Warm-up: first frames are often black on DirectShow
            for _ in range(3):
                cap.read()
            self._cap = cap
            logger.info(
                "Opened camera %s for %s (api=%s)",
                self.device_index,
                self.role.value,
                api,
            )
            return True
        return False

    def _make_mock_frame(self) -> np.ndarray:
        t = time.time()
        h, w = settings.frame_height, settings.frame_width
        frame = np.zeros((h, w, 3), dtype=np.uint8)
        if self.role == CameraRole.TARGET:
            hue = int((t * 30) % 180)
            color = cv2.cvtColor(
                np.uint8([[[hue, 200, 200]]]), cv2.COLOR_HSV2BGR
            )[0, 0]
            frame[:] = color
        else:
            stripes = [
                (60, 80, 200),
                (80, 200, 60),
                (200, 80, 60),
                (200, 200, 60),
                (200, 60, 200),
            ]
            sw = w // len(stripes)
            for i, c in enumerate(stripes):
                frame[:, i * sw : (i + 1) * sw] = c
        label = f"MOCK {self.role.value} cam {self.device_index}"
        cv2.putText(
            frame,
            label,
            (20, 40),
            cv2.FONT_HERSHEY_SIMPLEX,
            1.0,
            (255, 255, 255),
            2,
            cv2.LINE_AA,
        )
        return frame

    def _loop(self) -> None:
        if not self._open_capture():
            msg = f"Camera {self.device_index} not available"
            logger.warning("%s — %s", msg, self.role.value)
            self._error = msg
            if settings.mock_on_failure:
                self._mock = True
            else:
                self._running = False
                return

        while self._running:
            if self._mock:
                frame = self._make_mock_frame()
                time.sleep(1 / 15)
            else:
                assert self._cap is not None
                ok, frame = self._cap.read()
                if not ok:
                    time.sleep(0.05)
                    continue

            roi = roi_store.get(self.role)
            rgb = sample_median_rgb(frame, roi)
            smooth = self._smoother.update(rgb)
            reading = analyze_rgb(smooth)
            color_payload = reading_to_dict(reading)

            display = draw_roi_overlay(frame, roi)
            with self._lock:
                self._frame_raw = frame
                self._frame = display
                self._last_color = color_payload

        if self._cap:
            self._cap.release()
            self._cap = None

    def get_frame_jpeg(self, *, overlay: bool = True) -> bytes | None:
        with self._lock:
            source = self._frame if overlay else self._frame_raw
            frame = None if source is None else source.copy()
        if frame is None:
            return None
        ok, buf = cv2.imencode(
            ".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80]
        )
        return buf.tobytes() if ok else None

    def get_color(self) -> dict | None:
        with self._lock:
            return None if self._last_color is None else dict(self._last_color)


class CameraManager:
    def __init__(self) -> None:
        self.streams: dict[CameraRole, CameraStream] = {}
        self.target_index = settings.camera_target_index
        self.palette_index = settings.camera_palette_index

    def start(self) -> None:
        self.streams = {
            CameraRole.TARGET: CameraStream(
                CameraRole.TARGET, self.target_index
            ),
            CameraRole.PALETTE: CameraStream(
                CameraRole.PALETTE, self.palette_index
            ),
        }
        for stream in self.streams.values():
            stream.start()

    def stop(self) -> None:
        for stream in self.streams.values():
            stream.stop()

    def get(self, role: CameraRole) -> CameraStream:
        return self.streams[role]

    def set_camera(self, role: CameraRole, device_index: int) -> None:
        stream = self.streams.get(role)
        if (
            stream
            and stream.device_index == device_index
            and stream._running
            and not stream.is_mock
            and stream.get_color() is not None
        ):
            return
        if stream:
            stream.stop()
        new_stream = CameraStream(role, device_index)
        new_stream.start()
        self.streams[role] = new_stream
        if role == CameraRole.TARGET:
            self.target_index = device_index
        else:
            self.palette_index = device_index


def probe_cameras(
    max_index: int | None = None,
    *,
    skip_indices: set[int] | None = None,
) -> list[dict]:
    """
    Try opening camera indices 0..max_index-1.
    Indices in skip_indices are not opened (avoid conflict with active streams).
    """
    if max_index is None:
        max_index = settings.camera_probe_max
    skip = skip_indices or set()
    found: list[dict] = []
    apis = (
        [cv2.CAP_DSHOW, cv2.CAP_MSMF, cv2.CAP_ANY]
        if settings.use_dshow
        else [cv2.CAP_ANY]
    )
    for i in range(max_index):
        if i in skip:
            continue
        opened = False
        for api in apis:
            cap = cv2.VideoCapture(i, api)
            if cap.isOpened():
                w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                found.append({"index": i, "width": w, "height": h})
                cap.release()
                opened = True
                break
            cap.release()
        if not opened:
            time.sleep(0.05)
    return found
