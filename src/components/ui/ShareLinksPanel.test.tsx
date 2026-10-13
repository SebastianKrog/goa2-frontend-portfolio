import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { GameView } from "../../types/game";
import { ShareLinksPanel } from "./ShareLinksPanel";

const view = {
  teams: {
    RED: { heroes: [{ id: "hero_arien", name: "Arien" }], minions: [] },
    BLUE: { heroes: [{ id: "hero_wasp", name: "Wasp" }], minions: [] },
  },
} as unknown as GameView;

function render(props: Partial<Parameters<typeof ShareLinksPanel>[0]> = {}) {
  return renderToStaticMarkup(
    <ShareLinksPanel
      gameId="g1"
      origin="https://table.test"
      token="mine"
      view={view}
      heroNames={{}}
      myHeroId="hero_arien"
      revealedPlayerTokens={{}}
      proposalOpen={false}
      onRequestPlayerLink={() => {}}
      onClose={() => {}}
      preloadedSpectatorToken="spec-token"
      {...props}
    />,
  );
}

describe("ShareLinksPanel", () => {
  it("offers the spectator link without a vote", () => {
    expect(render()).toContain("https://table.test/game/g1?token=spec-token");
  });

  it("lists every hero with a way to ask the table", () => {
    const html = render();
    expect(html).toContain("Arien");
    expect(html).toContain("Wasp");
    expect(html.match(/>Ask the table</g)).toHaveLength(2);
  });

  it("shows a seat link only once the table has released it", () => {
    const html = render({ revealedPlayerTokens: { hero_wasp: "wasp-token" } });
    expect(html).toContain("https://table.test/game/g1?token=wasp-token");
    expect(html.match(/>Ask the table</g)).toHaveLength(1);
  });

  it("prefers the player's own name over the hero name", () => {
    expect(render({ heroNames: { hero_wasp: "Ana" } })).toContain("Ana");
  });

  it("gives spectators the watch link but no vote", () => {
    const html = render({ myHeroId: null });
    expect(html).toContain("https://table.test/game/g1?token=spec-token");
    expect(html).not.toContain("Ask the table");
    expect(html).toContain("Only players at the table can call this vote.");
  });

  it("blocks a second request while a proposal is open", () => {
    expect(render({ proposalOpen: true })).toContain("disabled");
  });
});
