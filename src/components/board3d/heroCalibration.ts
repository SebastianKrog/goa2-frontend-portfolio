export interface CalibrationHeroPlacement {
  id: string;
  heroKey: string;
  team: string;
}

export interface CalibrationHeroUnit extends CalibrationHeroPlacement {
  displayKey: string;
}

export interface HeroAssetPaths {
  gltfPath: string;
  originalGltfPath?: string;
}

/** Archived models are a calibration aid and must never replace normal gameplay assets. */
export function resolveHeroGltfPath(
  hero: HeroAssetPaths,
  calibrate: boolean,
  useArchivedOriginal: boolean,
): string {
  if (calibrate && useArchivedOriginal && hero.originalGltfPath) {
    return hero.originalGltfPath;
  }
  return hero.gltfPath;
}

export function resolveHeroRenderConfig<T extends HeroAssetPaths>(
  current: T,
  legacy: T | undefined,
  useLegacy: boolean,
  calibrate: boolean,
  useArchivedOriginal: boolean,
): { config: T; gltfPath: string } {
  if (useLegacy && legacy) {
    return { config: legacy, gltfPath: legacy.gltfPath };
  }
  return {
    config: current,
    gltfPath: resolveHeroGltfPath(current, calibrate, useArchivedOriginal),
  };
}

/**
 * Resolves visual-only hero replacements for model calibration.
 *
 * URL swaps retain the existing sorted-unit behavior for compatibility.
 * Interactive selections take precedence and invalid model keys are ignored so
 * a typo cannot make a live board unit disappear.
 */
export function buildHeroDisplayMap(
  placements: CalibrationHeroPlacement[],
  urlSwaps: string[],
  interactiveSwaps: Record<string, string>,
  validHeroKeys: string[],
): Map<string, string> {
  const valid = new Set(validHeroKeys);
  const byId = new Map(placements.map((placement) => [placement.id, placement]));
  const result = new Map(
    placements.map((placement) => [placement.id, placement.heroKey]),
  );

  [...byId.keys()].sort().forEach((id, index) => {
    const modelKey = urlSwaps[index];
    if (modelKey && valid.has(modelKey)) result.set(id, modelKey);
  });

  for (const [id, modelKey] of Object.entries(interactiveSwaps)) {
    if (byId.has(id) && valid.has(modelKey)) result.set(id, modelKey);
  }
  return result;
}

export function buildCalibrationHeroUnits(
  placements: CalibrationHeroPlacement[],
  displayMap: Map<string, string>,
): CalibrationHeroUnit[] {
  return placements
    .map((placement) => ({
      ...placement,
      displayKey: displayMap.get(placement.id) ?? placement.heroKey,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

/** Serializes the display map in the legacy sorted-unit order used by `swap=`. */
export function heroSwapQueryValues(
  placements: CalibrationHeroPlacement[],
  displayMap: Map<string, string>,
): string[] {
  const sorted = [...placements].sort((left, right) => left.id.localeCompare(right.id));
  const values = sorted.map(
    (placement) => displayMap.get(placement.id) ?? placement.heroKey,
  );
  while (
    values.length > 0
    && values.at(-1) === sorted[values.length - 1].heroKey
  ) {
    values.pop();
  }
  return values;
}
