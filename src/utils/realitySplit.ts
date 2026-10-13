import type { EffectView, Hex, InputRequest, TileView } from "../types/game";

export type SplitAxis = "q" | "r" | "s";

/** Effect types created by NebKher's Crack in Reality / Shift Reality. */
export const TOPOLOGY_EFFECT_TYPES = new Set(["topology_split", "topology_isolation"]);

/**
 * Detects the "Choose the line of spaces drawn through your space" SELECT_NUMBER
 * request from Crack in Reality / Shift Reality. Its three options each name a
 * cube axis ("Line along the q-axis …"), which reads poorly as dock chips, so
 * the 3D view paints the three candidate lines on the board instead.
 */
export function isRealitySplitRequest(req: InputRequest | null): boolean {
  if (!req || req.type !== "SELECT_NUMBER") return false;
  if (!/line of spaces/i.test(req.prompt)) return false;
  const opts = (req.options as Array<{ text?: string }> | undefined) ?? [];
  return opts.length === 3 && opts.every((o) => axisFromOptionText(o.text ?? "") !== null);
}

/**
 * Which axis an option stands for, parsed from its label ("… the q-axis …")
 * rather than a hardcoded id→axis table, so backend option order can change.
 */
export function axisFromOptionText(text: string): SplitAxis | null {
  const m = /\b([qrs])-axis\b/i.exec(text);
  return m ? (m[1].toLowerCase() as SplitAxis) : null;
}

/** The tiles forming the split line: every tile where hex[axis] === value. */
export function splitLineTiles(
  tiles: Record<string, TileView>,
  axis: SplitAxis,
  value: number,
): Hex[] {
  return Object.values(tiles)
    .filter((t) => t.hex[axis] === value)
    .map((t) => t.hex);
}

/** Active reality-split effects (crack + shift) that carry a drawable line. */
export function activeSplitEffects(effects: EffectView[]): EffectView[] {
  return effects.filter(
    (e) => e.is_active && TOPOLOGY_EFFECT_TYPES.has(e.type) && e.split_axis != null,
  );
}
