// Zone ids differ per map: single-lane boards use plain "Mid"/"RedBeach", the
// two-lane Across the River suffixes them per lane ("MidA1", "RedBBeach") and
// Vexing Cliffs numbers its jungles. Match the family, not the exact id, so a
// new map does not silently render grey.
const ZONE_COLOR_RULES: Array<[RegExp, string]> = [
  [/^RedBase/, "var(--zone-red-base)"],
  [/^BlueBase/, "var(--zone-blue-base)"],
  [/^Red.*Beach/, "var(--zone-red-beach)"],
  [/^Blue.*Beach/, "var(--zone-blue-beach)"],
  [/^Mid/, "var(--zone-mid)"],
  // Only Vexing Cliffs numbers its jungles, and there the touching pairs are
  // crossed (RedJungle1-BlueJungle2, RedJungle2-BlueJungle1), so the trailing
  // digit separates both. Maps with a single jungle per side keep one green.
  [/Jungle2$/, "var(--zone-jungle-alt)"],
  [/Jungle/, "var(--zone-jungle)"],
  [/^River/, "var(--zone-river)"],
];

// A two-lane map repeats every family, so same-family zones end up touching and
// merge into one blob. These break the ties. Lane order comes from the map JSON
// (lane_1: RedBase -> RedABeach -> MidA1 -> MidA2 -> BlueABeach -> BlueBase;
// lane_2 wraps the other way: RedBBeach -> MidB2 -> MidB1 -> BlueBBeach), which
// is why A2 pairs with B1 — both are the blue half of their lane. Keying off the
// trailing digit instead would flip the red->blue gradient in lane B.
const ZONE_COLOR_OVERRIDES: Record<string, string> = {
  MidA2: "var(--zone-mid-far)",
  MidB1: "var(--zone-mid-far)",
  RedBBeach: "var(--zone-red-beach-alt)",
  BlueBBeach: "var(--zone-blue-beach-alt)",
};

export const UNKNOWN_ZONE_COLOR = "#444";

export function zoneColor(zoneId: string): string {
  return ZONE_COLOR_OVERRIDES[zoneId]
    ?? ZONE_COLOR_RULES.find(([pattern]) => pattern.test(zoneId))?.[1]
    ?? UNKNOWN_ZONE_COLOR;
}

export const TEAM_COLORS: Record<string, string> = {
  RED: "var(--team-red)",
  BLUE: "var(--team-blue)",
};

export const PHASE_COLORS: Record<string, string> = {
  PLANNING: "var(--phase-planning)",
  REVELATION: "var(--phase-revelation)",
  RESOLUTION: "var(--phase-resolution)",
  CLEANUP: "var(--phase-cleanup)",
  LEVEL_UP: "var(--phase-level-up)",
  GAME_OVER: "var(--phase-game-over)",
};

export const CARD_COLORS: Record<string, string> = {
  GOLD: "var(--card-gold)",
  SILVER: "var(--card-silver)",
  RED: "var(--card-red)",
  BLUE: "var(--card-blue)",
  GREEN: "var(--card-green)",
  PURPLE: "var(--card-purple)",
};

export function getUnitLabel(entityId: string, name?: string): string {
  if (entityId.startsWith("hero_") && name) {
    return name[0].toUpperCase();
  }
  if (entityId.startsWith("minion_")) {
    return "m";
  }
  return "?";
}
