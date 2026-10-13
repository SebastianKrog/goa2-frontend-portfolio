// Vendored from goa2-translations (src/painter/painterTypes.ts). Do not edit — see scripts/sync-translations.mjs.
export const Color = {
  GOLD: "GOLD",
  SILVER: "SILVER",
  RED: "RED",
  BLUE: "BLUE",
  GREEN: "GREEN",
  PURPLE: "PURPLE",
} as const;
export type Color = (typeof Color)[keyof typeof Color];

export const Type = {
  SKILL: "SKILL",
  ATTACK: "ATTACK",
  MOVEMENT: "MOVEMENT",
  DEFENSE: "DEFENSE",
  DEFENSE_SKILL: "DEFENSE_SKILL",
} as const;
export type Type = (typeof Type)[keyof typeof Type];

export const ValueSign = {
  NONE: "NONE",
  PLUS: "PLUS",
  MINUS: "MINUS",
  EXCLAMATION: "EXCLAMATION",
} as const;
export type ValueSign = (typeof ValueSign)[keyof typeof ValueSign];

export const Modifier = {
  NONE: "NONE",
  RANGE: "RANGE",
  AREA: "AREA",
} as const;
export type Modifier = (typeof Modifier)[keyof typeof Modifier];

export const Item = {
  ATTACK: "ATTACK",
  DEFENSE: "DEFENSE",
  INITIATIVE: "INITIATIVE",
  RANGE: "RANGE",
  AREA: "AREA",
  MOVEMENT: "MOVEMENT",
} as const;
export type Item = (typeof Item)[keyof typeof Item];

export const Stat = {
  ATTACK: "ATTACK",
  DEFENSE: "DEFENSE",
  INITIATIVE: "INITIATIVE",
  MOVEMENT: "MOVEMENT",
} as const;
export type Stat = (typeof Stat)[keyof typeof Stat];

export const cardStats = new Map<Color, Map<Stat, Map<string, number[]>>>([
  [Color.RED, new Map<Stat, Map<string, number[]>>([
    [Stat.MOVEMENT, new Map<string, number[]>([
      ["i", [3, 4, 4, 4, 5, 5, 5, 5]],
      ["ii", [3, 4, 4, 4, 5, 5, 5, 5]],
      ["iii", [3, 4, 4, 4, 5, 5, 5, 5]],
    ])],
    [Stat.INITIATIVE, new Map<string, number[]>([
      ["i", [7, 7, 7, 8, 8, 8, 9, 9]],
      ["ii", [7, 7, 8, 8, 9, 9, 9, 9]],
      ["iii", [8, 8, 8, 9, 9, 9, 10, 10]],
    ])],
    [Stat.ATTACK, new Map<string, number[]>([
      ["i", [4, 4, 5, 5, 5, 6, 6, 6]],
      ["ii", [4, 5, 5, 5, 6, 6, 6, 7]],
      ["iii", [5, 5, 6, 6, 6, 7, 7, 7]],
    ])],
    [Stat.DEFENSE, new Map<string, number[]>([
      ["i", [5, 5, 6, 6, 6, 7, 7, 7]],
      ["ii", [5, 6, 6, 6, 7, 7, 7, 8]],
      ["iii", [6, 6, 7, 7, 7, 8, 8, 8]],
    ])],
  ])],
  [Color.GOLD, new Map<Stat, Map<string, number[]>>([
    [Stat.MOVEMENT, new Map<string, number[]>([
      ["i", [1, 1, 1, 1, 1, 1, 2, 2]],
    ])],
    [Stat.INITIATIVE, new Map<string, number[]>([
      ["i", [11, 11, 11, 11, 12, 12, 12, 13]],
    ])],
    [Stat.ATTACK, new Map<string, number[]>([
      ["i", [1, 2, 2, 3, 3, 3, 4, 4]],
    ])],
    [Stat.DEFENSE, new Map<string, number[]>([
      ["i", [1, 1, 2, 2, 2, 2, 3, 3]],
    ])],
  ])],
  [Color.SILVER, new Map<Stat, Map<string, number[]>>([
    [Stat.DEFENSE, new Map<string, number[]>([
      ["i", [1, 2, 2, 2, 3, 3, 3, 4]],
    ])],
  ])],
  [Color.BLUE, new Map<Stat, Map<string, number[]>>([
    [Stat.MOVEMENT, new Map<string, number[]>([
      ["i", [2, 2, 3, 3, 3, 3, 3, 3]],
      ["ii", [2, 2, 3, 3, 3, 3, 3, 3]],
      ["iii", [2, 2, 3, 3, 3, 3, 3, 3]],
    ])],
    [Stat.INITIATIVE, new Map<string, number[]>([
      ["i", [8, 9, 9, 9, 9, 10, 10, 10]],
      ["ii", [9, 9, 10, 10, 10, 10, 10, 11]],
      ["iii", [9, 10, 10, 10, 10, 11, 11, 11]],
    ])],
    [Stat.DEFENSE, new Map<string, number[]>([
      ["i", [4, 4, 4, 5, 5, 5, 6, 6]],
      ["ii", [4, 5, 5, 5, 6, 6, 6, 7]],
      ["iii", [5, 5, 5, 6, 6, 6, 7, 7]],
    ])],
  ])],
  [Color.GREEN, new Map<Stat, Map<string, number[]>>([
    [Stat.MOVEMENT, new Map<string, number[]>([
      ["i", [2, 2, 2, 2, 2, 2, 2, 3]],
      ["ii", [2, 2, 2, 2, 2, 2, 2, 3]],
      ["iii", [2, 2, 2, 2, 2, 2, 2, 3]],
    ])],
    [Stat.INITIATIVE, new Map<string, number[]>([
      ["i", [6, 5, 5, 4, 4, 3, 3, 2]],
      ["ii", [5, 5, 4, 4, 3, 3, 2, 2]],
      ["iii", [5, 4, 4, 3, 3, 2, 2, 1]],
    ])],
    [Stat.DEFENSE, new Map<string, number[]>([
      ["i", [1, 2, 2, 3, 3, 3, 3, 4]],
      ["ii", [2, 2, 3, 3, 3, 4, 4, 4]],
      ["iii", [2, 3, 3, 4, 4, 4, 4, 5]],
    ])],
  ])],
]);

