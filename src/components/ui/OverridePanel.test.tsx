import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { GameView, HeroView } from "../../types/game";
import type { OverrideHistoryResponse, OverrideSchemaResponse } from "../../api/overrides";
import { OverridePanel } from "./OverridePanel";
import { finishedTurns, summarizeProposal } from "../../utils/overrideSummary";

const view = {
  phase: "PLANNING",
  turn: 1,
  unresolved_hero_ids: [],
  tokens: [],
  wave_counters: { lane_1: 5 },
  battle_zones: { lane_1: "Mid" },
  tie_breaker_team: "RED",
  teams: {
    RED: {
      life_counters: 6,
      heroes: [{
        id: "hero_arien", name: "Arien", gold: 3, level: 1, items: { ATTACK: 1 },
        hand: [{ id: "noble_blade", name: "Noble Blade" }],
        deck: [
          { id: "noble_blade", name: "Noble Blade", state: "HAND" },
          { id: "living_tsunami", name: "Living Tsunami", state: "DECK" },
          { id: "dangerous_current", name: "Dangerous Current", state: "DISCARD" },
          { id: "spell_break", name: "Spell Break", state: "HAND" },
        ],
        ultimate_card: null,
        played_cards: [null],
        current_turn_card: null,
        extra_turn_card: null,
        discard_pile: [{ id: "dangerous_current", name: "Dangerous Current" }],
      }],
      minions: [{ id: "minion_7", type: "HEAVY", team: "RED", value: 4, is_heavy: true }],
    },
    BLUE: {
      life_counters: 4,
      heroes: [{
        id: "hero_wasp", name: "Wasp", gold: 2, level: 1, items: {},
        hand: [], hand_size: 4, deck: { count: 12 },
        played_cards: [], current_turn_card: null, extra_turn_card: null, discard_pile: [],
      }],
      minions: [],
    },
  },
  board: { map: "m", tiles: {}, zones: {}, entity_locations: { hero_arien: { q: 0, r: 0, s: 0 } } },
} as unknown as GameView;

const schema: OverrideSchemaResponse = {
  ops: [
    {
      name: "add_marker",
      family: "patch",
      label: "Place marker",
      description: "Place a singleton marker.",
      args_schema: {
        type: "object",
        properties: {
          marker_type: { type: "string" },
          target_id: { type: "string" },
          value: { type: "integer" },
          source_id: { type: "string" },
        },
        required: ["marker_type", "target_id", "source_id"],
      },
    },
  ],
};

const history: OverrideHistoryResponse = {
  total: 2,
  decisions: [
    { index: 0, type: "commit", round: 1, turn: 1, hero_id: "hero_arien", label: "hero_arien committed a card", superseded: true },
    { index: 1, type: "ov_rewind", round: 1, turn: 1, hero_id: "hero_arien", label: "The table rewound the game to decision 0", superseded: false },
  ],
};

function render(props: Partial<Parameters<typeof OverridePanel>[0]> = {}) {
  return renderToStaticMarkup(
    <OverridePanel
      view={view}
      gameId="g1"
      token="t"
      onClose={() => {}}
      onPropose={() => {}}
      onStartBoardPick={() => {}}
      preloadedSchema={schema}
      preloadedHistory={history}
      {...props}
    />,
  );
}

