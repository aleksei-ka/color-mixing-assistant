import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  analyzeRgb,
  type CameraHold,
  type ColorPayload,
  type RoiConfig,
} from "../api";
import type { VideoInputOption } from "../hooks/useMediaDevices";
import {
  captureFrameBlob,
  isFrameReady,
  type FrameSource,
} from "../utils/frameSource";
import { sampleRgbFromFrame } from "../utils/sampleImageColor";
import {
  BrowserCamera,
  type BrowserCameraHandle,
} from "./BrowserCamera";
import { RoiControls } from "./RoiControls";
import { RoiOverlay } from "./RoiOverlay";

type Props = {
  title: string;
  subtitle: string;
  deviceId: string;
  devices: VideoInputOption[];
  otherDeviceId?: string;
  hold: CameraHold | null;
  color: ColorPayload | null;
  frameWidth: number;
  frameHeight: number;
  defaultRoiSize: number;
  roi: RoiConfig;
  cameraError?: string | null;
  onDeviceIdChange: (deviceId: string) => void;
  onFrameSize: (width: number, height: number) => void;
  onHoldChange: Dispatch<SetStateAction<CameraHold | null>>;
  onLiveColor: (color: ColorPayload | null) => void;
  onRoiModeChange: (mode: "square" | "polygon") => void;
  onRoiSizeChange: (size: number) => void;
  onRoiMove: (centerX: number, centerY: number) => void;
  onRoiReset: () => void;
  onRoiRedraw: () => void;
  onPolygonComplete: (points: number[][]) => void;
};

function roiCanSample(roi: RoiConfig): boolean {
  return (
    roi.mode === "square" ||
    (roi.mode === "polygon" && roi.polygonClosed && roi.points.length >= 3)
  );
}

export function CameraPanel({
  title,
  subtitle,
  deviceId,
  devices,
  otherDeviceId,
  hold,
  color,
  frameWidth,
  frameHeight,
  defaultRoiSize,
  roi,
  cameraError,
  onDeviceIdChange,
  onFrameSize,
  onHoldChange,
  onLiveColor,
  onRoiModeChange,
  onRoiSizeChange,
  onRoiMove,
  onRoiReset,
  onRoiRedraw,
  onPolygonComplete,
}: Props) {
  const cameraRef = useRef<BrowserCameraHandle>(null);
  const frameRef = useRef<FrameSource | null>(null);
  const holdImgRef = useRef<HTMLImageElement>(null);
  const [polygonDraft, setPolygonDraft] = useState<number[][]>([]);
  const [capturing, setCapturing] = useState(false);
  const [localCamError, setLocalCamError] = useState<string | null>(null);

  const isHeld = hold !== null;
  const duplicateDevice =
    deviceId && otherDeviceId && deviceId === otherDeviceId;

  const setFrameRef = useCallback((el: FrameSource | null) => {
    frameRef.current = el;
  }, []);

  const sampleCurrentFrame = useCallback(async (): Promise<ColorPayload | null> => {
    const source = frameRef.current;
    if (!source || !isFrameReady(source) || !roiCanSample(roi)) {
      return null;
    }
    try {
      const rgb = sampleRgbFromFrame(source, roi);
      return await analyzeRgb(rgb);
    } catch {
      return null;
    }
  }, [roi]);

  useEffect(() => {
    if (isHeld) return;
    const tick = async () => {
      const c = await sampleCurrentFrame();
      onLiveColor(c);
    };
    tick();
    const id = window.setInterval(tick, 400);
    return () => window.clearInterval(id);
  }, [isHeld, sampleCurrentFrame, onLiveColor]);

  useEffect(() => {
    if (!isHeld) return;
    let cancelled = false;
    (async () => {
      const c = await sampleCurrentFrame();
      if (!cancelled && c) {
        onHoldChange((prev) => (prev ? { ...prev, color: c } : null));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isHeld, hold?.imageUrl, roi, sampleCurrentFrame, onHoldChange]);

  const handleCapture = async () => {
    const video = cameraRef.current?.getVideo();
    if (!video || !isFrameReady(video)) return;
    setCapturing(true);
    try {
      const { blobUrl } = await captureFrameBlob(video);
      const rgb = sampleRgbFromFrame(video, roi);
      const analyzed = await analyzeRgb(rgb);
      onHoldChange({
        color: analyzed,
        imageUrl: blobUrl,
        capturedAt: new Date().toISOString(),
      });
      onLiveColor(null);
    } catch (e) {
      setLocalCamError(e instanceof Error ? e.message : "Ошибка захвата");
    } finally {
      setCapturing(false);
    }
  };

  const handleResumeLive = () => {
    onHoldChange(null);
  };

  const timeLabel =
    hold?.capturedAt &&
    new Date(hold.capturedAt).toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

  const showOverlay = isHeld ? Boolean(hold?.imageUrl) : Boolean(deviceId);

  return (
    <section className={`camera-panel ${isHeld ? "camera-panel-held" : ""}`}>
      <header>
        <div className="camera-panel-titles">
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <div className="camera-panel-badges">
          {!isHeld ? (
            <span className="badge badge-live">live</span>
          ) : (
            <span className="badge badge-held">захват</span>
          )}
        </div>
      </header>

      {(cameraError || localCamError) && (
        <p className="camera-error muted small">
          {cameraError || localCamError}
        </p>
      )}
      {duplicateDevice && (
        <p className="camera-warn muted small">
          Та же камера выбрана для обеих панелей — лучше выбрать разные устройства.
        </p>
      )}

      <div className="camera-toolbar">
        <label className="camera-select-label">
          <span className="camera-select-title">Устройство</span>
          <select
            value={deviceId}
            disabled={isHeld}
            onChange={(e) => onDeviceIdChange(e.target.value)}
          >
            {!deviceId && <option value="">— выберите камеру —</option>}
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        {!isHeld ? (
          <button
            type="button"
            className="btn btn-primary camera-capture-btn"
            disabled={capturing || !deviceId}
            onClick={handleCapture}
          >
            {capturing ? "Захват…" : "Захватить"}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-secondary camera-capture-btn"
            onClick={handleResumeLive}
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
        {isHeld && hold?.imageUrl ? (
          <img
            ref={(el) => {
              holdImgRef.current = el;
              setFrameRef(el);
            }}
            src={hold.imageUrl}
            alt={`${title} (захват)`}
            className="video"
          />
        ) : deviceId ? (
          <BrowserCamera
            ref={cameraRef}
            deviceId={deviceId}
            active={!isHeld}
            alt={title}
            onReady={onFrameSize}
            onError={setLocalCamError}
            onVideoMount={setFrameRef}
          />
        ) : (
          <div className="video video-placeholder">
            Выберите камеру и разрешите доступ в браузере
          </div>
        )}
        {showOverlay && (
          <RoiOverlay
            frameRef={frameRef}
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
