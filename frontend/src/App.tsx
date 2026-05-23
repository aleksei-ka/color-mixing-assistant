import { useCallback, useEffect, useState, type SetStateAction } from "react";
import {
  fetchConfig,
  fetchHealth,
  fetchMatch,
  releaseCameraHold,
  type AppConfig,
  type CameraHold,
  type CameraRole,
  type ColorPayload,
  type MatchResult,
  type RoiConfig,
} from "./api";
import { CameraPanel } from "./components/CameraPanel";
import { ColorInfo } from "./components/ColorInfo";
import { MixSuggestion } from "./components/MixSuggestion";
import { useMediaDevices } from "./hooks/useMediaDevices";

const STORAGE_TARGET_DEVICE = "colorMatcher.device.target";
const STORAGE_PALETTE_DEVICE = "colorMatcher.device.palette";

function loadDeviceId(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function saveDeviceId(key: string, deviceId: string) {
  try {
    if (deviceId) localStorage.setItem(key, deviceId);
    else localStorage.removeItem(key);
  } catch {
    /* private mode */
  }
}

function defaultRoi(size: number): RoiConfig {
  return {
    mode: "square",
    size,
    centerX: null,
    centerY: null,
    points: [],
    label: `${size} px`,
    polygonClosed: false,
  };
}

export default function App() {
  const [online, setOnline] = useState(false);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [targetHold, setTargetHold] = useState<CameraHold | null>(null);
  const [paletteHold, setPaletteHold] = useState<CameraHold | null>(null);
  const [liveTarget, setLiveTarget] = useState<ColorPayload | null>(null);
  const [livePalette, setLivePalette] = useState<ColorPayload | null>(null);
  const [targetDeviceId, setTargetDeviceId] = useState(() =>
    loadDeviceId(STORAGE_TARGET_DEVICE),
  );
  const [paletteDeviceId, setPaletteDeviceId] = useState(() =>
    loadDeviceId(STORAGE_PALETTE_DEVICE),
  );
  const [targetFrame, setTargetFrame] = useState({ w: 1280, h: 720 });
  const [paletteFrame, setPaletteFrame] = useState({ w: 1280, h: 720 });
  const [roiTarget, setRoiTarget] = useState<RoiConfig | null>(null);
  const [roiPalette, setRoiPalette] = useState<RoiConfig | null>(null);

  const { devices, loading: devicesLoading, error: devicesError, refresh } =
    useMediaDevices();

  const defaultRoiSize = config?.roiSize ?? 48;
  const targetRoi = roiTarget ?? defaultRoi(defaultRoiSize);
  const paletteRoi = roiPalette ?? defaultRoi(defaultRoiSize);

  const targetDisplayColor = targetHold?.color ?? liveTarget;
  const paletteDisplayColor = paletteHold?.color ?? livePalette;

  const refreshMatch = useCallback(async () => {
    const target = targetHold?.color ?? liveTarget;
    const palette = paletteHold?.color ?? livePalette;
    if (!target || !palette) {
      setMatch(null);
      return;
    }
    try {
      const data = await fetchMatch({ target, palette });
      setMatch(data);
      setMatchError(null);
    } catch (e) {
      setMatchError(e instanceof Error ? e.message : "Ошибка API");
    }
  }, [targetHold, paletteHold, liveTarget, livePalette]);

  useEffect(() => {
    fetchHealth()
      .then(() => setOnline(true))
      .catch(() => setOnline(false));
    fetchConfig()
      .then((cfg) => {
        setConfig(cfg);
        setRoiTarget(defaultRoi(cfg.roiSize));
        setRoiPalette(defaultRoi(cfg.roiSize));
        if (!targetFrame.w) setTargetFrame({ w: cfg.frameWidth ?? 1280, h: cfg.frameHeight ?? 720 });
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!devices.length) return;
    setTargetDeviceId((prev) => {
      if (prev && devices.some((d) => d.deviceId === prev)) return prev;
      const next = devices[0]?.deviceId ?? "";
      saveDeviceId(STORAGE_TARGET_DEVICE, next);
      return next;
    });
    setPaletteDeviceId((prev) => {
      if (prev && devices.some((d) => d.deviceId === prev)) return prev;
      const next = devices[1]?.deviceId ?? devices[0]?.deviceId ?? "";
      saveDeviceId(STORAGE_PALETTE_DEVICE, next);
      return next;
    });
  }, [devices]);

  useEffect(() => {
    if (!online) return;
    void refreshMatch();
  }, [online, targetHold, paletteHold, liveTarget, livePalette, refreshMatch]);

  useEffect(() => {
    const url = targetHold?.imageUrl;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [targetHold?.imageUrl]);

  useEffect(() => {
    const url = paletteHold?.imageUrl;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [paletteHold?.imageUrl]);

  const patchRoi =
    (role: CameraRole) => (patch: (prev: RoiConfig) => RoiConfig) => {
      const apply = (prev: RoiConfig | null) =>
        patch(prev ?? defaultRoi(defaultRoiSize));
      if (role === "target") setRoiTarget(apply);
      else setRoiPalette(apply);
      void refreshMatch();
    };

  const handleRoiModeChange = (role: CameraRole, mode: "square" | "polygon") => {
    patchRoi(role)((prev) => ({
      ...prev,
      mode,
      points: mode === "polygon" ? prev.points : [],
      polygonClosed: false,
      label: mode === "polygon" ? "произвольная область" : `${prev.size} px`,
    }));
  };

  const handleRoiSizeChange = (role: CameraRole, size: number) => {
    const clamped = Math.max(8, Math.min(400, Math.round(size)));
    patchRoi(role)((prev) => ({
      ...prev,
      mode: "square",
      size: clamped,
      label: `${clamped} px`,
    }));
  };

  const handleRoiMove = (role: CameraRole, centerX: number, centerY: number) => {
    const frame = role === "target" ? targetFrame : paletteFrame;
    const currentRoi = role === "target" ? targetRoi : paletteRoi;
    const half = currentRoi.size / 2;
    const cx = Math.round(Math.max(half, Math.min(frame.w - half, centerX)));
    const cy = Math.round(Math.max(half, Math.min(frame.h - half, centerY)));
    patchRoi(role)((prev) => ({ ...prev, mode: "square", centerX: cx, centerY: cy }));
  };

  const handleRoiReset = (role: CameraRole) => {
    if (role === "target") setRoiTarget(defaultRoi(defaultRoiSize));
    else setRoiPalette(defaultRoi(defaultRoiSize));
    void refreshMatch();
  };

  const handleRoiRedraw = (role: CameraRole) => {
    patchRoi(role)((prev) => ({
      ...prev,
      mode: "polygon",
      points: [],
      polygonClosed: false,
      label: "произвольная область",
    }));
  };

  const handlePolygonComplete = (role: CameraRole, points: number[][]) => {
    patchRoi(role)((prev) => ({
      ...prev,
      mode: "polygon",
      points,
      polygonClosed: true,
      label: "произвольная область",
    }));
  };

  const handleTargetDevice = (deviceId: string) => {
    setTargetDeviceId(deviceId);
    saveDeviceId(STORAGE_TARGET_DEVICE, deviceId);
  };

  const handlePaletteDevice = (deviceId: string) => {
    setPaletteDeviceId(deviceId);
    saveDeviceId(STORAGE_PALETTE_DEVICE, deviceId);
  };

  const handleTargetHold = useCallback(
    (action: SetStateAction<CameraHold | null>) => {
      setTargetHold((prev) => {
        const next = typeof action === "function" ? action(prev) : action;
        if (prev && !next) releaseCameraHold(prev);
        if (prev && next && prev.imageUrl !== next.imageUrl) {
          releaseCameraHold(prev);
        }
        return next;
      });
    },
    [],
  );

  const handlePaletteHold = useCallback(
    (action: SetStateAction<CameraHold | null>) => {
      setPaletteHold((prev) => {
        const next = typeof action === "function" ? action(prev) : action;
        if (prev && !next) releaseCameraHold(prev);
        if (prev && next && prev.imageUrl !== next.imageUrl) {
          releaseCameraHold(prev);
        }
        return next;
      });
    },
    [],
  );

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>Color Matcher</h1>
          <p className="muted">
            Камеры в браузере · сравнение и смешивание через API
          </p>
        </div>
        <div className="topbar-meta">
          <span className={`badge ${online ? "badge-ok" : "badge-off"}`}>
            API {online ? "online" : "offline"}
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={devicesLoading}
            onClick={refresh}
          >
            {devicesLoading ? "Поиск…" : "Обновить список камер"}
          </button>
        </div>
      </header>

      {!online && (
        <div className="banner banner-warn">
          Запустите бэкенд: <code>.\scripts\start-backend.ps1</code>
        </div>
      )}

      {devicesError && (
        <div className="banner banner-warn">{devicesError}</div>
      )}

      <main className="grid cameras">
        <CameraPanel
          title="Камера 1 — цель"
          subtitle="Миниатюра / образец цвета"
          deviceId={targetDeviceId}
          devices={devices}
          otherDeviceId={paletteDeviceId}
          hold={targetHold}
          color={targetDisplayColor}
          frameWidth={targetFrame.w}
          frameHeight={targetFrame.h}
          defaultRoiSize={defaultRoiSize}
          roi={targetRoi}
          onDeviceIdChange={handleTargetDevice}
          onFrameSize={(w, h) => setTargetFrame({ w, h })}
          onHoldChange={handleTargetHold}
          onLiveColor={setLiveTarget}
          onRoiModeChange={(m) => handleRoiModeChange("target", m)}
          onRoiSizeChange={(s) => handleRoiSizeChange("target", s)}
          onRoiMove={(x, y) => handleRoiMove("target", x, y)}
          onRoiReset={() => handleRoiReset("target")}
          onRoiRedraw={() => handleRoiRedraw("target")}
          onPolygonComplete={(pts) => handlePolygonComplete("target", pts)}
        />
        <CameraPanel
          title="Камера 2 — палитра"
          subtitle="Текущий цвет на палитре"
          deviceId={paletteDeviceId}
          devices={devices}
          otherDeviceId={targetDeviceId}
          hold={paletteHold}
          color={paletteDisplayColor}
          frameWidth={paletteFrame.w}
          frameHeight={paletteFrame.h}
          defaultRoiSize={defaultRoiSize}
          roi={paletteRoi}
          onDeviceIdChange={handlePaletteDevice}
          onFrameSize={(w, h) => setPaletteFrame({ w, h })}
          onHoldChange={handlePaletteHold}
          onLiveColor={setLivePalette}
          onRoiModeChange={(m) => handleRoiModeChange("palette", m)}
          onRoiSizeChange={(s) => handleRoiSizeChange("palette", s)}
          onRoiMove={(x, y) => handleRoiMove("palette", x, y)}
          onRoiReset={() => handleRoiReset("palette")}
          onRoiRedraw={() => handleRoiRedraw("palette")}
          onPolygonComplete={(pts) => handlePolygonComplete("palette", pts)}
        />
      </main>

      <section className="grid codes">
        <ColorInfo
          label={
            targetHold ? "Камера 1 — захваченный цвет" : "Камера 1 — live"
          }
          color={targetDisplayColor}
        />
        <ColorInfo
          label={
            paletteHold ? "Камера 2 — захваченный цвет" : "Камера 2 — live"
          }
          color={paletteDisplayColor}
        />
      </section>

      <MixSuggestion match={match} error={matchError} />
    </div>
  );
}
