import type { Hex } from "../../../types/game";
import type { MapConfig } from "./types";

/**
 * The single definition of how the board's hex grid and its map image sit in
 * world space. Everything that needs a hex's position on the 3D board goes
 * through here.
 *
 * The four numbers in a MapConfig (hexSize, origin.x/z, rotationDeg) are solved
 * in the map editor (goa2-backend/tools/map_editor.html), which inverts these
 * same formulas. Any change here is a change to that contract — see
 * docs/superpowers/specs/2026-07-27-map-calibration-in-editor-design.md and keep
 * the editor's solver in step.
 */

const SQRT3 = Math.sqrt(3);

/**
 * Flat-top axial hex -> grid-local (x, z), before the grid's rotation and
 * origin offset are applied. Linear in hexSize.
 */
export function hexToLocal(hex: Hex, hexSize: number): [number, number] {
  return [
    hexSize * (3 / 2) * hex.q,
    hexSize * ((SQRT3 / 2) * hex.q + SQRT3 * hex.r),
  ];
}

/**
 * Hex -> world (x, z), the full chain: local, then the grid rotation about Y,
 * then the origin offset. Mirrors what the `<group position rotation>` wrapper
 * does to the meshes rendered inside it.
 */
export function hexToWorld(hex: Hex, config: MapConfig): [number, number] {
  const [lx, lz] = hexToLocal(hex, config.hexSize);
  const t = (config.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(t);
  const sin = Math.sin(t);
  // three.js rotation-y: x' = x*cos + z*sin, z' = -x*sin + z*cos
  return [
    config.origin.x + lx * cos + lz * sin,
    config.origin.z - lx * sin + lz * cos,
  ];
}

/**
 * World units the map plane spans, given the image's natural pixel size.
 * `imageSize` is the horizontal span; the vertical span follows the image's
 * aspect so the art is never stretched. A stretched image is not a similarity
 * transform of the grid, which makes exact calibration impossible — this is the
 * only place that decision is made.
 */
export function planeSize(
  imageW: number,
  imageH: number,
  imageSize: number,
): [number, number] {
  if (!(imageW > 0) || !(imageH > 0)) return [imageSize, imageSize];
  return [imageSize, imageSize * (imageH / imageW)];
}

/**
 * A point on the map image -> world (x, z). `u`/`v` are normalised image
 * coordinates: (0,0) is the top-left corner of the art, (1,1) the bottom-right.
 *
 * Exact inverse of how MapPlane lays the texture out: the plane is centred on
 * the world origin, image-right runs to +x and image-down to +z. Normalised
 * rather than pixel input so a map's calibration survives re-exporting the PNG
 * at a different resolution.
 */
export function imageUVToWorld(
  u: number,
  v: number,
  imageSize: number,
  aspect: number,
): [number, number] {
  return [(u - 0.5) * imageSize, (v - 0.5) * imageSize * aspect];
}

/**
 * Dev-only agreement check between this module and the editor that produced the
 * config. `config.check` records one hex and the normalised image point the
 * editor aligned it to; if the two disagree by a visible fraction of a hex,
 * something in the pixel->world chain has drifted (a re-cropped image, a changed
 * plane, an edited formula). Logs the actual error so it reads as a number
 * instead of a grid that just looks slightly off.
 *
 * Returns the error in world units, or null when there is nothing to check.
 */
export function checkCalibration(
  config: MapConfig,
  imageW: number,
  imageH: number,
): number | null {
  const check = config.check;
  if (!check || !(imageW > 0) || !(imageH > 0)) return null;
  const [wx, wz] = imageUVToWorld(check.u, check.v, config.imageSize, imageH / imageW);
  const [hx, hz] = hexToWorld(check.hex, config);
  return Math.hypot(wx - hx, wz - hz);
}

/**
 * Error above this fraction of a hex radius is reported as a calibration bug.
 *
 * The check hex is the editor's second align anchor, so a correct config lands on
 * it exactly; the only error left is the rounding of the exported literals. The
 * editor prints hexSize/origin to enough decimals that rounding stays around
 * 1e-4 world units (~3e-4 hex radii), which leaves plenty of room below this
 * limit while still catching real drift — a 1% image stretch, for instance, shows
 * up as ~0.1 hex radii at a corner anchor.
 */
export const CHECK_TOLERANCE = 0.05;
