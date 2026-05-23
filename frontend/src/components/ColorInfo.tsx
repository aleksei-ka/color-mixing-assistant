import type { ColorPayload } from "../api";

type Props = {
  label: string;
  color: ColorPayload | null;
};

export function ColorInfo({ label, color }: Props) {
  if (!color) {
    return (
      <div className="color-info">
        <h3>{label}</h3>
        <p className="muted">Ожидание кадра…</p>
      </div>
    );
  }

  const { rgb, hex, hsl, lab, cmyk } = color;

  return (
    <div className="color-info">
      <h3>{label}</h3>
      <dl>
        <div>
          <dt>HEX</dt>
          <dd>{hex}</dd>
        </div>
        <div>
          <dt>RGB</dt>
          <dd>
            {rgb.r}, {rgb.g}, {rgb.b}
          </dd>
        </div>
        <div>
          <dt>HSL</dt>
          <dd>
            {hsl.h}°, {hsl.s}%, {hsl.l}%
          </dd>
        </div>
        <div>
          <dt>Lab</dt>
          <dd>
            L*{lab.l} a*{lab.a} b*{lab.b}
          </dd>
        </div>
        <div>
          <dt>CMYK</dt>
          <dd className="muted">
            {cmyk.c}% / {cmyk.m}% / {cmyk.y}% / {cmyk.k}% (оценка с экрана)
          </dd>
        </div>
      </dl>
    </div>
  );
}
