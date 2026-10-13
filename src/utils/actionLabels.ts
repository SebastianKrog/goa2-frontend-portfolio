// Shared action display helpers (used by the 2D OptionPicker styling and the
// 3D PickerDock). Colors mirror OptionPicker.module.css's action classes so the
// two views speak the same visual language.

export const ACTION_NAMES: Record<string, string> = {
  MOVEMENT: "Movement",
  ATTACK: "Attack",
  DEFENSE: "Defense",
  SKILL: "Skill",
  DEFENSE_SKILL: "Defense Skill",
  HOLD: "Hold",
  CLEAR: "Clear",
  FAST_TRAVEL: "Fast Travel",
};

export const ACTION_COLORS: Record<string, string> = {
  MOVEMENT: "#42a5f5",
  ATTACK: "#ef5350",
  DEFENSE: "#66bb6a",
  SKILL: "#ba68c8",
  DEFENSE_SKILL: "#66bb6a",
};

export function formatActionName(action: string): string {
  return ACTION_NAMES[action] || action;
}
