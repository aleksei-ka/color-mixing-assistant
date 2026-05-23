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
  const components = mix.components;
  const top = components[0];

  return (
    <section className="mix-panel">
      <h2>Смешивание и сравнение</h2>
      <p className="muted small">
        Цель: {sourceLabel(targetCaptured, "камера 1")} · Палитра:{" "}
        {sourceLabel(paletteCaptured, "камера 2")}
      </p>

      <p className="delta-e-line">
        ΔE (палитра ↔ цель): <strong>{deltaE}</strong>
      </p>
      <p className="muted small delta-e-hint">
        Насколько отличаются цвета для глаза: &lt;2 — почти совпадают, 2–5 —
        заметно, &gt;10 — сильно разные.
      </p>

      {!mix.available && (
        <p className="muted">{mix.message ?? "Нет базовых цветов"}</p>
      )}

      {mix.available && components.length > 0 && (
        <>
          <h3 className="mix-subtitle">Какие пигменты добавить к палитре</h3>
          <p className="muted small mix-intro">
            Список — до трёх красок из вашего набора, которые сильнее всего
            сдвигают <strong>текущий цвет палитры</strong> к{" "}
            <strong>образцу</strong>. Проценты в сумме дают 100% только у этих
            строк: это <em>важность</em>, а не «столько миллилитров».
          </p>
          {top && (
            <p className="mix-practical small">
              Начните с <strong>{top.name}</strong> ({top.percent}%) — добавляйте
              понемногу, снова снимайте палитру камерой.
            </p>
          )}
          <ul className="mix-list">
            {components.map((c, i) => (
              <li key={c.name} className="mix-list-item">
                <span
                  className="mix-swatch"
                  style={{
                    backgroundColor: `rgb(${c.rgb.r},${c.rgb.g},${c.rgb.b})`,
                  }}
                  aria-hidden
                />
                <div className="mix-item-body">
                  <div className="mix-item-head">
                    <span className="mix-rank">{i + 1}.</span>
                    <strong>{c.name}</strong>
                    <span className="mix-percent">вклад ~{c.percent}%</span>
                  </div>
                  <div
                    className="mix-bar"
                    role="presentation"
                    style={{ width: `${c.percent}%` }}
                  />
                  <span className="muted small mix-item-hint">
                    {i === 0
                      ? "главный пигмент для сдвига к образцу"
                      : "дополнительно"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          {mix.legend && (
            <p className="muted small mix-legend">{mix.legend}</p>
          )}
        </>
      )}
    </section>
  );
}
