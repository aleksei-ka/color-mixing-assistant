import { forwardRef, useEffect, useState } from "react";
import { snapshotUrl } from "../api";

type Props = {
  role: "target" | "palette";
  deviceIndex: number;
  streamKey: number;
  paused: boolean;
  alt: string;
  onSrcChange?: (src: string) => void;
};

/** Polls JPEG snapshots — works reliably through the Vite dev proxy (unlike MJPEG). */
export const LivePreview = forwardRef<HTMLImageElement, Props>(function LivePreview(
  {
  role,
  deviceIndex,
  streamKey,
  paused,
  alt,
  onSrcChange,
},
  ref,
) {
  const [src, setSrc] = useState<string>("");
  const [error, setError] = useState(false);

  useEffect(() => {
    if (paused) return;
    setError(false);
    let cancelled = false;

    const pull = async () => {
      try {
        const res = await fetch(`${snapshotUrl(role)}?t=${Date.now()}`);
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

  useEffect(() => {
    if (src) onSrcChange?.(src);
  }, [src, onSrcChange]);

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

  return <img ref={ref} src={src} alt={alt} className="video" />;
});
