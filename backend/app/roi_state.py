from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass, field
from threading import Lock

from app.roles import CameraRole
from app.config import settings


@dataclass
class RoiState:
    mode: str = "square"  # square | polygon
    size: int = field(default_factory=lambda: settings.roi_size)
    center_x: int | None = None
    center_y: int | None = None
    points: list[list[int]] = field(default_factory=list)

    def label(self) -> str:
        if self.mode == "polygon" and len(self.points) >= 3:
            return "произвольная область"
        return f"{self.size} px"

    def to_api(self) -> dict:
        return {
            "mode": self.mode,
            "size": self.size,
            "centerX": self.center_x,
            "centerY": self.center_y,
            "points": [list(p) for p in self.points],
            "label": self.label(),
            "polygonClosed": self.mode == "polygon" and len(self.points) >= 3,
        }


def default_roi_state() -> RoiState:
    return RoiState(size=settings.roi_size, center_x=None, center_y=None)


class RoiStore:
    def __init__(self) -> None:
        self._lock = Lock()
        self._states: dict[CameraRole, RoiState] = {
            CameraRole.TARGET: default_roi_state(),
            CameraRole.PALETTE: default_roi_state(),
        }

    def get(self, role: CameraRole) -> RoiState:
        with self._lock:
            return deepcopy(self._states[role])

    def set(self, role: CameraRole, state: RoiState) -> RoiState:
        with self._lock:
            self._states[role] = state
            return deepcopy(state)

    def update(
        self,
        role: CameraRole,
        *,
        mode: str | None = None,
        size: int | None = None,
        center_x: int | None = None,
        center_y: int | None = None,
        clear_center: bool = False,
        points: list[list[int]] | None = None,
    ) -> RoiState:
        with self._lock:
            cur = self._states[role]
            if mode is not None:
                cur.mode = mode
            if size is not None:
                cur.size = max(8, min(400, size))
            if clear_center:
                cur.center_x = None
                cur.center_y = None
            else:
                if center_x is not None:
                    cur.center_x = center_x
                if center_y is not None:
                    cur.center_y = center_y
            if points is not None:
                cur.points = points
            return deepcopy(cur)

    def reset_square(self, role: CameraRole) -> RoiState:
        return self.set(role, default_roi_state())

    def redraw_polygon(self, role: CameraRole) -> RoiState:
        with self._lock:
            cur = self._states[role]
            cur.mode = "polygon"
            cur.points = []
            return deepcopy(cur)


roi_store = RoiStore()
