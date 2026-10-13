import { describe, expect, it } from "vitest";
import { HERO_MODELS, LEGACY_HERO_MODELS, trinketsTurretModelPath } from ".";

describe("archived hero models", () => {
  it("exposes archived originals for every painted replacement", () => {
    const heroesWithoutArchive = Object.entries(HERO_MODELS)
      .filter(([, config]) => !config.originalGltfPath)
      .map(([key]) => key);

    expect(heroesWithoutArchive).toEqual([]);
  });

  it("uses the archived asset path for legacy replacements", () => {
    for (const [key, config] of Object.entries(HERO_MODELS)) {
      if (!config.originalGltfPath) continue;
      expect(config.originalGltfPath).toBe(`/models/heroes/original/${key}.glb`);
      expect(LEGACY_HERO_MODELS[key].gltfPath).toBe(config.originalGltfPath);
    }
  });

  it("switches Trinkets' turret with the legacy hero set", () => {
    expect(trinketsTurretModelPath(false)).toBe("/models/heroes/turret_trinkets.glb");
    expect(trinketsTurretModelPath(true))
      .toBe("/models/heroes/original/turret_trinkets.glb");
  });

  it("stores the reviewed calibration for the latest painted models", () => {
    expect(HERO_MODELS.brynn).toMatchObject({
      scale: 1.3,
      xOffset: 0,
      yOffset: -0.05,
      zOffset: 0,
      rotationDeg: 90,
    });
    expect(HERO_MODELS.hanu).toMatchObject({
      scale: 1.3,
      xOffset: -0.065,
      yOffset: -0.295,
      zOffset: 0.05,
      rotationDeg: 261,
    });
    expect(HERO_MODELS.wuk).toMatchObject({
      scale: 1.3,
      xOffset: 0,
      yOffset: -0.05,
      zOffset: 0,
      rotationDeg: 256,
    });
    expect(HERO_MODELS.trinkets).toMatchObject({
      scale: 1.3,
      xOffset: 0,
      yOffset: -0.05,
      zOffset: 0,
      rotationDeg: 67,
    });
  });

  it("keeps model brightness neutral until individually calibrated", () => {
    const calibratedBrightness = {
      arien: 2.55,
      brynn: 2.5,
      garrus: 1.35,
      takahide: 1.45,
      tigerclaw: 3,
      wuk: 2.35,
    };

    for (const [key, brightness] of Object.entries(calibratedBrightness)) {
      expect(HERO_MODELS[key].brightness).toBe(brightness);
    }
    expect(Object.entries(HERO_MODELS)
      .filter(([key]) => !(key in calibratedBrightness))
      .every(([, model]) => model.brightness === 1)).toBe(true);
    expect(Object.values(LEGACY_HERO_MODELS).every((model) => model.brightness === 1)).toBe(true);
  });

  it("preserves the complete transform snapshot from master at 0bc2c0e", () => {
    const transforms = Object.entries(LEGACY_HERO_MODELS).map(([key, config]) => [
      key,
      config.scale,
      config.xOffset,
      config.yOffset,
      config.zOffset,
      config.rotationDeg,
    ]);

    expect(transforms).toEqual([
      ["arien", 1.3, 0, -0.05, 0, 319],
      ["bain", 1.3, 0, -0.05, 0, 35],
      ["brogan", 1.3, 0, -0.05, 0, 218],
      ["brynn", 1.3, 0, -0.05, 0, 74],
      ["cutter", 1.3, 0, -0.05, 0, 227],
      ["dodger", 1.3, 0, -0.05, 0, 20],
      ["emmitt", 1.3, 0, -0.05, 0, 0],
      ["garrus", 1.3, 0, -0.05, 0, 123],
      ["gydion", 1.3, 0, -0.05, 0, 326],
      ["hanu", 1.3, -0.065, -0.295, 0.05, 341],
      ["ignatia", 1.3, 0, -0.05, 0, 170],
      ["min", 1.3, 0, -0.05, 0, 34],
      ["misa", 1.3, 0, -0.05, 0, 190],
      ["mortimer", 1.3, 0, -0.05, 0, 53],
      ["mrak", 1.3, 0, -0.05, 0, 178],
      ["nebkher", 1.3, 0, -0.05, 0, 326],
      ["razzle", 1.3, 0, -0.05, 0, 12],
      ["rowenna", 1.3, -0.055, -0.340, -0.060, 41],
      ["sabina", 1.3, 0, -0.05, 0, 23],
      ["silverarrow", 1.3, 0, -0.05, 0, 275],
      ["snorri", 1.3, 0, -0.05, 0, 329],
      ["swift", 1.3, 0, -0.05, 0, 251],
      ["takahide", 1.3, 0, -0.05, 0, 204],
      ["tali", 1.3, 0, -0.05, 0, 112],
      ["tigerclaw", 1.3, 0, -0.05, 0, 70],
      ["trinkets", 1.3, 0, -0.05, 0, 313],
      ["ursafar", 1.3, 0, -0.05, 0, 14],
      ["wasp", 1.3, 0, -0.05, 0, 32],
      ["whisper", 1.3, 0, -0.05, 0, 138],
      ["widget", 1.3, 0, -0.05, 0, 304],
      ["wuk", 1.3, 0, -0.05, 0, 255],
      ["xargatha", 1.3, 0, -0.05, 0, 94],
    ]);
  });
});
