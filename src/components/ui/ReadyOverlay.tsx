import type { GameClockView, GameView } from "../../types/game";
import styles from "./ReadyOverlay.module.css";
import { useLocalizedHeroNames } from "../../i18n/useLocalizedHeroNames";

interface Props {
  view: GameView;
  clock: GameClockView;
  myHeroId: string | null;
  connected: boolean;
  onReady: (ready: boolean) => void;
}

export function ReadyOverlay({ view, clock, myHeroId, connected, onReady }: Props) {
  const localizedHeroName = useLocalizedHeroNames();
  const ready = new Set(clock.ready_hero_ids);
  const heroes = Object.values(view.teams).flatMap((team) => team.heroes);
  const meReady = !!myHeroId && ready.has(myHeroId);
  const suspended = clock.status === "SUSPENDED_FOR_INACTIVITY";
  const paused = clock.status === "PAUSED";
  const requester = heroes.find((hero) => hero.id === clock.pause?.requested_by);

  const kicker = paused ? "Match paused" : suspended ? "Match suspended" : "Timed match";
  const title = paused
    ? requester
      ? `${localizedHeroName(requester.id, requester.name)} asked the table to pause`
      : "The table agreed to pause"
    : suspended
      ? "Paused for inactivity"
      : "Ready check";
  const blurb = paused
    ? "The match resumes when every player is back."
    : suspended
      ? "The table completed too many turns without a human decision. Every player must ready again to start the next Planning phase."
      : "The Planning clocks start together when every player is ready. Disconnecting will not pause them.";

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-labelledby="ready-title">
      <section className={styles.card}>
        <span className={styles.kicker}>{kicker}</span>
        <h1 id="ready-title">{title}</h1>
        <p>{blurb}</p>
        <div className={styles.roster}>
          {heroes.map((hero) => (
            <div className={ready.has(hero.id) ? styles.ready : ""} key={hero.id}>
              <span>{localizedHeroName(hero.id, hero.name)}</span>
              <strong>{ready.has(hero.id) ? "Ready" : "Waiting"}</strong>
            </div>
          ))}
        </div>
        {myHeroId ? (
          <button type="button" disabled={!connected} onClick={() => onReady(!meReady)}>
            {!connected
              ? "Reconnecting…"
              : meReady
                ? "Not ready"
                : paused
                  ? "I’m back"
                  : suspended
                    ? "Ready to resume"
                    : "I’m ready"}
          </button>
        ) : (
          <span className={styles.spectator}>Spectating — waiting for the players</span>
        )}
      </section>
    </div>
  );
}
