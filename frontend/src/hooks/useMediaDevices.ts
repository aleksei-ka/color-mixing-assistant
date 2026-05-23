import { useCallback, useEffect, useState } from "react";

export type VideoInputOption = {
  deviceId: string;
  label: string;
};

export type DevicesErrorCode =
  | "noMediaDevices"
  | "noCameras"
  | "deviceListFailed";

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
  const [errorCode, setErrorCode] = useState<DevicesErrorCode | null>(null);

  const refresh = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setErrorCode("noMediaDevices");
      return;
    }
    setLoading(true);
    setErrorCode(null);
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
            : `Camera ${i + 1}`,
        }));
      setDevices(video);
      if (video.length === 0) {
        setErrorCode("noCameras");
      }
    } catch {
      setErrorCode("deviceListFailed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { devices, loading, errorCode, refresh };
}
