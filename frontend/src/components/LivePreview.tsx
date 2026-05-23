import { useEffect, useState } from "react";
import { snapshotUrl } from "../api";

type Props = {
  role: "target" | "palette";
  deviceIndex: number;
  streamKey: number;
  paused: boolean;
  alt: string;
};

/** Polls JPEG snapshots — works reliably through the Vite dev proxy (unlike MJPEG). */
export function LivePreview({
  role,
  deviceIndex,
  streamKey,
  paused,
  alt,
}: Props) {
  const [src, setSrc] = useState<string>("");
  const [error, setError] = useState(false);

  useEffect(() => {
    if (paused) return;
    setError(false);
    let cancelled = false;

    const pull = async () => {
      try {
        const res = await fetch(
          `${snapshotUrl(role)}?t=${Date.now()}`,
        );
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        setSrc((prev) => {
          if (prev.startsWith("blob:")) URL.revokeObjectURL(prev);
          return url;
        });
      } catch {
        if (!cancelled) setError(true);
      }
    };

    pull();
    const id = window.setInterval(pull, 100);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [role, deviceIndex, streamKey, paused]);

  useEffect(
    () => () => {
      if (src.startsWith("blob:")) URL.revokeObjectURL(src);
    },
    [src],
  );

  if (paused) return null;

  if (error && !src) {
    return (
      <div className="video video-placeholder">
        Нет кадра — проверьте камеру {deviceIndex}
      </div>
    );
  }

  return <img src={src} alt={alt} className="video" />;
}
