import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ActiveOverrideProposal, OverrideResolution } from "../../types/game";
import { OverrideVoteBanner } from "./OverrideVoteBanner";

const baseProposal: ActiveOverrideProposal = {
  proposal_id: "p1",
  proposer_hero_id: "hero_arien",
  family: "patch",
  op: "set_gold",
  args: { hero_id: "hero_arien", value: 9 },
  to: null,
  summary: "Set hero_arien gold to 9",
  eligible_voters: ["hero_arien", "hero_wasp", "hero_min"],
  threshold: 2,
  tally: { yes: ["hero_arien"], no: [] },
  expires_at: Date.now() / 1000 + 90,
};

function render(overrides: Partial<Parameters<typeof OverrideVoteBanner>[0]> = {}) {
  return renderToStaticMarkup(
    <OverrideVoteBanner
      proposal={baseProposal}
      resolution={null}
      myHeroId="hero_wasp"
      onVote={() => {}}
      onCancel={() => {}}
      {...overrides}
    />,
  );
}

describe("OverrideVoteBanner", () => {
  it("shows the summary, tally, and vote buttons to an eligible non-voter", () => {
    const html = render();
    expect(html).toContain("Set hero_arien gold to 9");
    expect(html).toContain("1/2");
    expect(html).toContain("Approve");
    expect(html).toContain("Reject");
  });

  it("hides vote buttons from spectators and shows watching state", () => {
    const html = render({ myHeroId: null });
    expect(html).not.toContain("Approve");
    expect(html).toContain("Set hero_arien gold to 9");
  });

  it("shows Cancel (not Approve) to the proposer, whose vote is already cast", () => {
    const html = render({ myHeroId: "hero_arien" });
    expect(html).not.toContain("Approve");
    expect(html).toContain("Cancel proposal");
  });

  it("shows the voted state once my vote is in the tally", () => {
    const html = render({
      proposal: { ...baseProposal, tally: { yes: ["hero_arien", "hero_wasp"], no: [] } },
    });
    expect(html).not.toContain("Approve");
    expect(html).toContain("You approved");
  });

  it("renders the applied outcome strip", () => {
    const resolution: OverrideResolution = {
      outcome: "applied",
      summary: "Set hero_arien gold to 9",
    };
    const html = render({ proposal: null, resolution });
    expect(html).toContain("applied");
  });

  it("renders a rejection reason when present", () => {
    const resolution: OverrideResolution = {
      outcome: "rejected",
      summary: "Move minion_999",
      reason: { code: "not_on_board", message: "minion_999 is not on the board" },
    };
    const html = render({ proposal: null, resolution });
    expect(html).toContain("minion_999 is not on the board");
  });
});

describe("OverrideVoteBanner pause proposals", () => {
  const pauseProposal: ActiveOverrideProposal = {
    ...baseProposal,
    family: "pause",
    op: null,
    args: {},
    summary: "Pause the match",
  };

  it("asks for a pause rather than announcing a table override", () => {
    const html = render({ proposal: pauseProposal });
    expect(html).toContain("asks the table to pause");
    expect(html).not.toContain("proposes a table override");
  });

  it("reports an agreed pause as paused, not as an applied override", () => {
    const html = render({
      proposal: null,
      resolution: { outcome: "applied", summary: "Pause the match", family: "pause" },
    });
    expect(html).toContain("Match paused");
  });
});

describe("OverrideVoteBanner seat-link proposals", () => {
  const revealProposal: ActiveOverrideProposal = {
    ...baseProposal,
    family: "reveal_player",
    op: null,
    args: { hero_id: "hero_wasp" },
    summary: "Share Wasp's player link",
  };

  it("asks for a seat link rather than announcing a table override", () => {
    const html = render({ proposal: revealProposal });
    expect(html).toContain("asks for a seat link");
    expect(html).not.toContain("proposes a table override");
    expect(html).toContain("Share Wasp&#x27;s player link");
  });

  it("reports the released seat link, not an applied override", () => {
    const html = render({
      proposal: null,
      resolution: {
        outcome: "applied",
        summary: "Share Wasp's player link",
        family: "reveal_player",
      },
    });
    expect(html).toContain("Seat link released");
    expect(html).not.toContain("Override applied");
  });
});
