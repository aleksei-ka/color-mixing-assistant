import { describe, expect, it } from "vitest";
import en from "./locales/en.json";
import ru from "./locales/ru.json";

function keysFlat(obj: Record<string, unknown>, prefix = ""): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "object" && v !== null) {
      out.push(...keysFlat(v as Record<string, unknown>, path));
    } else {
      out.push(path);
    }
  }
  return out;
}

describe("i18n locale parity", () => {
  const enKeys = new Set(keysFlat(en));
  const ruKeys = new Set(keysFlat(ru));

  it("ru has all en keys", () => {
    for (const key of enKeys) {
      expect(ruKeys.has(key), `missing ru: ${key}`).toBe(true);
    }
  });

  it("en has all ru keys", () => {
    for (const key of ruKeys) {
      expect(enKeys.has(key), `missing en: ${key}`).toBe(true);
    }
  });
});
