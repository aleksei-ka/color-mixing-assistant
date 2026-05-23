export type FrameSource = HTMLImageElement | HTMLVideoElement;

export function framePixelSize(source: FrameSource): { w: number; h: number } {
  if (source instanceof HTMLVideoElement) {
    return {
      w: source.videoWidth || source.clientWidth,
      h: source.videoHeight || source.clientHeight,
    };
  }
  return {
    w: source.naturalWidth || source.clientWidth,
    h: source.naturalHeight || source.clientHeight,
  };
}

export function isFrameReady(source: FrameSource | null): boolean {
  if (!source) return false;
  const { w, h } = framePixelSize(source);
  return w > 0 && h > 0;
}

export async function captureFrameBlob(
  source: HTMLVideoElement,
): Promise<{ blobUrl: string; width: number; height: number }> {
  const w = source.videoWidth;
  const h = source.videoHeight;
  if (!w || !h) {
    throw new Error("Видео ещё не готово");
  }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas недоступен");
  ctx.drawImage(source, 0, 0, w, h);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Не удалось сохранить кадр"))),
      "image/jpeg",
      0.92,
    );
  });
  return {
    blobUrl: URL.createObjectURL(blob),
    width: w,
    height: h,
  };
}

export async function loadImageFile(
  file: File,
): Promise<{ blobUrl: string; image: HTMLImageElement; width: number; height: number }> {
  if (!file.type.startsWith("image/")) {
    throw new Error("imageInvalid");
  }
  const blobUrl = URL.createObjectURL(file);
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("imageLoadFailed"));
    image.src = blobUrl;
  });
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (!width || !height) {
    URL.revokeObjectURL(blobUrl);
    throw new Error("imageLoadFailed");
  }
  return { blobUrl, image, width, height };
}
