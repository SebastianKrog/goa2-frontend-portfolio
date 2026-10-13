import type { Hex } from "../types/game";

// Flat-top hex layout constants
const HEX_SIZE = 28; // pixels — radius of hex

export function hexToPixel(hex: Hex): { x: number; y: number } {
  const x = HEX_SIZE * (3 / 2) * hex.q;
  const y = HEX_SIZE * (Math.sqrt(3) / 2 * hex.q + Math.sqrt(3) * hex.r);
  return { x, y };
}

export function hexCorners(cx: number, cy: number, size: number = HEX_SIZE): string {
  const points: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i);
    const px = cx + size * Math.cos(angle);
    const py = cy + size * Math.sin(angle);
    points.push(`${px},${py}`);
  }
  return points.join(" ");
}

export function hexKey(hex: Hex): string {
  return `${hex.q}_${hex.r}_${hex.s}`;
}

export function hexEqual(a: Hex, b: Hex): boolean {
  return a.q === b.q && a.r === b.r && a.s === b.s;
}

export function hexInList(hex: Hex, list: Hex[]): boolean {
  return list.some((h) => hexEqual(h, hex));
}

export { HEX_SIZE };
