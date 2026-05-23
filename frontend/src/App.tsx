import { useCallback, useEffect, useRef, useState } from "react";
import {
  analyzeRgb,
  captureCamera,
  fetchCameras,
  fetchColor,
  fetchConfig,
  fetchHealth,
  fetchMatch,
  fetchRoi,
  fetchStatus,
  redrawPolygonRoi,
  releaseCameraHold,
  resetRoi,
  selectCameras,
  updateRoi,
  type AppConfig,
  type CameraDevice,
  type CameraHold,
  type CameraRole,
  type ColorPayload,
  type MatchResult,
  type RoiConfig,
  type StreamStatus,
} from "./api";
import { CameraPanel } from "./components/CameraPanel";
import { ColorInfo } from "./components/ColorInfo";
import { MixSuggestion } from "./components/MixSuggestion";
import { sampleRgbFromImage } from "./utils/sampleImageColor";

function statusFor(
  streams: StreamStatus[],
  role: string,
): StreamStatus | undefined {
  return streams.find((s) => s.role === role);
}

export default function App() {
  const [online, setOnline] = useState(false);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [streams, setStreams] = useState<StreamStatus[]>([]);
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [targetHold, setTargetHold] = useState<CameraHold | null>(null);
  const [paletteHold, setPaletteHold] = useState<CameraHold | null>(null);
  const [liveTarget, setLiveTarget] = useState<ColorPayload | null>(null);
  const [livePalette, setLivePalette] = useState<ColorPayload | null>(null);
  const [capturingRole, setCapturingRole] = useState<CameraRole | null>(null);
  const [switchingRole, setSwitchingRole] = useState<string | null>(null);
  const [refreshingCameras, setRefreshingCameras] = useState(false);
  const [streamTick, setStreamTick] = useState(0);
  const [roiTarget, setRoiTarget] = useState<RoiConfig | null>(null);
  const [roiPalette, setRoiPalette] = useState<RoiConfig | null>(null);
  const roiSizeTimers = useRef<Partial<Record<CameraRole, number>>>({});
  const roiMoveTimers = useRef<Partial<Record<CameraRole, number>>>({});

  const defaultRoi = useCallback(
    (size: number): RoiConfig => ({
      mode: "square",
      size,
      centerX: null,
      centerY: null,
      points: [],
      label: `${size} px`,
      polygonClosed: false,
    }),
    [],
  );

  const applyRoi = useCallback((role: CameraRole, roi: RoiConfig) => {
    if (role === "target") setRoiTarget(roi);
    else setRoiPalette(roi);
  }, []);

  const refreshMatch = useCallback(async () => {
    try {
      const data = await fetchMatch({
        target: targetHold?.color ?? null,
        palette: paletteHold?.color ?? null,
      });
      setMatch(data);
      setMatchError(null);
    } catch (e) {
      setMatchError(e instanceof Error ? e.message : "Ошибка API");
    }
  }, [targetHold, paletteHold]);

  const refreshLiveColors = useCallback(async () => {
    try {
      if (!targetHold) {
        const t = await fetchColor("target");
        setLiveTarget(t.color);
      }
      if (!paletteHold) {
        const p = await fetchColor("palette");
        setLivePalette(p.color);
      }
    } catch {
      /* stream warming up */
    }
  }, [targetHold, paletteHold]);

  const syncAfterRoiChange = useCallback(
    async (role: CameraRole, roi: RoiConfig) => {
      const fw = config?.frameWidth ?? 1280;
      const fh = config?.frameHeight ?? 720;
      let targetColor: ColorPayload | null = targetHold?.color ?? null;
      let paletteColor: ColorPayload | null = paletteHold?.color ?? null;

      const hold = role === "target" ? targetHold : paletteHold;
      const canSample =
        hold &&
        (roi.mode === "square" ||
          (roi.mode === "polygon" && roi.polygonClosed && roi.points.length >= 3));

      if (hold && canSample) {
        const rgb = await sampleRgbFromImage(hold.imageUrl, roi, fw, fh);
        const color = await analyzeRgb(rgb);
        const updated: CameraHold = { ...hold, color };
        if (role === "target") {
          setTargetHold(updated);
          targetColor = color;
        } else {
          setPaletteHold(updated);
          paletteColor = color;
        }
      } else if (!hold) {
        await refreshLiveColors();
        targetColor = role === "target" ? null : targetHold?.color ?? null;
        paletteColor = role === "palette" ? null : paletteHold?.color ?? null;
      }

      const data = await fetchMatch({
        target: targetColor,
        palette: paletteColor,
      });
      setMatch(data);
      setMatchError(null);
    },
    [config, targetHold, paletteHold, refreshLiveColors],
  );

  const refreshDevices = useCallback(async () => {
    setRefreshingCameras(true);
    try {
      const data = await fetchCameras();
      setDevices(data.devices);
    } finally {
      setRefreshingCameras(false);
    }
  }, []);

  const applyConfig = useCallback((cfg: AppConfig) => {
    setConfig(cfg);
    setStreamTick((t) => t + 1);
  }, []);

  const handleSelectCamera = useCallback(
    async (role: CameraRole, index: number) => {
      if (!config) return;
      const current =
        role === "target"
          ? config.cameraTargetIndex
          : config.cameraPaletteIndex;
      if (current === index) return;
      setSwitchingRole(role);
      try {
        const cfg = await selectCameras(
          role === "target" ? index : undefined,
          role === "palette" ? index : undefined,
        );
        applyConfig(cfg);
        const st = await fetchStatus();
        setStreams(st.streams);
        await refreshLiveColors();
        await refreshMatch();
      } catch (e) {
        setMatchError(
          e instanceof Error ? e.message : "Не удалось сменить камеру",
        );
      } finally {
        setSwitchingRole(null);
      }
    },
    [config, applyConfig, refreshLiveColors, refreshMatch],
  );

  const handleCapture = useCallback(
    async (role: CameraRole) => {
      setCapturingRole(role);
      try {
        const hold = await captureCamera(role);
        const nextTarget = role === "target" ? hold : targetHold;
        const nextPalette = role === "palette" ? hold : paletteHold;
        if (role === "target") {
          releaseCameraHold(targetHold);
          setTargetHold(hold);
        } else {
          releaseCameraHold(paletteHold);
          setPaletteHold(hold);
        }
        const data = await fetchMatch({
          target: nextTarget?.color ?? null,
          palette: nextPalette?.color ?? null,
        });
        setMatch(data);
        setMatchError(null);
      } catch (e) {
        setMatchError(e instanceof Error ? e.message : "Ошибка захвата");
      } finally {
        setCapturingRole(null);
      }
    },
    [targetHold, paletteHold],
  );

  const handleResumeLive = useCallback((role: CameraRole) => {
    if (role === "target") {
      releaseCameraHold(targetHold);
      setTargetHold(null);
    } else {
      releaseCameraHold(paletteHold);
      setPaletteHold(null);
    }
    setStreamTick((t) => t + 1);
  }, [targetHold, paletteHold]);

  const handleRoiModeChange = useCallback(
    async (role: CameraRole, mode: "square" | "polygon") => {
      try {
        const data = await updateRoi(role, { mode });
        applyRoi(role, data);
        await syncAfterRoiChange(role, data);
      } catch (e) {
        setMatchError(e instanceof Error ? e.message : "Ошибка ROI");
      }
    },
    [applyRoi, syncAfterRoiChange],
  );

  const handleRoiSizeChange = useCallback(
    (role: CameraRole, size: number) => {
      const clamped = Math.max(8, Math.min(400, Math.round(size)));
      const patch = (prev: RoiConfig | null): RoiConfig => {
        const base = prev ?? defaultRoi(config?.roiSize ?? 48);
        return {
          ...base,
          mode: "square",
          size: clamped,
          label: `${clamped} px`,
        };
      };
      if (role === "target") setRoiTarget(patch);
      else setRoiPalette(patch);

      const prevTimer = roiSizeTimers.current[role];
      if (prevTimer) window.clearTimeout(prevTimer);
      roiSizeTimers.current[role] = window.setTimeout(async () => {
        try {
          const data = await updateRoi(role, { size: clamped });
          applyRoi(role, data);
          await syncAfterRoiChange(role, data);
        } catch (e) {
          setMatchError(e instanceof Error ? e.message : "Ошибка ROI");
        }
      }, 280);
    },
    [applyRoi, config?.roiSize, defaultRoi, syncAfterRoiChange],
  );

  const handleRoiMove = useCallback(
    (role: CameraRole, centerX: number, centerY: number) => {
      const fw = config?.frameWidth ?? 1280;
      const fh = config?.frameHeight ?? 720;
      const currentRoi = role === "target" ? roiTarget : roiPalette;
      const half = (currentRoi?.size ?? config?.roiSize ?? 48) / 2;
      const cx = Math.round(
        Math.max(half, Math.min(fw - half, centerX)),
      );
      const cy = Math.round(
        Math.max(half, Math.min(fh - half, centerY)),
      );

      const patch = (prev: RoiConfig | null): RoiConfig => {
        const base = prev ?? defaultRoi(config?.roiSize ?? 48);
        return { ...base, mode: "square", centerX: cx, centerY: cy };
      };
      if (role === "target") setRoiTarget(patch);
      else setRoiPalette(patch);

      const prevTimer = roiMoveTimers.current[role];
      if (prevTimer) window.clearTimeout(prevTimer);
      roiMoveTimers.current[role] = window.setTimeout(async () => {
        try {
          const data = await updateRoi(role, {
            centerX: cx,
            centerY: cy,
          });
          applyRoi(role, data);
          await syncAfterRoiChange(role, data);
        } catch (e) {
          setMatchError(e instanceof Error ? e.message : "Ошибка ROI");
        }
      }, 120);
    },
    [applyRoi, config, defaultRoi, roiTarget, roiPalette, syncAfterRoiChange],
  );

  const handleRoiReset = useCallback(
    async (role: CameraRole) => {
      try {
        const data = await resetRoi(role);
        applyRoi(role, data);
        await syncAfterRoiChange(role, data);
      } catch (e) {
        setMatchError(e instanceof Error ? e.message : "Ошибка ROI");
      }
    },
    [applyRoi, syncAfterRoiChange],
  );

  const handleRoiRedraw = useCallback(
    async (role: CameraRole) => {
      try {
        const data = await redrawPolygonRoi(role);
        applyRoi(role, data);
      } catch (e) {
        setMatchError(e instanceof Error ? e.message : "Ошибка ROI");
      }
    },
    [applyRoi],
  );

  const handlePolygonComplete = useCallback(
    async (role: CameraRole, points: number[][]) => {
      try {
        const data = await updateRoi(role, { mode: "polygon", points });
        applyRoi(role, data);
        await syncAfterRoiChange(role, data);
      } catch (e) {
        setMatchError(e instanceof Error ? e.message : "Ошибка ROI");
      }
    },
    [applyRoi, syncAfterRoiChange],
  );

  useEffect(() => {
    fetchHealth()
      .then(() => setOnline(true))
      .catch(() => setOnline(false));
    fetchConfig().then(applyConfig).catch(() => undefined);
    refreshDevices();
    fetchStatus().then((s) => setStreams(s.streams)).catch(() => undefined);
  }, [applyConfig, refreshDevices]);

  useEffect(() => {
    if (!online) return;
    void Promise.all([fetchRoi("target"), fetchRoi("palette")]).then(
      ([t, p]) => {
        setRoiTarget(t);
        setRoiPalette(p);
      },
    );
  }, [online]);

  // Пересчёт match при смене захвата / возврате в live
  useEffect(() => {
    if (!online) return;
    refreshMatch();
  }, [online, targetHold, paletteHold, refreshMatch]);

  // Live-опрос только для камер без захвата
  useEffect(() => {
    if (!online) return;
    const needsLivePoll = !targetHold || !paletteHold;
    if (!needsLivePoll) return;

    const tick = async () => {
      await refreshLiveColors();
      await refreshMatch();
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [online, targetHold, paletteHold, refreshLiveColors, refreshMatch]);

  useEffect(() => {
    if (!online) return;
    const id = window.setInterval(() => {
      fetchStatus()
        .then((s) => setStreams(s.streams))
        .catch(() => undefined);
    }, 3000);
    return () => window.clearInterval(id);
  }, [online]);

  useEffect(() => {
    return () => {
      releaseCameraHold(targetHold);
      releaseCameraHold(paletteHold);
    };
  }, [targetHold, paletteHold]);

  const targetStatus = statusFor(streams, "target");
  const paletteStatus = statusFor(streams, "palette");

  const targetDisplayColor = targetHold?.color ?? liveTarget;
  const paletteDisplayColor = paletteHold?.color ?? livePalette;

  const targetIndex = config?.cameraTargetIndex ?? 0;
  const paletteIndex = config?.cameraPaletteIndex ?? 1;
  const frameWidth = config?.frameWidth ?? 1280;
  const frameHeight = config?.frameHeight ?? 720;
  const defaultRoiSize = config?.roiSize ?? 48;
  const targetRoi = roiTarget ?? defaultRoi(defaultRoiSize);
  const paletteRoi = roiPalette ?? defaultRoi(defaultRoiSize);

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>Color Matcher</h1>
          <p className="muted">
            Захват по камерам · сравнение по снимку или live
          </p>
        </div>
        <div className="topbar-meta">
          <span className={`badge ${online ? "badge-ok" : "badge-off"}`}>
            API {online ? "online" : "offline"}
          </span>
          {config && (
            <div className="topbar-cam-row">
              <span className="muted small">
                cam {targetIndex} / {paletteIndex}
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={refreshingCameras}
                onClick={refreshDevices}
              >
                {refreshingCameras ? "Поиск…" : "Обновить список камер"}
              </button>
            </div>
          )}
        </div>
      </header>

      {!online && (
        <div className="banner banner-warn">
          Запустите бэкенд: <code>.\scripts\start-backend.ps1</code>
        </div>
      )}

      <main className="grid cameras">
        <CameraPanel
          title="Камера 1 — цель"
          subtitle="Миниатюра / образец цвета"
          role="target"
          streamKey={streamTick}
          holdImageUrl={targetHold?.imageUrl}
          isHeld={targetHold !== null}
          color={targetDisplayColor}
          mock={targetStatus?.mock}
          deviceIndex={targetIndex}
          devices={devices}
          frameWidth={frameWidth}
          frameHeight={frameHeight}
          defaultRoiSize={defaultRoiSize}
          roi={targetRoi}
          switching={switchingRole === "target"}
          capturing={capturingRole === "target"}
          capturedAt={targetHold?.capturedAt ?? null}
          onCapture={() => handleCapture("target")}
          onResumeLive={() => handleResumeLive("target")}
          onDeviceChange={(idx) => handleSelectCamera("target", idx)}
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
          role="palette"
          streamKey={streamTick}
          holdImageUrl={paletteHold?.imageUrl}
          isHeld={paletteHold !== null}
          color={paletteDisplayColor}
          mock={paletteStatus?.mock}
          deviceIndex={paletteIndex}
          devices={devices}
          frameWidth={frameWidth}
          frameHeight={frameHeight}
          defaultRoiSize={defaultRoiSize}
          roi={paletteRoi}
          switching={switchingRole === "palette"}
          capturing={capturingRole === "palette"}
          capturedAt={paletteHold?.capturedAt ?? null}
          onCapture={() => handleCapture("palette")}
          onResumeLive={() => handleResumeLive("palette")}
          onDeviceChange={(idx) => handleSelectCamera("palette", idx)}
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
            targetHold
              ? "Камера 1 — захваченный цвет"
              : "Камера 1 — live"
          }
          color={targetDisplayColor}
        />
        <ColorInfo
          label={
            paletteHold
              ? "Камера 2 — захваченный цвет"
              : "Камера 2 — live"
          }
          color={paletteDisplayColor}
        />
      </section>

      <MixSuggestion match={match} error={matchError} />
    </div>
  );
}
