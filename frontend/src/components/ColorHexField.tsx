import type { CSSProperties } from "react";
import { useTranslation } from "../i18n/I18nProvider";
import { parseHex, rgbToHex } from "../palette/hex";

type Props = {
  rgb: [number, number, number];
  readOnly?: boolean;
  onChange: (rgb: [number, number, number]) => void;
  onCommit?: () => void;
};

/** Native color picker; HEX label drawn inside the swatch. */
export function ColorHexField({
  rgb,
  readOnly = false,
  onChange,
  onCommit,
}: Props) {
  const { t } = useTranslation();
  const hex = rgbToHex(rgb);
  const pickerValue = `#${hex.slice(1).toLowerCase()}`;
  const bg = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
  const style = { "--picker-bg": bg } as CSSProperties;

  return (
    <div
      className={`bases-color-picker-wrap${readOnly ? " is-readonly" : ""}`}
      style={style}
    >
      <div className="bases-color-picker-face" aria-hidden />
      <span className="bases-picker-hex">{hex}</span>
      {!readOnly && (
        <input
          type="color"
          className="bases-color-picker-input"
          value={pickerValue}
          aria-label={`${t("bases.hex")}: ${hex}`}
          onChange={(e) => {
            const parsed = parseHex(e.target.value);
            if (parsed) onChange(parsed);
          }}
          onBlur={() => onCommit?.()}
        />
      )}
    </div>
  );
}
