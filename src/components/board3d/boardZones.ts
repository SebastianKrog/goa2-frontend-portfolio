import { CARD_H, CARD_W } from "./cards/paintCard";
import type { SeatPlacement } from "./seating";

export type BoardZone =
  | "COMMIT"
  | "PLAYED"
  | "ULTIMATE"
  | "DECK"
  | "DISCARD"
  | "SPELLBOOK"
  | "HAND"
  | "STATUS"
  | "WISH"
  | "SHEET";

export const BOARD_ZONES: ReadonlySet<string> = new Set([
  "COMMIT", "PLAYED", "ULTIMATE", "DECK", "DISCARD", "SPELLBOOK", "HAND", "STATUS", "WISH", "SHEET",
]);

// Rects in board-local units, mirroring Board3D's default calibration values
// (cardWidth 0.835, deckX -3.900, ...). If those defaults move, move these.
const CARD_HALF_W = 0.835 / 2;
const CARD_HALF_H = (0.835 * (CARD_H / CARD_W)) / 2;

interface ZoneRect {
  zone: BoardZone;
  cx: number;
  cy: number;
  hx: number;
  hy: number;
}

/** Satellites first, then the played row and the mat itself as fallbacks. */
const ZONE_RECTS: ZoneRect[] = [
  { zone: "DECK", cx: -3.9, cy: -0.6, hx: CARD_HALF_W, hy: CARD_HALF_H },
  { zone: "ULTIMATE", cx: -3.0, cy: -0.11, hx: CARD_HALF_W, hy: CARD_HALF_H },
  { zone: "DISCARD", cx: 2.505, cy: -0.11, hx: CARD_HALF_W + 0.05, hy: CARD_HALF_H + 0.05 },
  // Book pile plus the cast fan trailing behind it.
  { zone: "SPELLBOOK", cx: -2.75, cy: -3.2, hx: 1.65, hy: 2.3 },
  { zone: "COMMIT", cx: 0, cy: 2.14, hx: 0.75, hy: CARD_HALF_H },
  { zone: "HAND", cx: 0, cy: -1.75, hx: 0.85, hy: 0.25 },
  { zone: "STATUS", cx: 0, cy: -1.5, hx: 0.6, hy: 0.4 },
  { zone: "WISH", cx: 1.1, cy: -1.5, hx: 0.35, hy: 0.35 },
  {
    zone: "PLAYED",
    cx: (-1.525 + (-1.525 + 3 * 0.99)) / 2,
    cy: -0.11,
    hx: (3 * 0.99) / 2 + CARD_HALF_W,
    hy: CARD_HALF_H,
  },
  { zone: "SHEET", cx: 0, cy: 0.15, hx: 2.25, hy: 1.45 },
];

const RECT_BY_ZONE = new Map(ZONE_RECTS.map((r) => [r.zone, r]));

/**
 * The seat-local frame composes a Y rotation with a flip, so its matrix is an
 * involution: the inverse transform equals the forward one. Scaling is applied
 * around the seat position itself (Board3D's scaleOrigin), so dividing by the
 * placement scale completes the inverse.
 */
function toSeatLocal(x: number, z: number, placement: SeatPlacement): { lx: number; ly: number } {
  const cos = Math.cos(placement.rotationY);
  const sin = Math.sin(placement.rotationY);
  const dx = x - placement.position[0];
  const dz = z - placement.position[2];
  return {
    lx: (dx * cos + dz * -sin) / placement.scale,
    ly: (dx * -sin + dz * -cos) / placement.scale,
  };
}

export function zoneAtPoint(
  x: number,
  z: number,
  placements: SeatPlacement[],
): { hero_id: string; zone: BoardZone } | null {
  for (const placement of placements) {
    const { lx, ly } = toSeatLocal(x, z, placement);
    for (const rect of ZONE_RECTS) {
      if (Math.abs(lx - rect.cx) <= rect.hx && Math.abs(ly - rect.cy) <= rect.hy) {
        return { hero_id: placement.hero.id, zone: rect.zone };
      }
    }
  }
  return null;
}

/**
 * Where a receiver should draw a cursor aimed at `heroId`'s `zone`, in world
 * space using the *receiver's own* seating. Null when that hero has no seat
 * here (e.g. roster changed mid-flight).
 */
export function zoneAnchor(
  heroId: string,
  zone: BoardZone,
  placements: SeatPlacement[],
): { x: number; y: number; z: number } | null {
  const placement = placements.find((p) => p.hero.id === heroId);
  const rect = RECT_BY_ZONE.get(zone);
  if (!placement || !rect) return null;
  const cos = Math.cos(placement.rotationY);
  const sin = Math.sin(placement.rotationY);
  return {
    x: placement.position[0] + rect.cx * placement.scale * cos + rect.cy * placement.scale * -sin,
    y: zone === "HAND" ? 0.02 + 0.68 * placement.scale : 0,
    z: placement.position[2] + rect.cx * placement.scale * -sin + rect.cy * placement.scale * -cos,
  };
}
