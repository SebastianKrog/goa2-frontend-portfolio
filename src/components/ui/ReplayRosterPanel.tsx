import type { CardView, GameView } from "../../types/game";
import { TEAM_COLORS } from "../../utils/colors";
import styles from "./ReplayRosterPanel.module.css";
import { useLocalizedHeroNames } from "../../i18n/useLocalizedHeroNames";

function committedLabel(c: CardView | null): string {
  return c ? `${c.name} (i${c.initiative})` : "—";
}

/**
 * Omniscient roster: every hero's revealed hand and committed card. This is what
 * surfaces "see all hands" — Board3D's HandRow only renders the local player's
 * hand, but the reveal_all view populates every hero's `hand`.
 */
export function ReplayRosterPanel({
  view,
  heroNames = {},
}: {
  view: GameView;
  /** Display name per hero id. Empty for replays recorded without names. */
  heroNames?: Record<string, string>;
}) {
  const localizedHeroName = useLocalizedHeroNames();
  return (
    <div className={styles.panel}>
      {Object.entries(view.teams).map(([color, team]) => (
        <div key={color} className={styles.team}>
          <div className={styles.teamHeader} style={{ color: TEAM_COLORS[color] ?? "#ccc" }}>
            {color} · ♥ {team.life_counters}
          </div>
          {team.heroes.map((h) => (
            <div key={h.id} className={styles.hero}>
              <div className={styles.heroName}>
                {localizedHeroName(h.id, h.name)}
                {heroNames[h.id] && (
                  <span className={styles.player}> · {heroNames[h.id]}</span>
                )}
                {view.current_actor_id === h.id && <span className={styles.actor}> ◀ acting</span>}
              </div>
              <div className={styles.committed}>committed: {committedLabel(h.current_turn_card)}</div>
              <div className={styles.hand}>
                {h.hand.length === 0 ? (
                  <span className={styles.empty}>(no hand)</span>
                ) : (
                  h.hand.map((c) => (
                    <span key={c.id} className={styles.card} title={c.effect_text ?? c.name}>
                      {c.name}
                      <sub className={styles.init}>{c.initiative}</sub>
                    </span>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
