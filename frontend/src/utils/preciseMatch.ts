import type { MatchResult } from "../api";

export const PRECISE_DELTA_E_THRESHOLD = 1;

export function matchColorsKey(match: MatchResult): string {
  const { target, palette } = match;
  return [
    target.rgb.r,
    target.rgb.g,
    target.rgb.b,
    palette.rgb.r,
    palette.rgb.g,
    palette.rgb.b,
  ].join(",");
}

export type PreciseMatchState = {
  displayed: MatchResult | null;
  baselineDeltaE: number | null;
  lastColorsKey: string | null;
};

export function applyPreciseMatchUpdate(
  incoming: MatchResult,
  state: PreciseMatchState,
  threshold = PRECISE_DELTA_E_THRESHOLD,
): PreciseMatchState {
  const key = matchColorsKey(incoming);
  if (key === state.lastColorsKey) {
    return state;
  }

  const { displayed, baselineDeltaE } = state;
  if (displayed === null || baselineDeltaE === null) {
    return {
      displayed: incoming,
      baselineDeltaE: incoming.deltaE,
      lastColorsKey: key,
    };
  }

  if (Math.abs(incoming.deltaE - baselineDeltaE) <= threshold) {
    return { ...state, lastColorsKey: key };
  }

  return {
    displayed: incoming,
    baselineDeltaE: incoming.deltaE,
    lastColorsKey: key,
  };
}
