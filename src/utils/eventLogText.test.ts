import { describe, expect, it } from "vitest";
import type { GameEvent, GameEventType, GameView, HeroView, MinionView } from "../types/game";
import { captureNames, formatEvent, type EntityNames } from "./eventLogText";

const hero = (id: string, name: string, team: string): HeroView =>
  ({ id, name, team, hand: [], deck: { count: 0 }, played_cards: [], discard_pile: [] }) as unknown as HeroView;

const minion = (id: string, type: string): MinionView =>
  ({ id, type, team: "BLUE", value: 1, is_heavy: false });

const view = (minions: MinionView[] = []): GameView =>
  ({
    teams: {
      red: { color: "RED", life_counters: 5, heroes: [hero("hero_arien", "Arien", "RED")], minions: [] },
      blue: { color: "BLUE", life_counters: 5, heroes: [hero("hero_brogan", "Brogan", "BLUE")], minions },
    },
    tokens: [{ id: "mine_1", name: "Mine", token_type: "mine", owner_id: "hero_arien", hex: null }],
    board_entities: [],
  }) as unknown as GameView;

const event = (event_type: GameEventType, overrides: Partial<GameEvent> = {}): GameEvent => ({
  event_type,
  actor_id: null,
  target_id: null,
  from_hex: null,
  to_hex: null,
  metadata: {},
  ...overrides,
});

const format = (e: GameEvent, names: EntityNames = {}, current = view()) =>
  formatEvent(e, {
    names,
    view: current,
    heroName: (_id, fallback) => fallback,
    cardName: (id) => (id === "arien_card_1" ? "Liquid Leap" : null),
  })?.text;

describe("formatEvent", () => {
  it("reports combat values and outcome", () => {
    expect(
      format(
        event("COMBAT_RESOLVED", {
          actor_id: "hero_arien",
          target_id: "hero_brogan",
          metadata: { attack_value: 5, defense_value: 3, modifier_value: 1, outcome: "BLOCKED" },
        }),
      ),
    ).toBe("Arien attacked Brogan (attack 5, defense 3 + 1): blocked");
    expect(
      format(
        event("COMBAT_RESOLVED", {
          actor_id: "hero_arien",
          target_id: "hero_brogan",
          metadata: { attack_value: 4, defense_value: null, outcome: "DEFEATED" },
        }),
      ),
    ).toBe("Arien attacked Brogan (attack 4, no defense): defeated");
  });

  it("names a defeated minion from the view captured before it left the board", () => {
    const defeat = event("UNIT_DEFEATED", { actor_id: "hero_arien", target_id: "minion_12" });
    const names = captureNames(defeat, [view(), view([minion("minion_12", "MELEE")])]);

    expect(format(defeat, names)).toBe("Blue melee minion was defeated by Arien");
  });

  it("never prints Unknown for an event without an actor", () => {
    const text = format(event("EFFECT_CREATED", { actor_id: "system", metadata: { effect_type: "IMMUNITY_ENEMY_ACTIONS" } }));

    expect(text).toBe("Effect started: immunity enemy actions");
  });

  it("counts movement distance from the hexes", () => {
    expect(
      format(
        event("UNIT_MOVED", {
          actor_id: "hero_arien",
          from_hex: { q: 0, r: 0, s: 0 },
          to_hex: { q: 2, r: -1, s: -1 },
        }),
      ),
    ).toBe("Arien moved 2 spaces");
  });

  it("uses the translated card name when one exists", () => {
    expect(
      format(event("CARD_RETRIEVED", { actor_id: "hero_arien", metadata: { card_id: "arien_card_1", card_name: "Raw" } })),
    ).toBe("Arien retrieved Liquid Leap");
    expect(format(event("CARD_RETRIEVED", { actor_id: "hero_arien", metadata: { card_id: null } }))).toBe(
      "Arien retrieved a card",
    );
  });

  it("marks turn ends as dividers", () => {
    const line = formatEvent(event("TURN_ENDED", { actor_id: "hero_brogan" }), {
      names: {},
      view: view(),
      heroName: (_id, fallback) => fallback,
      cardName: () => null,
    });

    expect(line).toEqual({ text: "Brogan's turn ended", turnEnd: true });
  });

  it("describes life counters, gold and mines", () => {
    expect(format(event("LIFE_COUNTER_CHANGED", { metadata: { team: "RED", change: -2, remaining: 3 } }))).toBe(
      "Red team lost 2 life counters (3 left)",
    );
    expect(format(event("GOLD_GAINED", { actor_id: "hero_arien", metadata: { amount: 1, reason: "assist" } }))).toBe(
      "Arien gained 1 gold for an assist",
    );
    expect(format(event("MINE_TRIGGERED", { actor_id: "hero_brogan", metadata: { is_blast: false } }))).toBe(
      "Brogan set off a mine, but it was a dud",
    );
  });

  it("falls back to readable text for event types it does not know", () => {
    expect(format(event("SOMETHING_NEW" as GameEventType, { actor_id: "hero_arien" }))).toBe("Arien: something new");
    expect(format(event("SOMETHING_NEW" as GameEventType))).toBe("Something new");
  });
});
