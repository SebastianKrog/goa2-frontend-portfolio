export interface ActionStatConfig {
  key: string;
  icon: string;
  label: string;
  order: number;
}

export const ACTION_ORDER: string[] = [
  'ATTACK',
  'DEFENSE',
  'MOVEMENT',
  'SKILL',
  'DEFENSE_SKILL',
  'RANGE',
  'RADIUS',
  'INITIATIVE',
];

export const ACTION_CONFIGS: Record<string, ActionStatConfig> = {
  ATTACK: {
    key: 'ATTACK',
    icon: '/icons/attack.png',
    label: 'Attack',
    order: 0,
  },
  DEFENSE: {
    key: 'DEFENSE',
    icon: '/icons/defense.png',
    label: 'Defense',
    order: 1,
  },
  MOVEMENT: {
    key: 'MOVEMENT',
    icon: '/icons/movement.png',
    label: 'Movement',
    order: 2,
  },
  SKILL: {
    key: 'SKILL',
    icon: '/icons/skill.png',
    label: 'Skill',
    order: 3,
  },
  DEFENSE_SKILL: {
    key: 'DEFENSE_SKILL',
    icon: '/icons/defense-skill.png',
    label: 'Defense Skill',
    order: 4,
  },
  RANGE: {
    key: 'RANGE',
    icon: '/icons/range.png',
    label: 'Range',
    order: 5,
  },
  RADIUS: {
    key: 'RADIUS',
    icon: '/icons/radius.png',
    label: 'Radius',
    order: 6,
  },
  INITIATIVE: {
    key: 'INITIATIVE',
    icon: '/icons/initiative.png',
    label: 'Initiative',
    order: 7,
  },
};

export interface CardStatDisplay {
  key: string;
  icon: string;
  label: string;
  value?: number;
  isPrimary?: boolean;
}

import type { CardView } from "../types/game";

export function getCardStatsDisplay(card: CardView): CardStatDisplay[] {
  const stats: CardStatDisplay[] = [];
  
  const addActionStat = (actionKey: string, value: number) => {
    const config = ACTION_CONFIGS[actionKey];
    if (config) {
      stats.push({
        key: actionKey,
        icon: config.icon,
        label: config.label,
        value,
      });
    }
  };

  if (card.primary_action) {
    if (!['HOLD', 'CLEAR', 'FAST_TRAVEL'].includes(card.primary_action)) {
      const config = ACTION_CONFIGS[card.primary_action];
      if (config) {
        const showValue = card.primary_action_value != null && card.primary_action_value > 0;
        stats.push({
          key: card.primary_action,
          icon: config.icon,
          label: config.label,
          value: showValue ? card.primary_action_value as number : undefined,
          isPrimary: true,
        });
      }
    }
  }

  for (const [action, value] of Object.entries(card.secondary_actions || {})) {
    const numValue = value as number;
    if (numValue != null && numValue > 0 && !['HOLD', 'CLEAR', 'FAST_TRAVEL'].includes(action)) {
      addActionStat(action, numValue);
    }
  }

  if (card.is_ranged && card.range_value != null && card.range_value > 0) {
    addActionStat('RANGE', card.range_value);
  }

  if (card.radius_value != null && card.radius_value > 0) {
    addActionStat('RADIUS', card.radius_value);
  }

  addActionStat('INITIATIVE', card.initiative);

  return stats.sort((a, b) => {
    if (a.isPrimary && !b.isPrimary) return -1;
    if (!a.isPrimary && b.isPrimary) return 1;
    const orderA = ACTION_CONFIGS[a.key]?.order ?? 999;
    const orderB = ACTION_CONFIGS[b.key]?.order ?? 999;
    return orderA - orderB;
  });
}
