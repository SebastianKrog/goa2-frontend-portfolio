import type { GameView, Hex, InputRequest } from "../types/game";
import { entityLabel } from "./overrideSummary";

// Board-pick state machine for consensus-override patch ops that target the
// board (move / remove / place entity). While a pick is active, GameView
// passes the synthetic InputRequest below into the board component — reusing
// the exact highlight/click plumbing real input requests use — and reroutes
// the clicks into `advancePick` instead of `submitInput`.

export type BoardPickOp = "move_entity" | "remove_entity" | "place_entity";

export type OverridePick =
  | { op: BoardPickOp; stage: "entity" }
  | { op: BoardPickOp; stage: "hex"; entityId: string };

/** A completed pick: the args object ready to propose. */
export interface CompletedPick {
  op: BoardPickOp;
  proposal: Record<string, unknown>;
}

export function startPick(op: BoardPickOp, entityId?: string): OverridePick {
  // place_entity's subject is off-board (nothing to click), so the panel
  // supplies it and picking starts directly at the destination hex.
  if (op === "place_entity") {
    if (!entityId) throw new Error("place_entity requires a preselected entity");
    return { op, stage: "hex", entityId };
  }
  return { op, stage: "entity" };
}

export function advancePick(
  pick: OverridePick,
  selection: string | Hex,
): OverridePick | CompletedPick {
  if (pick.stage === "entity") {
    const entityId = selection as string;
    if (pick.op === "remove_entity") {
      return { op: pick.op, proposal: { entity_id: entityId } };
    }
    return { op: pick.op, stage: "hex", entityId };
  }
  const hex = selection as Hex;
  return {
    op: pick.op,
    proposal: { entity_id: pick.entityId, hex: { q: hex.q, r: hex.r, s: hex.s } },
  };
}

export function isCompletedPick(
  value: OverridePick | CompletedPick,
): value is CompletedPick {
  return "proposal" in value;
}

export function overridePickRequest(
  pick: OverridePick,
  view: GameView | null,
): InputRequest | null {
  if (!view) return null;
  if (pick.stage === "entity") {
    return {
      type: "SELECT_UNIT_OR_TOKEN",
      player_id: "override",
      prompt: describePick(pick, view),
      valid_options: Object.keys(view.board.entity_locations),
    };
  }
  return {
    type: "SELECT_HEX",
    player_id: "override",
    prompt: describePick(pick, view),
    valid_hexes: Object.values(view.board.tiles).map((tile) => tile.hex),
  };
}

export function describePick(pick: OverridePick, view?: GameView | null): string {
  if (pick.stage === "entity") {
    return pick.op === "remove_entity"
      ? "Click the unit or token to remove"
      : "Click the unit or token to move";
  }
  return pick.op === "place_entity"
    ? `Click the hex to place ${entityLabel(view, pick.entityId)} on`
    : `Click the destination hex for ${entityLabel(view, pick.entityId)}`;
}
