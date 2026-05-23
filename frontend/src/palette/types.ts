export type BaseColor = {
  name: string;
  rgb: [number, number, number];
};

export type PaletteSet = {
  id: string;
  label: string;
  colors: BaseColor[];
  /** Server preset id if last applied from server */
  presetId?: string;
};

export type PaletteStoreV1 = {
  version: 1;
  activeId: string;
  sets: PaletteSet[];
};

export type PalettePresetSummary = {
  id: string;
  tag: string;
  category: string;
  label: string;
  description: string;
  colorCount: number;
};

export type PalettePresetsResponse = {
  defaultPresetId: string;
  presets: PalettePresetSummary[];
};

/** Legacy single-set import */
export type PaletteFile = {
  label: string;
  colors: BaseColor[];
};

/** Export all user presets */
export type PaletteExportFile = {
  version: 1;
  sets: { label: string; colors: BaseColor[] }[];
};
