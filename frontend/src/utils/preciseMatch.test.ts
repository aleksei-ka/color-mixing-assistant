import { describe, expect, it } from "vitest";
import type { MatchResult } from "../api";
import {
  PRECISE_DELTA_E_THRESHOLD,
  applyPreciseMatchUpdate,
  matchColorsKey,
} from "./preciseMatch";

function sampleMatch(
  deltaE: number,
  targetRgb: [number, number, number],
  paletteRgb: [number, number, number],
): MatchResult {
  const color = (rgb: [number, number, number]) => ({
    rgb: { r: rgb[0], g: rgb[1], b: rgb[2] },
    hex: "#000000",
    hsl: { h: 0, s: 0, l: 0 },
    lab: { l: 0, a: 0, b: 0 },
    cmyk: { c: 0, m: 0, y: 0, k: 0 },
  });
  return {
    deltaE,
    target: color(targetRgb),
    palette: color(paletteRgb),
    mix: { available: true, components: [] },
  };
}

describe("applyPreciseMatchUpdate", () => {
  it("accepts first sample", () => {
    const m = sampleMatch(5, [10, 20, 30], [40, 50, 60]);
    const next = applyPreciseMatchUpdate(m, {
      displayed: null,
      baselineDeltaE: null,
      lastColorsKey: null,
    });
    expect(next.displayed?.deltaE).toBe(5);
    expect(next.baselineDeltaE).toBe(5);
    expect(next.lastColorsKey).toBe(matchColorsKey(m));
  });

  it("ignores duplicate colors key", () => {
    const m = sampleMatch(5, [1, 2, 3], [4, 5, 6]);
    const state = {
      displayed: m,
      baselineDeltaE: 5,
      lastColorsKey: matchColorsKey(m),
    };
    const next = applyPreciseMatchUpdate(
      sampleMatch(9, [1, 2, 3], [4, 5, 6]),
      state,
    );
    expect(next.displayed?.deltaE).toBe(5);
    expect(next.baselineDeltaE).toBe(5);
  });

  it("keeps display when deltaE change is within threshold", () => {
    const first = sampleMatch(5, [1, 2, 3], [4, 5, 6]);
    const state = applyPreciseMatchUpdate(first, {
      displayed: null,
      baselineDeltaE: null,
      lastColorsKey: null,
    });
    const next = applyPreciseMatchUpdate(
      sampleMatch(5 + PRECISE_DELTA_E_THRESHOLD * 0.5, [2, 2, 3], [4, 5, 6]),
      state,
    );
    expect(next.displayed?.deltaE).toBe(5);
    expect(next.baselineDeltaE).toBe(5);
  });

  it("updates when deltaE change exceeds threshold after recalc", () => {
    const first = sampleMatch(5, [1, 2, 3], [4, 5, 6]);
    const state = applyPreciseMatchUpdate(first, {
      displayed: null,
      baselineDeltaE: null,
      lastColorsKey: null,
    });
    const next = applyPreciseMatchUpdate(
      sampleMatch(5 + PRECISE_DELTA_E_THRESHOLD + 0.1, [2, 2, 3], [4, 5, 6]),
      state,
    );
    expect(next.displayed?.deltaE).toBeCloseTo(6.1, 5);
    expect(next.baselineDeltaE).toBeCloseTo(6.1, 5);
  });
});
