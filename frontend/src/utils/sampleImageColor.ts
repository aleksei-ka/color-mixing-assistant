import type { RoiConfig } from "../api";
import type { FrameSource } from "./frameSource";
import { framePixelSize } from "./frameSource";

export function medianChannel(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

export function pointInPolygon(
  x: number,
  y: number,
  points: number[][],
): boolean {
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

export function squareBounds(roi: RoiConfig, w: number, h: number) {
  const cx = roi.centerX ?? w / 2;
  const cy = roi.centerY ?? h / 2;
  const half = roi.size / 2;
  const x0 = Math.max(0, Math.min(w - roi.size, Math.round(cx - half)));
  const y0 = Math.max(0, Math.min(h - roi.size, Math.round(cy - half)));
  return { x0, y0, x1: x0 + roi.size, y1: y0 + roi.size };
}

import { sampleFromImageData } from "./sampleFromImageData";

export function sampleRgbFromFrame(
  source: FrameSource,
  roi: RoiConfig,
): { r: number; g: number; b: number } {
  const { w, h } = framePixelSize(source);
  if (!w || !h) {
    throw new Error("Кадр ещё не готов");
  }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas недоступен");
  ctx.drawImage(source, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  return sampleFromImageData(data, w, h, roi);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Не удалось загрузить снимок"));
    img.src = url;
  });
}

/** @deprecated use sampleRgbFromFrame — kept for captured blob URLs */
export async function sampleRgbFromImage(
  imageUrl: string,
  roi: RoiConfig,
  _frameWidth: number,
  _frameHeight: number,
): Promise<{ r: number; g: number; b: number }> {
  const img = await loadImage(imageUrl);
  return sampleRgbFromFrame(img, roi);
}
