import type { MatchResult, MixComponent } from "../api";
import { useTranslation } from "../i18n/I18nProvider";

const MIX_SLOTS = 3;

type Props = {
  match: MatchResult | null;
  error: string | null;
};

function padComponents(components: MixComponent[]): (MixComponent | null)[] {
  const slots: (MixComponent | null)[] = components.slice(0, MIX_SLOTS);
  while (slots.length < MIX_SLOTS) slots.push(null);
  return slots;
}

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
  const slots = padComponents(components);

  return (
    <section className="mix-panel">
      <h2>{t("mix.title")}</h2>
      <p className="muted small mix-sources">
        {t("mix.sources", {
          target: sourceLabel(targetCaptured, "mix.camera1"),
          palette: sourceLabel(paletteCaptured, "mix.camera2"),
        })}
      </p>

      <p className="delta-e-line">
        {t("mix.deltaE")}{" "}
        <strong className="delta-e-value">{deltaE}</strong>
      </p>
      <p className="muted small delta-e-hint">{t("mix.deltaEHint")}</p>

      {!mix.available && (
        <p className="muted mix-unavailable">{mix.message ?? t("mix.noBases")}</p>
      )}

      {mix.available && (
        <div className="mix-body">
          <h3 className="mix-subtitle">{t("mix.pigmentsTitle")}</h3>
          <p className="muted small mix-intro">{t("mix.pigmentsIntro")}</p>
          <p className="mix-practical small">
            {top
              ? t("mix.startWith", {
                  name: top.name,
                  percent: top.percent,
                })
              : t("mix.closeColors")}
          </p>
          <ul className="mix-list mix-list-fixed" aria-label={t("mix.pigmentsTitle")}>
            {slots.map((c, i) => (
              <li
                key={c ? c.name : `slot-${i}`}
                className={`mix-list-item${c ? "" : " mix-list-item-empty"}`}
                aria-hidden={!c}
              >
                <span
                  className="mix-swatch"
                  style={
                    c
                      ? {
                          backgroundColor: `rgb(${c.rgb.r},${c.rgb.g},${c.rgb.b})`,
                        }
                      : undefined
                  }
                  aria-hidden
                />
                <div className="mix-item-body">
                  <div className="mix-item-head">
                    <span className="mix-rank">{i + 1}.</span>
                    {c ? (
                      <>
                        <strong className="mix-item-name">{c.name}</strong>
                        <span className="mix-percent">
                          {t("mix.contribution", { percent: c.percent })}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="mix-item-name mix-item-placeholder">—</span>
                        <span className="mix-percent mix-item-placeholder">—</span>
                      </>
                    )}
                  </div>
                  <div
                    className="mix-bar"
                    role="presentation"
                    style={{ width: c ? `${c.percent}%` : "0%" }}
                  />
                  <span className="muted small mix-item-hint">
                    {c ? (i === 0 ? t("mix.hintMain") : t("mix.hintExtra")) : "\u00a0"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <p className="muted small mix-legend">{t("mix.legend")}</p>
        </div>
      )}
    </section>
  );
}
