import type { RoiConfig } from "../api";

function medianChannel(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Не удалось загрузить снимок"));
    img.src = url;
  });
}

function pointInPolygon(x: number, y: number, points: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    const intersect =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function squareBounds(roi: RoiConfig, w: number, h: number) {
  const cx = roi.centerX ?? w / 2;
  const cy = roi.centerY ?? h / 2;
  const half = roi.size / 2;
  const x0 = Math.max(0, Math.min(w - roi.size, Math.round(cx - half)));
  const y0 = Math.max(0, Math.min(h - roi.size, Math.round(cy - half)));
  return { x0, y0, x1: x0 + roi.size, y1: y0 + roi.size };
}

export async function sampleRgbFromImage(
  imageUrl: string,
  roi: RoiConfig,
  frameWidth: number,
  frameHeight: number,
): Promise<{ r: number; g: number; b: number }> {
  const img = await loadImage(imageUrl);
  const w = img.naturalWidth || frameWidth;
  const h = img.naturalHeight || frameHeight;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas недоступен");
  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];

  if (roi.mode === "polygon" && roi.polygonClosed && roi.points.length >= 3) {
    const xs = roi.points.map((p) => p[0]);
    const ys = roi.points.map((p) => p[1]);
    const minX = Math.max(0, Math.floor(Math.min(...xs)));
    const maxX = Math.min(w - 1, Math.ceil(Math.max(...xs)));
    const minY = Math.max(0, Math.floor(Math.min(...ys)));
    const maxY = Math.min(h - 1, Math.ceil(Math.max(...ys)));
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (!pointInPolygon(x, y, roi.points)) continue;
        const i = (y * w + x) * 4;
        rs.push(data[i]);
        gs.push(data[i + 1]);
        bs.push(data[i + 2]);
      }
    }
  } else {
    const { x0, y0, x1, y1 } = squareBounds(roi, w, h);
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * w + x) * 4;
        rs.push(data[i]);
        gs.push(data[i + 1]);
        bs.push(data[i + 2]);
      }
    }
  }

  return {
    r: medianChannel(rs),
    g: medianChannel(gs),
    b: medianChannel(bs),
  };
}
