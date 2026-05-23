export type PaletteSelection =
  | { type: "user"; setId: string }
  | { type: "server"; presetId: string };

export function selectionKey(sel: PaletteSelection): string {
  return sel.type === "user" ? `user:${sel.setId}` : `server:${sel.presetId}`;
}

export function parseSelectionKey(key: string): PaletteSelection | null {
  if (key.startsWith("user:")) {
    const setId = key.slice(5);
    return setId ? { type: "user", setId } : null;
  }
  if (key.startsWith("server:")) {
    const presetId = key.slice(7);
    return presetId ? { type: "server", presetId } : null;
  }
  return null;
}

const STORAGE_SELECTION = "colorMatcher.paletteSelection";

export function loadSelectionKey(): string | null {
  try {
    return localStorage.getItem(STORAGE_SELECTION);
  } catch {
    return null;
  }
}

export function saveSelectionKey(key: string): void {
  try {
    localStorage.setItem(STORAGE_SELECTION, key);
  } catch {
    /* private mode */
  }
}
