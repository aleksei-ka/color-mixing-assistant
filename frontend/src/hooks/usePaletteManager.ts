import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchPalettePresetColors,
  fetchPalettePresets,
} from "../api";
import {
  addSet,
  cloneColors,
  createSet,
  findUserSetByLabel,
  loadStore,
  mergeImportedSets,
  removeSet,
  saveStore,
  setActive,
  sortUserSets,
  updateSetColors,
} from "../palette/storage";
import {
  loadSelectionKey,
  parseSelectionKey,
  saveSelectionKey,
  selectionKey,
  type PaletteSelection,
} from "../palette/selection";
import type {
  BaseColor,
  PalettePresetSummary,
  PaletteStoreV1,
} from "../palette/types";
import {
  buildExportFile,
  normalizeLabel,
  parseImportPayload,
} from "../palette/validate";

const emptyStore = (): PaletteStoreV1 => ({
  version: 1,
  activeId: "",
  sets: [],
});

export function usePaletteManager(lang: string) {
  const [ready, setReady] = useState(false);
  const [store, setStore] = useState<PaletteStoreV1>(emptyStore);
  const [presets, setPresets] = useState<PalettePresetSummary[]>([]);
  const [defaultPresetId, setDefaultPresetId] = useState("classic-10");
  const [selection, setSelection] = useState<PaletteSelection>({
    type: "server",
    presetId: "classic-10",
  });
  const [workingColors, setWorkingColors] = useState<BaseColor[]>([]);
  const [error, setError] = useState<string | null>(null);

  const persist = useCallback((next: PaletteStoreV1) => {
    saveStore(next);
    setStore(next);
  }, []);

  const loadServerColors = useCallback(async (presetId: string) => {
    const { colors } = await fetchPalettePresetColors(presetId);
    const cloned = cloneColors(colors);
    setWorkingColors(cloned);
    return cloned;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const meta = await fetchPalettePresets(lang);
        if (cancelled) return;
        setPresets(meta.presets);
        setDefaultPresetId(meta.defaultPresetId);

        const saved = loadStore() ?? emptyStore();
        setStore(saved);

        const savedKey = loadSelectionKey();
        let sel: PaletteSelection = {
          type: "server",
          presetId: meta.defaultPresetId,
        };
        if (savedKey) {
          const parsed = parseSelectionKey(savedKey);
          if (parsed?.type === "user" && saved.sets.some((s) => s.id === parsed.setId)) {
            sel = parsed;
          } else if (
            parsed?.type === "server" &&
            meta.presets.some((p) => p.id === parsed.presetId)
          ) {
            sel = parsed;
          } else if (saved.activeId && saved.sets.some((s) => s.id === saved.activeId)) {
            sel = { type: "user", setId: saved.activeId };
          }
        } else if (saved.activeId && saved.sets.some((s) => s.id === saved.activeId)) {
          sel = { type: "user", setId: saved.activeId };
        }

        setSelection(sel);
        saveSelectionKey(selectionKey(sel));

        if (sel.type === "user") {
          const set = saved.sets.find((s) => s.id === sel.setId);
          const colors = cloneColors(set?.colors ?? []);
          setWorkingColors(colors);
        } else {
          await loadServerColors(sel.presetId);
        }

        setReady(true);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "init");
          setReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lang, loadServerColors]);

  const sortedUserSets = useMemo(
    () => sortUserSets(store.sets),
    [store.sets],
  );

  const selectedKey = selectionKey(selection);

  const selectByKey = useCallback(
    async (key: string) => {
      const sel = parseSelectionKey(key);
      if (!sel) return;
      setError(null);
      setSelection(sel);
      saveSelectionKey(key);

      if (sel.type === "user") {
        const set = store.sets.find((s) => s.id === sel.setId);
        if (!set) return;
        const colors = cloneColors(set.colors);
        setWorkingColors(colors);
        persist(setActive(store, sel.setId));
      } else {
        await loadServerColors(sel.presetId);
      }
    },
    [store, persist, loadServerColors],
  );

  const updateWorkingColors = useCallback(
    (colors: BaseColor[]) => {
      const cloned = cloneColors(colors);
      setWorkingColors(cloned);
      if (selection.type === "user") {
        const next = updateSetColors(store, selection.setId, cloned);
        persist(next);
      }
    },
    [selection, store, persist],
  );

  const saveUserPresetFromCurrent = useCallback(
    (label: string, colors: BaseColor[] = workingColors) => {
      const trimmed = label.trim();
      if (!trimmed) return;
      const snapshot = cloneColors(colors);
      const existing = findUserSetByLabel(store.sets, trimmed);
      let next: PaletteStoreV1;
      let setId: string;
      if (existing) {
        next = updateSetColors(store, existing.id, snapshot);
        setId = existing.id;
      } else {
        const presetId =
          selection.type === "server" ? selection.presetId : undefined;
        const created = createSet(trimmed, snapshot, presetId);
        next = addSet(store, created);
        setId = created.id;
      }
      next = setActive(next, setId);
      persist(next);
      const sel: PaletteSelection = { type: "user", setId };
      setSelection(sel);
      saveSelectionKey(selectionKey(sel));
      setWorkingColors(cloneColors(snapshot));
      setError(null);
    },
    [store, workingColors, selection, persist],
  );

  const willOverwriteUserPreset = useCallback(
    (label: string) => !!findUserSetByLabel(store.sets, label.trim()),
    [store.sets],
  );

  const deleteActiveUserPreset = useCallback(() => {
    if (selection.type !== "user") return;
    const next = removeSet(store, selection.setId);
    persist(next);
    const fallback: PaletteSelection = {
      type: "server",
      presetId: defaultPresetId,
    };
    setSelection(fallback);
    saveSelectionKey(selectionKey(fallback));
    void loadServerColors(fallback.presetId);
    setError(null);
  }, [selection, store, persist, defaultPresetId, loadServerColors]);

  const exportAllUserPresets = useCallback((): string => {
    return JSON.stringify(
      buildExportFile(
        sortUserSets(store.sets).map((s) => ({
          label: s.label,
          colors: s.colors,
        })),
      ),
      null,
      2,
    );
  }, [store.sets]);

  const importUserPresets = useCallback(
    (text: string) => {
      try {
        const items = parseImportPayload(JSON.parse(text) as unknown);
        const next = mergeImportedSets(store, items);
        persist(next);
        const last = items[items.length - 1];
        const match = next.sets.find(
          (s) => normalizeLabel(s.label) === normalizeLabel(last!.label),
        );
        if (match) {
          const sel: PaletteSelection = { type: "user", setId: match.id };
          setSelection(sel);
          saveSelectionKey(selectionKey(sel));
          const colors = cloneColors(match.colors);
          setWorkingColors(colors);
        }
        setError(null);
        return true;
      } catch {
        setError("importInvalid");
        return false;
      }
    },
    [store, persist],
  );

  const countDuplicateImportLabels = useCallback(
    (text: string): number => {
      try {
        const items = parseImportPayload(JSON.parse(text) as unknown);
        const keys = new Set(store.sets.map((s) => s.label.trim().toLowerCase()));
        return items.filter((i) => keys.has(i.label.trim().toLowerCase())).length;
      } catch {
        return 0;
      }
    },
    [store.sets],
  );

  const clearError = useCallback(() => setError(null), []);

  const activeSet =
    selection.type === "user"
      ? store.sets.find((s) => s.id === selection.setId) ?? null
      : null;

  const selectionLabel =
    selection.type === "user"
      ? activeSet?.label ?? ""
      : presets.find((p) => p.id === selection.presetId)?.label ?? "";

  return {
    ready,
    store,
    sortedUserSets,
    presets,
    defaultPresetId,
    selection,
    selectedKey,
    selectionLabel,
    activeSet,
    activeColors: workingColors,
    error,
    clearError,
    selectByKey,
    updateWorkingColors,
    saveUserPresetFromCurrent,
    willOverwriteUserPreset,
    deleteActiveUserPreset,
    exportAllUserPresets,
    importUserPresets,
    countDuplicateImportLabels,
  };
}
