import * as THREE from "three";

export interface HandFanCardPlacement {
  x: number;
  y: number;
  rotationZ: number;
}

export const OPPONENT_HAND_CARD_WIDTH = 0.46;
export const OPPONENT_HAND_MAX_FAN_ANGLE = THREE.MathUtils.degToRad(14);
export const OPPONENT_HAND_TILT = THREE.MathUtils.degToRad(30);

const MAX_SPAN = 0.9;
const CARD_ANGLE_STEP = THREE.MathUtils.degToRad(3);
const PIVOT_DISTANCE = OPPONENT_HAND_CARD_WIDTH * 0.7;

export function handFanPlacements(count: number): HandFanCardPlacement[] {
  const cardCount = Math.max(0, Math.floor(count));
  if (cardCount === 0) return [];

  const spacing = cardCount > 1
    ? Math.min(OPPONENT_HAND_CARD_WIDTH * 0.23, MAX_SPAN / (cardCount - 1))
    : 0;
  const angleStep = cardCount > 1
    ? Math.min(CARD_ANGLE_STEP, OPPONENT_HAND_MAX_FAN_ANGLE / (cardCount - 1))
    : 0;

  return Array.from({ length: cardCount }, (_, index) => {
    const offset = index - (cardCount - 1) / 2;
    const rotationZ = offset === 0 ? 0 : -offset * angleStep;
    return {
      x: offset * spacing - PIVOT_DISTANCE * Math.sin(rotationZ),
      y: PIVOT_DISTANCE * (1 - Math.cos(rotationZ)),
      rotationZ,
    };
  });
}
