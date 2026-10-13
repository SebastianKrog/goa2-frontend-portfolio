import type { MapConfig } from "../components/board3d/maps/types";
import { HEX_SIZE } from "./hex";

// The 2D board renders the same flat-top axial grid the 3D scene uses, just
// with HEX_SIZE and no rotation/origin. These two functions convert pointer
// positions between the SVG's local pixel space and 3D table world space so
// remote cursors land on the same spot in either view.

export function svgToWorld(
  x: number,
  y: number,
  config: MapConfig,
): { x: number; z: number } {
  const lx = x * (config.hexSize / HEX_SIZE);
  const lz = y * (config.hexSize / HEX_SIZE);
  const t = (config.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(t);
  const sin = Math.sin(t);
  return {
    x: config.origin.x + lx * cos + lz * sin,
    z: config.origin.z - lx * sin + lz * cos,
  };
}

export function worldToSvg(
  worldX: number,
  worldZ: number,
  config: MapConfig,
): { x: number; y: number } {
  const dx = worldX - config.origin.x;
  const dz = worldZ - config.origin.z;
  const t = (config.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(t);
  const sin = Math.sin(t);
  return {
    x: (dx * cos - dz * sin) * (HEX_SIZE / config.hexSize),
    y: (dx * sin + dz * cos) * (HEX_SIZE / config.hexSize),
  };
}
