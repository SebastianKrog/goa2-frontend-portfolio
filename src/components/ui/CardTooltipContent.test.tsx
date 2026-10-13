import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CardView } from "../../types/game";
import { CardTooltipContent } from "./CardTooltipContent";

const card = (overrides: Partial<CardView> = {}): CardView => ({
  id: "card_1",
  name: "Daring Strike",
  tier: "I",
  color: "red",
  primary_action: "ATTACK",
  primary_action_value: 4,
  secondary_actions: {},
  effect_id: null,
  effect_text: null,
  initiative: 8,
  state: "PLAYED",
  is_facedown: false,
  is_ranged: false,
  range_value: null,
  radius_value: null,
  item: null,
  is_active: false,
  ...overrides,
});

describe("card tooltip", () => {
  it("shows the initiative", () => {
    const html = renderToStaticMarkup(<CardTooltipContent card={card()} />);
    expect(html).toContain("Initiative:");
    expect(html).toContain(">8<");
  });

  it("shows it for a resolved card with no other stats", () => {
    const html = renderToStaticMarkup(
      <CardTooltipContent card={card({ primary_action: null, primary_action_value: null, initiative: 13 })} />,
    );
    expect(html).toContain("Initiative:");
    expect(html).toContain(">13<");
  });
});
