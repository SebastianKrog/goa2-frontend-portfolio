import type { GameEvent, GameView, Hex } from "../types/game";
import { resolveWinnerDisplay } from "./winner";

export type EntityRef =
  | { kind: "hero"; id: string; name: string }
  | { kind: "minion"; type: string; team: string }
  | { kind: "token"; name: string }
  | { kind: "entity"; name: string };

export type EntityNames = Record<string, EntityRef>;

export interface LogLine {
  text: string;
  turnEnd?: boolean;
}

export interface FormatContext {
  /** Names captured when the event arrived; units may have left the board since. */
  names: EntityNames;
  view: GameView;
  heroName: (heroId: string, fallback: string) => string;
  cardName: (cardId: string) => string | null;
}

const ENTITY_ID_KEYS = ["owner_id", "caster_id", "controller_id", "owner_hero_id"] as const;

export function referencedIds(event: GameEvent): string[] {
  const ids = [event.actor_id, event.target_id];
  for (const key of ENTITY_ID_KEYS) {
    const value = event.metadata[key];
    if (typeof value === "string") ids.push(value);
  }
  return ids.filter((id): id is string => !!id);
}

export function lookupEntity(view: GameView | null, id: string): EntityRef | null {
  if (!view) return null;
  for (const team of Object.values(view.teams)) {
    const hero = team.heroes.find((candidate) => candidate.id === id);
    if (hero) return { kind: "hero", id: hero.id, name: hero.name };
    const minion = team.minions.find((candidate) => candidate.id === id);
    if (minion) return { kind: "minion", type: minion.type, team: team.color };
  }
  const token = view.tokens.find((candidate) => candidate.id === id);
  if (token) return { kind: "token", name: token.name };
  const entity = view.board_entities?.find((candidate) => candidate.id === id);
  if (entity) return { kind: "entity", name: entity.name };
  return null;
}

/**
 * Resolves each ID against the newest view first, then older ones. Units that
 * an update removes (a defeated minion) are only present in the view before it.
 */
export function captureNames(event: GameEvent, views: (GameView | null)[]): EntityNames {
  const names: EntityNames = {};
  for (const id of referencedIds(event)) {
    for (const view of views) {
      const ref = lookupEntity(view, id);
      if (ref) {
        names[id] = ref;
        break;
      }
    }
  }
  return names;
}

