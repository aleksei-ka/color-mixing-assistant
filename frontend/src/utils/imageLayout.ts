/** Visible image rect for object-fit: contain inside the element box. */
export function getContainedImageRect(img: HTMLImageElement): {
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
} | null {
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  if (!nw || !nh) return null;

  const boxW = img.clientWidth;
  const boxH = img.clientHeight;
  if (!boxW || !boxH) return null;

  const scale = Math.min(boxW / nw, boxH / nh);
  const width = nw * scale;
  const height = nh * scale;
  return {
    offsetX: (boxW - width) / 2,
    offsetY: (boxH - height) / 2,
    width,
    height,
  };
}

/** Map pointer position inside <img> to frame coordinates (0..frameWidth/Height). */
export function pointerToFrame(
  clientX: number,
  clientY: number,
  img: HTMLImageElement,
  frameWidth: number,
  frameHeight: number,
): [number, number] | null {
  const rect = getContainedImageRect(img);
  if (!rect || rect.width <= 0 || rect.height <= 0) return null;

  const box = img.getBoundingClientRect();
  const localX = clientX - box.left - rect.offsetX;
  const localY = clientY - box.top - rect.offsetY;

  const nx = localX / rect.width;
  const ny = localY / rect.height;
  if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return null;

  const nw = img.naturalWidth || frameWidth;
  const nh = img.naturalHeight || frameHeight;
  const fx = Math.round(nx * nw);
  const fy = Math.round(ny * nh);

  return [
    Math.max(0, Math.min(frameWidth - 1, fx)),
    Math.max(0, Math.min(frameHeight - 1, fy)),
  ];
}
