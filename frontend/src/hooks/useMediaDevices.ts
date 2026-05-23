import { useCallback, useEffect, useState } from "react";

export type VideoInputOption = {
  deviceId: string;
  label: string;
};

async function ensureCameraPermission(): Promise<boolean> {
  if (!navigator.mediaDevices?.getUserMedia) return false;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach((t) => t.stop());
    return true;
  } catch {
    return false;
  }
}

export function useMediaDevices() {
  const [devices, setDevices] = useState<VideoInputOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setError("Браузер не поддерживает доступ к камерам");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await ensureCameraPermission();
      const all = await navigator.mediaDevices.enumerateDevices();
      const seen = new Set<string>();
      const video = all
        .filter((d) => d.kind === "videoinput" && d.deviceId)
        .filter((d) => {
          if (seen.has(d.deviceId)) return false;
          seen.add(d.deviceId);
          return true;
        })
        .map((d, i) => ({
          deviceId: d.deviceId,
          label: d.label?.trim()
            ? d.label.trim()
            : `Камера ${i + 1}`,
        }));
      setDevices(video);
      if (video.length === 0) {
        setError("Камеры не найдены");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось получить список камер");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { devices, loading, error, refresh };
}