function humanize(value: string): string {
  return value.toLowerCase().replace(/_/g, " ");
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function teamName(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  return capitalize(value.replace(/^team:/i, "").toLowerCase());
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function article(word: string): string {
  return /^[aeiou]/i.test(word) ? `an ${word}` : `a ${word}`;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function hexDistance(a: Hex, b: Hex): number {
  return Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(a.s - b.s));
}

const GOLD_REASONS: Record<string, string> = {
  kill: " for a takedown",
  assist: " for an assist",
  minion_kill: " for defeating a minion",
  minion_defeat_bounty: " from a minion bounty",
  steal: " by stealing",
  cheat: " (cheat)",
};

export function formatEvent(event: GameEvent, ctx: FormatContext): LogLine | null {
  const meta = event.metadata;

  const nameOf = (id: string | null): string | null => {
    if (!id || id === "system") return null;
    const ref = ctx.names[id] ?? lookupEntity(ctx.view, id);
    if (!ref) return null;
    switch (ref.kind) {
      case "hero":
        return ctx.heroName(ref.id, ref.name);
      case "minion":
        return `${teamName(ref.team) ?? ""} ${humanize(ref.type)} minion`.trim();
      default:
        return ref.name;
    }
  };
  const actor = nameOf(event.actor_id);
  const target = nameOf(event.target_id);
  const someone = (name: string | null) => name ?? "A unit";

  const card = (idKey: string, nameKey = "card_name"): string | null => {
    const id = str(meta[idKey]);
    return (id && ctx.cardName(id)) ?? str(meta[nameKey]);
  };

  const line = (text: string): LogLine => ({ text });

  switch (event.event_type) {
    case "UNIT_MOVED": {
      const distance = event.from_hex && event.to_hex ? hexDistance(event.from_hex, event.to_hex) : null;
      return line(`${someone(actor)} moved${distance ? ` ${plural(distance, "space")}` : ""}`);
    }
    case "TOKEN_MOVED": {
      const token = target ?? "A token";
      return line(actor && meta.replaced !== true ? `${actor} moved ${token}` : `${token} was moved`);
    }
    case "UNIT_PLACED": {
      const placed = target ?? actor;
      return line(`${someone(placed)} was placed on the board`);
    }
    case "TOKEN_PLACED": {
      const token = target ?? article(humanize(str(meta.token_type) ?? "token"));
      return line(actor ? `${actor} placed ${token}` : `${capitalize(token)} was placed`);
    }
    case "BOARD_ENTITY_PLACED": {
      const entity = target ?? `the ${humanize(str(meta.entity_kind) ?? "object")}`;
      const verb = event.from_hex ? "moved" : "placed";
      return line(actor ? `${actor} ${verb} ${entity}` : `${capitalize(entity)} was ${verb}`);
    }
    case "UNIT_PUSHED":
    case "TOKEN_PUSHED": {
      const distance = num(meta.distance);
      const how = distance ? ` ${plural(distance, "space")}` : "";
      const stopped = meta.collision === true ? ", stopped by an obstacle" : "";
      const pushed = target ?? (event.event_type === "TOKEN_PUSHED" ? "a token" : "a unit");
      return line(actor ? `${actor} pushed ${pushed}${how}${stopped}` : `${capitalize(pushed)} was pushed${how}${stopped}`);
    }
    case "UNITS_SWAPPED":
      return line(`${someone(actor)} and ${target ?? "a unit"} swapped places`);
    case "COMBAT_RESOLVED": {
      const attack = num(meta.attack_value);
      const defense = num(meta.defense_value);
      const modifier = num(meta.modifier_value) ?? 0;
      const numbers: string[] = [];
      if (attack !== null) numbers.push(`attack ${attack}`);
      if (defense !== null) {
        const mod = modifier > 0 ? ` + ${modifier}` : modifier < 0 ? ` - ${-modifier}` : "";
        numbers.push(`defense ${defense}${mod}`);
      } else if (attack !== null) {
        numbers.push("no defense");
      }
      const outcome = meta.outcome === "BLOCKED" ? "blocked" : meta.outcome === "DEFEATED" ? "defeated" : null;
      const detail = numbers.length ? ` (${numbers.join(", ")})` : "";
      return line(`${someone(actor)} attacked ${target ?? "a unit"}${detail}${outcome ? `: ${outcome}` : ""}`);
    }
    case "UNIT_DEFEATED":
      return line(`${someone(target)} was defeated${actor ? ` by ${actor}` : ""}`);
    case "UNIT_REMOVED":
      return line(
        meta.voluntary === true && actor
          ? `${actor} removed ${target ?? "a piece"}`
          : `${someone(target)} was removed from the board`,
      );
    case "TOKEN_REMOVED":
      return line(`${target ?? "A token"} was removed`);
    case "BOARD_ENTITY_REMOVED":
      return line(`${target ?? `The ${humanize(str(meta.entity_kind) ?? "object")}`} was removed`);
    case "EFFECT_CREATED": {
      if (meta.effect === "action_control" && actor) {
        return line(`${actor} took control of ${target ?? "a unit"}'s action`);
      }
      if (meta.effect === "initiative_override") {
        const value = num(meta.value);
        return line(`${someone(actor)}'s initiative became ${value ?? "a new value"}`);
      }
      const effect = str(meta.effect_type);
      const named = str(meta.named_color);
      const what = effect ? humanize(effect) : "an effect";
      const color = named ? ` (${humanize(named)})` : "";
      return line(actor ? `${actor} created an effect: ${what}${color}` : `Effect started: ${what}${color}`);
    }
    case "MARKER_PLACED": {
      const marker = str(meta.marker_type) ?? "a";
      return line(`${actor ? `${actor} placed` : "Placed"} ${article(humanize(marker))} marker on ${target ?? "a unit"}`);
    }
    case "MARKER_REMOVED": {
      const marker = str(meta.marker_type);
      return line(`${marker ? capitalize(humanize(marker)) : "A"} marker was removed`);
    }
    case "GOLD_GAINED": {
      const amount = num(meta.amount);
      const reason = GOLD_REASONS[str(meta.reason) ?? ""] ?? "";
      return line(`${someone(actor)} gained ${amount ?? "some"} gold${reason}`);
    }
    case "GOLD_LOST": {
      const amount = num(meta.amount);
      const loser = target ?? nameOf(str(meta.owner_id));
      return line(`${someone(loser)} lost ${amount ?? "some"} gold`);
    }
    case "ITEM_GAINED": {
      const stat = str(meta.stat_type);
      const item = stat ? `${article(humanize(stat))} item` : "an item";
      return line(`${someone(actor)} gained ${item}`);
    }
    case "LIFE_COUNTER_CHANGED": {
      const team = teamName(meta.team);
      const change = num(meta.change);
      const remaining = num(meta.remaining);
      const who = team ? `${team} team` : "A team";
      const left = remaining !== null ? ` (${remaining} left)` : "";
      if (change === null || change === 0) return line(`${who}'s life counters changed${left}`);
      const verb = change < 0 ? "lost" : "gained";
      return line(`${who} ${verb} ${plural(Math.abs(change), "life counter")}${left}`);
    }
    case "CARD_RETRIEVED": {
      const name = card("card_id");
      return line(`${someone(actor)} retrieved ${name ?? "a card"}`);
    }
    case "CARD_SELECTED_FOR_GUESS": {
      const attempt = num(meta.attempt);
      return line(`${target ?? "A hero"} chose a facedown card for ${actor ?? "a hero"}'s guess${attempt !== null ? ` (attempt ${attempt})` : ""}`);
    }
    case "GUESSED_CARD_REVEALED": {
      const guessed = str(meta.guessed_color) ?? "a color";
      const actual = str(meta.card_color) ?? "unknown";
      const name = card("card_id") ?? "a card";
      const verdict = meta.guess_correct === true ? "correct" : "wrong";
      return line(`${someone(actor)} guessed ${humanize(guessed)}; ${target ?? "the target"} revealed ${name} (${humanize(actual)}): ${verdict}`);
    }
    case "CARD_REVEALED": {
      const name = card("card_id") ?? "a card";
      const owner = nameOf(str(meta.owner_id)) ?? target;
      return line(`${someone(actor)} revealed ${name}${owner ? ` from ${owner}'s hand` : ""}`);
    }
    case "SPELL_CAST": {
      const caster = nameOf(str(meta.caster_id)) ?? actor;
      return line(`${someone(caster)} cast ${card("spell_id", "spell_name") ?? "a spell"}`);
    }
    case "SPELL_REMOVED_FROM_SPELLBOOK": {
      const owner = nameOf(str(meta.owner_id)) ?? actor;
      return line(`${card("spell_id", "spell_name") ?? "A spell"} left ${owner ? `${owner}'s` : "the"} spellbook`);
    }
    case "SPELLBOOK_PREPARED": {
      const count = num(meta.spellbook_count);
      return line(`${someone(actor)} prepared their spellbook${count !== null ? ` (${plural(count, "spell")})` : ""}`);
    }
    case "WISH_CAST_COUNT_CHANGED": {
      const count = num(meta.count);
      const required = num(meta.required);
      return line(
        count !== null && required !== null
          ? `${someone(actor)} has cast Wish ${count} of ${required} times`
          : `${someone(actor)} cast Wish`,
      );
    }
    case "RESOLVED_CARDS_SWAPPED": {
      const a = card("card_a_id");
      const b = card("card_b_id");
      return line(a && b ? `${someone(actor)} swapped ${a} and ${b}` : `${someone(actor)} swapped two resolved cards`);
    }
    case "DECK_CARD_SWAPPED":
      return line(`${someone(actor)} swapped a card with their deck`);
    case "MINION_PROTECTED":
      return line(`${someone(actor)} protected ${target ?? "a minion"}`);
    case "TURN_ENDED":
      return { text: `${actor ? `${actor}'s turn` : "Turn"} ended`, turnEnd: true };
    case "MINE_TRIGGERED":
      return line(
        meta.is_blast === true
          ? `${someone(actor)} set off a mine and it exploded`
          : `${someone(actor)} set off a mine, but it was a dud`,
      );
    case "HERO_LAUGHED":
      return line(`${someone(actor)} laughed`);
    case "TIE_BREAKER_FLIPPED": {
      const team = teamName(meta.tie_breaker_team);
      return line(team ? `The tie breaker flipped to the ${team} team` : "The tie breaker flipped");
    }
    case "RUNES_PLACED":
      return line(`${someone(actor)} placed runes`);
    case "TIMER_EXPIRED":
      return line(formatTimerExpired(meta, actor, (id) => ctx.cardName(id)));
    case "GAME_OVER": {
      const winner = resolveWinnerDisplay(ctx.view, str(meta.winner), ctx.heroName);
      if (!winner) return line("Game over");
      const subject = winner.type === "TEAM" ? `${winner.label} team` : winner.label;
      const condition = str(meta.condition);
      return line(`${subject} won${condition ? ` (${humanize(condition)})` : ""}`);
    }
    default: {
      const what = humanize(event.event_type);
      return line(actor ? `${actor}: ${what}${target ? ` (${target})` : ""}` : capitalize(what));
    }
  }
}

function formatTimerExpired(
  meta: Record<string, unknown>,
  actor: string | null,
  cardName: (id: string) => string | null,
): string {
  const who = actor ?? "A hero";
  const kind = str(meta.clock_kind) ?? "clock";
  const action = str(meta.automatic_action) ?? "decision";
  if (kind === "PLANNING") {
    if (action === "commit") {
      const id = str(meta.card_id);
      const name = (id && cardName(id)) ?? "a card";
      return `${who}'s Planning clock expired: ${name} was selected`;
    }
    if (action === "pass") return `${who}'s Planning clock expired: passed with an empty hand`;
    return `${who}'s Planning clock expired: first card locked in`;
  }
  if (kind === "LEVEL_UP") return `${who}'s Upgrade clock expired: an upgrade was selected`;
  const selection = str(meta.selection);
  const suffix = selection ? `: ${selection}` : "";
  const team = teamName(meta.team);
  if (team) return `${team} team's Response clocks expired${suffix}`;
  return `${who}'s ${kind === "RESPONSE" ? "Response" : "Resolution"} clock expired${suffix}`;
}
