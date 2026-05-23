import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";
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
import { LanguageSwitcher } from "./components/LanguageSwitcher";
import { BaseColorsPanel } from "./components/BaseColorsPanel";
import { MixSuggestion } from "./components/MixSuggestion";
import { useTranslation } from "./i18n/I18nProvider";
import { useMediaDevices } from "./hooks/useMediaDevices";
import { usePaletteManager } from "./hooks/usePaletteManager";

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
  const { t, lang } = useTranslation();
  const basePalette = usePaletteManager(lang);
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

  const { devices, loading: devicesLoading, errorCode, refresh } =
    useMediaDevices();
  const devicesAssigned = useRef(false);

  const defaultRoiSize = config?.roiSize ?? 48;
  const targetRoi = roiTarget ?? defaultRoi(defaultRoiSize);
  const paletteRoi = roiPalette ?? defaultRoi(defaultRoiSize);

  const targetDisplayColor = targetHold?.color ?? liveTarget;
  const paletteDisplayColor = paletteHold?.color ?? livePalette;

  const refreshMatch = useCallback(async () => {
    const target = targetHold?.color ?? liveTarget;
    const paletteColor = paletteHold?.color ?? livePalette;
    if (!target || !paletteColor) {
      setMatch(null);
      return;
    }
    try {
      const data = await fetchMatch(
        { target, palette: paletteColor },
        basePalette.activeColors,
      );
      setMatch(data);
      setMatchError(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setMatchError(
        msg === "matchNeedsColors" ? t("errors.matchNeedsColors") : t("errors.api"),
      );
    }
  }, [
    targetHold,
    paletteHold,
    liveTarget,
    livePalette,
    basePalette.activeColors,
    t,
  ]);

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
    if (!devices.length || devicesAssigned.current) return;
    devicesAssigned.current = true;

    const firstId = devices[0]?.deviceId ?? "";
    const secondId =
      devices.find((d) => d.deviceId !== firstId)?.deviceId ?? "";

    setTargetDeviceId((prev) => {
      const next =
        prev && devices.some((d) => d.deviceId === prev) ? prev : firstId;
      saveDeviceId(STORAGE_TARGET_DEVICE, next);
      return next;
    });
    setPaletteDeviceId((prev) => {
      const next =
        prev && devices.some((d) => d.deviceId === prev) ? prev : secondId;
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

  const handleTargetFrameSize = useCallback((w: number, h: number) => {
    setTargetFrame((prev) =>
      prev.w === w && prev.h === h ? prev : { w, h },
    );
  }, []);

  const handlePaletteFrameSize = useCallback((w: number, h: number) => {
    setPaletteFrame((prev) =>
      prev.w === w && prev.h === h ? prev : { w, h },
    );
  }, []);

  const handleTargetDevice = useCallback((id: string) => {
    setTargetDeviceId(id);
    saveDeviceId(STORAGE_TARGET_DEVICE, id);
  }, []);

  const handlePaletteDevice = useCallback((id: string) => {
    setPaletteDeviceId(id);
    saveDeviceId(STORAGE_PALETTE_DEVICE, id);
  }, []);

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
          <h1>{t("app.title")}</h1>
          <p className="muted">{t("app.subtitle")}</p>
        </div>
        <div className="topbar-meta">
          <LanguageSwitcher />
          <span className={`badge ${online ? "badge-ok" : "badge-off"}`}>
            API {online ? t("app.apiOnline") : t("app.apiOffline")}
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={devicesLoading}
            onClick={refresh}
          >
            {devicesLoading
              ? t("app.refreshingCameras")
              : t("app.refreshCameras")}
          </button>
        </div>
      </header>

      {!online && (
        <div className="banner banner-warn">
          {t("app.backendBanner", {
            cmd: ".\\scripts\\start-backend.ps1",
          })}
        </div>
      )}

      {errorCode && (
        <div className="banner banner-warn">{t(`errors.${errorCode}`)}</div>
      )}

      <main className="grid cameras">
        <CameraPanel
          key="camera-panel-target"
          panelId="target"
          deviceId={targetDeviceId}
          devices={devices}
          hold={targetHold}
          color={targetDisplayColor}
          frameWidth={targetFrame.w}
          frameHeight={targetFrame.h}
          defaultRoiSize={defaultRoiSize}
          roi={targetRoi}
          onDeviceIdChange={handleTargetDevice}
          onFrameSize={handleTargetFrameSize}
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
          key="camera-panel-palette"
          panelId="palette"
          deviceId={paletteDeviceId}
          devices={devices}
          hold={paletteHold}
          color={paletteDisplayColor}
          frameWidth={paletteFrame.w}
          frameHeight={paletteFrame.h}
          defaultRoiSize={defaultRoiSize}
          roi={paletteRoi}
          onDeviceIdChange={handlePaletteDevice}
          onFrameSize={handlePaletteFrameSize}
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
          panelKey="target"
          title={targetHold ? t("color.targetHeld") : t("color.targetLive")}
          color={targetDisplayColor}
        />
        <ColorInfo
          panelKey="palette"
          title={
            paletteHold ? t("color.paletteHeld") : t("color.paletteLive")
          }
          color={paletteDisplayColor}
        />
      </section>

      <BaseColorsPanel
        palette={basePalette}
        targetColor={targetDisplayColor}
        paletteColor={paletteDisplayColor}
      />

      <MixSuggestion match={match} error={matchError} />
    </div>
  );
}
