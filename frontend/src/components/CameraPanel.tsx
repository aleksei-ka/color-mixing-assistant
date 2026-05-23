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
import { useTranslation } from "../i18n/I18nProvider";
import {
  BrowserCamera,
  type BrowserCameraHandle,
} from "./BrowserCamera";
import { RoiControls } from "./RoiControls";
import { RoiOverlay } from "./RoiOverlay";

type Props = {
  deviceId: string;
  devices: VideoInputOption[];
  panelId: "target" | "palette";
  otherDeviceId?: string;
  hold: CameraHold | null;
  color: ColorPayload | null;
  frameWidth: number;
  frameHeight: number;
  defaultRoiSize: number;
  roi: RoiConfig;
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
  panelId,
  deviceId,
  devices,
  otherDeviceId,
  hold,
  color,
  frameWidth,
  frameHeight,
  defaultRoiSize,
  roi,
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
  const { t, lang } = useTranslation();
  const title =
    panelId === "target" ? t("camera.targetTitle") : t("camera.paletteTitle");
  const subtitle =
    panelId === "target"
      ? t("camera.targetSubtitle")
      : t("camera.paletteSubtitle");

  const cameraRef = useRef<BrowserCameraHandle>(null);
  const frameRef = useRef<FrameSource | null>(null);
  const holdImgRef = useRef<HTMLImageElement>(null);
  const [polygonDraft, setPolygonDraft] = useState<number[][]>([]);
  const [capturing, setCapturing] = useState(false);
  const [localCamError, setLocalCamError] = useState<string | null>(null);

  const isHeld = hold !== null;
  const sameAsOther =
    Boolean(deviceId && otherDeviceId && deviceId === otherDeviceId);
  const cameraActive = !isHeld && Boolean(deviceId);

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
    if (isHeld || !cameraActive) {
      onLiveColor(null);
      return;
    }
    const tick = async () => {
      const c = await sampleCurrentFrame();
      onLiveColor(c);
    };
    tick();
    const id = window.setInterval(tick, 400);
    return () => window.clearInterval(id);
  }, [isHeld, cameraActive, sampleCurrentFrame, onLiveColor]);

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
      setLocalCamError(
        e instanceof Error ? e.message : t("errors.captureFailed"),
      );
    } finally {
      setCapturing(false);
    }
  };

  const handleResumeLive = () => {
    onHoldChange(null);
  };

  const timeLabel =
    hold?.capturedAt &&
    new Date(hold.capturedAt).toLocaleTimeString(lang === "ru" ? "ru-RU" : "en-GB", {
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
            <span className="badge badge-live">{t("camera.live")}</span>
          ) : (
            <span className="badge badge-held">{t("camera.held")}</span>
          )}
        </div>
      </header>

      {localCamError && (
        <p className="camera-error muted small">{localCamError}</p>
      )}
      {sameAsOther && !isHeld && (
        <p className="camera-warn muted small">{t("camera.sameDeviceWarn")}</p>
      )}

      <div className="camera-toolbar">
        <label className="camera-select-label">
          <span className="camera-select-title">{t("camera.device")}</span>
          <select
            id={`camera-select-${panelId}`}
            name={`camera-select-${panelId}`}
            value={deviceId}
            disabled={isHeld}
            onChange={(e) => onDeviceIdChange(e.target.value)}
          >
            <option value="">{t("camera.selectCamera")}</option>
            {devices.map((d) => (
              <option key={`${panelId}-${d.deviceId}`} value={d.deviceId}>
                {d.label}
                {devices.length > 1 ? ` · ${d.deviceId.slice(0, 6)}` : ""}
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
            {capturing ? t("camera.capturing") : t("camera.capture")}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-secondary camera-capture-btn"
            onClick={handleResumeLive}
          >
            {t("camera.resumeLive")}
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
            alt={t("camera.heldAlt", { title })}
            className="video"
          />
        ) : deviceId ? (
          <BrowserCamera
            key={`${panelId}-${deviceId}`}
            ref={cameraRef}
            panelId={panelId}
            deviceId={deviceId}
            active={cameraActive}
            alt={title}
            onReady={onFrameSize}
            onError={setLocalCamError}
            onVideoMount={setFrameRef}
          />
        ) : (
          <div className="video video-placeholder">
            {t("camera.placeholder")}
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
            ? t("camera.heldHint")
            : roi.mode === "polygon" && !roi.polygonClosed
              ? t("camera.roiHintPolygon")
              : t("camera.roiHintLive")}
        </p>
      </div>

      {color && (
        <div className="swatch" style={{ backgroundColor: color.hex }}>
          <span className="swatch-caption">
            <code className="swatch-hex">{color.hex}</code>
            {isHeld && timeLabel && (
              <span className="swatch-capture">
                {" "}
                · {t("camera.captureAt", { time: timeLabel })}
              </span>
            )}
          </span>
        </div>
      )}
    </section>
  );
}
