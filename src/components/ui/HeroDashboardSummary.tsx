import type { CardView, EffectView, GameView, HeroView, RuneType } from "../../types/game";
import type { ReactNode } from "react";
import { CARD_COLORS, TEAM_COLORS } from "../../utils/colors";
import { ITEM_CONFIGS, ITEM_ORDER } from "../../utils/itemIcons";
import { heroesByTeam } from "../board3d/seating";
import { CardCanvas } from "../board3d/hud/CardCanvas";
import { heroSlug } from "../../utils/resolveCards";
import { Tooltip } from "./Tooltip";
import styles from "./HeroDashboardSummary.module.css";
import { useLocalizedHeroNames } from "../../i18n/useLocalizedHeroNames";

interface Props {
  view: GameView;
  myHeroId: string | null;
  hidden: boolean;
  onHiddenChange: (hidden: boolean) => void;
}

interface ItemEntry {
  key: string;
  index: number;
  total: number;
}

const PLAYED_TURNS = 4;

function itemEntries(hero: HeroView): ItemEntry[] {
  return ITEM_ORDER.flatMap((key) => {
    const rawValue = hero.items[key];
    const total = typeof rawValue === "number" && Number.isFinite(rawValue)
      ? Math.max(0, Math.floor(rawValue))
      : 0;
    return Array.from({ length: total }, (_, index) => ({ key, index, total }));
  });
}

function RuneIcon({ rune, turn, active }: { rune: RuneType; turn: number; active: boolean }) {
  const label = `Turn ${turn} rune: ${rune}${active ? " (active)" : ""}`;
  return (
    <img
      className={`${styles.runeIcon} ${active ? styles.runeActive : ""}`}
      src={`/cards/sheets/rune_${rune}.png`}
      alt={label}
      title={label}
    />
  );
}

function CardPreview({ card, heroId }: { card: CardView; heroId: string }) {
  return (
    <div className={styles.cardPreview}>
      <CardCanvas card={card} heroSlug={heroSlug(heroId)} width="min(310px, 42vw)" />
    </div>
  );
}

function CardMarker({ card, heroId, label, rune }: { card: CardView | null; heroId: string; label: string; rune?: ReactNode }) {
  const marker = (
    <span
      className={`${styles.cardMarker} ${card ? styles.cardMarkerFilled : ""} ${card?.is_active ? styles.cardMarkerActive : ""}`}
      style={card ? { backgroundColor: CARD_COLORS[card.color ?? ""] || "#888" } : undefined}
      aria-hidden="true"
    />
  );

  return (
    <div
      className={styles.cardSlot}
      aria-label={card ? `${label}: ${card.name}${card.is_active ? " (active effect)" : ""}` : `${label}: empty`}
    >
      <span className={`${styles.cardLabel} ${card?.is_active ? styles.cardLabelActive : ""}`}>{label}</span>
      {card ? (
        <Tooltip content={<CardPreview card={card} heroId={heroId} />} delay={100} position="right" bare>
          {marker}
        </Tooltip>
      ) : marker}
      {rune}
    </div>
  );
}

function DiscardMarker({ card, heroId, index }: { card: CardView; heroId: string; index: number }) {
  return (
    <Tooltip
      content={<CardPreview card={card} heroId={heroId} />}
      delay={100}
      position="right"
      bare
      className={styles.discardTooltip}
    >
      <span
        className={`${styles.cardMarker} ${styles.cardMarkerFilled} ${card.is_active ? styles.cardMarkerActive : ""}`}
        style={{ backgroundColor: CARD_COLORS[card.color ?? ""] || "#888" }}
        aria-label={`Discard ${index + 1}: ${card.name}${card.is_active ? " (active effect)" : ""}`}
      />
    </Tooltip>
  );
}

function ActiveSpellChip({ spell, heroId, effect }: { spell: CardView; heroId: string; effect: EffectView }) {
  const label = `${spell.name} (active ${effect.duration.toLowerCase().replace(/_/g, " ")})`;
  return (
    <Tooltip content={<CardPreview card={{ ...spell, is_active: true }} heroId={heroId} />} delay={100} position="right" bare>
      <span className={styles.activeSpell} aria-label={label}>{spell.name}</span>
    </Tooltip>
  );
}

