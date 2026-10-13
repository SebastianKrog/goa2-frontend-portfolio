import { useState, type CSSProperties } from "react";
import { PHASE_COLORS } from "../../utils/colors";
import type { GameView } from "../../types/game";
import { useAnimationEvents } from "../../anim/useAnimationEvents";
import { resolveWinnerDisplay } from "../../utils/winner";
import { useSynchronizedClock } from "../../hooks/useSynchronizedClock";
import { MatchClocks } from "./MatchClocks";
import { ReplayShareButton } from "./ReplayShareButton";
import type { PlayerGameStatus } from "../../utils/gameStatus";
import styles from "./PhaseBar.module.css";
import { useLocalizedHeroNames } from "../../i18n/useLocalizedHeroNames";

function laneLabel(laneId: string) {
  const numberedLane = /^lane[_\s-]*(\d+)$/i.exec(laneId);
  if (numberedLane) return `Lane ${numberedLane[1]}`;
  return laneId.replace(/[_-]+/g, " ");
}

interface Props {
  view: GameView;
  winner: string | null;
  isMyInput?: boolean;
  waitingTitle?: string | null;
  playerStatus?: PlayerGameStatus;
  immersive?: boolean;
  /** Set only for seated players, who alone may mint the replay link. */
  replayShare?: { gameId: string; token: string };
}

