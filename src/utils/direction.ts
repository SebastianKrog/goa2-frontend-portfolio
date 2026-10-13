import type { Hex, InputRequest } from "../types/game";

/**
 * Engine neighbor vectors, indexed by direction 0-5 (NE, E, SE, SW, W, NW).
 * Mirrors `Hex.neighbor(direction_index)` in the game engine.
 */
export const DIRECTION_VECTORS: ReadonlyArray<Hex> = [
  { q: 1, r: 0, s: -1 },
  { q: 1, r: -1, s: 0 },
  { q: 0, r: -1, s: 1 },
  { q: -1, r: 0, s: 1 },
  { q: -1, r: 1, s: 0 },
  { q: 0, r: 1, s: -1 },
];

/** Neighbor of `origin` in the given direction index (0-5). */
export function neighborInDirection(origin: Hex, index: number): Hex {
  const v = DIRECTION_VECTORS[index % 6];
  return { q: origin.q + v.q, r: origin.r + v.r, s: origin.s + v.s };
}

/**
 * Detects the "Choose a direction" SELECT_NUMBER request whose six options are the
 * compass directions ids "0".."5". These are unintuitive as NE..NW chips, so the 3D
 * view paints them as clickable arrows around the acting hero instead.
 */
export function isDirectionRequest(req: InputRequest | null): boolean {
  if (!req || req.type !== "SELECT_NUMBER") return false;
  if (!/direction/i.test(req.prompt)) return false;
  const opts = (req.options as Array<{ id: string }> | undefined) ?? [];
  return opts.length === 6 && opts.every((o, i) => o.id === String(i));
}
