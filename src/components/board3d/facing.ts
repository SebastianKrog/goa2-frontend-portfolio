import type { Hex } from "../../types/game";
import { hexToLocal } from "./maps/geometry";

export interface FacingPlacement {
  id: string;
  hex: Hex;
  team: string;
}

const hexDistance = (left: Hex, right: Hex) => (
  Math.abs(left.q - right.q)
  + Math.abs(left.r - right.r)
  + Math.abs(left.s - right.s)
) / 2;

function nearestEnemyHex(
  unit: FacingPlacement,
  candidates: FacingPlacement[],
): Hex | null {
  let target: Hex | null = null;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    if (candidate.team === unit.team) continue;
    const distance = hexDistance(unit.hex, candidate.hex);
    if (distance < bestDistance) {
      bestDistance = distance;
      target = candidate.hex;
    }
  }
  return target;
}

/**
 * Chooses the board object each hero faces. Enemy heroes retain priority over
 * minions, matching the existing board behavior even when a minion is nearer.
 */
export function buildHeroFacingTargets(
  heroes: FacingPlacement[],
  minions: FacingPlacement[],
): Map<string, Hex> {
  const targets = new Map<string, Hex>();
  for (const hero of heroes) {
    const target = nearestEnemyHex(hero, heroes) ?? nearestEnemyHex(hero, minions);
    if (target) targets.set(hero.id, target);
  }
  return targets;
}

/** Returns the Y-axis heading from one board hex to another. */
export function lookAtHexDeg(from: Hex, target: Hex, hexSize: number): number {
  const [fromX, fromZ] = hexToLocal(from, hexSize);
  const [targetX, targetZ] = hexToLocal(target, hexSize);
  return (Math.atan2(targetX - fromX, targetZ - fromZ) * 180) / Math.PI;
}
