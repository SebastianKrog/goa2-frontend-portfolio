import type { CardView, GameView, Hex, HeroView, OverrideFamily } from "../types/game";

export interface OverrideProposalPayload {
  family: OverrideFamily;
  op?: string;
  args?: Record<string, unknown>;
  to?: number;
}

/** The zones the server's `move_card` override accepts as a destination. */
export type CardZone = "hand" | "discard" | "played" | "deck";

export const CARD_ZONE_LABEL: Record<CardZone, string> = {
  hand: "hand",
  discard: "discard pile",
  played: "played cards",
  deck: "deck",
};

/** Item and passive-ultimate cards stay put: the server refuses to move them. */
const UNMOVABLE_STATES = new Set(["ITEM", "PASSIVE"]);

export function findHero(view: GameView, heroId: string): HeroView | null {
  for (const team of Object.values(view.teams)) {
    const hero = team.heroes.find((entry) => entry.id === heroId);
    if (hero) return hero;
  }
  return null;
}

/** Committed-but-unresolved cards count as "played": that is where move_card takes them from. */
export function heroCardZones(hero: HeroView): Record<CardZone, CardView[]> {
  const played = [
    ...hero.played_cards,
    hero.current_turn_card,
    hero.extra_turn_card,
  ].filter((card): card is CardView => card !== null);
  // Deck = master-list cards no live zone holds, which includes cards a bug orphaned.
  const held = new Set(
    [...hero.hand, ...hero.discard_pile, ...played, hero.ultimate_card]
      .filter((card): card is CardView => !!card)
      .map((card) => card.id),
  );
  const deck = Array.isArray(hero.deck)
    ? hero.deck.filter((card) => !held.has(card.id) && !UNMOVABLE_STATES.has(card.state))
    : [];
  return { hand: hero.hand, discard: hero.discard_pile, played, deck };
}

/**
 * Turns this hero has finished this round; only their played slots are safe
 * to fill, since the engine writes each later turn's card into its slot.
 */
