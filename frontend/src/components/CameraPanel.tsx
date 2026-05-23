import { useMemo, useRef, useState } from "react";
import type { CameraDevice, ColorPayload, RoiConfig } from "../api";
import { LivePreview } from "./LivePreview";
import { RoiControls } from "./RoiControls";
import { RoiOverlay } from "./RoiOverlay";

type Props = {
  title: string;
  subtitle: string;
  role: "target" | "palette";
  streamKey: number;
  holdImageUrl?: string | null;
  isHeld: boolean;
  color: ColorPayload | null;
  mock?: boolean;
  deviceIndex: number;
  devices: CameraDevice[];
  frameWidth: number;
  frameHeight: number;
  defaultRoiSize: number;
  roi: RoiConfig;
  onDeviceChange: (index: number) => void;
  switching?: boolean;
  capturing?: boolean;
  capturedAt?: string | null;
  onCapture: () => void;
  onResumeLive: () => void;
  onRoiModeChange: (mode: "square" | "polygon") => void;
  onRoiSizeChange: (size: number) => void;
  onRoiMove: (centerX: number, centerY: number) => void;
  onRoiReset: () => void;
  onRoiRedraw: () => void;
  onPolygonComplete: (points: number[][]) => void;
};

export function CameraPanel({
  title,
  subtitle,
  role,
  streamKey,
  holdImageUrl,
  isHeld,
  color,
  mock,
  deviceIndex,
  devices,
  frameWidth,
  frameHeight,
  defaultRoiSize,
  roi,
  onDeviceChange,
  switching,
  capturing,
  capturedAt,
  onCapture,
  onResumeLive,
  onRoiModeChange,
  onRoiSizeChange,
  onRoiMove,
  onRoiReset,
  onRoiRedraw,
  onPolygonComplete,
}: Props) {
  const videoRef = useRef<HTMLImageElement>(null);
  const [polygonDraft, setPolygonDraft] = useState<number[][]>([]);

  const options = useMemo(() => {
    const byIndex = new Map(devices.map((d) => [d.index, d]));
    if (!byIndex.has(deviceIndex)) {
      byIndex.set(deviceIndex, {
        index: deviceIndex,
        width: 0,
        height: 0,
        inUse: true,
      });
    }
    return [...byIndex.values()].sort((a, b) => a.index - b.index);
  }, [devices, deviceIndex]);

  const timeLabel =
    capturedAt &&
    new Date(capturedAt).toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

  const showOverlay = isHeld ? Boolean(holdImageUrl) : true;

  return (
    <section className={`camera-panel ${isHeld ? "camera-panel-held" : ""}`}>
      <header>
        <div className="camera-panel-titles">
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <div className="camera-panel-badges">
          {switching && (
            <span className="badge badge-switching">переключение…</span>
          )}
          {!isHeld ? (
            <span className="badge badge-live">live</span>
          ) : (
            <span className="badge badge-held">захват</span>
          )}
          {mock && <span className="badge badge-mock">mock</span>}
        </div>
      </header>

      <div className="camera-toolbar">
        <label className="camera-select-label">
          <span className="camera-select-title">Устройство</span>
          <select
            value={deviceIndex}
            disabled={isHeld}
            onChange={(e) => onDeviceChange(Number(e.target.value))}
          >
            {options.map((d) => (
              <option key={d.index} value={d.index}>
                Камера {d.index}
                {d.width > 0 ? ` (${d.width}×${d.height})` : ""}
                {d.inUse ? " · в работе" : ""}
              </option>
            ))}
          </select>
        </label>
        {!isHeld ? (
          <button
            type="button"
            className="btn btn-primary camera-capture-btn"
            disabled={capturing}
            onClick={onCapture}
          >
            {capturing ? "Захват…" : "Захватить"}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-secondary camera-capture-btn"
            onClick={onResumeLive}
          >
            Снова live
          </button>
        )}
      </div>

      <RoiControls
        roi={roi}
        defaultSize={defaultRoiSize}
        onModeChange={onRoiModeChange}
        onSizeChange={onRoiSizeChange}
        onReset={onRoiReset}
        onRedraw={() => {
          setPolygonDraft([]);
          onRoiRedraw();
        }}
      />

      <div className="video-wrap">
        {isHeld && holdImageUrl ? (
          <img
            ref={videoRef}
            src={holdImageUrl}
            alt={`${title} (захват)`}
            className="video"
          />
        ) : (
          <LivePreview
            ref={videoRef}
            role={role}
            deviceIndex={deviceIndex}
            streamKey={streamKey}
            paused={isHeld}
            alt={title}
          />
        )}
        {showOverlay && (
          <RoiOverlay
            imageRef={videoRef}
            roi={roi}
            frameWidth={frameWidth}
            frameHeight={frameHeight}
            polygonDraft={polygonDraft}
            onPolygonDraftChange={setPolygonDraft}
            onSquareMove={onRoiMove}
            onSquareResize={onRoiSizeChange}
            onPolygonComplete={onPolygonComplete}
          />
        )}
        <p className="roi-hint">
          {isHeld
            ? "Снимок — сравните фигурку с цветом на экране"
            : roi.mode === "polygon" && !roi.polygonClosed
              ? "Отметьте точки на кадре"
              : "Область отбора цвета на кадре"}
        </p>
      </div>

      {color && (
        <div className="swatch" style={{ backgroundColor: color.hex }}>
          <span className="swatch-caption">
            <code className="swatch-hex">{color.hex}</code>
            {isHeld && timeLabel && (
              <span className="swatch-capture"> · захват {timeLabel}</span>
            )}
          </span>
        </div>
      )}
    </section>
  );
}
