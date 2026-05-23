import type { RoiConfig } from "../api";
import { medianChannel, pointInPolygon, squareBounds } from "./sampleImageColor";

export function sampleFromImageData(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  roi: RoiConfig,
): { r: number; g: number; b: number } {
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
