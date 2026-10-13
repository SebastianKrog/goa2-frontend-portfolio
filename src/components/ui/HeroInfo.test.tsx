import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CardView, HeroView } from "../../types/game";
import { HeroInfo } from "./HeroInfo";

const hero: HeroView = {
  id: "hero_snorri",
  name: "Snorri",
  title: "",
  team: "RED",
  level: 1,
  gold: 0,
  items: {},
  hand: [],
  deck: { count: 0 },
  played_cards: [],
  current_turn_card: null,
  extra_turn_card: null,
  can_commit_second_card: false,
  discard_pile: [],
  ultimate_card: null,
};

describe("HeroInfo", () => {
  it("shows the player's name beside the hero", () => {
    const html = renderToStaticMarkup(<HeroInfo hero={hero} playerName="Mad_Mike" isYou />);
    expect(html).toContain("Snorri");
    expect(html).toContain("Mad_Mike");
    expect(html.indexOf("Snorri")).toBeLessThan(html.indexOf("Mad_Mike"));
  });

  it("trims player names to the plaque's limit", () => {
    const html = renderToStaticMarkup(<HeroInfo hero={hero} playerName={`  ${"x".repeat(30)}  `} />);
    expect(html).toContain("x".repeat(20));
    expect(html).not.toContain("x".repeat(21));
  });

  it("shows only the hero name without a player name", () => {
    for (const playerName of [undefined, "", "   "]) {
      const html = renderToStaticMarkup(<HeroInfo hero={hero} playerName={playerName} />);
      expect(html).not.toContain("playerName");
    }
  });

  it("shows Snorri's runes by turn and marks the current one", () => {
    const html = renderToStaticMarkup(
      <HeroInfo hero={{ ...hero, rune_slots: { "2": "bird", "1": "axe" } }} turn={2} />,
    );
    expect(html).toContain("Runes");
    expect(html.indexOf("Turn 1 rune: axe")).toBeLessThan(html.indexOf("Turn 2 rune: bird (active)"));
    expect(html).not.toContain("Turn 1 rune: axe (active)");
  });

  it("shows a pile of face-up spells for spellcasters only", () => {
    const spell: CardView = {
      id: "shield", name: "Shield", tier: "", color: null, primary_action: null,
      primary_action_value: null, secondary_actions: {}, effect_id: null, effect_text: null,
      initiative: 0, state: "OUTSIDE_SPELLBOOK", is_facedown: false, is_ranged: false,
      range_value: null, radius_value: null, item: null, is_active: false,
    };
    expect(renderToStaticMarkup(<HeroInfo hero={hero} />)).not.toContain("Spells");
    const html = renderToStaticMarkup(
      <HeroInfo hero={{ ...hero, spellbook: { count: 3 }, cast_spells: [spell] }} />,
    );
    expect(html).toContain("Spells");
  });
});