function SpellLine({ hero, effects }: { hero: HeroView; effects: EffectView[] }) {
  if (hero.spellbook == null) return null;
  const cast = hero.cast_spells ?? [];
  const active = cast.flatMap((spell) => {
    const effect = effects.find((e) => e.is_active && e.source_card_id === spell.id);
    return effect ? [{ spell, effect }] : [];
  });
  return (
    <div className={styles.spellLine}>
      <span className={styles.spellCount}>Cast {cast.length}</span>
      {active.map(({ spell, effect }) => <ActiveSpellChip key={spell.id} spell={spell} heroId={hero.id} effect={effect} />)}
    </div>
  );
}

function HeroRow({ hero, turn, effects }: { hero: HeroView; turn: number; effects: EffectView[] }) {
  const localizedHeroName = useLocalizedHeroNames();
  const heroName = localizedHeroName(hero.id, hero.name);
  const played = Array.from(
    { length: PLAYED_TURNS },
    (_, index) => hero.played_cards[index] ?? null,
  );
  const items = itemEntries(hero);
  const teamColor = TEAM_COLORS[hero.team.toUpperCase()] || "#aaa";
  const unlockedUltimate = hero.level >= 8 ? hero.ultimate_card : null;

  return (
    <div className={styles.heroRow} aria-label={`${heroName} dashboard`}>
      <span className={styles.heroName} style={{ color: teamColor }} title={heroName}>
        {heroName}
      </span>

      <div className={styles.stats}>
        <span
          className={`${styles.level} ${unlockedUltimate ? styles.ultimateLevel : ""}`}
          aria-label={`Level ${hero.level}${unlockedUltimate ? ", ultimate unlocked" : ""}`}
          title={unlockedUltimate ? `Ultimate unlocked: ${unlockedUltimate.name}` : `Level ${hero.level}`}
        >
          {unlockedUltimate && <span aria-hidden="true">★ </span>}
          Lv {hero.level}
        </span>
        <span className={styles.coins} aria-label={`${hero.gold} coins`} title={`${hero.gold} coins`}>
          <svg className={styles.coinIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="9" cy="9" r="6" />
            <path d="M14.5 8.5a6 6 0 1 1-6 6M9 6v6" />
          </svg>
          {hero.gold}
        </span>
      </div>

      <div className={styles.historySection}>
        <div className={styles.playedSection} aria-label={`${heroName} played cards`}>
          {played.map((card, index) => (
            <CardMarker
              key={index}
              card={card}
              heroId={hero.id}
              label={`T${index + 1}`}
              rune={hero.rune_slots?.[String(index + 1)] && (
                <RuneIcon rune={hero.rune_slots[String(index + 1)]} turn={index + 1} active={turn === index + 1} />
              )}
            />
          ))}
        </div>

        <div className={styles.discardSection} aria-label={`${heroName} discarded cards`}>
          <div className={styles.discardStack}>
            {hero.discard_pile.map((card, index) => (
              <DiscardMarker key={`${card.id}-${index}`} card={card} heroId={hero.id} index={index} />
            ))}
          </div>
        </div>
      </div>

      <div className={styles.items} aria-label={`${heroName} items`}>
        {items.length > 0 ? items.map(({ key, index, total }) => {
          const config = ITEM_CONFIGS[key];
          return (
            <img
              key={`${key}-${index}`}
              className={styles.itemIcon}
              src={config.icon}
              alt={config.label}
              title={total > 1 ? `${config.label} ${index + 1} of ${total}` : config.label}
            />
          );
        }) : <span className={styles.noItems} aria-label="No items">—</span>}
      </div>

      <SpellLine hero={hero} effects={effects} />
    </div>
  );
}

/** Compact public board state for checking played cards, discards, items, runes, and spells without moving the camera. */
export function HeroDashboardSummary({ view, myHeroId, hidden, onHiddenChange }: Props) {
  const { own, other } = heroesByTeam(view, myHeroId);
  const heroes = [...own, ...other];
  if (heroes.length === 0) return null;

  return (
    <section className={`${styles.panel} ${hidden ? styles.hidden : ""}`} aria-label="Hero dashboards">
      <button
        type="button"
        className={styles.title}
        onClick={() => onHiddenChange(!hidden)}
        aria-expanded={!hidden}
        aria-label={hidden ? "Show hero dashboards" : "Hide hero dashboards"}
      >
        <span aria-hidden="true">{hidden ? "\u25B8" : "\u25BE"}</span>
        Hero Dashboards
      </button>
      {!hidden && <div className={styles.rows}>
        {heroes.map((hero) => <HeroRow key={hero.id} hero={hero} turn={view.turn} effects={view.effects ?? []} />)}
      </div>}
    </section>
  );
}
