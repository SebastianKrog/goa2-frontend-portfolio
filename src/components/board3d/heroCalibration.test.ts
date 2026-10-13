import { describe, expect, it } from "vitest";
import {
  buildCalibrationHeroUnits,
  buildHeroDisplayMap,
  heroSwapQueryValues,
  resolveHeroGltfPath,
  resolveHeroRenderConfig,
  type CalibrationHeroPlacement,
} from "./heroCalibration";

const placements: CalibrationHeroPlacement[] = [
  { id: "hero_min", heroKey: "min", team: "RED" },
  { id: "hero_bain", heroKey: "bain", team: "BLUE" },
];
const validKeys = ["bain", "min", "wuk"];

describe("resolveHeroGltfPath", () => {
  const hero = {
    gltfPath: "/models/heroes/min.glb",
    originalGltfPath: "/models/heroes/original/min.glb",
  };

  it("loads the archive only when explicitly selected in calibration", () => {
    expect(resolveHeroGltfPath(hero, true, true)).toBe(hero.originalGltfPath);
    expect(resolveHeroGltfPath(hero, true, false)).toBe(hero.gltfPath);
  });

  it("ignores an original-model URL selection during normal gameplay", () => {
    expect(resolveHeroGltfPath(hero, false, true)).toBe(hero.gltfPath);
  });

  it("falls back to current when no archive exists", () => {
    expect(resolveHeroGltfPath({ gltfPath: "/models/heroes/wuk.glb" }, true, true))
      .toBe("/models/heroes/wuk.glb");
  });
});

describe("resolveHeroRenderConfig", () => {
  const current = {
    gltfPath: "/models/heroes/min.glb",
    originalGltfPath: "/models/heroes/original/min.glb",
    rotationDeg: 184,
  };
  const legacy = {
    gltfPath: "/models/heroes/original/min.glb",
    rotationDeg: 34,
  };

  it("uses the archived model and legacy transform together", () => {
    expect(resolveHeroRenderConfig(current, legacy, true, false, false)).toEqual({
      config: legacy,
      gltfPath: legacy.gltfPath,
    });
  });

  it("keeps painted transforms when legacy mode is off", () => {
    expect(resolveHeroRenderConfig(current, legacy, false, false, false)).toEqual({
      config: current,
      gltfPath: current.gltfPath,
    });
  });

  it("still supports per-unit archived assets during calibration", () => {
    expect(resolveHeroRenderConfig(current, legacy, false, true, true)).toEqual({
      config: current,
      gltfPath: current.originalGltfPath,
    });
  });
});

describe("buildHeroDisplayMap", () => {
  it("keeps URL swap compatibility by assigning models to sorted unit ids", () => {
    const result = buildHeroDisplayMap(placements, ["wuk", "min"], {}, validKeys);

    expect(result.get("hero_bain")).toBe("wuk");
    expect(result.get("hero_min")).toBe("min");
  });

  it("lets the live calibration picker override URL swaps", () => {
    const result = buildHeroDisplayMap(
      placements,
      ["wuk", "wuk"],
      { hero_min: "bain" },
      validKeys,
    );

    expect(result.get("hero_bain")).toBe("wuk");
    expect(result.get("hero_min")).toBe("bain");
  });

  it("ignores unknown models and units instead of hiding board heroes", () => {
    const result = buildHeroDisplayMap(
      placements,
      ["missing"],
      { hero_min: "also_missing", hero_unknown: "wuk" },
      validKeys,
    );

    expect(result.get("hero_bain")).toBe("bain");
    expect(result.get("hero_min")).toBe("min");
    expect(result.has("hero_unknown")).toBe(false);
  });
});

describe("buildCalibrationHeroUnits", () => {
  it("returns stable sorted picker rows with the displayed model", () => {
    const displayMap = new Map([
      ["hero_min", "wuk"],
      ["hero_bain", "bain"],
    ]);

    expect(buildCalibrationHeroUnits(placements, displayMap)).toEqual([
      { id: "hero_bain", heroKey: "bain", displayKey: "bain", team: "BLUE" },
      { id: "hero_min", heroKey: "min", displayKey: "wuk", team: "RED" },
    ]);
  });
});

describe("heroSwapQueryValues", () => {
  it("persists the picker state using the URL's stable sorted-unit order", () => {
    expect(heroSwapQueryValues(
      placements,
      new Map([
        ["hero_bain", "wuk"],
        ["hero_min", "bain"],
      ]),
    )).toEqual(["wuk", "bain"]);
  });

  it("removes redundant original models from the end of the URL", () => {
    expect(heroSwapQueryValues(
      placements,
      new Map([
        ["hero_bain", "wuk"],
        ["hero_min", "min"],
      ]),
    )).toEqual(["wuk"]);

    expect(heroSwapQueryValues(
      placements,
      new Map([
        ["hero_bain", "bain"],
        ["hero_min", "min"],
      ]),
    )).toEqual([]);
  });
});
