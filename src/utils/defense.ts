import type { CardView } from "../types/game";

export type DefenseState = "BLOCKS" | "FAILS" | "PRIMARY";

export interface DefenseOptionInfo {
  state: DefenseState;
  /** secondary defense value, present for BLOCKS/FAILS (not PRIMARY) */
  defenseValue?: number;
  baseDefense?: number;
}

/**
 * Classifies a defense option for a SELECT_CARD_OR_PASS decision.
 *
 * Single source of truth shared by the 2D OptionPicker and the 3D HUD — it
 * re-presents the EXISTING logic, it does not introduce a new one:
 *  - a card whose primary action is DEFENSE/DEFENSE_SKILL is a PRIMARY defense
 *    whose blocking is effect-driven; the frontend asserts no verdict on it.
 *  - otherwise it BLOCKS iff its secondary defense value meets what's needed.
 */
/**
 * The stat a defense option blocks with, read off the server's option text.
 *
 * Some cards make the defender block with a stat other than Defense (Emmitt's
 * Temporal line uses Initiative). `defense_value` keeps its name and carries
 * the number for whichever stat is in use, so the only place the stat's
 * identity is exposed is the trailing "(Init: N)" / "(Def: N)" in `text`.
 */
export function defenseStatLabel(text: string | undefined): string {
  return text?.match(/\(([A-Za-z]+):\s*-?\d+\)\s*$/)?.[1] ?? "Def";
}

export function classifyDefenseOption(
  opt: { id: string; defense_value?: number; base_defense?: number },
  card: CardView | undefined,
  defenseNeeded: number | null | undefined,
): DefenseOptionInfo {
  const isPrimary =
    card?.primary_action === "DEFENSE" || card?.primary_action === "DEFENSE_SKILL";
  if (isPrimary) return { state: "PRIMARY" };

  const dv = opt.defense_value;
  const blocks =
    dv !== undefined &&
    defenseNeeded !== undefined &&
    defenseNeeded !== null &&
    dv >= defenseNeeded;
  return { state: blocks ? "BLOCKS" : "FAILS", defenseValue: dv, baseDefense: opt.base_defense };
}
