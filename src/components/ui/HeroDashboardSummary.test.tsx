import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CardView, GameView, HeroView } from "../../types/game";
import { HeroDashboardSummary } from "./HeroDashboardSummary";

const card = (id: string, color: string): CardView => ({
  id,
  name: id,
  tier: "I",
  color,
  primary_action: null,
  primary_action_value: null,
  secondary_actions: {},
  effect_id: null,
  effect_text: null,
  initiative: 5,
  state: "PLAYED",
  is_facedown: false,
  is_ranged: false,
  range_value: null,
  radius_value: null,
  item: null,
  is_active: false,
});

const hero = (overrides: Partial<HeroView> = {}): HeroView => ({
  id: "hero_cutter",
  name: "Cutter",
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
  ...overrides,
});

const view = (heroes: HeroView[], extra: Partial<GameView> = {}): GameView => ({
  turn: 1,
  effects: [],
  ...extra,
  teams: {
    red: { color: "RED", life_counters: 0, minions: [], heroes: heroes.filter((h) => h.team === "RED") },
    blue: { color: "BLUE", life_counters: 0, minions: [], heroes: heroes.filter((h) => h.team === "BLUE") },
  },
} as unknown as GameView);

describe("HeroDashboardSummary", () => {
  it("maps played-card array indices to the four turn slots without collapsing gaps", () => {
    const html = renderToStaticMarkup(
      <HeroDashboardSummary
        view={view([hero({ played_cards: [card("red play", "RED"), null, card("blue play", "BLUE")] })])}
        myHeroId="hero_cutter"
        hidden={false}
        onHiddenChange={() => {}}
      />,
    );

    expect(html).toContain('aria-label="T1: red play"');
    expect(html).toContain('aria-label="T2: empty"');
    expect(html).toContain('aria-label="T3: blue play"');
    expect(html).toContain('aria-label="T4: empty"');
  });

  it("glows the bar of a played or discarded card whose effect is still active", () => {
    const html = renderToStaticMarkup(
      <HeroDashboardSummary
        view={view([hero({
          played_cards: [{ ...card("lasting", "RED"), is_active: true }, card("plain", "BLUE")],
          discard_pile: [card("spent", "GREEN"), { ...card("lingering", "GOLD"), is_active: true }],
        })])}
        myHeroId="hero_cutter"
        hidden={false}
        onHiddenChange={() => {}}
      />,
    );

    expect(html).toContain('aria-label="T1: lasting (active effect)"');
    expect(html).toContain('aria-label="T2: plain"');
    expect(html).toContain('aria-label="Discard 1: spent"');
    expect(html).toContain('aria-label="Discard 2: lingering (active effect)"');
    expect(html.match(/cardMarkerActive/g) ?? []).toHaveLength(2);
    expect(html.match(/cardLabelActive/g) ?? []).toHaveLength(1);
  });

  it("renders discards as an unlabeled stack of individually accessible bars", () => {
    const html = renderToStaticMarkup(
      <HeroDashboardSummary
        view={view([hero({ discard_pile: [card("first discard", "GOLD"), card("second discard", "GREEN")] })])}
        myHeroId="hero_cutter"
        hidden={false}
        onHiddenChange={() => {}}
      />,
    );

    expect(html).toContain('aria-label="Cutter discarded cards"');
    expect(html).toContain('aria-label="Discard 1: first discard"');
    expect(html).toContain('aria-label="Discard 2: second discard"');
    expect(html).not.toContain(">D1<");
    expect(html).not.toContain(">D2<");
  });

  it("repeats item icons for item quantities and ignores invalid values", () => {
    const html = renderToStaticMarkup(
      <HeroDashboardSummary
        view={view([hero({ items: { ATTACK: 2, RANGE: 1, DEFENSE: -1, RADIUS: "2" } })])}
        myHeroId="hero_cutter"
        hidden={false}
        onHiddenChange={() => {}}
      />,
    );

    expect(html.match(/src="\/icons\/attack.png"/g)).toHaveLength(2);
    expect(html.match(/src="\/icons\/range.png"/g)).toHaveLength(1);
    expect(html).not.toContain("/icons/defense.png");
    expect(html).not.toContain("/icons/radius.png");
  });

  it("shows the local team first and stays absent without heroes", () => {
    const mine = hero();
    const opponent = hero({ id: "hero_mortimer", name: "Mortimer", team: "BLUE" });
    const html = renderToStaticMarkup(
      <HeroDashboardSummary
        view={view([opponent, mine])}
        myHeroId={mine.id}
        hidden={false}
        onHiddenChange={() => {}}
      />,
    );

    expect(html.indexOf("Cutter dashboard")).toBeLessThan(html.indexOf("Mortimer dashboard"));
    expect(renderToStaticMarkup(
      <HeroDashboardSummary view={view([])} myHeroId={null} hidden={false} onHiddenChange={() => {}} />,
    )).toBe("");
  });

  it("collapses to a button and offers to reopen", () => {
    const html = renderToStaticMarkup(
      <HeroDashboardSummary
        view={view([hero()])}
        myHeroId="hero_cutter"
        hidden
        onHiddenChange={() => {}}
      />,
    );

    expect(html).toContain('aria-label="Show hero dashboards"');
    expect(html).not.toContain("Cutter dashboard");
  });

  it("offers to hide the expanded panel", () => {
    const html = renderToStaticMarkup(
      <HeroDashboardSummary
        view={view([hero()])}
        myHeroId="hero_cutter"
        hidden={false}
        onHiddenChange={() => {}}
      />,
    );

    expect(html).toContain('aria-label="Hide hero dashboards"');
    expect(html).toContain("Cutter dashboard");
  });
  it("shows Snorri's runes under their turn slots and marks the current turn's rune active", () => {
    const html = renderToStaticMarkup(
      <HeroDashboardSummary
        view={view(
          [hero({ id: "hero_snorri", name: "Snorri", rune_slots: { "1": "axe", "2": "bird", "3": "anvil", "4": "horn" } })],
          { turn: 2 },
        )}
        myHeroId="hero_snorri"
        hidden={false}
        onHiddenChange={() => {}}
      />,
    );

    expect(html).toContain('alt="Turn 1 rune: axe"');
    expect(html).toContain('alt="Turn 2 rune: bird (active)"');
    expect(html).toContain('alt="Turn 4 rune: horn"');
    expect(html.match(/runeActive/g) ?? []).toHaveLength(1);
  });

  it("counts Gydion's cast spells and names only those whose effect is live", () => {
    const shield = { ...card("Shield", "GREEN"), id: "shield", state: "OUTSIDE_SPELLBOOK" };
    const html = renderToStaticMarkup(
      <HeroDashboardSummary
        view={view(
          [hero({
            id: "hero_gydion",
            name: "Gydion",
            spellbook: { count: 3 },
            cast_spells: [shield, { ...card("Suggestion", "BLUE"), id: "suggestion" }],
            wish_cast_count: 1,
          })],
          { effects: [{ id: "e1", type: "attack_immunity", source_card_id: "shield", duration: "THIS_ROUND", is_active: true } as GameView["effects"][number]] },
        )}
        myHeroId={null}
        hidden={false}
        onHiddenChange={() => {}}
      />,
    );

    expect(html).toContain("Cast 2");
    expect(html).toContain('aria-label="Shield (active this round)"');
    expect(html).not.toContain("Suggestion");
    expect(html).not.toContain("Book");
    expect(html.match(/activeSpell/g) ?? []).toHaveLength(1);
  });

  it("omits rune and spell sections for other heroes", () => {
    const html = renderToStaticMarkup(
      <HeroDashboardSummary view={view([hero()])} myHeroId="hero_cutter" hidden={false} onHiddenChange={() => {}} />,
    );

    expect(html).not.toContain("rune:");
    expect(html).not.toContain("Cast ");
  });
});
