import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CommittedCards } from "./CommittedCards";
import type { CardView, GameView, HeroView } from "../../types/game";

const card = (id: string, facedown = false): CardView =>
  ({ id, name: id, tier: 1, initiative: 5, is_facedown: facedown }) as unknown as CardView;

const hero = (id: string, team: string, committed: CardView | null): HeroView =>
  ({
    id,
    name: id.toUpperCase(),
    title: "",
    team,
    level: 1,
    gold: 0,
    items: {},
    hand: [],
    deck: { count: 0 },
    played_cards: [],
    current_turn_card: committed,
    extra_turn_card: null,
    can_commit_second_card: false,
    discard_pile: [],
    ultimate_card: null,
  });

const view = (heroes: HeroView[]): GameView =>
  ({
    teams: {
      red: {
        color: "red",
        life_counters: 0,
        minions: [],
        heroes: heroes.filter((h) => h.team === "red"),
      },
      blue: {
        color: "blue",
        life_counters: 0,
        minions: [],
        heroes: heroes.filter((h) => h.team === "blue"),
      },
    },
  }) as unknown as GameView;

describe("CommittedCards", () => {
  it("stays out of the way until somebody commits", () => {
    const html = renderToStaticMarkup(
      <CommittedCards
        view={view([hero("r0", "red", null), hero("b0", "blue", null)])}
        myHeroId="r0"
        hidden={false}
        onHiddenChange={() => {}}
      />,
    );

    expect(html).toBe("");
  });

  it("shows a card for each hero who has committed", () => {
    const html = renderToStaticMarkup(
      <CommittedCards
        view={view([
          hero("r0", "red", card("c1")),
          hero("r1", "red", null),
          hero("b0", "blue", card("c2")),
        ])}
        myHeroId="r0"
        hidden={false}
        onHiddenChange={() => {}}
      />,
    );

    expect(html).toContain('aria-label="R0"');
    expect(html).toContain('aria-label="B0"');
    expect(html).not.toContain('aria-label="R1"');
  });

  it("splits the two teams into columns, yours first", () => {
    const html = renderToStaticMarkup(
      <CommittedCards
        view={view([hero("r0", "red", card("c1")), hero("b0", "blue", card("c2"))])}
        myHeroId="r0"
        hidden={false}
        onHiddenChange={() => {}}
      />,
    );

    expect(html.indexOf('aria-label="R0"')).toBeLessThan(html.indexOf('aria-label="B0"'));
  });

  it("keeps a facedown commit facedown", () => {
    const html = renderToStaticMarkup(
      <CommittedCards
        view={view([hero("r0", "red", card("c1", true))])}
        myHeroId="r0"
        hidden={false}
        onHiddenChange={() => {}}
      />,
    );

    expect(html).toContain('aria-label="R0, face down"');
  });
});

describe("CommittedCards hiding", () => {
  const committed = view([hero("r0", "red", card("c1"))]);

  it("drops the cards but keeps a way back when hidden", () => {
    const html = renderToStaticMarkup(
      <CommittedCards view={committed} myHeroId="r0" hidden onHiddenChange={() => {}} />,
    );

    expect(html).not.toContain('aria-label="R0"');
    expect(html).toContain('aria-label="Show committed cards"');
  });

  it("offers to hide the panel while it is showing", () => {
    const html = renderToStaticMarkup(
      <CommittedCards view={committed} myHeroId="r0" hidden={false} onHiddenChange={() => {}} />,
    );

    expect(html).toContain('aria-label="R0"');
    expect(html).toContain('aria-label="Hide committed cards"');
  });

  it("stays out of the way when hidden and nobody has committed", () => {
    const html = renderToStaticMarkup(
      <CommittedCards
        view={view([hero("r0", "red", null)])}
        myHeroId="r0"
        hidden
        onHiddenChange={() => {}}
      />,
    );

    expect(html).toBe("");
  });
});
