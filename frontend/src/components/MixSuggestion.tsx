import { useEffect, useState } from "react";
import type { MatchResult, MixComponent } from "../api";
import { useTranslation } from "../i18n/I18nProvider";
import {
  applyPreciseMatchUpdate,
  type PreciseMatchState,
} from "../utils/preciseMatch";

const MIX_SLOTS = 3;
const STORAGE_PRECISE = "colorMatcher.mixPreciseMode";

function loadPreciseMode(): boolean {
  try {
    const v = localStorage.getItem(STORAGE_PRECISE);
    if (v === null) return true;
    return v === "1";
  } catch {
    return true;
  }
}

function savePreciseMode(on: boolean) {
  try {
    localStorage.setItem(STORAGE_PRECISE, on ? "1" : "0");
  } catch {
    /* private mode */
  }
}

const EMPTY_PRECISE: PreciseMatchState = {
  displayed: null,
  baselineDeltaE: null,
  lastColorsKey: null,
};

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
  const [preciseMode, setPreciseMode] = useState(loadPreciseMode);
  const [preciseState, setPreciseState] = useState<PreciseMatchState>(EMPTY_PRECISE);

  useEffect(() => {
    if (!match) {
      setPreciseState(EMPTY_PRECISE);
      return;
    }
    if (!preciseMode) {
      setPreciseState({
        displayed: match,
        baselineDeltaE: null,
        lastColorsKey: null,
      });
      return;
    }
    setPreciseState((prev) => {
      if (prev.baselineDeltaE === null) {
        return applyPreciseMatchUpdate(match, EMPTY_PRECISE);
      }
      return applyPreciseMatchUpdate(match, prev);
    });
  }, [match, preciseMode]);

  const togglePreciseMode = () => {
    setPreciseMode((on) => {
      const next = !on;
      savePreciseMode(next);
      return next;
    });
  };

  const sourceLabel = (captured: boolean | undefined, roleKey: string) =>
    captured
      ? t("mix.sourceCaptured", { role: t(roleKey) })
      : t("mix.sourceLive", { role: t(roleKey) });

  if (error) {
    return (
      <section className="mix-panel">
        <div className="mix-panel-head">
          <h2>{t("mix.title")}</h2>
        </div>
        <p className="error">{error}</p>
      </section>
    );
  }

  if (!match) {
    return (
      <section className="mix-panel">
        <div className="mix-panel-head">
          <h2>{t("mix.title")}</h2>
          <label className="mix-precise-toggle">
            <input
              type="checkbox"
              checked={preciseMode}
              onChange={togglePreciseMode}
            />
            <span>{t("mix.preciseMode")}</span>
          </label>
        </div>
        <p className="muted">{t("mix.loading")}</p>
      </section>
    );
  }

  const view = preciseMode ? (preciseState.displayed ?? match) : match;
  const { mix, deltaE, targetCaptured, paletteCaptured } = view;
  const components = mix.components;
  const top = components[0];
  const slots = padComponents(components);

  return (
    <section className="mix-panel">
      <div className="mix-panel-head">
        <h2>{t("mix.title")}</h2>
        <label className="mix-precise-toggle" title={t("mix.preciseModeHint")}>
          <input
            type="checkbox"
            checked={preciseMode}
            onChange={togglePreciseMode}
          />
          <span>{t("mix.preciseMode")}</span>
        </label>
      </div>
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