export const defaultEmoji = [
  "area_blue", "area_gold", "area_green", "area_purple", "area_red", "area_silver",
  "attack_blue", "attack_gold", "attack_green", "attack_red", "attack_silver",
  "defense_blue", "defense_gold", "defense_green", "defense_red", "defense_silver",
  "defense_skill_blue", "defense_skill_gold", "defense_skill_green", "defense_skill_red", "defense_skill_silver",
  "initiative", "life_counters", "marker_bounty", "marker_poison",
  "movement_blue", "movement_gold", "movement_green", "movement_red", "movement_silver",
  "range_blue", "range_gold", "range_green", "range_purple", "range_red", "range_silver", "radius_silver",
  "rune_bird", "rune_bird_marker", "rune_axe", "rune_axe_marker",
  "rune_anvil", "rune_anvil_marker", "rune_horn", "rune_horn_marker",
  "skill_blue", "skill_gold", "skill_green", "skill_red", "skill_silver",
  "tiebreaker_blue", "tiebreaker_orange",
  "token_barrier", "token_blast", "token_dud", "token_familiar", "token_glitch", "token_grenade",
  "token_ice", "token_illusion", "token_magma", "token_rock", "token_smoke_bomb",
  "token_totem", "token_tree", "token_zombie",
];

export const imageNames = [
  "area_blue", "area_gold", "area_green", "area_purple", "area_red", "area_silver",
  "attack", "attack_blue", "attack_gold", "attack_green", "attack_red", "attack_silver",
  "banner_blue_bottom", "banner_blue_top", "banner_gold_bottom", "banner_gold_top",
  "banner_green_bottom", "banner_green_top", "banner_red_bottom", "banner_red_top",
  "banner_silver_bottom", "banner_silver_top",
  "bottom_long", "bottom_short",
  "colorblind_blue", "colorblind_gold", "colorblind_green", "colorblind_purple",
  "colorblind_red", "colorblind_silver",
  "defense", "defense_blue", "defense_gold", "defense_green", "defense_red", "defense_silver",
  "defense_skill_blue", "defense_skill_gold", "defense_skill_green", "defense_skill_red", "defense_skill_silver",
  "frame_blue_bottom", "frame_blue_middle", "frame_blue_middle_cut", "frame_blue_top",
  "frame_empty_bottom",
  "frame_gold_bottom", "frame_gold_middle", "frame_gold_top",
  "frame_green_bottom", "frame_green_middle", "frame_green_middle_cut", "frame_green_top",
  "frame_purple_bottom", "frame_purple_middle", "frame_purple_top",
  "frame_red_bottom", "frame_red_middle", "frame_red_middle_cut", "frame_red_top",
  "frame_silver_bottom", "frame_silver_middle", "frame_silver_top",
  "initiative",
  "item_area", "item_attack", "item_defense", "item_initiative", "item_movement", "item_range",
  "level_i", "level_ii", "level_iii", "level_iv", "level_h",
  "life_counters", "marker_bounty", "marker_poison",
  "movement", "movement_blue", "movement_gold", "movement_green", "movement_red", "movement_silver",
  "range_blue", "range_gold", "range_green", "range_purple", "range_red", "range_silver",
  "rune_bird", "rune_bird_marker", "rune_axe", "rune_axe_marker",
  "rune_anvil", "rune_anvil_marker", "rune_horn", "rune_horn_marker",
  "skill_blue", "skill_gold", "skill_green", "skill_red", "skill_silver",
  "tiebreaker_blue", "tiebreaker_orange",
  "title", "title_ultimate",
  "token_barrier", "token_blast", "token_dud", "token_familiar", "token_glitch", "token_grenade",
  "token_ice", "token_illusion", "token_magma", "token_rock", "token_smoke_bomb",
  "token_totem", "token_tree", "token_zombie",
];
