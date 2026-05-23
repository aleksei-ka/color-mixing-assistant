import { describe, expect, it } from "vitest";
import { parseHex, rgbToHex } from "./hex";

describe("hex", () => {
  it("round-trips rgb", () => {
    expect(rgbToHex([227, 38, 54])).toBe("#E32636");
    expect(parseHex("#E32636")).toEqual([227, 38, 54]);
  });

  it("rejects invalid hex", () => {
    expect(parseHex("fff")).toBeNull();
    expect(parseHex("gggggg")).toBeNull();
  });
});
