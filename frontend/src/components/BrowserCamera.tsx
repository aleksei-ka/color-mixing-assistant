import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type Ref,
} from "react";

type Props = {
  deviceId: string;
  active: boolean;
  alt: string;
  onReady?: (width: number, height: number) => void;
  onError?: (message: string) => void;
  onVideoMount?: (video: HTMLVideoElement | null) => void;
};

export type BrowserCameraHandle = {
  getVideo: () => HTMLVideoElement | null;
};

export const BrowserCamera = forwardRef(function BrowserCamera(
  { deviceId, active, alt, onReady, onError, onVideoMount }: Props,
  ref: Ref<BrowserCameraHandle>,
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useImperativeHandle(ref, () => ({
    getVideo: () => videoRef.current,
  }));

  useEffect(() => {
    if (!active || !deviceId) return;

    let cancelled = false;

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: deviceId },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        onVideoMount?.(video);

        const reportSize = () => {
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            onReady?.(video.videoWidth, video.videoHeight);
          }
        };
        video.addEventListener("loadeddata", reportSize);
        reportSize();
      } catch (e) {
        onError?.(
          e instanceof Error ? e.message : "Не удалось открыть камеру",
        );
      }
    };

    void start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      const video = videoRef.current;
      if (video) {
        video.srcObject = null;
      }
      onVideoMount?.(null);
    };
  }, [deviceId, active, onReady, onError, onVideoMount]);

  return (
    <video
      ref={videoRef}
      className="video"
      playsInline
      muted
      autoPlay
      aria-label={alt}
    />
  );
});
