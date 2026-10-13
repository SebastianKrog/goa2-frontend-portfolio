import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StartingPositionControls } from "./StartingPositionControls";

function render(choosing: boolean) {
  return renderToStaticMarkup(<StartingPositionControls
    position={{ destinations: [], swap_targets: ["hero_arien"], requests: [
      { id: "a", from: "hero_arien", to: "hero_min" },
    ] }}
    heroId="hero_min" choosing={choosing} onChoosing={() => {}} onAction={() => {}}
    heroName={() => "Arien"}
  />);
}

describe("starting positions", () => {
  it("shows incoming consent even when the recipient has not opened the controls", () => {
    const html = render(false);
    expect(html).toContain("Arien wants to swap starting positions.");
    expect(html).toContain("Accept");
    expect(html).toContain("Decline");
    expect(html).not.toContain("Swap with Arien");
  });
  it("offers teammate swaps when there are no empty starting spaces", () => {
    const html = render(true);
    expect(html).toContain("Swap with Arien");
    expect(html).toContain("Request a swap with a teammate.");
    expect(html).not.toContain("highlighted space");
  });
});
