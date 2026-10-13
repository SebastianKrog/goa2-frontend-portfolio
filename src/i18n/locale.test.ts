import { afterEach, describe, expect, it, vi } from "vitest";
import { ensureCardTextReady, getHeroName, resetCardText } from "./cardText";
import { setLocale, SUPPORTED_LOCALES } from "./locale";

afterEach(() => {
  setLocale("en");
  resetCardText();
  vi.unstubAllGlobals();
});

describe("supported card locales", () => {
  it("offers the vendored Simplified Chinese catalog", () => {
    expect(SUPPORTED_LOCALES).toContain("zh-Hans");
  });

  it("resolves backend-prefixed hero ids against catalog slugs", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({
        schemaVersion: 1,
        locale: "zh-Hans",
        heroNames: { arien: "阿里恩" },
        cards: {},
      }),
    })));

    setLocale("zh-Hans");
    await ensureCardTextReady();

    expect(getHeroName("hero_arien")).toBe("阿里恩");
    expect(getHeroName("arien")).toBe("阿里恩");
  });
});