export function PhaseBar({ view, winner, isMyInput, waitingTitle, playerStatus, immersive = false, replayShare }: Props) {
  const localizedHeroName = useLocalizedHeroNames();
  const redTeam = view.teams["RED"];
  const blueTeam = view.teams["BLUE"];
  const isGameOver = view.phase === "GAME_OVER";
  const isResolution = view.phase === "RESOLUTION";
  const winnerDisplay = resolveWinnerDisplay(view, winner, localizedHeroName);
  const tieBreakerIcon = view.tie_breaker_team === "RED" ? "/icons/tiebreaker_orange.png" : "/icons/tiebreaker_blue.png";
  const clock = useSynchronizedClock(view.clock);

  const redLife = redTeam?.life_counters ?? 0;
  const blueLife = blueTeam?.life_counters ?? 0;
  // Capacity comes from setup so a reload mid-game still shows the spent
  // counters; the first-seen value is only a fallback for older servers.
  const [initialRedLife] = useState(redLife);
  const [initialBlueLife] = useState(blueLife);
  const redLifeCapacity = Math.max(redTeam?.starting_life_counters ?? initialRedLife, redLife);
  const blueLifeCapacity = Math.max(blueTeam?.starting_life_counters ?? initialBlueLife, blueLife);
  const waveCounters = Object.entries(view.wave_counters ?? {}).sort(([a], [b]) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
  const hasMultipleLanes = waveCounters.length > 1;
  const phaseLabel = view.phase.replace(/_/g, " ");
  const statusTitle = isGameOver && winnerDisplay
    ? `${winnerDisplay.label} wins`
    : playerStatus?.title
      ?? (isMyInput ? "Your turn" : waitingTitle ?? null);
  const statusDetail = isGameOver ? undefined : playerStatus?.detail;
  const statusTone = isGameOver ? undefined : playerStatus?.tone;

  // Bump a counter on each LIFE_COUNTER_CHANGED so the affected team's chips
  // remount (via key) and replay their flash animation, even on repeats.
  const [redPulse, setRedPulse] = useState(0);
  const [bluePulse, setBluePulse] = useState(0);
  useAnimationEvents((events) => {
    for (const ev of events) {
      if (ev.event_type !== "LIFE_COUNTER_CHANGED") continue;
      if (ev.metadata.team === "RED") setRedPulse((n) => n + 1);
      else if (ev.metadata.team === "BLUE") setBluePulse((n) => n + 1);
    }
  });

  return (
    <header className={`${styles.bar} ${immersive ? styles.immersive : ""}`}>
      <section className={`${styles.teamPanel} ${styles.redPanel}`} aria-label={`Red team has ${redLife} life remaining`}>
        <div className={styles.teamTop}>
          <div className={styles.teamIdentity}>
            <span className={styles.teamName}>Red team</span>
          </div>
          <div className={`${styles.lifeScore} ${styles.red}`}>
            <span key={redPulse} className={`${styles.lifeCounters} ${redPulse ? styles.lifePulse : ""}`} aria-hidden="true">
              {Array.from({ length: redLifeCapacity }, (_, i) => (
                <img
                  key={i}
                  className={styles.lifeCounter}
                  src={`/icons/life_counter_red_${i < redLife ? "front" : "back"}.png`}
                  alt=""
                />
              ))}
            </span>
          </div>
        </div>
        {clock && redTeam && <MatchClocks heroes={redTeam.heroes} clock={clock} phase={view.phase} />}
      </section>

      <section className={styles.matchPanel} aria-live="polite">
        <div className={styles.matchMeta}>
          <span>Round <strong>{view.round}</strong></span>
          <span
            className={styles.phase}
            style={{ "--phase-color": PHASE_COLORS[view.phase] || "#777" } as CSSProperties}
          >
            {phaseLabel}
          </span>
          <span>Turn <strong>{view.turn}</strong></span>
          <img
            src={tieBreakerIcon}
            alt={`Tie breaker: ${view.tie_breaker_team}`}
            className={styles.tieBreaker}
            title={`${view.tie_breaker_team} team wins ties during combat`}
          />
        </div>
        {waveCounters.length > 0 && (
          <div className={styles.waveLanes} aria-label="Wave counters">
            {waveCounters.map(([laneId, remaining]) => {
              const count = Math.max(0, remaining);
              const label = laneLabel(laneId);
              return (
                <div
                  key={laneId}
                  className={styles.waveLane}
                  aria-label={`${hasMultipleLanes ? `${label}: ` : ""}${count} Wave ${count === 1 ? "counter" : "counters"} remaining`}
                >
                  <span className={styles.waveLaneLabel} aria-hidden="true">
                    {hasMultipleLanes ? label : "Waves"}
                  </span>
                  <span className={styles.waveCounterStack} aria-hidden="true">
                    {count > 0 ? Array.from({ length: count }, (_, i) => (
                      <img
                        key={i}
                        className={styles.waveCounter}
                        src="/icons/wave_counter.png"
                        alt=""
                      />
                    )) : (
                      <span className={styles.noWaves}>0</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        {statusTitle && (
          <div className={[
            styles.status,
            statusTone === "active" || (!playerStatus && isMyInput) ? styles.statusActive : "",
            statusTone === "locked" ? styles.statusLocked : "",
            statusTone === "waiting" ? styles.statusWaiting : "",
            isGameOver ? styles.statusWinner : "",
          ].filter(Boolean).join(" ")}>
            <span className={styles.statusDot} aria-hidden="true" />
            <span className={styles.statusCopy}>
              <strong>{statusTitle}</strong>
              {statusDetail && <span className={styles.statusDetail}>{statusDetail}</span>}
            </span>
          </div>
        )}
        {isGameOver && replayShare && (
          <ReplayShareButton gameId={replayShare.gameId} token={replayShare.token} />
        )}
        {isResolution && view.active_zone_id && (
          <span className={styles.zoneInfo}>{view.active_zone_id}</span>
        )}
      </section>

      <section className={`${styles.teamPanel} ${styles.bluePanel}`} aria-label={`Blue team has ${blueLife} life remaining`}>
        <div className={styles.teamTop}>
          <div className={`${styles.lifeScore} ${styles.blue}`}>
            <span key={bluePulse} className={`${styles.lifeCounters} ${bluePulse ? styles.lifePulse : ""}`} aria-hidden="true">
              {Array.from({ length: blueLifeCapacity }, (_, i) => (
                <img
                  key={i}
                  className={styles.lifeCounter}
                  src={`/icons/life_counter_blue_${i < blueLife ? "front" : "back"}.png`}
                  alt=""
                />
              ))}
            </span>
          </div>
          <div className={`${styles.teamIdentity} ${styles.alignRight}`}>
            <span className={styles.teamName}>Blue team</span>
          </div>
        </div>
        {clock && blueTeam && <MatchClocks heroes={blueTeam.heroes} clock={clock} phase={view.phase} align="right" />}
      </section>
    </header>
  );
}
