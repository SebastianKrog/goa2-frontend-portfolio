import { useState } from "react";
import { TEAM_COLORS } from "../../utils/colors";
import { getItemsDisplay } from "../../utils/itemIcons";
import { getHandColors, getHandColorDot } from "../../utils/handColors";
import { formatEffectText } from "../../utils/effectText";
import { Tooltip } from "./Tooltip";
import { DeckViewer } from "./DeckViewer";
import { CardRow } from "./CardRow";
import { CardPile } from "./CardPile";
import type { HeroView, PingTarget } from "../../types/game";
import styles from "./HeroInfo.module.css";
import tooltipStyles from "./Tooltip.module.css";
import { PingMarker2D } from "./PingMarker2D";
import { pingTargetKey, type PresentedPing } from "../../utils/pings";
import { useLocalizedHeroNames } from "../../i18n/useLocalizedHeroNames";
import { plaqueNameText } from "../board3d/statusPlaqueText";

interface Props {
  hero: HeroView;
  playerName?: string;
  isYou?: boolean;
  phase?: string;
  turn?: number;
  pings?: PresentedPing[];
  onPingTargetHover?: (target: PingTarget | null) => void;
  onViewDeck?: () => void;
}

export function HeroInfo({ hero, playerName, isYou, turn, pings = [], onPingTargetHover, onViewDeck }: Props) {
  const localizedHeroName = useLocalizedHeroNames();
  const heroName = localizedHeroName(hero.id, hero.name);
  const shownPlayerName = plaqueNameText(playerName);
  const [showDeck, setShowDeck] = useState(false);
  const teamColor = TEAM_COLORS[hero.team] || "#888";
  const items = getItemsDisplay(hero.items as Record<string, number>);
  const handColors = !isYou ? getHandColors(hero) : [];
  const currentCard = hero.current_turn_card;
  const hasColoredCard = currentCard && currentCard.color;
  const runes = Object.entries(hero.rune_slots ?? {}).sort(([a], [b]) => Number(a) - Number(b));
  const pingsFor = (target: PingTarget) =>
    pings.filter((ping) => pingTargetKey(ping.target) === pingTargetKey(target));

  return (
    <div className={styles.container}>
      <div className={styles.name}>
        <span style={{ color: teamColor }}>
          {heroName}
          {shownPlayerName && <span className={styles.playerName}> · {shownPlayerName}</span>}
          {isYou && " (You)"}
        </span>
        {items.length > 0 && (
          <span className={styles.items}>
            {items.map((item) => (
              <span
                key={item.key}
                className={styles.item}
                title={`${item.label}: +${hero.items[item.key] as number}`}
              >
                <img src={item.icon} alt={item.label} className={styles.itemIcon} />
                +{hero.items[item.key] as number}
              </span>
            ))}
          </span>
        )}
      </div>
      <div className={styles.details}>
        {hero.title}
        {!isYou && handColors.length > 0 && (
          <span className={styles.handColors}>
            {handColors.map((color) => (
              <span
                key={color}
                className={styles.handColorDot}
                style={{ backgroundColor: getHandColorDot(color) }}
                title={color}
              />
            ))}
          </span>
        )}
        {!isYou && handColors.length > 0 && " · "}
        Lv {hero.level} &middot; {hero.gold} Gold
      </div>
      {hero.spellbook != null && (
        <div className={styles.details}>
          Spellbook: {Array.isArray(hero.spellbook) ? hero.spellbook.length : hero.spellbook.count}
          {" "}&middot; Cast: {hero.cast_spells?.length ?? 0}
          {(hero.wish_cast_count ?? 0) > 0 && <> &middot; Wish {hero.wish_cast_count}/3</>}
        </div>
      )}
      {isYou && (
        <button className={styles.viewDeckBtn} onClick={onViewDeck ?? (() => setShowDeck(true))}>
          View Deck
        </button>
      )}
      {hero.ultimate_card && hero.level >= 8 && (
        <Tooltip
          content={
            <div className={tooltipStyles.goaTooltip}>
              <div className={tooltipStyles.goaTooltipHeader}>
                <span className={`${tooltipStyles.goaTooltipTitle} ${tooltipStyles.cardColorPurple}`}>
                  {hero.ultimate_card.name}
                </span>
                <span className={`${tooltipStyles.goaTooltipTier} ${tooltipStyles.tierIv}`}>
                  Ultimate
                </span>
              </div>
              {hero.ultimate_card.effect_text && (
                <div className={tooltipStyles.goaTooltipEffect}>
                  {formatEffectText(hero.ultimate_card.effect_text)}
                </div>
              )}
            </div>
          }
          position="bottom"
        >
          <div
            className={styles.ultimate}
            onPointerEnter={() => onPingTargetHover?.({ kind: "CARD", hero_id: hero.id, zone: "ULTIMATE" })}
            onPointerLeave={() => onPingTargetHover?.(null)}
          >
            {pingsFor({ kind: "CARD", hero_id: hero.id, zone: "ULTIMATE" }).map((ping, index) => (
              <PingMarker2D key={ping.id} label={ping.label} color={ping.color} stackIndex={index} />
            ))}
            <span className={styles.ultimateStar}>★</span>
            {hero.ultimate_card.name}
          </div>
        </Tooltip>
      )}
      <CardPile label="Played" cards={hero.played_cards} heroId={hero.id} zone="PLAYED" pings={pings} onPingTargetHover={onPingTargetHover} />
      <CardPile label="Discard" cards={hero.discard_pile} heroId={hero.id} zone="DISCARD" pings={pings} onPingTargetHover={onPingTargetHover} />
      {hero.spellbook != null && <CardPile label="Spells" cards={hero.cast_spells ?? []} perCardTooltip />}
      {runes.length > 0 && (
        <div className={styles.runes}>
          <span className={styles.runesLabel}>Runes</span>
          {runes.map(([slot, rune]) => {
            const active = turn === Number(slot);
            const label = `Turn ${slot} rune: ${rune}${active ? " (active)" : ""}`;
            return (
              <span key={slot} className={`${styles.rune} ${active ? styles.runeActive : ""}`} title={label}>
                T{slot}
                <img src={`/cards/sheets/rune_${rune}.png`} alt={label} className={styles.runeIcon} />
              </span>
            );
          })}
        </div>
      )}
      {hasColoredCard && (
        <div className={styles.currentCard}>
          <div className={styles.currentLabel}>Current:</div>
          <CardRow
            card={currentCard}
            pings={pingsFor({ kind: "CARD", hero_id: hero.id, zone: "CURRENT" })}
            onPingHover={(hovered) => onPingTargetHover?.(hovered
              ? { kind: "CARD", hero_id: hero.id, zone: "CURRENT" }
              : null)}
          />
        </div>
      )}
      {showDeck && isYou && (
        <DeckViewer hero={hero} teamColor={teamColor} onClose={() => setShowDeck(false)} />
      )}
    </div>
  );
}
