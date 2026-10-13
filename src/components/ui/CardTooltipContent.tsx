import type { CardView } from "../../types/game";
import { formatEffectText } from "../../utils/effectText";
import styles from "./Tooltip.module.css";

const formatActionName = (action: string) => {
  const names: Record<string, string> = {
    MOVEMENT: "Movement",
    ATTACK: "Attack",
    DEFENSE: "Defense",
    SKILL: "Skill",
    DEFENSE_SKILL: "Defense Skill",
    HOLD: "Hold",
    CLEAR: "Clear",
    FAST_TRAVEL: "Fast Travel",
  };
  return names[action] || action;
};

const getActionClass = (action: string) => {
  const actionMap: Record<string, string> = {
    MOVEMENT: "actionMovement",
    ATTACK: "actionAttack",
    DEFENSE: "actionDefense",
    SKILL: "actionSkill",
    DEFENSE_SKILL: "actionDefenseSkill",
  };
  return actionMap[action] || "";
};

const getTierClass = (tier: string) => {
  const tierMap: Record<string, string> = { i: "tierI", ii: "tierIi", iii: "tierIii", iv: "tierIv" };
  return tierMap[tier.toLowerCase()] || `tier${tier}`;
};

const getCardColorClass = (color: string) => {
  return `cardColor${color.charAt(0).toUpperCase()}${color.slice(1).toLowerCase()}`;
};

export function CardTooltipContent({ card }: { card: CardView }) {
  return (
    <div className={`${styles.goaTooltip} ${card.is_active ? styles.goaTooltipActive : ''}`}>
      <div className={styles.goaTooltipHeader}>
        <span className={`${styles.goaTooltipTitle} ${card.color ? styles[getCardColorClass(card.color)] : ''}`}>{card.name}</span>
        {card.tier && (
          <span className={`${styles.goaTooltipTier} ${styles[getTierClass(card.tier)]}`}>
            {card.tier === "I" || card.tier === "II" || card.tier === "III"
              ? `Tier ${card.tier}`
              : card.tier}
          </span>
        )}
      </div>

      {card.effect_text && (
        <div className={styles.goaTooltipEffect}>{formatEffectText(card.effect_text)}</div>
      )}

      <div className={styles.goaTooltipStats}>
        <div className={styles.goaTooltipStat}>
          <span className={styles.goaTooltipStatLabel}>Initiative:</span>
          <span className={`${styles.goaTooltipStatValue} initiative`}>{card.initiative}</span>
        </div>

        {card.primary_action && (
          <div className={styles.goaTooltipStat}>
            <span className={styles.goaTooltipStatLabel}>Primary Action:</span>
            <span className={`${styles.goaTooltipStatValue} primary`}>
              {formatActionName(card.primary_action)}{card.primary_action_value != null && !["HOLD", "CLEAR", "FAST_TRAVEL"].includes(card.primary_action) ? ` ${card.primary_action_value}` : ""}
            </span>
          </div>
        )}

        {card.is_ranged && card.range_value && (
          <div className={styles.goaTooltipStat}>
            <span className={styles.goaTooltipStatLabel}>Range:</span>
            <span className={`${styles.goaTooltipStatValue} range`}>
              {card.range_value} hexes
            </span>
          </div>
        )}

        {card.radius_value && (
          <div className={styles.goaTooltipStat}>
            <span className={styles.goaTooltipStatLabel}>Radius:</span>
            <span className={styles.goaTooltipStatValue}>
              {card.radius_value} hexes
            </span>
          </div>
        )}

        {card.item && (
          <div className={styles.goaTooltipStat}>
            <span className={styles.goaTooltipStatLabel}>Item Bonus:</span>
            <span className={styles.goaTooltipStatValue}>
              {card.item}
            </span>
          </div>
        )}
      </div>

      {Object.keys(card.secondary_actions).length > 0 && (
        <div className={styles.goaTooltipSecondary}>
          {Object.entries(card.secondary_actions).map(([action, value]) => (
            <span
              key={action}
              className={`${styles.goaTooltipSecondaryAction} ${styles[getActionClass(action)]}`}
            >
              {formatActionName(action)}{!["HOLD", "CLEAR", "FAST_TRAVEL"].includes(action) ? `: ${value}` : ""}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
