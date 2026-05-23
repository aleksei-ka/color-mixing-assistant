import { useCallback, useEffect, useState } from "react";
import {
  captureCamera,
  fetchCameras,
  fetchColor,
  fetchConfig,
  fetchHealth,
  fetchMatch,
  fetchStatus,
  releaseCameraHold,
  selectCameras,
  type AppConfig,
  type CameraDevice,
  type CameraHold,
  type CameraRole,
  type ColorPayload,
  type MatchResult,
  type StreamStatus,
} from "./api";
import { CameraPanel } from "./components/CameraPanel";
import { CaptureBar } from "./components/CaptureBar";
import { ColorInfo } from "./components/ColorInfo";
import { MixSuggestion } from "./components/MixSuggestion";

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

  const refreshDevices = useCallback(async () => {
    setRefreshingCameras(true);
    try {
      const data = await fetchCameras();
      setDevices(data.devices);
    } finally {
      setRefreshingCameras(false);
    }
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

  useEffect(() => {
    fetchHealth()
      .then(() => setOnline(true))
      .catch(() => setOnline(false));
    fetchConfig().then(applyConfig).catch(() => undefined);
    refreshDevices();
    fetchStatus().then((s) => setStreams(s.streams)).catch(() => undefined);
  }, [applyConfig, refreshDevices]);

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

  const anyHeld = targetHold !== null || paletteHold !== null;

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
          {anyHeld && <span className="badge badge-held">есть захват</span>}
          {config && (
            <span className="muted small">
              cam {targetIndex} / {paletteIndex} · ROI {config.roiSize}px
            </span>
          )}
        </div>
      </header>

      {!online && (
        <div className="banner banner-warn">
          Запустите бэкенд: <code>.\scripts\start-backend.ps1</code>
        </div>
      )}

      <CaptureBar
        onRefreshCameras={refreshDevices}
        refreshingCameras={refreshingCameras}
      />

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
          switching={switchingRole === "target"}
          capturing={capturingRole === "target"}
          capturedAt={targetHold?.capturedAt ?? null}
          onCapture={() => handleCapture("target")}
          onResumeLive={() => handleResumeLive("target")}
          onDeviceChange={(idx) => handleSelectCamera("target", idx)}
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
          switching={switchingRole === "palette"}
          capturing={capturingRole === "palette"}
          capturedAt={paletteHold?.capturedAt ?? null}
          onCapture={() => handleCapture("palette")}
          onResumeLive={() => handleResumeLive("palette")}
          onDeviceChange={(idx) => handleSelectCamera("palette", idx)}
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

      <footer className="footer muted small">
        <p>
          Захват одной камеры не останавливает другую — можно сравнить
          захват с live или два захвата между собой.
        </p>
      </footer>
    </div>
  );
}
