import { parseHex } from "./hex";
import type { BaseColor, PaletteExportFile, PaletteFile } from "./types";

export const MAX_COLOR_NAME_LENGTH = 150;
export const MIN_USER_PALETTE_COLORS = 3;

function isRgbTuple(v: unknown): v is [number, number, number] {
  return (
    Array.isArray(v) &&
    v.length === 3 &&
    v.every((n) => typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 255)
  );
}

export function parsePaletteFile(data: unknown): PaletteFile {
  if (!data || typeof data !== "object") {
    throw new Error("invalidRoot");
  }
  const root = data as Record<string, unknown>;
  const label = typeof root.label === "string" ? root.label.trim() : "";
  if (!label) throw new Error("missingLabel");
  if (!Array.isArray(root.colors) || root.colors.length === 0) {
    throw new Error("emptyColors");
  }
  const colors: BaseColor[] = [];
  for (const item of root.colors) {
    if (!item || typeof item !== "object") throw new Error("badColor");
    const row = item as Record<string, unknown>;
    const name = normalizeColorName(
      typeof row.name === "string" ? row.name.trim() : "",
    );
    if (!isValidColorName(name)) throw new Error("badColorName");
    if (!isRgbTuple(row.rgb)) throw new Error("badColorRgb");
    colors.push({ name, rgb: [...row.rgb] as [number, number, number] });
  }
  return { label, colors };
}

export function clampChannel(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

export function normalizeColorName(name: string): string {
  return name.slice(0, MAX_COLOR_NAME_LENGTH);
}

export function isValidColorName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_COLOR_NAME_LENGTH;
}

/** #RGB or #RRGGBB (optional #), partial typing allowed */
export function isPartialHexInput(input: string): boolean {
  const raw = input.trim().replace(/^#/, "");
  return /^[0-9a-fA-F]{0,6}$/.test(raw);
}

export function normalizeHexInput(input: string): [number, number, number] | null {
  const raw = input.trim().replace(/^#/, "");
  if (raw.length === 3) {
    const expanded = raw
      .split("")
      .map((c) => c + c)
      .join("");
    return parseHex(`#${expanded}`);
  }
  return parseHex(input);
}

export function normalizeLabel(label: string): string {
  return label.trim().toLowerCase();
}

function parseColorsArray(colorsRaw: unknown): BaseColor[] {
  if (!Array.isArray(colorsRaw) || colorsRaw.length === 0) {
    throw new Error("emptyColors");
  }
  const colors: BaseColor[] = [];
  for (const item of colorsRaw) {
    if (!item || typeof item !== "object") throw new Error("badColor");
    const row = item as Record<string, unknown>;
    const name = normalizeColorName(
      typeof row.name === "string" ? row.name.trim() : "",
    );
    if (!isValidColorName(name)) throw new Error("badColorName");
    if (!isRgbTuple(row.rgb)) throw new Error("badColorRgb");
    colors.push({ name, rgb: [...row.rgb] as [number, number, number] });
  }
  return colors;
}

/** Single set or full export bundle */
export function parseImportPayload(data: unknown): { label: string; colors: BaseColor[] }[] {
  if (!data || typeof data !== "object") throw new Error("invalidRoot");
  const root = data as Record<string, unknown>;

  if (root.version === 1 && Array.isArray(root.sets)) {
    const out: { label: string; colors: BaseColor[] }[] = [];
    for (const item of root.sets) {
      if (!item || typeof item !== "object") throw new Error("badSet");
      const row = item as Record<string, unknown>;
      const label = typeof row.label === "string" ? row.label.trim() : "";
      if (!label) throw new Error("missingLabel");
      out.push({ label, colors: parseColorsArray(row.colors) });
    }
    if (out.length === 0) throw new Error("emptyColors");
    return out;
  }

  const single = parsePaletteFile(data);
  return [single];
}

export function buildExportFile(
  sets: { label: string; colors: BaseColor[] }[],
): PaletteExportFile {
  return { version: 1, sets };
}
