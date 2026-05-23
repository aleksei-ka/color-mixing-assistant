import type { MatchResult } from "../api";

type Props = {
  match: MatchResult | null;
  error: string | null;
};

function sourceLabel(captured: boolean | undefined, role: string): string {
  return captured ? `${role} (захват)` : `${role} (live)`;
}

export function MixSuggestion({ match, error }: Props) {
  if (error) {
    return (
      <section className="mix-panel">
        <h2>Смешивание и сравнение</h2>
        <p className="error">{error}</p>
      </section>
    );
  }

  if (!match) {
    return (
      <section className="mix-panel">
        <h2>Смешивание и сравнение</h2>
        <p className="muted">Загрузка…</p>
      </section>
    );
  }

  const { mix, deltaE, targetCaptured, paletteCaptured } = match;

  return (
    <section className="mix-panel">
      <h2>Смешивание и сравнение</h2>
      <p className="muted small">
        Цель: {sourceLabel(targetCaptured, "камера 1")} · Палитра:{" "}
        {sourceLabel(paletteCaptured, "камера 2")}
      </p>
      <p>
        ΔE (палитра → цель): <strong>{deltaE}</strong>
        {mix.deltaE_current_to_target != null && (
          <>
            {" "}
            · до цели: <strong>{mix.deltaE_current_to_target}</strong>
          </>
        )}
      </p>

      {!mix.available && (
        <p className="muted">{mix.message ?? "Нет базовых цветов"}</p>
      )}

      {mix.available && mix.components.length > 0 && (
        <ul className="mix-list">
          {mix.components.map((c) => (
            <li key={c.name}>
              <span
                className="mix-swatch"
                style={{
                  backgroundColor: `rgb(${c.rgb.r},${c.rgb.g},${c.rgb.b})`,
                }}
              />
              <span>
                <strong>{c.name}</strong> — ~{c.percent}%
              </span>
            </li>
          ))}
        </ul>
      )}

      {mix.note && <p className="muted small">{mix.note}</p>}
    </section>
  );
}
