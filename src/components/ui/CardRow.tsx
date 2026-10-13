import { useState, useEffect } from "react";
import { CARD_COLORS } from "../../utils/colors";
import { getCardStatsDisplay } from "../../utils/cardStats";
import { colorizeIcon } from "../../utils/iconColorizer";
import type { CardView } from "../../types/game";
import { Tooltip } from "./Tooltip";
import { CardTooltipContent } from "./CardTooltipContent";
import styles from "./CardRow.module.css";
import { PingMarker2D } from "./PingMarker2D";
import type { PresentedPing } from "../../utils/pings";

interface Props {
  card: CardView;
  isSelected?: boolean;
  shortcutKey?: number;
  onClick?: () => void;
  pings?: PresentedPing[];
  onPingHover?: (hovered: boolean) => void;
}

export function CardRow({ card, isSelected, shortcutKey, onClick, pings = [], onPingHover }: Props) {
  const colorPip = CARD_COLORS[card.color ?? ""] || "#888";
  const isSilver = card.color === "SILVER";
  const stats = getCardStatsDisplay(card);
  const [coloredIcons, setColoredIcons] = useState<Record<string, string>>({});

  useEffect(() => {
    const primaryStat = stats.find((s) => s.isPrimary);
    if (primaryStat && !isSilver) {
      colorizeIcon(primaryStat.icon, colorPip).then((coloredUrl) => {
        setColoredIcons((prev) => prev[primaryStat.key] !== coloredUrl 
          ? { [primaryStat.key]: coloredUrl }
          : prev
        );
      });
    }
  }, [card.color, stats, colorPip, isSilver]);

  const hasTooltip = card.effect_text || Object.keys(card.secondary_actions).length > 0 || card.is_ranged || card.radius_value;

  const tooltipContent = <CardTooltipContent card={card} />;

  const rowClass = [
    styles.row,
    isSelected && styles.selected,
    onClick && styles.clickable,
  ].filter(Boolean).join(" ");

  const cardRow = (
    <div
      onClick={onClick}
      onPointerEnter={() => onPingHover?.(true)}
      onPointerLeave={() => onPingHover?.(false)}
      className={rowClass}
    >
      {pings.map((ping, index) => (
        <PingMarker2D key={ping.id} label={ping.label} color={ping.color} stackIndex={index} />
      ))}
      {shortcutKey !== undefined && (
        <span className={styles.shortcutBadge}>{shortcutKey}</span>
      )}
      <span className={styles.colorPip} style={{ background: colorPip }} />
      <span className={styles.cardName}>{card.name}</span>
      <div className={styles.stats}>
        {stats.map((stat) => (
          <span
            key={stat.key}
            className={`${styles.stat} ${stat.isPrimary && isSilver ? styles.silverPrimary : ''}`}
            style={stat.isPrimary ? {
              borderColor: colorPip,
            } : undefined}
            title={`${stat.label}: ${stat.value ?? '0'}`}
          >
            <img src={stat.isPrimary && !isSilver ? (coloredIcons[stat.key] || stat.icon) : stat.icon} alt={stat.label} className={styles.statIcon} />
            {stat.value !== undefined && (
              <span style={stat.isPrimary ? { color: colorPip } : undefined}>{stat.value}</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );

  if (hasTooltip) {
    return (
      <Tooltip content={tooltipContent}>
        {cardRow}
      </Tooltip>
    );
  }

  return cardRow;
}
