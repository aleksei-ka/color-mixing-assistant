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

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
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

function colorQueryParams(
  prefix: string,
  color: ColorPayload | null | undefined,
): string {
  if (!color) return "";
  const { r, g, b } = color.rgb;
  return `${prefix}R=${r}&${prefix}G=${g}&${prefix}B=${b}`;
}

export function fetchMatch(overrides: MatchOverrides): Promise<MatchResult> {
  const q = [
    colorQueryParams("target", overrides.target),
    colorQueryParams("palette", overrides.palette),
  ]
    .filter(Boolean)
    .join("&");
  if (!q) {
    return Promise.reject(new Error("Нужны цвета target и palette"));
  }
  return getJson(`/api/match?${q}`);
}

export function analyzeRgb(rgb: Rgb): Promise<ColorPayload> {
  return postJson("/api/analyze-rgb", rgb);
}

export function releaseCameraHold(hold: CameraHold | null): void {
  if (!hold) return;
  URL.revokeObjectURL(hold.imageUrl);
}
