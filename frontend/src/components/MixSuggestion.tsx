import type { MatchResult } from "../api";
import { useTranslation } from "../i18n/I18nProvider";

type Props = {
  match: MatchResult | null;
  error: string | null;
};

export function MixSuggestion({ match, error }: Props) {
  const { t } = useTranslation();

  const sourceLabel = (captured: boolean | undefined, roleKey: string) =>
    captured
      ? t("mix.sourceCaptured", { role: t(roleKey) })
      : t("mix.sourceLive", { role: t(roleKey) });

  if (error) {
    return (
      <section className="mix-panel">
        <h2>{t("mix.title")}</h2>
        <p className="error">{error}</p>
      </section>
    );
  }

  if (!match) {
    return (
      <section className="mix-panel">
        <h2>{t("mix.title")}</h2>
        <p className="muted">{t("mix.loading")}</p>
      </section>
    );
  }

  const { mix, deltaE, targetCaptured, paletteCaptured } = match;
  const components = mix.components;
  const top = components[0];

  return (
    <section className="mix-panel">
      <h2>{t("mix.title")}</h2>
      <p className="muted small">
        {t("mix.sources", {
          target: sourceLabel(targetCaptured, "mix.camera1"),
          palette: sourceLabel(paletteCaptured, "mix.camera2"),
        })}
      </p>

      <p className="delta-e-line">
        {t("mix.deltaE")} <strong>{deltaE}</strong>
      </p>
      <p className="muted small delta-e-hint">{t("mix.deltaEHint")}</p>

      {!mix.available && (
        <p className="muted">{mix.message ?? t("mix.noBases")}</p>
      )}

      {mix.available && components.length > 0 && (
        <>
          <h3 className="mix-subtitle">{t("mix.pigmentsTitle")}</h3>
          <p className="muted small mix-intro">{t("mix.pigmentsIntro")}</p>
          {top && (
            <p className="mix-practical small">
              {t("mix.startWith", {
                name: top.name,
                percent: top.percent,
              })}
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
                    <span className="mix-percent">
                      {t("mix.contribution", { percent: c.percent })}
                    </span>
                  </div>
                  <div
                    className="mix-bar"
                    role="presentation"
                    style={{ width: `${c.percent}%` }}
                  />
                  <span className="muted small mix-item-hint">
                    {i === 0 ? t("mix.hintMain") : t("mix.hintExtra")}
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
