import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type Ref,
} from "react";
import {
  acquireCameraStream,
  releaseCameraStream,
} from "../hooks/cameraStreamPool";

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
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);
  const onVideoMountRef = useRef(onVideoMount);

  onReadyRef.current = onReady;
  onErrorRef.current = onError;
  onVideoMountRef.current = onVideoMount;

  useImperativeHandle(ref, () => ({
    getVideo: () => videoRef.current,
  }));

  useEffect(() => {
    if (!active || !deviceId) {
      onVideoMountRef.current?.(null);
      return;
    }

    let cancelled = false;
    let loadedHandler: (() => void) | null = null;
    let boundDeviceId = "";

    const detachVideo = () => {
      const video = videoRef.current;
      if (video && loadedHandler) {
        video.removeEventListener("loadeddata", loadedHandler);
        loadedHandler = null;
      }
      if (video) {
        video.srcObject = null;
      }
      onVideoMountRef.current?.(null);
    };

    const start = async () => {
      try {
        const stream = await acquireCameraStream(deviceId);
        if (cancelled) {
          releaseCameraStream(deviceId);
          return;
        }
        boundDeviceId = deviceId;

        const video = videoRef.current;
        if (!video) {
          releaseCameraStream(deviceId);
          return;
        }

        video.srcObject = stream;
        onVideoMountRef.current?.(video);

        loadedHandler = () => {
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            onReadyRef.current?.(video.videoWidth, video.videoHeight);
          }
        };
        video.addEventListener("loadeddata", loadedHandler);

        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.catch((err: DOMException) => {
            if (cancelled || err.name === "AbortError") return;
            onErrorRef.current?.(err.message || "Не удалось запустить видео");
          });
        }
      } catch (e) {
        if (cancelled) return;
        onErrorRef.current?.(
          e instanceof Error ? e.message : "Не удалось открыть камеру",
        );
      }
    };

    void start();

    return () => {
      cancelled = true;
      detachVideo();
      if (boundDeviceId) {
        releaseCameraStream(boundDeviceId);
      }
    };
  }, [deviceId, active]);

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
