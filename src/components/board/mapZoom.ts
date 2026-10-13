/**
 * Pan/zoom transform for the 2D map, applied as a CSS transform on the SVG
 * inside its clipping container: `translate(x, y) scale(k)` around the
 * container's centre. Nothing else in the layout moves.
 *
 * All coordinates are CSS pixels relative to the container's centre, which is
 * also the transform origin — that keeps the algebra to one line per axis.
 */
export interface MapTransform {
  k: number;
  x: number;
  y: number;
}

export const NO_ZOOM: MapTransform = { k: 1, x: 0, y: 0 };
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 6;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Scale to `nextK` while the content under `anchor` stays under it.
 *
 * A point p (content space) lands at `x + k * p`. Holding the anchor fixed
 * across the scale change gives x' = a - (k'/k) * (a - x).
 */
export function zoomTo(
  current: MapTransform,
  nextK: number,
  anchor: { x: number; y: number },
  size: { width: number; height: number },
): MapTransform {
  const k = clamp(nextK, MIN_ZOOM, MAX_ZOOM);
  const ratio = k / current.k;
  return clampPan(
    {
      k,
      x: anchor.x - ratio * (anchor.x - current.x),
      y: anchor.y - ratio * (anchor.y - current.y),
    },
    size,
  );
}

/** Keep the scaled map covering the container, so it can never be dragged away. */
export function clampPan(transform: MapTransform, size: { width: number; height: number }): MapTransform {
  const slackX = ((transform.k - 1) * size.width) / 2;
  const slackY = ((transform.k - 1) * size.height) / 2;
  return {
    k: transform.k,
    x: clamp(transform.x, -slackX, slackX),
    y: clamp(transform.y, -slackY, slackY),
  };
}

export function toCss({ k, x, y }: MapTransform): string {
  return `translate(${x}px, ${y}px) scale(${k})`;
}
