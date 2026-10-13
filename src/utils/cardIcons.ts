import type { CSSProperties } from "react";

// Shared definitions for the `:icon_name:` tokens that can appear inline in
// card effect text. Both the 2D tooltip renderer (`effectText.tsx`) and the
// 3D card painter (`paintCard.ts`) read from this map, so adding a new icon
// only needs one entry here.

const ABSENT_PURPLE: Record<string, string> = { purple: "silver" };

function withColor(base: string, color: string, fallbacks: Record<string, string> = {}): string {
  return `${base}_${fallbacks[color] ?? color}`;
}

// The stone card-sheet rune art is too dark and detailed for 1em on tooltip backgrounds.
const RUNE_ICON_STYLE: CSSProperties = { height: "1.3em", filter: "brightness(1.9)" };

export interface CardIcon {
  iconPath: string;
  painterSprite: (color: string) => string;
  iconStyle?: CSSProperties;
}

export const CARD_ICONS: Record<string, CardIcon> = {
  attack: {
    iconPath: "/icons/attack.png",
    painterSprite: (c) => withColor("attack", c, ABSENT_PURPLE),
  },
  defense: {
    iconPath: "/icons/defense.png",
    painterSprite: (c) => withColor("defense", c, ABSENT_PURPLE),
  },
  movement: {
    iconPath: "/icons/movement.png",
    painterSprite: (c) => withColor("movement", c, ABSENT_PURPLE),
  },
  range: {
    iconPath: "/icons/range.png",
    painterSprite: (c) => withColor("range", c),
  },
  radius: {
    iconPath: "/icons/radius.png",
    painterSprite: (c) => withColor("area", c),
  },
  initiative: {
    iconPath: "/icons/initiative.png",
    painterSprite: () => "initiative",
  },
  poison_marker: {
    iconPath: "/icons/marker_poison.png",
    painterSprite: () => "marker_poison",
  },
  bounty_marker: {
    iconPath: "/icons/marker_bounty.png",
    painterSprite: () => "marker_bounty",
  },
  life_counter: {
    iconPath: "/icons/life_counters.png",
    painterSprite: () => "life_counters",
  },
  smoke_bomb_token: {
    iconPath: "/icons/token_smoke_bomb.png",
    painterSprite: () => "token_smoke_bomb",
  },
  grenade_token: {
    iconPath: "/icons/token_grenade.png",
    painterSprite: () => "token_grenade",
  },
  blast_token: {
    iconPath: "/icons/token_blast.png",
    painterSprite: () => "token_blast",
  },
  dud_token: {
    iconPath: "/icons/token_dud.png",
    painterSprite: () => "token_dud",
  },
  zombie_token: {
    iconPath: "/icons/token_zombie.png",
    painterSprite: () => "token_zombie",
  },
  ice_token: {
    iconPath: "/icons/token_ice.png",
    painterSprite: () => "token_ice",
  },
  totem_token: {
    iconPath: "/icons/token_totem.png",
    painterSprite: () => "token_totem",
  },
  barrier_token: {
    iconPath: "/icons/token_barrier.png",
    painterSprite: () => "token_barrier",
  },
  tree_token: {
    iconPath: "/icons/token_tree.png",
    painterSprite: () => "token_tree",
  },
  glitch_token: {
    iconPath: "/icons/token_glitch.png",
    painterSprite: () => "token_glitch",
  },
  illusion_token: {
    iconPath: "/icons/token_illusion.png",
    painterSprite: () => "token_illusion",
  },
  magma_token: {
    iconPath: "/icons/token_magma.png",
    painterSprite: () => "token_magma",
  },
  rock_token: {
    iconPath: "/icons/token_rock.png",
    painterSprite: () => "token_rock",
  },
  familiar_token: {
    iconPath: "/icons/token_familiar.png",
    painterSprite: () => "token_familiar",
  },
  tiebreaker_blue: {
    iconPath: "/icons/tiebreaker_blue.png",
    painterSprite: () => "tiebreaker_blue",
  },
  tiebreaker_orange: {
    iconPath: "/icons/tiebreaker_orange.png",
    painterSprite: () => "tiebreaker_orange",
  },
  rune_axe: {
    iconPath: "/cards/sheets/rune_axe.png",
    painterSprite: () => "rune_axe",
    iconStyle: RUNE_ICON_STYLE,
  },
  rune_bird: {
    iconPath: "/cards/sheets/rune_bird.png",
    painterSprite: () => "rune_bird",
    iconStyle: RUNE_ICON_STYLE,
  },
  rune_anvil: {
    iconPath: "/cards/sheets/rune_anvil.png",
    painterSprite: () => "rune_anvil",
    iconStyle: RUNE_ICON_STYLE,
  },
  rune_horn: {
    iconPath: "/cards/sheets/rune_horn.png",
    painterSprite: () => "rune_horn",
    iconStyle: RUNE_ICON_STYLE,
  },
  rune_axe_marker: {
    iconPath: "/cards/sheets/rune_axe_marker.png",
    painterSprite: () => "rune_axe_marker",
  },
  rune_bird_marker: {
    iconPath: "/cards/sheets/rune_bird_marker.png",
    painterSprite: () => "rune_bird_marker",
  },
  rune_anvil_marker: {
    iconPath: "/cards/sheets/rune_anvil_marker.png",
    painterSprite: () => "rune_anvil_marker",
  },
  rune_horn_marker: {
    iconPath: "/cards/sheets/rune_horn_marker.png",
    painterSprite: () => "rune_horn_marker",
  },
};
