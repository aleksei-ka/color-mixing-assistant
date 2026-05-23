import type { RoiConfig } from "../api";

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
  const isPolygon = roi.mode === "polygon";
  const polygonClosed = roi.polygonClosed;

  return (
    <div className="roi-controls">
      <div className="roi-mode-row">
        <label className="roi-mode-label">
          <span className="roi-mode-title">Область</span>
          <select
            value={roi.mode}
            onChange={(e) =>
              onModeChange(e.target.value as "square" | "polygon")
            }
          >
            <option value="square">Квадрат</option>
            <option value="polygon">По точкам</option>
          </select>
        </label>

        {!isPolygon && (
          <>
            <label className="roi-size-label">
              Размер
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
              title={`Сбросить к ${defaultSize} px`}
              onClick={onReset}
            >
              ↺ Сброс
            </button>
          </>
        )}

        {isPolygon && (
          <>
            <p className="muted small roi-hint-inline">
              {polygonClosed
                ? "Произвольная область выбрана."
                : "Кликните точки на кадре. Замкните кликом по первой точке."}
            </p>
            {polygonClosed && (
              <button
                type="button"
                className="btn btn-ghost btn-sm roi-redraw-btn"
                onClick={onRedraw}
              >
                Рисовать заново
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
