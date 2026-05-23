import { useCallback, useMemo, useRef, useState } from "react";
import type { RoiConfig } from "../api";

const CLOSE_PX = 14;

type DragState = {
  kind: "move" | "resize";
  startFx: number;
  startFy: number;
  startCx: number;
  startCy: number;
};

type Props = {
  roi: RoiConfig;
  frameWidth: number;
  frameHeight: number;
  onSquareMove: (centerX: number, centerY: number) => void;
  onSquareResize: (size: number) => void;
  onPolygonComplete: (points: number[][]) => void;
  polygonDraft: number[][];
  onPolygonDraftChange: (points: number[][]) => void;
};

function squareCenter(
  roi: RoiConfig,
  frameWidth: number,
  frameHeight: number,
): { cx: number; cy: number } {
  return {
    cx: roi.centerX ?? frameWidth / 2,
    cy: roi.centerY ?? frameHeight / 2,
  };
}

function squareRect(
  roi: RoiConfig,
  frameWidth: number,
  frameHeight: number,
) {
  const { cx, cy } = squareCenter(roi, frameWidth, frameHeight);
  const half = roi.size / 2;
  const x0 = Math.max(0, Math.min(frameWidth - roi.size, cx - half));
  const y0 = Math.max(0, Math.min(frameHeight - roi.size, cy - half));
  return {
    x0,
    y0,
    x1: x0 + roi.size,
    y1: y0 + roi.size,
    cx: x0 + roi.size / 2,
    cy: y0 + roi.size / 2,
  };
}

export function RoiOverlay({
  roi,
  frameWidth,
  frameHeight,
  onSquareMove,
  onSquareResize,
  onPolygonComplete,
  polygonDraft,
  onPolygonDraftChange,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  const displayToFrame = useCallback(
    (dx: number, dy: number, dw: number, dh: number) => {
      const fx = Math.round((dx / dw) * frameWidth);
      const fy = Math.round((dy / dh) * frameHeight);
      return [
        Math.max(0, Math.min(frameWidth - 1, fx)),
        Math.max(0, Math.min(frameHeight - 1, fy)),
      ] as [number, number];
    },
    [frameWidth, frameHeight],
  );

  const rect = useMemo(
    () => squareRect(roi, frameWidth, frameHeight),
    [roi, frameWidth, frameHeight],
  );

  const framePointFromEvent = (e: React.MouseEvent) => {
    const wrap = wrapRef.current;
    if (!wrap) return null;
    const box = wrap.getBoundingClientRect();
    return displayToFrame(
      e.clientX - box.left,
      e.clientY - box.top,
      box.width,
      box.height,
    );
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (roi.mode !== "polygon" || roi.polygonClosed) return;
    const pt = framePointFromEvent(e);
    if (!pt) return;
    const [fx, fy] = pt;

    if (polygonDraft.length >= 3) {
      const [x0, y0] = polygonDraft[0];
      if (Math.hypot(fx - x0, fy - y0) <= CLOSE_PX) {
        onPolygonComplete([...polygonDraft]);
        onPolygonDraftChange([]);
        return;
      }
    }
    onPolygonDraftChange([...polygonDraft, [fx, fy]]);
  };

  const startMove = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const pt = framePointFromEvent(e);
    if (!pt) return;
    const { cx, cy } = squareCenter(roi, frameWidth, frameHeight);
    setDrag({
      kind: "move",
      startFx: pt[0],
      startFy: pt[1],
      startCx: cx,
      startCy: cy,
    });
  };

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const pt = framePointFromEvent(e);
    if (!pt) return;
    const { cx, cy } = squareCenter(roi, frameWidth, frameHeight);
    setDrag({
      kind: "resize",
      startFx: pt[0],
      startFy: pt[1],
      startCx: cx,
      startCy: cy,
    });
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!drag) return;
    const pt = framePointFromEvent(e);
    if (!pt) return;
    const [fx, fy] = pt;

    if (drag.kind === "move") {
      onSquareMove(
        Math.round(drag.startCx + (fx - drag.startFx)),
        Math.round(drag.startCy + (fy - drag.startFy)),
      );
      return;
    }

    const half = Math.max(
      4,
      Math.min(
        200,
        Math.max(Math.abs(fx - drag.startCx), Math.abs(fy - drag.startCy)),
      ),
    );
    onSquareResize(Math.round(half * 2));
  };

  const endDrag = () => setDrag(null);

  const points =
    roi.mode === "polygon"
      ? roi.polygonClosed
        ? roi.points
        : polygonDraft
      : [];

  const overlayCursor =
    roi.mode === "square" ? (drag ? "grabbing" : "default") : undefined;

  return (
    <div
      ref={wrapRef}
      className={`roi-overlay ${drag?.kind === "move" ? "roi-overlay-grabbing" : ""}`}
      style={{ cursor: overlayCursor }}
      onClick={handleOverlayClick}
      onMouseMove={onMouseMove}
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
    >
      <svg className="roi-svg" viewBox={`0 0 ${frameWidth} ${frameHeight}`}>
        {roi.mode === "square" && (
          <>
            <rect
              x={rect.x0}
              y={rect.y0}
              width={rect.x1 - rect.x0}
              height={rect.y1 - rect.y0}
              className="roi-square"
              onMouseDown={startMove}
            />
            <circle
              cx={rect.x1}
              cy={rect.y1}
              r={10}
              className="roi-handle"
              onMouseDown={startResize}
            />
          </>
        )}
        {roi.mode === "polygon" && points.length > 0 && (
          <>
            {roi.polygonClosed ? (
              <polygon
                points={points.map((p) => p.join(",")).join(" ")}
                className="roi-poly-fill"
              />
            ) : (
              <polyline
                points={points.map((p) => p.join(",")).join(" ")}
                className="roi-poly-open"
                fill="none"
              />
            )}
            {points.map(([px, py], i) => (
              <circle
                key={`${px}-${py}-${i}`}
                cx={px}
                cy={py}
                r={i === 0 ? 8 : 5}
                className={i === 0 ? "roi-point-first" : "roi-point"}
              />
            ))}
          </>
        )}
      </svg>
    </div>
  );
}
