import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CardSelectOverlay } from "./CardSelectOverlay";
import type { GameView, InputRequest } from "../../../types/game";

const inputRequest = {
  type: "SELECT_CARD",
  prompt: "Discard a card",
  valid_options: ["c1"],
  options: [{ id: "c1", text: "Sidestep" }],
} as unknown as InputRequest;

const view = {
  teams: {
    red: {
      heroes: [
        {
          id: "hero_widget",
          hand: [{ id: "c1", name: "Sidestep", is_facedown: false }],
          discard_pile: [],
          played_cards: [],
        },
      ],
    },
  },
} as unknown as GameView;

describe("CardSelectOverlay board peek", () => {
  it("offers a visible way to read the board, not only the Alt hold", () => {
    const html = renderToStaticMarkup(
      <CardSelectOverlay view={view} inputRequest={inputRequest} onSelect={() => {}} />,
    );

    expect(html).toContain('aria-label="View the board"');
    expect(html).toContain('aria-pressed="false"');
  });
});
