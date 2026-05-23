import { useCallback, useEffect, useRef, useState } from "react";
import type { ColorPayload } from "../api";
import type { usePaletteManager } from "../hooks/usePaletteManager";
import { useTranslation } from "../i18n/I18nProvider";
import type { BaseColor } from "../palette/types";
import {
  clampChannel,
  MAX_COLOR_NAME_LENGTH,
  normalizeColorName,
} from "../palette/validate";
import { ColorHexField } from "./ColorHexField";
import { SavePresetModal } from "./SavePresetModal";

const DEBOUNCE_MS = 450;

type PaletteApi = ReturnType<typeof usePaletteManager>;

type Props = {
  palette: PaletteApi;
  targetColor: ColorPayload | null;
  paletteColor: ColorPayload | null;
};

const STORAGE_EXPANDED = "colorMatcher.basesExpanded";

function loadExpanded(): boolean {
  try {
    return localStorage.getItem(STORAGE_EXPANDED) === "1";
  } catch {
    return false;
  }
}

function saveExpanded(open: boolean) {
  try {
    localStorage.setItem(STORAGE_EXPANDED, open ? "1" : "0");
  } catch {
    /* private mode */
  }
}

function payloadToRgb(color: ColorPayload): [number, number, number] {
  return [color.rgb.r, color.rgb.g, color.rgb.b];
}

