import { useEffect, useMemo, useState } from "react";
import { CardCanvas } from "../board3d/hud/CardCanvas";
import { useAltHeld } from "../../hooks/useAltHeld";
import type { CardView, HeroView } from "../../types/game";
import styles from "./DeckViewer.module.css";
import { useLocalizedHeroNames } from "../../i18n/useLocalizedHeroNames";

interface Props {
  hero: HeroView;
  teamColor: string;
  onClose: () => void;
}

const TIER_ORDER = ["I", "II", "III"];

const COLOR_ORDER = ["GOLD", "SILVER", "RED", "BLUE", "GREEN", "PURPLE"];

const CARD_WIDTH = 180;

// The deck overview always shows the painted card face, regardless of whether
// the dealt instance happens to be marked face-down.
const faceUp = (card: CardView): CardView => ({ ...card, is_facedown: false });

function getDeckCards(hero: HeroView): CardView[] {
  return Array.isArray(hero.deck) ? hero.deck : [];
}

function groupByTier(cards: CardView[]): Record<string, CardView[]> {
  const groups: Record<string, CardView[]> = {};
  for (const card of cards) {
    const tier = card.tier || "?";
    if (!groups[tier]) groups[tier] = [];
    groups[tier].push(card);
  }
  for (const tier of Object.keys(groups)) {
    groups[tier].sort((a, b) => {
      const ai = COLOR_ORDER.indexOf(a.color ?? "");
      const bi = COLOR_ORDER.indexOf(b.color ?? "");
      return ai - bi;
    });
  }
  return groups;
}

export function DeckViewer({ hero, teamColor, onClose }: Props) {
  const localizedHeroName = useLocalizedHeroNames();
  const heroName = localizedHeroName(hero.id, hero.name);
  const heroSlug = hero.id.toLowerCase().replace(/^hero_/, "");
  const altHeld = useAltHeld();
  const [hoveredCard, setHoveredCard] = useState<CardView | null>(null);

  const tierGroups = useMemo(() => groupByTier(getDeckCards(hero)), [hero]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey, true);
    return () => window.removeEventListener("keydown", handleKey, true);
  }, [onClose]);

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <span className={styles.heroName} style={{ color: teamColor }}>{heroName}</span>
            <span className={styles.heroTitle}>{hero.title}</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>&times;</button>
        </div>

        {TIER_ORDER.map((tier) => {
          const cards = tierGroups[tier];
          if (!cards || cards.length === 0) return null;
          return (
            <div key={tier} className={styles.tierGroup}>
              <div className={styles.tierLabel}>Tier {tier}</div>
              <div className={styles.cardGrid}>
                {cards.map((card) => {
                  const up = faceUp(card);
                  return (
                    <div
                      key={card.id}
                      onMouseEnter={() => setHoveredCard(up)}
                      onMouseLeave={() => setHoveredCard((c) => (c?.id === up.id ? null : c))}
                    >
                      <CardCanvas card={up} heroSlug={heroSlug} width={CARD_WIDTH} />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {hero.ultimate_card && (
          <div className={styles.tierGroup}>
            <div className={`${styles.tierLabel} ${styles.tierLabelUltimate}`}>★ Ultimate</div>
            <div className={styles.cardGrid}>
              {(() => {
                const up = faceUp(hero.ultimate_card);
                return (
                  <div
                    onMouseEnter={() => setHoveredCard(up)}
                    onMouseLeave={() => setHoveredCard((c) => (c?.id === up.id ? null : c))}
                  >
                    <CardCanvas card={up} heroSlug={heroSlug} width={CARD_WIDTH} />
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {altHeld && hoveredCard && (
        <div className={styles.altPreview}>
          <CardCanvas card={hoveredCard} heroSlug={heroSlug} width={440} />
        </div>
      )}
    </div>
  );
}
