import type { CSSProperties } from "react";
import type { GameView } from "../../types/game";
import {
  hiddenGuessCard,
  type CardGuessRevealState,
} from "../../hooks/useCardGuessReveal";
import { CARD_COLORS } from "../../utils/colors";
import { heroSlug } from "../../utils/resolveCards";
import { CardCanvas } from "../board3d/hud/CardCanvas";
import styles from "./CardGuessReveal.module.css";
import { useLocalizedHeroNames, type HeroNameResolver } from "../../i18n/useLocalizedHeroNames";

interface Props {
  state: CardGuessRevealState;
  view: GameView;
  immersive?: boolean;
}

function heroName(view: GameView, heroId: string, localizedHeroName: HeroNameResolver): string {
  for (const team of Object.values(view.teams)) {
    const hero = team.heroes.find((candidate) => candidate.id === heroId);
    if (hero) return localizedHeroName(hero.id, hero.name);
  }
  return heroId;
}

function colorStyle(color: string | null): CSSProperties | undefined {
  if (!color) return undefined;
  return { color: CARD_COLORS[color] ?? undefined };
}

export function CardGuessReveal({ state, view, immersive = false }: Props) {
  const localizedHeroName = useLocalizedHeroNames();
  if (!state.guesserId || state.attempts.length === 0) return null;

  return (
    <section
      className={`${styles.tray} ${immersive ? styles.immersive : ""}`}
      aria-label="Card color guess"
      aria-live="polite"
    >
      <div className={styles.heading}>{heroName(view, state.guesserId, localizedHeroName)}'s guess</div>
      <div className={styles.attempts}>
        {state.attempts.map((attempt) => {
          const card = attempt.card ?? hiddenGuessCard(attempt);
          const revealed = attempt.card !== null;
          return (
            <article className={styles.attempt} key={`${attempt.guesserId}:${attempt.attempt}`}>
              <div className={styles.attemptHeader}>
                <span>Attempt {attempt.attempt}</span>
                <strong>{heroName(view, attempt.victimId, localizedHeroName)}</strong>
              </div>
              <div className={`${styles.card} ${revealed ? styles.revealed : styles.facedown}`}>
                <CardCanvas
                  card={card}
                  heroSlug={heroSlug(attempt.victimId)}
                  width={immersive ? 118 : 106}
                />
              </div>
              {revealed ? (
                <div className={`${styles.result} ${attempt.correct ? styles.correct : styles.wrong}`}>
                  <div>
                    Guessed <strong style={colorStyle(attempt.guessedColor)}>{attempt.guessedColor}</strong>
                  </div>
                  <div>
                    Revealed <strong style={colorStyle(attempt.actualColor)}>{attempt.actualColor}</strong>
                  </div>
                  <b>{attempt.correct ? "Correct" : "Miss"}</b>
                </div>
              ) : (
                <div className={styles.waiting}>Card chosen · waiting for the color</div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
