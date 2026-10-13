import { useEffect, useState } from "react";
import type { ActiveOverrideProposal, GameView, OverrideResolution } from "../../types/game";
import { summarizeProposal } from "../../utils/overrideSummary";
import styles from "./OverrideVoteBanner.module.css";

interface Props {
  proposal: ActiveOverrideProposal | null;
  resolution: OverrideResolution | null;
  /** null for spectators. */
  myHeroId: string | null;
  onVote: (proposalId: string, approve: boolean) => void;
  onCancel: (proposalId: string) => void;
  glass?: boolean;
  /** Lets proposals that reference cards show names instead of ids. */
  view?: GameView | null;
}

const READABLE_OPS = new Set([
  "move_card",
  "move_entity",
  "place_entity",
  "remove_entity",
  "set_gold",
  "set_level",
  "set_life_counters",
  "set_wave_counter",
  "set_tie_breaker_team",
]);

function shortHero(heroId: string): string {
  return heroId.replace(/^hero_/, "");
}

const OUTCOME_TEXT: Record<OverrideResolution["outcome"], string> = {
  applied: "Override applied",
  rejected: "Override rejected",
  expired: "Override proposal expired",
  cancelled: "Override proposal cancelled",
};

const PAUSE_OUTCOME_TEXT: Record<OverrideResolution["outcome"], string> = {
  applied: "Match paused",
  rejected: "Pause rejected",
  expired: "Pause request expired",
  cancelled: "Pause request cancelled",
};

const REVEAL_OUTCOME_TEXT: Record<OverrideResolution["outcome"], string> = {
  applied: "Seat link released",
  rejected: "Seat link refused",
  expired: "Seat link request expired",
  cancelled: "Seat link request cancelled",
};

const OUTCOME_TEXT_BY_FAMILY = {
  pause: PAUSE_OUTCOME_TEXT,
  reveal_player: REVEAL_OUTCOME_TEXT,
} as const;

function Countdown({ expiresAt }: { expiresAt: number }) {
  const remaining = () => Math.max(0, Math.round(expiresAt - Date.now() / 1000));
  const [seconds, setSeconds] = useState(remaining);
  useEffect(() => {
    const id = window.setInterval(() => setSeconds(remaining()), 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAt]);
  return <span className={styles.countdown}>{seconds}s</span>;
}

export function OverrideVoteBanner({
  proposal,
  resolution,
  myHeroId,
  onVote,
  onCancel,
  glass = false,
  view,
}: Props) {
  if (proposal) {
    const yes = proposal.tally.yes.length;
    const isProposer = myHeroId === proposal.proposer_hero_id;
    const isEligible = !!myHeroId && proposal.eligible_voters.includes(myHeroId);
    const myVote = !myHeroId
      ? null
      : proposal.tally.yes.includes(myHeroId)
        ? true
        : proposal.tally.no.includes(myHeroId)
          ? false
          : null;
    const canVote = isEligible && myVote === null && !isProposer;

    return (
      <div className={`${styles.banner} ${glass ? styles.glass : ""}`} role="status">
        <div className={styles.header}>
          <span className={styles.kicker}>
            {shortHero(proposal.proposer_hero_id)}
            {proposal.family === "pause"
              ? " asks the table to pause"
              : proposal.family === "reveal_player"
                ? " asks for a seat link"
                : " proposes a table override"}
          </span>
          <Countdown expiresAt={proposal.expires_at} />
        </div>
        <div className={styles.summary}>
          {proposal.op && READABLE_OPS.has(proposal.op) && view
            ? summarizeProposal({ family: proposal.family, op: proposal.op, args: proposal.args }, view)
            : proposal.summary}
        </div>
        <div className={styles.footer}>
          <span className={styles.tally} title={`Yes: ${proposal.tally.yes.map(shortHero).join(", ") || "—"} · No: ${proposal.tally.no.map(shortHero).join(", ") || "—"}`}>
            {yes}/{proposal.threshold} approvals
            {proposal.tally.no.length > 0 && (
              <span className={styles.noCount}> · {proposal.tally.no.length} against</span>
            )}
          </span>
          {canVote && (
            <span className={styles.actions}>
              <button
                type="button"
                className={styles.approve}
                onClick={() => onVote(proposal.proposal_id, true)}
              >
                Approve
              </button>
              <button
                type="button"
                className={styles.reject}
                onClick={() => onVote(proposal.proposal_id, false)}
              >
                Reject
              </button>
            </span>
          )}
          {myVote !== null && !isProposer && (
            <span className={styles.voted}>
              {myVote ? "You approved" : "You rejected"}
            </span>
          )}
          {isProposer && (
            <button
              type="button"
              className={styles.cancel}
              onClick={() => onCancel(proposal.proposal_id)}
            >
              Cancel proposal
            </button>
          )}
        </div>
      </div>
    );
  }

  if (resolution) {
    return (
      <div
        className={`${styles.banner} ${styles[resolution.outcome]} ${glass ? styles.glass : ""}`}
        role="status"
      >
        <div className={styles.summary}>
          <strong>
            {(
              OUTCOME_TEXT_BY_FAMILY[
                resolution.family as keyof typeof OUTCOME_TEXT_BY_FAMILY
              ] ?? OUTCOME_TEXT
            )[resolution.outcome]}
          </strong>
          {resolution.family === "pause" || !resolution.summary
            ? ""
            : ` — ${resolution.summary}`}
        </div>
        {resolution.reason && (
          <div className={styles.reason}>{resolution.reason.message}</div>
        )}
      </div>
    );
  }

  return null;
}
