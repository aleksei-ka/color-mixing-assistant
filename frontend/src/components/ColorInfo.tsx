import { useState } from "react";
import type { ColorPayload } from "../api";
import { useTranslation } from "../i18n/I18nProvider";

type PanelKey = "target" | "palette";

type Props = {
  panelKey: PanelKey;
  title: string;
  color: ColorPayload | null;
};

const STORAGE_KEY: Record<PanelKey, string> = {
  target: "colorMatcher.colorInfo.target",
  palette: "colorMatcher.colorInfo.palette",
};

function loadExpanded(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function saveExpanded(key: string, open: boolean) {
  try {
    localStorage.setItem(key, open ? "1" : "0");
  } catch {
    /* private mode */
  }
}

export function ColorInfo({ panelKey, title, color }: Props) {
  const { t } = useTranslation();
  const storageKey = STORAGE_KEY[panelKey];
  const [expanded, setExpanded] = useState(() => loadExpanded(storageKey));

  const toggle = () => {
    setExpanded((open) => {
      const next = !open;
      saveExpanded(storageKey, next);
      return next;
    });
  };

  const collapsedMeta = color
    ? `${color.hex} · RGB ${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b}`
    : null;

  return (
    <div className="color-info">
      <button
        type="button"
        className="color-info-toggle"
        aria-expanded={expanded}
        onClick={toggle}
      >
        <span className="bases-chevron" aria-hidden>
          {expanded ? "▾" : "▸"}
        </span>
        <span className="color-info-toggle-text">
          <span className="color-info-title">{title}</span>
          <span className="muted small color-info-subtitle">
            {t("color.detailHint")}
          </span>
          {!expanded && collapsedMeta && (
            <span className="muted small color-info-meta">{collapsedMeta}</span>
          )}
        </span>
        <span className="sr-only">
          {expanded ? t("bases.collapse") : t("bases.expand")}
        </span>
      </button>

      {expanded && (
        <div className="color-info-body">
          {!color ? (
            <p className="muted">{t("color.waiting")}</p>
          ) : (
            <dl>
              <div>
                <dt>HEX</dt>
                <dd>{color.hex}</dd>
              </div>
              <div>
                <dt>RGB</dt>
                <dd>
                  {color.rgb.r}, {color.rgb.g}, {color.rgb.b}
                </dd>
              </div>
              <div>
                <dt>HSL</dt>
                <dd>
                  {color.hsl.h}°, {color.hsl.s}%, {color.hsl.l}%
                </dd>
              </div>
              <div>
                <dt>Lab</dt>
                <dd>
                  L*{color.lab.l} a*{color.lab.a} b*{color.lab.b}
                </dd>
              </div>
              <div>
                <dt>CMYK</dt>
                <dd className="muted">
                  {t("color.cmykHint", {
                    c: color.cmyk.c,
                    m: color.cmyk.m,
                    y: color.cmyk.y,
                    k: color.cmyk.k,
                  })}
                </dd>
              </div>
            </dl>
          )}
        </div>
      )}
    </div>
  );
}
