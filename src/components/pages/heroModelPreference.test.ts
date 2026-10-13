import { describe, expect, it } from "vitest";
import { HERO_MODEL_STYLE_KEY, readLegacyHeroModelPreference } from "./heroModelPreference";

describe("hero model preference", () => {
  it("defaults to legacy models when no preference is stored", () => {
    expect(readLegacyHeroModelPreference({ getItem: () => null })).toBe(true);
  });

  it("keeps an explicit painted preference", () => {
    expect(readLegacyHeroModelPreference({ getItem: (key) => key === HERO_MODEL_STYLE_KEY ? "painted" : null })).toBe(false);
  });

  it("treats the legacy preference and unknown values as legacy", () => {
    expect(readLegacyHeroModelPreference({ getItem: () => "legacy" })).toBe(true);
    expect(readLegacyHeroModelPreference({ getItem: () => "unexpected" })).toBe(true);
  });
});
