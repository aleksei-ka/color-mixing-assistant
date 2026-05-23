import { describe, expect, it } from "vitest";
import { labelExists, createSet } from "./storage";
import {
  MAX_COLOR_NAME_LENGTH,
  MIN_USER_PALETTE_COLORS,
  normalizeColorName,
  normalizeHexInput,
  parseImportPayload,
} from "./validate";

describe("parseImportPayload", () => {
  it("parses export bundle", () => {
    const items = parseImportPayload({
      version: 1,
      sets: [
        { label: "A", colors: [{ name: "Red", rgb: [1, 2, 3] }] },
        { label: "B", colors: [{ name: "Blue", rgb: [4, 5, 6] }] },
      ],
    });
    expect(items).toHaveLength(2);
  });

  it("parses legacy single set", () => {
    const items = parseImportPayload({
      label: "Solo",
      colors: [{ name: "X", rgb: [10, 20, 30] }],
    });
    expect(items).toHaveLength(1);
    expect(items[0]!.label).toBe("Solo");
  });
});

describe("normalizeColorName", () => {
  it("truncates to max length", () => {
    const long = "a".repeat(200);
    expect(normalizeColorName(long).length).toBe(MAX_COLOR_NAME_LENGTH);
  });
});

describe("MIN_USER_PALETTE_COLORS", () => {
  it("requires at least three colors in a user set", () => {
    expect(MIN_USER_PALETTE_COLORS).toBe(3);
  });
});

describe("normalizeHexInput", () => {
  it("accepts shorthand hex", () => {
    expect(normalizeHexInput("#F00")).toEqual([255, 0, 0]);
  });
});

describe("labelExists", () => {
  it("is case-insensitive among user sets", () => {
    const a = createSet("Studio", [{ name: "A", rgb: [1, 2, 3] }]);
    const store = { version: 1 as const, activeId: a.id, sets: [a] };
    expect(labelExists(store.sets, "studio")).toBe(true);
    expect(labelExists(store.sets, "Other")).toBe(false);
  });
});
