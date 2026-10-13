import { CARD_COLORS } from "../../utils/colors";
import { Tooltip } from "./Tooltip";
import { CardTooltipContent } from "./CardTooltipContent";
import type { CardView, PingCardZone, PingTarget } from "../../types/game";
import styles from "./CardPile.module.css";
import { PingMarker2D } from "./PingMarker2D";
import { pingTargetKey, type PresentedPing } from "../../utils/pings";

interface Props {
  label: string;
  cards: (CardView | null)[];
  heroId?: string;
  zone?: Extract<PingCardZone, "PLAYED" | "DISCARD">;
  pings?: PresentedPing[];
  onPingTargetHover?: (target: PingTarget | null) => void;
  /** Hovering a dot shows only its card; the whole-pile tooltip outgrows the screen for long piles. */
  perCardTooltip?: boolean;
}

export function CardPile({ label, cards: rawCards, heroId, zone, pings = [], onPingTargetHover, perCardTooltip = false }: Props) {
  const cards = rawCards
    .map((card, index) => ({ card, index }))
    .filter((entry): entry is { card: CardView; index: number } => entry.card !== null);

  const tooltipContent = (
    <div className={styles.tooltipList}>
      {cards.map(({ card, index }) => (
        <CardTooltipContent key={`${card.id}-${index}`} card={card} />
      ))}
    </div>
  );

  const content = (
    <div className={styles.container}>
      <div className={styles.label}>{label}</div>
      <div className={styles.dots}>
        {cards.map(({ card, index }) => perCardTooltip ? (
          <Tooltip key={`${card.id}-${index}`} content={<CardTooltipContent card={card} />} delay={100}>
            <span
              className={styles.dot}
              style={{ backgroundColor: CARD_COLORS[card.color ?? ""] || "#888" }}
              aria-label={card.name}
            />
          </Tooltip>
        ) : (
          <span
            key={`${card.id}-${index}`}
            className={styles.dot}
            style={{
              backgroundColor: CARD_COLORS[card.color ?? ""] || "#888",
            }}
            onPointerEnter={() => heroId && zone && onPingTargetHover?.({ kind: "CARD", hero_id: heroId, zone, index })}
            onPointerLeave={() => onPingTargetHover?.(null)}
          >
            {heroId && zone && pings
              .filter((ping) => pingTargetKey(ping.target) === pingTargetKey({ kind: "CARD", hero_id: heroId, zone, index }))
              .map((ping, pingIndex) => (
                <PingMarker2D key={ping.id} label={ping.label} color={ping.color} stackIndex={pingIndex} compact />
              ))}
          </span>
        ))}
      </div>
    </div>
  );

  if (cards.length > 0 && !perCardTooltip) {
    return <Tooltip content={tooltipContent} maxWidth="none">{content}</Tooltip>;
  }

  return content;
}
