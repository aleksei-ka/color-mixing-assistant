import type { RoiConfig } from "../api";
import { useTranslation } from "../i18n/I18nProvider";

type Props = {
  roi: RoiConfig;
  defaultSize: number;
  onModeChange: (mode: "square" | "polygon") => void;
  onSizeChange: (size: number) => void;
  onReset: () => void;
  onRedraw: () => void;
};

export function RoiControls({
  roi,
  defaultSize,
  onModeChange,
  onSizeChange,
  onReset,
  onRedraw,
}: Props) {
  const { t } = useTranslation();
  const isPolygon = roi.mode === "polygon";
  const polygonClosed = roi.polygonClosed;

  return (
    <div className="roi-controls">
      <div className="roi-mode-row">
        <label className="roi-mode-label">
          <span className="roi-mode-title">{t("roi.region")}</span>
          <select
            value={roi.mode}
            onChange={(e) =>
              onModeChange(e.target.value as "square" | "polygon")
            }
          >
            <option value="square">{t("roi.square")}</option>
            <option value="polygon">{t("roi.polygon")}</option>
          </select>
        </label>

        {!isPolygon && (
          <>
            <label className="roi-size-label">
              {t("roi.size")}
              <input
                type="number"
                min={8}
                max={400}
                step={4}
                value={roi.size}
                onChange={(e) => onSizeChange(Number(e.target.value))}
              />
              <span className="muted small">px</span>
            </label>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              title={t("roi.resetTitle", { size: defaultSize })}
              onClick={onReset}
            >
              {t("roi.reset")}
            </button>
          </>
        )}

        {isPolygon && (
          <>
            <p className="muted small roi-hint-inline">
              {polygonClosed ? t("roi.polygonClosed") : t("roi.polygonOpen")}
            </p>
            {polygonClosed && (
              <button
                type="button"
                className="btn btn-ghost btn-sm roi-redraw-btn"
                onClick={onRedraw}
              >
                {t("roi.redraw")}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
