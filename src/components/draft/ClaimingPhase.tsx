import { useState } from "react";
import { claimHero } from "../../api/draft";
import type { DraftView, TeamColor } from "../../types/draft";
import { formatHeroName } from "../../utils/heroDisplay";
import { HeroPoolCard } from "./HeroPoolCard";
import styles from "./Draft.module.css";

interface ClaimingPhaseProps {
  view: DraftView;
  draftId: string;
  token: string;
  onUpdate: (view: DraftView) => void;
  onError: (msg: string) => void;
}

export function ClaimingPhase({ view, draftId, token, onUpdate, onError }: ClaimingPhaseProps) {
  const { draft, you } = view;
  const [busy, setBusy] = useState(false);
  const [pendingHero, setPendingHero] = useState<string | null>(null);

  // hero -> claiming player's display name (across both teams).
  const claimedBy = new Map<string, string>();
  draft.players.forEach((p) => {
    if (p.claimed_hero) claimedBy.set(p.claimed_hero, p.display_name);
  });

  // Only players on a team are participants; unassigned players are spectators.
  const participants = draft.players.filter((p) => p.team !== null);
  const totalPlayers = participants.length;
  const claimedCount = participants.filter((p) => p.claimed_hero).length;

  const claim = async (hero: string) => {
    if (busy) return;
    setBusy(true);
    try {
      onUpdate(await claimHero(draftId, token, hero));
      setPendingHero(null);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not claim hero");
    } finally {
      setBusy(false);
    }
  };

  const myTeam = you?.team ?? null;
  const alreadyClaimed = !!you?.claimed_hero;

  const renderTeamPicks = (team: TeamColor) => {
    const isMine = team === myTeam;
    const members = draft.players.filter((p) => p.team === team);
    return (
      <div key={team} className={styles.claimTeam}>
        <div className={`${styles.teamPicksTitle} ${team === "RED" ? styles.red : styles.blue}`}>
          {team === "RED" ? "Red" : "Blue"} Team
          {isMine && <span className={styles.youTag}>your team</span>}
        </div>
        <div className={styles.rosterList}>
          {members.map((p) => (
            <div key={p.id} className={styles.playerChip}>
              <span className={styles.playerName}>
                {p.is_captain && (
                  <span className={styles.captainStar} title="Captain">
                    ★
                  </span>
                )}
                {p.display_name}
                {p.id === you?.id && <span className={styles.youTag}>you</span>}
              </span>
              <span className={styles.claimStatus}>
                {p.claimed_hero ? formatHeroName(p.claimed_hero) : "choosing…"}
              </span>
            </div>
          ))}
        </div>
        <div className={styles.claimGrid}>
          {draft.picks[team]?.map((hero) => {
            const owner = claimedBy.get(hero);
            const claimable = isMine && !owner && !alreadyClaimed;
            return (
              <div key={hero} className={styles.claimCell}>
                <HeroPoolCard
                  hero={hero}
                  state={owner ? "claimed" : "available"}
                  tone={team === "RED" ? "red" : "blue"}
                  selectable={claimable}
                  selected={pendingHero === hero}
                  disabled={busy}
                  onClick={() => setPendingHero(hero)}
                />
                <span className={styles.claimOwner}>
                  {owner ? owner : claimable ? pendingHero === hero ? "Selected" : "Choose" : formatHeroName(hero)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className={styles.claiming}>
      <div className={styles.turnBanner} role="status" aria-live="polite">
        {you
          ? alreadyClaimed
            ? `You claimed ${formatHeroName(you.claimed_hero!)} — waiting for others…`
            : "Claim the hero you want to play"
          : "Players are claiming heroes…"}
      </div>
      <div className={styles.note}>
        {claimedCount} / {totalPlayers} players have claimed. The game starts automatically once
        everyone has chosen.
      </div>
      <div className={styles.claimTeams}>
        {(["RED", "BLUE"] as TeamColor[]).map(renderTeamPicks)}
      </div>
      {!alreadyClaimed && myTeam && (
        <div className={styles.confirmBar}>
          <span>{pendingHero ? `Play ${formatHeroName(pendingHero)}?` : "Choose one of your team’s drafted heroes."}</span>
          <button className={styles.primaryBtn} type="button" disabled={!pendingHero || busy} onClick={() => pendingHero && claim(pendingHero)}>
            {busy ? "Claiming…" : "Confirm hero"}
          </button>
        </div>
      )}
    </div>
  );
}
