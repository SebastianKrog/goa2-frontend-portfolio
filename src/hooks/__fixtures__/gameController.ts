import type { CardView, GameClockView, GameView, HeroView } from "../../types/game";

export function card(id: string): CardView {
  return {
    id, name: id, tier: "I", color: "RED", primary_action: "ATTACK", primary_action_value: 3,
    secondary_actions: {}, initiative: 5, effect_id: null, effect_text: null,
    state: "HAND", is_facedown: false, is_ranged: false, range_value: null,
    radius_value: null, item: null, is_active: false,
  };
}

export function hero(id: string, team: string, own = false): HeroView {
  return {
    id, name: id, title: "", team, level: 1, gold: 0, items: {},
    hand: own ? [card("choice")] : [], deck: own ? [] : { count: 5 },
    played_cards: [], discard_pile: [], current_turn_card: null, extra_turn_card: null,
    ultimate_card: null, can_commit_second_card: false,
  };
}

export function game(): GameView {
  return {
    phase: "PLANNING", round: 1, turn: 1, current_actor_id: null,
    unresolved_hero_ids: [], unresolved_cards: [], battle_zones: {}, wave_counters: {},
    active_zone_id: null, cheats_enabled: false, tie_breaker_team: "RED",
    teams: {
      RED: { color: "RED", life_counters: 5, heroes: [hero("hero_own", "RED", true), hero("hero_ally", "RED")], minions: [] },
      BLUE: { color: "BLUE", life_counters: 5, heroes: [hero("hero_other", "BLUE")], minions: [] },
    },
    board: { map: "test", tiles: {}, zones: {}, entity_locations: {} },
    effects: [], markers: {}, tokens: [], time_control: null, clock: null,
  };
}

export function clock(status: GameClockView["status"] = "RUNNING", locked = false): GameClockView {
  return {
    status, enforce_timeouts: true, server_now_ms: 0, turn_key: { round: 1, turn: 1 },
    ready_hero_ids: [], pause: null, active: null,
    players: { hero_own: {
      planning_allowance_ms: 0, resolution_allowance_ms: 0, initiative_bonus_ms: 0,
      response_time_ms: 0, upgrade_allowance_ms: 0, time_bank_ms: 0, overrun_ms: 0,
      planning_complete: false, planning_locked_by_timeout: locked, running: false,
    } },
  };
}
