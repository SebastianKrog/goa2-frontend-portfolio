import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReadyOverlay } from "./ReadyOverlay";
import type { GameClockView, GameView } from "../../types/game";

const view = {
  teams: {
    RED: { heroes: [{ id: "hero_arien", name: "Arien" }] },
    BLUE: { heroes: [{ id: "hero_wasp", name: "Wasp" }] },
  },
} as unknown as GameView;

function clock(overrides: Partial<GameClockView>): GameClockView {
  return {
    status: "WAITING_FOR_PLAYERS",
    enforce_timeouts: true,
    server_now_ms: 0,
    turn_key: { round: 1, turn: 1 },
    ready_hero_ids: [],
    pause: null,
    active: null,
    players: {},
    ...overrides,
  };
}

function render(clockView: GameClockView, myHeroId: string | null = "hero_arien") {
  return renderToStaticMarkup(
    <ReadyOverlay
      view={view}
      clock={clockView}
      myHeroId={myHeroId}
      connected
      onReady={() => {}}
    />,
  );
}

describe("ReadyOverlay", () => {
  it("names who requested a consensus pause", () => {
    const html = render(
      clock({ status: "PAUSED", pause: { requested_by: "hero_wasp", since_ms: 1_000 } }),
    );

    expect(html).toContain("Match paused");
    expect(html).toContain("Wasp");
  });

  it("tells players the match waits for everyone to come back", () => {
    const html = render(
      clock({ status: "PAUSED", pause: { requested_by: "hero_wasp", since_ms: 1_000 } }),
    );

    expect(html).toContain("every player");
  });

  it("shows who is still missing while paused", () => {
    const html = render(
      clock({
        status: "PAUSED",
        ready_hero_ids: ["hero_arien"],
        pause: { requested_by: "hero_arien", since_ms: 1_000 },
      }),
    );

    expect(html).toContain("Ready");
    expect(html).toContain("Waiting");
  });

  it("offers to resume rather than to start when paused", () => {
    const html = render(
      clock({ status: "PAUSED", pause: { requested_by: "hero_wasp", since_ms: 1 } }),
    );

    expect(html).toContain("I’m back");
  });

  it("keeps the pre-match ready check unchanged", () => {
    const html = render(clock({ status: "WAITING_FOR_PLAYERS" }));

    expect(html).toContain("Ready check");
    expect(html).toContain("I’m ready");
  });

  it("still distinguishes an inactivity suspension from a consensus pause", () => {
    const html = render(clock({ status: "SUSPENDED_FOR_INACTIVITY" }));

    expect(html).toContain("Paused for inactivity");
    expect(html).not.toContain("Match paused");
  });
});
