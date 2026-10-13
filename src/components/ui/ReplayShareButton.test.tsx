import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PhaseBar } from "./PhaseBar";
import type { GameView } from "../../types/game";

function makeView(phase: string): GameView {
  return {
    phase,
    round: 4,
    turn: 2,
    tie_breaker_team: "RED",
    teams: {
      RED: { heroes: [], life_counters: 2, starting_life_counters: 3 },
      BLUE: { heroes: [], life_counters: 0, starting_life_counters: 3 },
    },
    wave_counters: {},
  } as unknown as GameView;
}

describe("replay share button in the top bar", () => {
  it("offers the share to a seated player once the game is over", () => {
    const html = renderToStaticMarkup(
      <PhaseBar
        view={makeView("GAME_OVER")}
        winner="RED"
        replayShare={{ gameId: "g1", token: "player-token" }}
      />,
    );

    expect(html).toContain("Share replay");
  });

  it("hides the share while the match is still running", () => {
    const html = renderToStaticMarkup(
      <PhaseBar
        view={makeView("PLANNING")}
        winner={null}
        replayShare={{ gameId: "g1", token: "player-token" }}
      />,
    );

    expect(html).not.toContain("Share replay");
  });

  it("hides the share from spectators, who cannot mint one", () => {
    const html = renderToStaticMarkup(
      <PhaseBar view={makeView("GAME_OVER")} winner="RED" />,
    );

    expect(html).not.toContain("Share replay");
  });
});
