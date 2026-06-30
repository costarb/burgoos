import { describe, expect, it } from "vitest";
import {
  BUILT_IN_LAYOUT_PRESETS,
  DEFAULT_LAYOUT_PRESET_KEY,
  getLayoutPreset,
  isActiveLayoutPreset,
  toLayoutPresetKey,
} from "../src/customer-experience/branding/layout-presets";

describe("layout presets", () => {
  it("exposes the approved public menu presets", () => {
    expect(BUILT_IN_LAYOUT_PRESETS.map((preset) => preset.key)).toEqual([
      "classic",
      "compact",
      "visual",
    ]);
  });

  it("validates active preset keys", () => {
    expect(isActiveLayoutPreset("classic")).toBe(true);
    expect(isActiveLayoutPreset("compact")).toBe(true);
    expect(isActiveLayoutPreset("visual")).toBe(true);
    expect(isActiveLayoutPreset("builder")).toBe(false);
  });

  it("falls back to classic when an unavailable preset is requested", () => {
    expect(DEFAULT_LAYOUT_PRESET_KEY).toBe("classic");
    expect(toLayoutPresetKey("builder")).toBe("classic");
    expect(getLayoutPreset(null).key).toBe("classic");
  });
});