export function BaseColorsPanel({
  palette,
  targetColor,
  paletteColor,
}: Props) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [expanded, setExpanded] = useState(loadExpanded);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveModalName, setSaveModalName] = useState("");

  const {
    ready,
    sortedUserSets,
    presets,
    selectedKey,
    selectionLabel,
    selection,
    activeColors,
    error,
    selectByKey,
    updateWorkingColors,
    saveUserPresetFromCurrent,
    willOverwriteUserPreset,
    deleteActiveUserPreset,
    exportAllUserPresets,
    importUserPresets,
    countDuplicateImportLabels,
  } = palette;

  const [draftColors, setDraftColors] = useState<BaseColor[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftRef = useRef(draftColors);
  draftRef.current = draftColors;

  useEffect(() => {
    setDraftColors(activeColors);
  }, [activeColors, selectedKey]);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  const flushDraft = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    updateWorkingColors(draftRef.current);
  }, [updateWorkingColors]);

  const scheduleDraft = useCallback(
    (colors: BaseColor[]) => {
      setDraftColors(colors);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        updateWorkingColors(colors);
      }, DEBOUNCE_MS);
    },
    [updateWorkingColors],
  );

  const commitNow = useCallback(
    (colors: BaseColor[]) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      setDraftColors(colors);
      updateWorkingColors(colors);
    },
    [updateWorkingColors],
  );

  const errorMessage = error ? t(`bases.errors.${error}`) : null;
  const overwriteWarn = willOverwriteUserPreset(saveModalName);

  const toggleExpanded = () => {
    setExpanded((open) => {
      const next = !open;
      saveExpanded(next);
      return next;
    });
  };

  const mapPatch = (
    colors: BaseColor[],
    index: number,
    patch: Partial<BaseColor>,
  ): BaseColor[] =>
    colors.map((c, i) => {
      if (i !== index) return c;
      const rgb = patch.rgb ?? c.rgb;
      return {
        name: normalizeColorName(patch.name ?? c.name),
        rgb: [
          clampChannel(rgb[0]),
          clampChannel(rgb[1]),
          clampChannel(rgb[2]),
        ] as [number, number, number],
      };
    });

  const patchColorDebounced = (index: number, patch: Partial<BaseColor>) => {
    scheduleDraft(mapPatch(draftRef.current, index, patch));
  };

  const removeColor = (index: number) => {
    commitNow(draftRef.current.filter((_, i) => i !== index));
  };

  const addColor = () => {
    commitNow([
      ...draftRef.current,
      { name: t("bases.newColorName"), rgb: [128, 128, 128] },
    ]);
  };

  const openSaveModal = () => {
    setSaveModalName(selectionLabel);
    setSaveModalOpen(true);
  };

  const handleSaveModalConfirm = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    saveUserPresetFromCurrent(saveModalName, draftRef.current);
    setSaveModalOpen(false);
  };

  const handleExport = () => {
    const json = exportAllUserPresets();
    if (!json || json === '{"version":1,"sets":[]}') return;
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "color-matcher-palettes.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const runImport = (text: string) => {
    const dupes = countDuplicateImportLabels(text);
    const msg =
      dupes > 0
        ? t("bases.importConfirmOverwrite", { count: dupes })
        : t("bases.importConfirm");
    if (!window.confirm(msg)) return;
    importUserPresets(text);
  };

  const handleImportFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") runImport(reader.result);
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const panelHeader = (
    <button
      type="button"
      className="bases-toggle"
      aria-expanded={expanded}
      aria-controls="bases-panel-body"
      onClick={toggleExpanded}
    >
      <span className="bases-chevron" aria-hidden>
        {expanded ? "▾" : "▸"}
      </span>
      <span className="bases-toggle-text">
        <span className="bases-toggle-title">{t("bases.title")}</span>
        {!expanded && selectionLabel && (
          <span className="muted small bases-toggle-meta">
            {selectionLabel} · {draftColors.length}
          </span>
        )}
      </span>
      <span className="sr-only">
        {expanded ? t("bases.collapse") : t("bases.expand")}
      </span>
    </button>
  );

  if (!ready) {
    return (
      <section className="bases-panel">
        {panelHeader}
        {expanded && <p className="muted bases-body">{t("bases.loading")}</p>}
      </section>
    );
  }

  const isServerSelection = selection.type === "server";
  const hasUserSets = sortedUserSets.length > 0;

  return (
    <section className="bases-panel">
      {panelHeader}

      <SavePresetModal
        open={saveModalOpen}
        name={saveModalName}
        onNameChange={setSaveModalName}
        willOverwrite={overwriteWarn}
        onSave={handleSaveModalConfirm}
        onClose={() => setSaveModalOpen(false)}
      />

      {expanded && (
        <div id="bases-panel-body" className="bases-body">
          <p className="muted small bases-intro">{t("bases.subtitle")}</p>

          {errorMessage && (
            <p className="error bases-error" role="alert">
              {errorMessage}
            </p>
          )}

          <div className="bases-block">
            <div className="bases-toolbar">
              <label className="bases-label-inline bases-toolbar-select">
                {t("bases.paletteSelect")}
                <select
                  className="bases-field bases-select"
                  value={selectedKey}
                  onChange={(e) => {
                    flushDraft();
                    void selectByKey(e.target.value);
                  }}
                >
                  {hasUserSets && (
                    <optgroup label={t("bases.userGroup")}>
                      {sortedUserSets.map((s) => (
                        <option key={s.id} value={`user:${s.id}`}>
                          {s.label} ({s.colors.length})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label={t("bases.serverGroup")}>
                    {presets.map((p) => (
                      <option key={p.id} value={`server:${p.id}`}>
                        {p.label} ({p.colorCount})
                      </option>
                    ))}
                  </optgroup>
                </select>
              </label>
              <div className="bases-toolbar-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-sm bases-toolbar-btn"
                  onClick={openSaveModal}
                >
                  {t("bases.makeNewPreset")}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm bases-toolbar-btn"
                  disabled={isServerSelection}
                  title={
                    isServerSelection ? t("bases.deleteSetDisabled") : undefined
                  }
                  onClick={deleteActiveUserPreset}
                >
                  {t("bases.deleteSet")}
                </button>
              </div>
            </div>
            {selection.type === "server" &&
              presets.find((p) => p.id === selection.presetId)?.description && (
                <p className="muted small">
                  {presets.find((p) => p.id === selection.presetId)?.description}
                </p>
              )}
          </div>

          <div className="bases-block">
            <div className="bases-row bases-row-between">
              <h3 className="bases-subtitle">{t("bases.editor")}</h3>
              <span className="muted small">
                {isServerSelection ? t("bases.serverReadOnly") : t("bases.clientOnly")}
              </span>
            </div>
            <ul className="bases-color-list">
              {draftColors.map((c, i) => (
                <li key={`${c.name}-${i}`} className="bases-color-row">
                  <input
                    type="text"
                    className="bases-field bases-name"
                    value={c.name}
                    readOnly={isServerSelection}
                    maxLength={MAX_COLOR_NAME_LENGTH}
                    onChange={(e) =>
                      patchColorDebounced(i, { name: e.target.value })
                    }
                    onBlur={flushDraft}
                    aria-label={t("bases.colorName")}
                  />
                  <ColorHexField
                    rgb={c.rgb}
                    readOnly={isServerSelection}
                    onChange={(rgb) => patchColorDebounced(i, { rgb })}
                    onCommit={flushDraft}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm bases-pick-btn"
                    disabled={isServerSelection || !targetColor}
                    title={
                      isServerSelection
                        ? t("bases.pickDisabledServer")
                        : t("bases.pickTarget")
                    }
                    onClick={() =>
                      targetColor &&
                      commitNow(
                        mapPatch(draftRef.current, i, {
                          rgb: payloadToRgb(targetColor),
                        }),
                      )
                    }
                  >
                    {t("bases.pickTargetShort")}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm bases-pick-btn"
                    disabled={isServerSelection || !paletteColor}
                    title={
                      isServerSelection
                        ? t("bases.pickDisabledServer")
                        : t("bases.pickPalette")
                    }
                    onClick={() =>
                      paletteColor &&
                      commitNow(
                        mapPatch(draftRef.current, i, {
                          rgb: payloadToRgb(paletteColor),
                        }),
                      )
                    }
                  >
                    {t("bases.pickPaletteShort")}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm bases-pick-btn"
                    disabled={isServerSelection}
                    onClick={() => removeColor(i)}
                    title={
                      isServerSelection
                        ? t("bases.removeColorDisabled")
                        : t("bases.removeColor")
                    }
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className="btn btn-ghost btn-sm" onClick={addColor}>
              {t("bases.addColor")}
            </button>
          </div>

          <div className="bases-block bases-io">
            <h3 className="bases-subtitle">{t("bases.importExport")}</h3>
            <div className="bases-row">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={!hasUserSets}
                onClick={handleExport}
              >
                {t("bases.export")}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => fileRef.current?.click()}
              >
                {t("bases.import")}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={(e) => handleImportFile(e.target.files?.[0])}
              />
            </div>
            <p className="muted small">{t("bases.exportHint")}</p>
            <p className="muted small">{t("bases.importHint")}</p>
          </div>
        </div>
      )}
    </section>
  );
}