export function finishedTurns(view: GameView, hero: HeroView): number {
  const finishedThisTurn =
    view.phase === "RESOLUTION" &&
    !view.unresolved_hero_ids.includes(hero.id) &&
    hero.current_turn_card === null;
  return view.turn - 1 + (finishedThisTurn ? 1 : 0);
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

export function teamLabel(teamId: string): string {
  return capitalize(teamId);
}

/** "Wave counter" for single-lane maps; "Mid wave counter" when lanes need telling apart. */
export function laneLabel(view: GameView | undefined | null, laneId: string): string {
  const lanes = Object.keys(view?.wave_counters ?? {});
  if (lanes.length <= 1) return "Wave counter";
  const zone = view?.battle_zones?.[laneId];
  const name = zone ? zone.replace(/([a-z])([A-Z0-9])/g, "$1 $2") : laneId.replace(/_/g, " ");
  return `${name} wave counter`;
}

function summarizeValue(op: string, args: Record<string, unknown>, view?: GameView | null): string | null {
  const value = args.value;
  const from = (current: number | undefined) =>
    current === undefined ? "" : ` from ${current}`;
  if (op === "set_gold" || op === "set_level") {
    const heroId = String(args.hero_id ?? "");
    const hero = view ? findHero(view, heroId) : null;
    const what = op === "set_gold" ? "gold" : "level";
    return `Set ${entityLabel(view, heroId)}'s ${what}${from(hero?.[what])} to ${value}`;
  }
  if (op === "set_life_counters") {
    const team = String(args.team ?? "");
    return `Set ${teamLabel(team)} team's life counters${from(view?.teams[team]?.life_counters)} to ${value}`;
  }
  if (op === "set_wave_counter") {
    const lane = String(args.lane_id ?? "");
    const label = laneLabel(view, lane);
    return `Set ${label.charAt(0).toLowerCase()}${label.slice(1)}${from(view?.wave_counters[lane])} to ${value}`;
  }
  if (op === "set_tie_breaker_team") {
    return `Give the tie-breaker to ${teamLabel(String(args.team ?? ""))} team`;
  }
  return null;
}

/** Display name for any board entity id: hero, minion, token, or turret. */
export function entityLabel(view: GameView | undefined | null, entityId: string): string {
  if (view) {
    for (const [teamId, team] of Object.entries(view.teams)) {
      const hero = team.heroes.find((entry) => entry.id === entityId);
      if (hero) return hero.name;
      const minion = team.minions.find((entry) => entry.id === entityId);
      if (minion) return `${capitalize(teamId)} ${minion.type.toLowerCase()} minion`;
    }
    const token = view.tokens.find((entry) => entry.id === entityId);
    if (token) return token.name;
    const entity = view.board_entities?.find((entry) => entry.id === entityId);
    if (entity) return entity.name;
    const piece = view.hero_pieces?.[entityId];
    if (piece) return `${entityLabel(view, piece.owner_hero_id)}'s piece`;
  }
  return entityId.replace(/^hero_/, "").replace(/_/g, " ");
}

/** "Blue Jungle" for a hex in zone BlueJungle; raw coordinates when the tile is unknown. */
export function hexLabel(view: GameView | undefined | null, hex: Hex): string {
  const tile = view
    ? Object.values(view.board.tiles).find(
        (entry) => entry.hex.q === hex.q && entry.hex.r === hex.r,
      )
    : undefined;
  if (!tile?.zone_id) return `(${hex.q}, ${hex.r})`;
  return tile.zone_id.replace(/([a-z])([A-Z0-9])/g, "$1 $2").replace(/_/g, " ");
}

function findHeroCard(hero: HeroView, cardId: string): { card: CardView; zone: CardZone } | null {
  const zones = heroCardZones(hero);
  for (const zone of Object.keys(zones) as CardZone[]) {
    const card = zones[zone].find((entry) => entry.id === cardId);
    if (card) return { card, zone };
  }
  return null;
}

function summarizeMoveCard(args: Record<string, unknown>, view?: GameView | null): string {
  const heroId = String(args.hero_id ?? "");
  const cardId = String(args.card_id ?? "");
  const zone = args.zone as CardZone;
  const hero = view ? findHero(view, heroId) : null;
  const found = hero ? findHeroCard(hero, cardId) : null;
  const heroName = hero?.name ?? heroId.replace(/^hero_/, "");
  const cardName = found?.card.name ?? cardId;
  const from = found ? ` from ${CARD_ZONE_LABEL[found.zone]}` : "";
  const to = zone === "played" && args.slot ? `played slot ${args.slot}` : CARD_ZONE_LABEL[zone] ?? zone;
  return `Move ${heroName}'s ${cardName}${from} to ${to}`;
}

/** Human-readable one-liner for the confirm step and vote banner. */
export function summarizeProposal(payload: OverrideProposalPayload, view?: GameView | null): string {
  if (payload.family === "pause") {
    return "Pause the match";
  }
  if (payload.family === "rewind") {
    return `Rewind the game to decision ${payload.to}`;
  }
  if (payload.family === "reveal_player") {
    const heroId = String(payload.args?.hero_id ?? "");
    return `Share ${heroId.replace(/^hero_/, "") || "a player"}'s player link`;
  }
  const args = payload.args ?? {};
  if (payload.op === "move_card") {
    return summarizeMoveCard(args, view);
  }
  if (payload.op === "move_entity" || payload.op === "place_entity" || payload.op === "remove_entity") {
    const name = entityLabel(view, String(args.entity_id ?? ""));
    if (payload.op === "remove_entity") return `Remove ${name} from the board`;
    const where = args.hex ? ` in ${hexLabel(view, args.hex as Hex)}` : "";
    return `${payload.op === "place_entity" ? "Place" : "Move"} ${name}${where}`;
  }
  const valueSummary = payload.op ? summarizeValue(payload.op, args, view) : null;
  if (valueSummary) return valueSummary;
  const argText = Object.entries(args)
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(", ");
  return `${payload.op}${argText ? ` (${argText})` : ""}`;
}
