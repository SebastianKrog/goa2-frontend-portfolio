import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GameTools } from "./GameTools";

describe("GameTools model toggle", () => {
  it("offers painted models in the same tools rail as reporting", () => {
    const html = renderToStaticMarkup(
      <GameTools
        onReportBug={() => {}}
        onShareLinks={() => {}}
        useLegacyHeroModels
        onLegacyHeroModelsChange={() => {}}
        playerBoardLayout="interleaved"
        onPlayerBoardLayoutChange={() => {}}
        brightness={1}
        onBrightnessChange={() => {}}
        showRemotePointers
        onShowRemotePointersChange={() => {}}
      />,
    );

    expect(html).toContain('aria-label="Use painted hero models"');
    expect(html).toContain("<small>Painted</small>");
    expect(html).toContain('aria-label="Report a bug"');
    expect(html.indexOf("Use painted hero models")).toBeLessThan(
      html.indexOf("Report a bug"),
    );
  });

  it("announces the action to return to legacy models when painted is active", () => {
    const html = renderToStaticMarkup(
      <GameTools
        onReportBug={() => {}}
        onShareLinks={() => {}}
        useLegacyHeroModels={false}
        onLegacyHeroModelsChange={() => {}}
        playerBoardLayout="interleaved"
        onPlayerBoardLayoutChange={() => {}}
        brightness={1}
        onBrightnessChange={() => {}}
        showRemotePointers
        onShowRemotePointersChange={() => {}}
      />,
    );

    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('aria-label="Use legacy hero models"');
    expect(html).toContain("<small>Legacy</small>");
  });

  it("names the layout in play and the one a click moves to", () => {
    const html = renderToStaticMarkup(
      <GameTools
        onReportBug={() => {}}
        onShareLinks={() => {}}
        useLegacyHeroModels={false}
        onLegacyHeroModelsChange={() => {}}
        playerBoardLayout="grouped"
        onPlayerBoardLayoutChange={() => {}}
        brightness={1}
        onBrightnessChange={() => {}}
        showRemotePointers
        onShowRemotePointersChange={() => {}}
      />,
    );

    expect(html).toContain('aria-label="Table layout: teams grouped. Next: tabletop rows"');
    expect(html).toContain("<small>Group</small>");
  });

  it("offers the tabletop row layout as the third stop in the cycle", () => {
    const html = renderToStaticMarkup(
      <GameTools
        onReportBug={() => {}}
        onShareLinks={() => {}}
        useLegacyHeroModels={false}
        onLegacyHeroModelsChange={() => {}}
        playerBoardLayout="rows"
        onPlayerBoardLayoutChange={() => {}}
        brightness={1}
        onBrightnessChange={() => {}}
        showRemotePointers
        onShowRemotePointersChange={() => {}}
      />,
    );

    expect(html).toContain('aria-label="Table layout: tabletop rows. Next: teams mixed"');
    expect(html).toContain("<small>Rows</small>");
  });

});

describe("GameTools remote cursor toggle", () => {
  it("offers to hide cursors while they are visible", () => {
    const html = renderToStaticMarkup(
      <GameTools
        onReportBug={() => {}}
        onShareLinks={() => {}}
        useLegacyHeroModels={false}
        onLegacyHeroModelsChange={() => {}}
        playerBoardLayout="rows"
        onPlayerBoardLayoutChange={() => {}}
        brightness={1}
        onBrightnessChange={() => {}}
        showRemotePointers
        onShowRemotePointersChange={() => {}}
      />,
    );

    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("Hide other players&#x27; cursors");
    expect(html).toContain("<small>Cursors</small>");
  });

  it("offers to restore cursors while they are hidden", () => {
    const html = renderToStaticMarkup(
      <GameTools
        onReportBug={() => {}}
        onShareLinks={() => {}}
        useLegacyHeroModels={false}
        onLegacyHeroModelsChange={() => {}}
        playerBoardLayout="rows"
        onPlayerBoardLayoutChange={() => {}}
        brightness={1}
        onBrightnessChange={() => {}}
        showRemotePointers={false}
        onShowRemotePointersChange={() => {}}
      />,
    );

    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain("Show other players&#x27; cursors");
  });
});

describe("GameTools pause request", () => {
  it("offers a pause only when the table can be paused", () => {
    const html = renderToStaticMarkup(
      <GameTools
        onReportBug={() => {}}
        onShareLinks={() => {}}
        onRequestPause={() => {}}
        useLegacyHeroModels={false}
        onLegacyHeroModelsChange={() => {}}
        playerBoardLayout="interleaved"
        onPlayerBoardLayoutChange={() => {}}
        brightness={1}
        onBrightnessChange={() => {}}
        showRemotePointers
        onShowRemotePointersChange={() => {}}
      />,
    );

    expect(html).toContain('aria-label="Request a pause"');
  });

  it("hides the pause control in an untimed match", () => {
    const html = renderToStaticMarkup(
      <GameTools
        onReportBug={() => {}}
        onShareLinks={() => {}}
        useLegacyHeroModels={false}
        onLegacyHeroModelsChange={() => {}}
        playerBoardLayout="interleaved"
        onPlayerBoardLayoutChange={() => {}}
        brightness={1}
        onBrightnessChange={() => {}}
        showRemotePointers
        onShowRemotePointersChange={() => {}}
      />,
    );

    expect(html).not.toContain('aria-label="Request a pause"');
  });
});
