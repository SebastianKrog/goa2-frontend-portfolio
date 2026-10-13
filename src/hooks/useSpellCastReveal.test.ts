import { describe, expect, it } from "vitest";
import type { CardView, GameEvent, GameView, HeroView } from "../types/game";
import type { TimestampedEvent } from "./useGameSocket";
import { spellCastRevealFromLog } from "./useSpellCastReveal";

const spell = (id: string, name: string): CardView => ({
  id,
  name,
  image_id: "GreenIA",
  tier: "I",
  color: "GREEN",
  primary_action: "SKILL",
  primary_action_value: null,
  secondary_actions: {},
  effect_id: id,
  effect_text: "",
  initiative: 0,
  state: "OUTSIDE_SPELLBOOK",
  is_facedown: false,
  is_ranged: false,
  range_value: null,
  radius_value: null,
  item: null,
  is_active: false,
  spell_rank: 1,
});

const hero = (id: string, name: string, overrides: Partial<HeroView> = {}): HeroView =>
  ({ id, name, team: "RED", ...overrides }) as HeroView;

const view = (heroes: HeroView[]): GameView =>
  ({ teams: { red: { heroes }, blue: { heroes: [] } } }) as unknown as GameView;

let nextId = 0;
const entry = (event: Partial<GameEvent>): TimestampedEvent => ({
  id: nextId++,
  timestamp: 0,
  names: {},
  event: { actor_id: null, target_id: null, from_hex: null, to_hex: null, metadata: {}, ...event } as GameEvent,
});

const cast = (spellId: string, casterId = "hero_gydion") =>
  entry({
    event_type: "SPELL_CAST",
    actor_id: casterId,
    metadata: { spell_id: spellId, owner_id: "hero_gydion", caster_id: casterId },
  });

const gydion = hero("hero_gydion", "Gydion", {
  cast_spells: [spell("shield", "Shield"), spell("fireball", "Fireball")],
});

describe("spellCastRevealFromLog", () => {
  it("is empty without a spell cast", () => {
    expect(spellCastRevealFromLog([], view([gydion]))).toBeNull();
    expect(spellCastRevealFromLog([entry({ event_type: "SPELLBOOK_PREPARED" })], view([gydion]))).toBeNull();
    expect(spellCastRevealFromLog([cast("shield")], null)).toBeNull();
  });

  it("reveals the most recently cast spell with its public card", () => {
    const log = [cast("shield"), entry({ event_type: "SPELLBOOK_PREPARED" }), cast("fireball")];
    const reveal = spellCastRevealFromLog(log, view([gydion]));
    expect(reveal?.key).toBe(log[2].id);
    expect(reveal?.spell.name).toBe("Fireball");
    expect(reveal?.casterId).toBe("hero_gydion");
    expect(reveal?.ownerId).toBe("hero_gydion");
  });

  it("keeps the caster separate from the spellbook owner", () => {
    const nebkher = hero("hero_nebkher", "NebKher");
    const reveal = spellCastRevealFromLog([cast("shield", "hero_nebkher")], view([gydion, nebkher]));
    expect(reveal?.casterId).toBe("hero_nebkher");
    expect(reveal?.ownerId).toBe("hero_gydion");
  });

  it("stays empty when the cast spell is no longer outside the spellbook", () => {
    const prepared = hero("hero_gydion", "Gydion", { cast_spells: [] });
    expect(spellCastRevealFromLog([cast("shield")], view([prepared]))).toBeNull();
  });
});
