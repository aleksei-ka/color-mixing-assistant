import { describe, expect, it } from "vitest";
import type { RoiConfig } from "../api";
import {
  medianChannel,
  pointInPolygon,
  squareBounds,
} from "./sampleImageColor";
import { sampleFromImageData } from "./sampleFromImageData";

const squareRoi = (size: number, cx: number, cy: number): RoiConfig => ({
  mode: "square",
  size,
  centerX: cx,
  centerY: cy,
  points: [],
  label: `${size} px`,
  polygonClosed: false,
});

describe("medianChannel", () => {
  it("returns median of odd count", () => {
    expect(medianChannel([10, 50, 90])).toBe(50);
  });

  it("returns average of two middles for even count", () => {
    expect(medianChannel([10, 20, 30, 40])).toBe(25);
  });
});

describe("squareBounds", () => {
  it("clamps square inside frame", () => {
    const b = squareBounds(squareRoi(48, 10, 10), 640, 480);
    expect(b.x0).toBeGreaterThanOrEqual(0);
    expect(b.y0).toBeGreaterThanOrEqual(0);
    expect(b.x1 - b.x0).toBe(48);
    expect(b.y1 - b.y0).toBe(48);
  });
});

describe("pointInPolygon", () => {
  it("detects inside triangle", () => {
    const tri = [
      [10, 10],
      [50, 10],
      [30, 50],
    ];
    expect(pointInPolygon(30, 25, tri)).toBe(true);
    expect(pointInPolygon(0, 0, tri)).toBe(false);
  });
});

describe("sampleFromImageData", () => {
  it("samples solid red square", () => {
    const w = 100;
    const h = 100;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 200;
      data[i + 1] = 10;
      data[i + 2] = 10;
      data[i + 3] = 255;
    }
    const rgb = sampleFromImageData(
      data,
      w,
      h,
      squareRoi(20, 50, 50),
    );
    expect(rgb.r).toBe(200);
    expect(rgb.g).toBe(10);
    expect(rgb.b).toBe(10);
  });
});
