import type { MapConfig } from "./types";
import { forgottenIsland } from "./forgotten_island";
import { narrowPassages } from "./narrow_passages";
import { acrossTheRiver } from "./across_the_river";
import { vexingCliffs } from "./vexing_cliffs";
import { vexingCliffsV2 } from "./vexing_cliffs_v2";
import { magmaAndIce } from "./magma_and_ice";

/**
 * Every calibrated map, keyed by the engine's board.map name. Adding a map is a
 * new file here plus a line in this record; the four calibration numbers come
 * from the map editor's align step.
 */
export const MAPS: Record<string, MapConfig> = {
  forgotten_island: forgottenIsland,
  narrow_passages: narrowPassages,
  across_the_river: acrossTheRiver,
  vexing_cliffs: vexingCliffs,
  vexing_cliffs_v2: vexingCliffsV2,
  magma_and_ice: magmaAndIce,
};

/** Used when the engine names a map we have no art or calibration for yet. */
export const FALLBACK_MAP = forgottenIsland;

export function mapConfigFor(name: string | null | undefined): MapConfig {
  return (name ? MAPS[name] : undefined) ?? FALLBACK_MAP;
}
