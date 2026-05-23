import { useMemo } from "react";
import type { CameraDevice, ColorPayload } from "../api";
import { LivePreview } from "./LivePreview";

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
  onDeviceChange: (index: number) => void;
  switching?: boolean;
  capturing?: boolean;
  capturedAt?: string | null;
  onCapture: () => void;
  onResumeLive: () => void;
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
  onDeviceChange,
  switching,
  capturing,
  capturedAt,
  onCapture,
  onResumeLive,
}: Props) {
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
          {isHeld && <span className="badge badge-held">захват</span>}
          {mock && <span className="badge badge-mock">mock</span>}
        </div>
      </header>

      <div className="camera-toolbar">
        <label className="camera-select-label">
          Устройство
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

      <div className="video-wrap">
        {isHeld && holdImageUrl ? (
          <img src={holdImageUrl} alt={`${title} (захват)`} className="video" />
        ) : (
          <LivePreview
            role={role}
            deviceIndex={deviceIndex}
            streamKey={streamKey}
            paused={isHeld}
            alt={title}
          />
        )}
        <p className="roi-hint">
          {isHeld
            ? "Снимок — сравните фигурку с цветом на экране"
            : "Подведите нужный цвет в центральный квадрат"}
        </p>
      </div>

      {color && (
        <div
          className="swatch"
          style={{ backgroundColor: color.hex }}
        >
          <span className="swatch-caption">
            <code className="swatch-hex">{color.hex}</code>
            {isHeld && timeLabel && (
              <span className="swatch-capture">
                {" "}
                · захват {timeLabel}
              </span>
            )}
          </span>
        </div>
      )}
    </section>
  );
}
