import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { CardView, GameView } from "../../types/game";
import { SpellCastReveal } from "./SpellCastReveal";

vi.mock("../board3d/hud/CardCanvas", () => ({
  CardCanvas: ({ card }: { card: CardView }) => <div data-card={card.id} />,
}));

const shield = { id: "shield", name: "Shield", color: "GREEN" } as CardView;

const view = {
  teams: {
    red: { heroes: [{ id: "hero_gydion", name: "Gydion" }, { id: "hero_nebkher", name: "NebKher" }] },
  },
} as unknown as GameView;

describe("SpellCastReveal", () => {
  it("renders nothing without a cast", () => {
    expect(renderToStaticMarkup(<SpellCastReveal reveal={null} view={view} />)).toBe("");
  });

  it("names the caster and shows the spell card", () => {
    const html = renderToStaticMarkup(
      <SpellCastReveal
        reveal={{ key: 1, spell: shield, casterId: "hero_gydion", ownerId: "hero_gydion" }}
        view={view}
      />,
    );
    expect(html).toContain("Gydion cast a spell");
    expect(html).toContain('data-card="shield"');
    expect(html).toContain("Shield");
    expect(html).not.toContain("spellbook");
  });

  it("credits the spellbook owner when another hero casts from it", () => {
    const html = renderToStaticMarkup(
      <SpellCastReveal
        reveal={{ key: 2, spell: shield, casterId: "hero_nebkher", ownerId: "hero_gydion" }}
        view={view}
      />,
    );
    expect(html).toContain("NebKher cast a spell");
    expect(html).toContain("from Gydion&#x27;s spellbook");
  });
});
