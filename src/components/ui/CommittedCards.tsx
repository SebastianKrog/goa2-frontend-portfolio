import type { CardView, GameView, HeroView } from "../../types/game";
import { heroesByTeam } from "../board3d/seating";
import { TEAM_COLORS } from "../../utils/colors";
import { heroSlug } from "../../utils/resolveCards";
import { CardCanvas } from "../board3d/hud/CardCanvas";
import { Tooltip } from "./Tooltip";
import styles from "./CommittedCards.module.css";
import { useLocalizedHeroNames } from "../../i18n/useLocalizedHeroNames";

const CARD_WIDTH = 66;

interface Props {
  view: GameView;
  myHeroId: string | null;
  hidden: boolean;
  onHiddenChange: (hidden: boolean) => void;
}

function committedCards(hero: HeroView): CardView[] {
  const cards: CardView[] = [];
  if (hero.current_turn_card) cards.push(hero.current_turn_card);
  if (hero.extra_turn_card) cards.push(hero.extra_turn_card);
  return cards;
}

/**
 * Every committed card gathered into one panel, after the Tabletop Simulator
 * mod's autoCard row. Each hero keeps a fixed row in their team's column, so a
 * card never moves once it lands.
 */
export function CommittedCards({ view, myHeroId, hidden, onHiddenChange }: Props) {
  const localizedHeroName = useLocalizedHeroNames();
  const { own, other } = heroesByTeam(view, myHeroId);
  const columns = [own, other].filter((heroes) =>
    heroes.some((hero) => committedCards(hero).length > 0),
  );
  if (columns.length === 0) return null;

  return (
    <div className={`${styles.panel} ${hidden ? styles.hidden : ""}`}>
      <button
        type="button"
        className={styles.title}
        onClick={() => onHiddenChange(!hidden)}
        aria-expanded={!hidden}
        aria-label={hidden ? "Show committed cards" : "Hide committed cards"}
      >
        <span aria-hidden="true">{hidden ? "\u25B8" : "\u25BE"}</span>
        Committed
      </button>
      {!hidden && <div className={styles.columns}>
        {columns.map((heroes, columnIndex) => (
          <div className={styles.column} key={columnIndex}>
            {heroes.map((hero) => {
              const heroName = localizedHeroName(hero.id, hero.name);
              const cards = committedCards(hero);
              if (cards.length === 0) return null;
              const hidden = cards.every((card) => card.is_facedown);
              return (
                <div
                  className={styles.slot}
                  key={hero.id}
                  aria-label={hidden ? `${heroName}, face down` : heroName}
                  style={{ borderColor: TEAM_COLORS[hero.team] }}
                >
                  {cards.map((card) => {
                    const canvas = (
                      <CardCanvas card={card} heroSlug={heroSlug(hero.id)} width={CARD_WIDTH} />
                    );
                    // A facedown card has nothing to preview but its back.
                    return card.is_facedown ? (
                      <div key={card.id}>{canvas}</div>
                    ) : (
                      <Tooltip
                        key={card.id}
                        content={
                          <div className={styles.cardPreview}>
                            <CardCanvas
                              card={card}
                              heroSlug={heroSlug(hero.id)}
                              width="min(310px, 42vw)"
                            />
                          </div>
                        }
                        delay={100}
                        position="right"
                        bare
                      >
                        {canvas}
                      </Tooltip>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>}
    </div>
  );
}
