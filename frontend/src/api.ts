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
    note?: string;
  };
};

export type StreamStatus = {
  role: string;
  deviceIndex: number;
  mock: boolean;
  error: string | null;
};

export type CameraDevice = {
  index: number;
  width: number;
  height: number;
  inUse?: boolean;
};

export type AppConfig = {
  cameraTargetIndex: number;
  cameraPaletteIndex: number;
  roiSize: number;
  cameraProbeMax?: number;
};

/** Захваченный кадр и цвет одной камеры */
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

export function snapshotUrl(role: CameraRole): string {
  return `/api/snapshot/${role}`;
}

export function fetchHealth(): Promise<{ status: string }> {
  return getJson("/api/health");
}

export function fetchStatus(): Promise<{ streams: StreamStatus[] }> {
  return getJson("/api/status");
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

export function fetchMatch(overrides?: MatchOverrides): Promise<MatchResult> {
  const q = [
    colorQueryParams("target", overrides?.target),
    colorQueryParams("palette", overrides?.palette),
  ]
    .filter(Boolean)
    .join("&");
  const path = q ? `/api/match?${q}` : "/api/match";
  return getJson(path);
}

export function fetchColor(
  role: CameraRole,
): Promise<{ role: string; color: ColorPayload; mock: boolean }> {
  return getJson(`/api/color/${role}`);
}

export function fetchConfig(): Promise<AppConfig> {
  return getJson("/api/config");
}

export function fetchCameras(): Promise<{ devices: CameraDevice[] }> {
  return getJson("/api/cameras");
}

export function selectCameras(
  targetIndex?: number,
  paletteIndex?: number,
): Promise<AppConfig> {
  return postJson("/api/cameras/select", {
    targetIndex,
    paletteIndex,
  });
}

export async function fetchSnapshotBlob(role: CameraRole): Promise<Blob> {
  const res = await fetch(snapshotUrl(role));
  if (!res.ok) {
    throw new Error(`snapshot ${role} → ${res.status}`);
  }
  return res.blob();
}

export function releaseCameraHold(hold: CameraHold | null): void {
  if (!hold) return;
  URL.revokeObjectURL(hold.imageUrl);
}

/** Захват одной камеры: снимок + текущий цвет из ROI */
export async function captureCamera(role: CameraRole): Promise<CameraHold> {
  const [colorRes, blob] = await Promise.all([
    fetchColor(role),
    fetchSnapshotBlob(role),
  ]);
  return {
    color: colorRes.color,
    imageUrl: URL.createObjectURL(blob),
    capturedAt: new Date().toISOString(),
  };
}
