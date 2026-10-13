import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useAltHeld } from "../../hooks/useAltHeld";
import type { GameView } from "../../types/game";
import type { SpellCastRevealState } from "../../hooks/useSpellCastReveal";
import { heroSlug } from "../../utils/resolveCards";
import { CardCanvas } from "../board3d/hud/CardCanvas";
import { useLocalizedHeroNames, type HeroNameResolver } from "../../i18n/useLocalizedHeroNames";
import styles from "./SpellCastReveal.module.css";

interface Props {
  reveal: SpellCastRevealState | null;
  view: GameView;
  immersive?: boolean;
  hovered?: boolean;
  onHoverChange?: (hovered: boolean) => void;
}

function heroName(view: GameView, heroId: string, localizedHeroName: HeroNameResolver): string {
  for (const team of Object.values(view.teams)) {
    const hero = team.heroes.find((candidate) => candidate.id === heroId);
    if (hero) return localizedHeroName(hero.id, hero.name);
  }
  return heroId;
}

export function SpellCastReveal({ reveal, view, immersive = false, hovered = false, onHoverChange }: Props) {
  const localizedHeroName = useLocalizedHeroNames();
  const altHeld = useAltHeld();
  const revealKey = reveal?.key;
  // A tray that closes or is replaced under the cursor never gets its mouseleave.
  useEffect(() => () => onHoverChange?.(false), [revealKey, onHoverChange]);
  if (!reveal) return null;

  const caster = heroName(view, reveal.casterId, localizedHeroName);
  const owner = heroName(view, reveal.ownerId, localizedHeroName);

  return (
    <section
      key={reveal.key}
      className={`${styles.tray} ${immersive ? styles.immersive : ""}`}
      aria-label="Spell cast"
      aria-live="polite"
    >
      <div className={styles.heading}>{caster} cast a spell</div>
      <div
        className={styles.card}
        onMouseEnter={() => onHoverChange?.(true)}
        onMouseLeave={() => onHoverChange?.(false)}
      >
        <CardCanvas card={reveal.spell} heroSlug={heroSlug(reveal.ownerId)} width={immersive ? 118 : 106} />
      </div>
      <div className={styles.caption}>
        <strong>{reveal.spell.name}</strong>
        {reveal.casterId !== reveal.ownerId && <div>from {owner}'s spellbook</div>}
      </div>
      {altHeld && hovered && createPortal(
        <div className={styles.altPreview}>
          <CardCanvas card={reveal.spell} heroSlug={heroSlug(reveal.ownerId)} width={560} />
        </div>,
        document.body,
      )}
    </section>
  );
}
