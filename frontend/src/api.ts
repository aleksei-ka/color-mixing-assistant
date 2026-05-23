export type Rgb = { r: number; g: number; b: number };

export type ColorPayload = {
  rgb: Rgb;
  hex: string;
  hsl: { h: number; s: number; l: number };
  lab: { l: number; a: number; b: number };
  cmyk: { c: number; m: number; y: number; k: number };
};

export type MixComponent = {
  name: string;
  rgb: Rgb;
  weight: number;
  percent: number;
  deltaE_to_target: number;
};

export type MatchResult = {
  deltaE: number;
  target: ColorPayload;
  palette: ColorPayload;
  targetCaptured?: boolean;
  paletteCaptured?: boolean;
  mix: {
    available: boolean;
    message?: string;
    deltaE_current_to_target?: number;
    components: MixComponent[];
    legend?: string;
    note?: string;
  };
};

export type AppConfig = {
  roiSize: number;
  frameWidth?: number;
  frameHeight?: number;
};

export type RoiConfig = {
  mode: "square" | "polygon";
  size: number;
  centerX: number | null;
  centerY: number | null;
  points: number[][];
  label: string;
  polygonClosed: boolean;
};

export type CameraHold = {
  color: ColorPayload;
  imageUrl: string;
  capturedAt: string;
};

export type CameraRole = "target" | "palette";

async function getJson<T>(path: string, headers?: HeadersInit): Promise<T> {
  const res = await fetch(path, { headers });
  if (!res.ok) {
    throw new Error(`${path} → ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`${path} → ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function fetchHealth(): Promise<{ status: string }> {
  return getJson("/api/health");
}

export function fetchConfig(): Promise<AppConfig> {
  return getJson("/api/config");
}

export type MatchOverrides = {
  target?: ColorPayload | null;
  palette?: ColorPayload | null;
};

export type BaseColorInput = {
  name: string;
  rgb: [number, number, number];
};

export type PalettePresetsResponse = {
  defaultPresetId: string;
  presets: {
    id: string;
    tag: string;
    category: string;
    label: string;
    description: string;
    colorCount: number;
  }[];
};

export function fetchPalettePresets(
  lang?: string,
): Promise<PalettePresetsResponse> {
  const headers: HeadersInit = {};
  if (lang) headers["Accept-Language"] = lang;
  return getJson("/api/palette-presets", headers);
}

export function fetchPalettePresetColors(presetId: string): Promise<{
  presetId: string;
  colors: { name: string; rgb: [number, number, number] }[];
}> {
  return getJson(`/api/palette-presets/${encodeURIComponent(presetId)}`);
}

export function fetchMatch(
  overrides: MatchOverrides,
  baseColors: BaseColorInput[],
): Promise<MatchResult> {
  const target = overrides.target;
  const palette = overrides.palette;
  if (!target || !palette) {
    return Promise.reject(new Error("matchNeedsColors"));
  }
  return postJson("/api/match", {
    target: target.rgb,
    palette: palette.rgb,
    baseColors: baseColors.map((c) => ({ name: c.name, rgb: c.rgb })),
  });
}

export function analyzeRgb(rgb: Rgb): Promise<ColorPayload> {
  return postJson("/api/analyze-rgb", rgb);
}

export function releaseCameraHold(hold: CameraHold | null): void {
  if (!hold) return;
  URL.revokeObjectURL(hold.imageUrl);
}
