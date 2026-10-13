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

const SPELL_CARD_WIDTH = 252;

const RANK_LABELS: Record<number, string> = {
  0: "Cantrips",
  1: "Rank I",
  2: "Rank II",
  3: "Rank III",
};

// Spells render from complete pre-painted faces, so just clear the facedown
// flag — prepared spells stay is_facedown in their owner's own view.
const faceUp = (card: CardView): CardView => ({ ...card, is_facedown: false });

function groupByRank(cards: CardView[]): Array<[number, CardView[]]> {
  const groups = new Map<number, CardView[]>();
  for (const card of cards) {
    const rank = card.spell_rank ?? 0;
    const group = groups.get(rank) ?? [];
    group.push(card);
    groups.set(rank, group);
  }
  return [...groups.entries()].sort(([a], [b]) => a - b);
}

// Modal overview of the hero's spell zones (Gydion): prepared spells grouped
// by rank, plus the faceup spells currently outside the spellbook. Only the
// owner ever has the array form of `spellbook`, so this opens for them alone.
export function SpellbookViewer({ hero, teamColor, onClose }: Props) {
  const localizedHeroName = useLocalizedHeroNames();
  const heroName = localizedHeroName(hero.id, hero.name);
  const heroSlug = hero.id.toLowerCase().replace(/^hero_/, "");
  const altHeld = useAltHeld();
  const [hoveredCard, setHoveredCard] = useState<CardView | null>(null);

  const prepared = useMemo(
    () => groupByRank(Array.isArray(hero.spellbook) ? hero.spellbook : []),
    [hero.spellbook],
  );
  const cast = hero.cast_spells ?? [];

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

  const renderCard = (card: CardView) => {
    const up = faceUp(card);
    return (
      <div
        key={card.id}
        onMouseEnter={() => setHoveredCard(up)}
        onMouseLeave={() => setHoveredCard((c) => (c?.id === up.id ? null : c))}
      >
        <CardCanvas card={up} heroSlug={heroSlug} width={SPELL_CARD_WIDTH} />
      </div>
    );
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <span className={styles.heroName} style={{ color: teamColor }}>{heroName}</span>
            <span className={styles.heroTitle}>Spellbook</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>&times;</button>
        </div>

        {prepared.map(([rank, cards]) => (
          <div key={rank} className={styles.tierGroup}>
            <div className={styles.tierLabel}>{RANK_LABELS[rank] ?? `Rank ${rank}`}</div>
            <div className={styles.cardGrid}>{cards.map(renderCard)}</div>
          </div>
        ))}

        {cast.length > 0 && (
          <div className={styles.tierGroup}>
            <div className={`${styles.tierLabel} ${styles.tierLabelUltimate}`}>✦ Cast (outside the spellbook)</div>
            <div className={styles.cardGrid}>{cast.map(renderCard)}</div>
          </div>
        )}
      </div>

      {altHeld && hoveredCard && (
        <div className={styles.altPreview}>
          <CardCanvas card={hoveredCard} heroSlug={heroSlug} width={560} />
        </div>
      )}
    </div>
  );
}
