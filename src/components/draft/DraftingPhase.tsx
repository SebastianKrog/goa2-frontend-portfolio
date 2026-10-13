import { useMemo, useState } from "react";
import { submitDraftAction } from "../../api/draft";
import type { DraftView, TeamColor } from "../../types/draft";
import { formatHeroName } from "../../utils/heroDisplay";
import { HeroPoolCard } from "./HeroPoolCard";
import styles from "./Draft.module.css";

interface DraftingPhaseProps {
  view: DraftView;
  draftId: string;
  token: string;
  onUpdate: (view: DraftView) => void;
  onError: (msg: string) => void;
}

const teamLabel = (t: TeamColor) => (t === "RED" ? "Red" : "Blue");

export function DraftingPhase({ view, draftId, token, onUpdate, onError }: DraftingPhaseProps) {
  const { draft, you } = view;
  const [busy, setBusy] = useState(false);
  const [pendingSelection, setPendingSelection] = useState<{ hero: string; step: number } | null>(null);
  const [search, setSearch] = useState("");

  const step = draft.sequence[draft.current_index];
  const isMyTurn = !!you?.is_captain && !!step && you.team === step.team;
  const membersOf = (t: TeamColor) => draft.players.filter((p) => p.team === t);
  const captainOf = (t: TeamColor) => membersOf(t).find((p) => p.is_captain) ?? null;
  const pendingHero = pendingSelection?.step === draft.current_index ? pendingSelection.hero : null;

  // Map each hero -> its current state for the pool grid.
  const heroState = useMemo(() => {
    const map = new Map<string, { state: "banned" | "picked"; tone?: "red" | "blue" }>();
    (["RED", "BLUE"] as TeamColor[]).forEach((t) => {
      draft.bans[t]?.forEach((h) => map.set(h, { state: "banned" }));
      draft.picks[t]?.forEach((h) =>
        map.set(h, { state: "picked", tone: t === "RED" ? "red" : "blue" })
      );
    });
    return map;
  }, [draft.bans, draft.picks]);
  const filteredHeroes = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return draft.hero_pool;
    return draft.hero_pool.filter((hero) => formatHeroName(hero).toLowerCase().includes(query));
  }, [draft.hero_pool, search]);

  const act = async (hero: string) => {
    if (!isMyTurn || busy) return;
    setBusy(true);
    try {
      onUpdate(await submitDraftAction(draftId, token, hero));
    } catch (err) {
      onError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const selectOrConfirmHero = (hero: string) => {
    if (pendingHero === hero) {
      void act(hero);
      return;
    }
    setPendingSelection({ hero, step: draft.current_index });
  };

  const activeCaptain = step ? captainOf(step.team) : null;
  const verb = step?.action === "BAN" ? "banning" : "picking";
  const banner = step
    ? isMyTurn
      ? `Your turn — ${step.action === "BAN" ? "ban" : "pick"} a hero for your team`
      : activeCaptain
        ? `${activeCaptain.display_name} is ${verb} for ${teamLabel(step.team)}${
            step.team === you?.team ? " — your team" : ""
          }`
        : `${teamLabel(step.team)} is ${verb}…`
    : "Draft complete";

  return (
    <div className={styles.drafting}>
      <div
        className={`${styles.turnBanner} ${
          step?.team === "RED" ? styles.bannerRed : step?.team === "BLUE" ? styles.bannerBlue : ""
        } ${isMyTurn ? styles.bannerActive : ""}`}
        role="status"
        aria-live="polite"
      >
        {banner}
      </div>

      <div className={styles.sequenceStrip}>
        {draft.sequence.map((s) => (
          <div
            key={s.index}
            className={[
              styles.seqStep,
              s.action === "BAN" ? styles.seqBan : styles.seqPick,
              s.team === "RED" ? styles.seqRed : styles.seqBlue,
              s.index === draft.current_index ? styles.seqCurrent : "",
              s.index < draft.current_index ? styles.seqDone : "",
            ]
              .filter(Boolean)
              .join(" ")}
            title={`${teamLabel(s.team)} ${s.action}`}
            aria-current={s.index === draft.current_index ? "step" : undefined}
          >
            <span className={styles.seqTeam}>{teamLabel(s.team)}</span>
            <span>{s.action === "BAN" ? "Ban" : "Pick"}</span>
          </div>
        ))}
      </div>

      <div className={styles.draftBody}>
        <div className={styles.draftSidebar}>
          {(["RED", "BLUE"] as TeamColor[]).map((t) => (
            <div key={t} className={styles.teamPicks}>
              <div className={`${styles.teamPicksTitle} ${t === "RED" ? styles.red : styles.blue}`}>
                {teamLabel(t)}
              </div>
              <div className={styles.picksLabel}>Team</div>
              <div className={styles.rosterList}>
                {membersOf(t).length ? (
                  membersOf(t).map((p) => (
                    <div key={p.id} className={styles.playerChip}>
                      <span className={styles.playerName}>
                        {p.is_captain && (
                          <span className={styles.captainStar} title="Captain — picks for the whole team">
                            ★
                          </span>
                        )}
                        {p.display_name}
                        {p.id === you?.id && <span className={styles.youTag}>you</span>}
                      </span>
                    </div>
                  ))
                ) : (
                  <span className={styles.dim}>—</span>
                )}
              </div>
              <div className={styles.picksLabel}>Picks</div>
              <div className={styles.picksList}>
                {draft.picks[t]?.length ? (
                  draft.picks[t].map((h) => (
                    <span key={h} className={styles.pickItem}>
                      {formatHeroName(h)}
                    </span>
                  ))
                ) : (
                  <span className={styles.dim}>—</span>
                )}
              </div>
              <div className={styles.picksLabel}>Bans</div>
              <div className={styles.picksList}>
                {draft.bans[t]?.length ? (
                  draft.bans[t].map((h) => (
                    <span key={h} className={`${styles.pickItem} ${styles.banItem}`}>
                      {formatHeroName(h)}
                    </span>
                  ))
                ) : (
                  <span className={styles.dim}>—</span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className={styles.draftPoolArea}>
          <label className={styles.draftSearch}>
            <span className={styles.srOnly}>Search draft heroes</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a hero…" />
          </label>
          <div className={styles.poolGrid}>
            {filteredHeroes.map((hero) => {
              const hs = heroState.get(hero);
              return (
                <HeroPoolCard
                  key={hero}
                  hero={hero}
                  state={hs?.state ?? "available"}
                  tone={hs?.tone}
                  badge={hs?.state === "banned" ? "BANNED" : undefined}
                  selectable={isMyTurn && !hs}
                  selected={pendingHero === hero}
                  disabled={busy}
                  onClick={() => selectOrConfirmHero(hero)}
                />
              );
            })}
            {!filteredHeroes.length && <div className={styles.emptyHint}>No heroes match that search.</div>}
          </div>
        </div>
      </div>
      {isMyTurn && (
        <div className={styles.confirmBar}>
          <span>{pendingHero ? `${step.action === "BAN" ? "Ban" : "Pick"} ${formatHeroName(pendingHero)}?` : `Choose a hero to ${step.action.toLowerCase()}.`}</span>
          <button className={styles.primaryBtn} type="button" disabled={!pendingHero || busy} onClick={() => pendingHero && act(pendingHero)}>
            {busy ? "Submitting…" : `Confirm ${step.action === "BAN" ? "ban" : "pick"}`}
          </button>
        </div>
      )}
    </div>
  );
}
