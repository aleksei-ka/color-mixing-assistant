import type { BaseColor } from "./types";

export function colorsEqual(a: BaseColor[], b: BaseColor[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((c, i) => {
    const o = b[i]!;
    return (
      c.name === o.name &&
      c.rgb[0] === o.rgb[0] &&
      c.rgb[1] === o.rgb[1] &&
      c.rgb[2] === o.rgb[2]
    );
  });
}
