import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type Ref,
} from "react";

type Props = {
  panelId: string;
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
  { panelId, deviceId, active, alt, onReady, onError, onVideoMount }: Props,
  ref: Ref<BrowserCameraHandle>,
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
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
    const stopStream = () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      const video = videoRef.current;
      if (video) {
        video.srcObject = null;
      }
      onVideoMountRef.current?.(null);
    };

    if (!active || !deviceId) {
      stopStream();
      return;
    }

    let cancelled = false;
    let loadedHandler: (() => void) | null = null;

    const detachListeners = () => {
      const video = videoRef.current;
      if (video && loadedHandler) {
        video.removeEventListener("loadeddata", loadedHandler);
        loadedHandler = null;
      }
    };

    const start = async () => {
      stopStream();

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

        const track = stream.getVideoTracks()[0];
        const openedId = track?.getSettings().deviceId;
        if (openedId && openedId !== deviceId) {
          stream.getTracks().forEach((t) => t.stop());
          onErrorRef.current?.(
            `Браузер открыл другое устройство. Попробуйте закрыть другие вкладки с камерой (${panelId}).`,
          );
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) {
          stream.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
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
        const msg =
          e instanceof Error ? e.message : "Не удалось открыть камеру";
        onErrorRef.current?.(
          `${msg} (панель ${panelId}). Если камера занята — выберите другое устройство.`,
        );
      }
    };

    void start();

    return () => {
      cancelled = true;
      detachListeners();
      stopStream();
    };
  }, [panelId, deviceId, active]);

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