describe("OverridePanel", () => {
  it("renders the six tabs", () => {
    const html = render();
    for (const tab of ["Board", "Cards", "Values", "Advanced", "Unstick", "Rewind"]) {
      expect(html).toContain(tab);
    }
  });

  it("board tab offers the three board fixes", () => {
    const html = render({ initialTab: "board" });
    expect(html).toContain("Move a unit or token");
    expect(html).toContain("Remove a unit or token");
    expect(html).toContain("Put a unit back on the board");
  });

  it("board tab lists off-board units by name instead of asking for an id", () => {
    const html = render({ initialTab: "board" });
    expect(html).toContain("Wasp");
    expect(html).toContain("Red heavy minion");
    expect(html).not.toContain("entity id");
  });

  it("unstick tab offers the four escape hatches", () => {
    const html = render({ initialTab: "unstick" });
    expect(html).toContain("Skip the stuck input");
    expect(html).toContain("Abort the current action");
    expect(html).toContain("Force the turn to end");
    expect(html).toContain("Fix whose turn it is");
  });

  it("cards tab lists the chosen hero's cards by zone", () => {
    const html = render({ initialTab: "cards", myHeroId: "hero_arien" });
    expect(html).toContain("Noble Blade");
    expect(html).toContain("Dangerous Current");
    expect(html).toContain("Discard pile");
  });

  it("cards tab explains an opponent's hidden hand", () => {
    const html = render({ initialTab: "cards", myHeroId: "hero_wasp" });
    expect(html).toContain("4 hidden");
    expect(html).toContain("only Wasp can move cards out of their deck");
  });

  it("cards tab lists deck cards that no other zone holds, flagging lost ones", () => {
    const html = render({ initialTab: "cards", myHeroId: "hero_arien" });
    expect(html).toContain("Living Tsunami");
    expect(html.match(/Noble Blade/g)).toHaveLength(1);
    expect(html.match(/Dangerous Current/g)).toHaveLength(1);
    expect(html).toMatch(/Spell Break.*\(lost\)/);
  });

  it("values tab shows every current value per team and hero", () => {
    const html = render({ initialTab: "values" });
    expect(html).toContain("Red team");
    expect(html).toContain("Blue team");
    expect(html).toMatch(/Gold.*?>3</s);
    expect(html).toMatch(/Life counters.*?>6</s);
    expect(html).toContain("Wave counter");
    expect(html).not.toContain("lane_1");
    expect(html).not.toContain("→");
  });

  it("values tab offers item counts and the wrong-upgrade swap per hero", () => {
    const html = render({ initialTab: "values" });
    expect(html).toMatch(/Attack items.*?>1</s);
    expect(html).toContain("Add item");
    expect(html.match(/Swap upgrade with item/g)).toHaveLength(2);
    expect(html).toContain("Green III");
  });

  it("advanced tab lists non-curated ops from the schema", () => {
    const html = render({ initialTab: "advanced" });
    expect(html).toContain("Place marker");
  });

  it("rewind tab greys superseded rows and marks rewind rows", () => {
    const html = render({ initialTab: "rewind" });
    expect(html).toContain("hero_arien committed a card");
    expect(html).toContain("superseded");
    expect(html).toContain("rewound the game");
  });
});

describe("finishedTurns", () => {
  const hero = { id: "hero_arien", current_turn_card: null } as unknown as HeroView;
  it("counts only earlier turns while planning", () => {
    expect(finishedTurns({ ...view, phase: "PLANNING", turn: 3 } as GameView, hero)).toBe(2);
  });
  it("counts the current turn once the hero has resolved it", () => {
    expect(finishedTurns({ ...view, phase: "RESOLUTION", turn: 3, unresolved_hero_ids: ["hero_wasp"] } as GameView, hero)).toBe(3);
  });
});

describe("summarizeProposal", () => {
  it("states old and new values", () => {
    expect(
      summarizeProposal({ family: "patch", op: "set_gold", args: { hero_id: "hero_arien", value: 9 } }, view),
    ).toBe("Set Arien's gold from 3 to 9");
    expect(
      summarizeProposal({ family: "patch", op: "set_life_counters", args: { team: "BLUE", value: 3 } }, view),
    ).toBe("Set Blue team's life counters from 4 to 3");
    expect(
      summarizeProposal({ family: "patch", op: "set_wave_counter", args: { lane_id: "lane_1", value: 4 } }, view),
    ).toBe("Set wave counter from 5 to 4");
    expect(
      summarizeProposal({ family: "patch", op: "set_tie_breaker_team", args: { team: "BLUE" } }, view),
    ).toBe("Give the tie-breaker to Blue team");
  });

  it("names the card, its current zone and the destination for move_card", () => {
    expect(
      summarizeProposal(
        { family: "patch", op: "move_card", args: { hero_id: "hero_arien", card_id: "dangerous_current", zone: "hand" } },
        view,
      ),
    ).toBe("Move Arien's Dangerous Current from discard pile to hand");
  });

  it("names the deck as a source", () => {
    expect(
      summarizeProposal(
        { family: "patch", op: "move_card", args: { hero_id: "hero_arien", card_id: "living_tsunami", zone: "hand" } },
        view,
      ),
    ).toBe("Move Arien's Living Tsunami from deck to hand");
  });

  it("names the chosen played slot", () => {
    expect(
      summarizeProposal(
        { family: "patch", op: "move_card", args: { hero_id: "hero_arien", card_id: "noble_blade", zone: "played", slot: 2 } },
        view,
      ),
    ).toBe("Move Arien's Noble Blade from hand to played slot 2");
  });

  it("names entities and zones for board fixes", () => {
    const boardView = {
      ...view,
      tokens: [],
      board: { ...view.board, tiles: { a: { hex: { q: 1, r: 0, s: -1 }, zone_id: "BlueJungle" } } },
    } as unknown as GameView;
    expect(
      summarizeProposal(
        { family: "patch", op: "place_entity", args: { entity_id: "minion_7", hex: { q: 1, r: 0, s: -1 } } },
        boardView,
      ),
    ).toBe("Place Red heavy minion in Blue Jungle");
  });

  it("describes a rewind", () => {
    expect(summarizeProposal({ family: "rewind", to: 4 })).toContain("decision 4");
  });
});
