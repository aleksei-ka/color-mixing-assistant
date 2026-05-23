import type { BaseColor, PaletteSet, PaletteStoreV1 } from "./types";
import { normalizeLabel } from "./validate";

const STORAGE_KEY = "colorMatcher.palettes";

function newId(): string {
  return crypto.randomUUID();
}

export function cloneColors(colors: BaseColor[]): BaseColor[] {
  return colors.map((c) => ({
    name: c.name,
    rgb: [c.rgb[0], c.rgb[1], c.rgb[2]] as [number, number, number],
  }));
}

export function createSet(
  label: string,
  colors: BaseColor[],
  presetId?: string,
): PaletteSet {
  return {
    id: newId(),
    label: label.trim(),
    colors: cloneColors(colors),
    presetId,
  };
}

export function loadStore(): PaletteStoreV1 | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PaletteStoreV1;
    if (parsed.version !== 1 || !Array.isArray(parsed.sets)) {
      return null;
    }
    if (parsed.sets.length > 0 && !parsed.activeId) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveStore(store: PaletteStoreV1): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function labelExists(
  sets: PaletteSet[],
  label: string,
  exceptId?: string,
): boolean {
  const key = normalizeLabel(label);
  return sets.some(
    (s) => s.id !== exceptId && normalizeLabel(s.label) === key,
  );
}

export function findUserSetByLabel(
  sets: PaletteSet[],
  label: string,
): PaletteSet | undefined {
  const key = normalizeLabel(label);
  return sets.find((s) => normalizeLabel(s.label) === key);
}

export function getActiveSet(store: PaletteStoreV1): PaletteSet | null {
  return store.sets.find((s) => s.id === store.activeId) ?? store.sets[0] ?? null;
}

export function updateSetColors(
  store: PaletteStoreV1,
  setId: string,
  colors: BaseColor[],
): PaletteStoreV1 {
  return {
    ...store,
    sets: store.sets.map((s) =>
      s.id === setId ? { ...s, colors: cloneColors(colors) } : s,
    ),
  };
}

export function updateSetLabel(
  store: PaletteStoreV1,
  setId: string,
  label: string,
): PaletteStoreV1 {
  return {
    ...store,
    sets: store.sets.map((s) =>
      s.id === setId ? { ...s, label: label.trim() } : s,
    ),
  };
}

export function addSet(store: PaletteStoreV1, set: PaletteSet): PaletteStoreV1 {
  return {
    ...store,
    activeId: set.id,
    sets: [...store.sets, set],
  };
}

export function removeSet(store: PaletteStoreV1, setId: string): PaletteStoreV1 {
  const sets = store.sets.filter((s) => s.id !== setId);
  if (sets.length === 0) {
    return { version: 1, activeId: "", sets: [] };
  }
  const activeId =
    store.activeId === setId ? sets[0]!.id : store.activeId;
  return { ...store, activeId, sets };
}

export function setActive(store: PaletteStoreV1, setId: string): PaletteStoreV1 {
  if (!store.sets.some((s) => s.id === setId)) return store;
  return { ...store, activeId: setId };
}

export function sortUserSets(sets: PaletteSet[]): PaletteSet[] {
  return [...sets].sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
  );
}

/** Merge import; duplicate user labels → last wins */
export function mergeImportedSets(
  store: PaletteStoreV1,
  imported: { label: string; colors: BaseColor[] }[],
): PaletteStoreV1 {
  const map = new Map<string, PaletteSet>();
  for (const s of store.sets) {
    map.set(normalizeLabel(s.label), s);
  }
  let lastId: string | null = store.activeId;
  for (const item of imported) {
    const key = normalizeLabel(item.label);
    const existing = map.get(key);
    if (existing) {
      const updated = {
        ...existing,
        colors: cloneColors(item.colors),
      };
      map.set(key, updated);
      lastId = updated.id;
    } else {
      const created = createSet(item.label, item.colors);
      map.set(key, created);
      lastId = created.id;
    }
  }
  const sets = sortUserSets(Array.from(map.values()));
  const activeId =
    lastId && sets.some((s) => s.id === lastId) ? lastId : (sets[0]?.id ?? "");
  return { version: 1, activeId, sets };
}
