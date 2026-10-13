import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from "react";
import { NO_ZOOM, clampPan, zoomTo, type MapTransform } from "./mapZoom";

/** Below this much pointer travel a drag is still a tap, so the hex under it selects. */
const TAP_SLOP = 6;
const DOUBLE_TAP_ZOOM = 2.5;

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

const midpoint = (a: { x: number; y: number }, b: { x: number; y: number }) => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});

/**
 * Pinch, drag, wheel and double-tap zoom for the 2D map.
 *
 * Pointer Events cover mouse, pen and touch in one path, so there is no
 * separate touch handling and no gesture library. Everything the hook returns
 * goes on the map's clipping container; the transform belongs on the SVG.
 */
export function useMapZoom({ allowDoubleTap = true }: { allowDoubleTap?: boolean } = {}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [transform, setTransform] = useState<MapTransform>(NO_ZOOM);

  // Live pointers, plus the state each gesture needs between moves.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; k: number } | null>(null);
  const drag = useRef<{ from: { x: number; y: number }; origin: MapTransform } | null>(null);
  // Set by a real pan so the click it ends with does not also select a hex.
  const panned = useRef(false);

  const metrics = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { rect, size: { width: rect.width, height: rect.height } };
  }, []);

  /** Client point → offset from the container centre, the transform's origin. */
  const toAnchor = useCallback((client: { x: number; y: number }, rect: DOMRect) => ({
    x: client.x - (rect.left + rect.width / 2),
    y: client.y - (rect.top + rect.height / 2),
  }), []);

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    // A touch drag ends with no click at all, so the flag has to clear here
    // too or it would swallow the next tap.
    panned.current = false;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const points = [...pointers.current.values()];
    if (points.length === 2) {
      drag.current = null;
      pinch.current = { distance: distance(points[0], points[1]), k: transform.k };
    } else if (points.length === 1 && transform.k > 1) {
      drag.current = { from: { x: e.clientX, y: e.clientY }, origin: transform };
    }
  }, [transform]);

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const box = metrics();
    if (!box) return;

    const points = [...pointers.current.values()];
    const gesture = pinch.current;
    if (gesture && points.length >= 2) {
      const spread = distance(points[0], points[1]);
      if (spread === 0) return;
      const anchor = toAnchor(midpoint(points[0], points[1]), box.rect);
      panned.current = true;
      // Read the gesture off the ref here, not inside the updater: React runs
      // the updater during render, by which point a pointerup may have cleared it.
      setTransform((current) => zoomTo(current, (gesture.k * spread) / gesture.distance, anchor, box.size));
      return;
    }

    if (drag.current) {
      const dx = e.clientX - drag.current.from.x;
      const dy = e.clientY - drag.current.from.y;
      if (!panned.current && Math.hypot(dx, dy) < TAP_SLOP) return;
      panned.current = true;
      const origin = drag.current.origin;
      setTransform(clampPan({ k: origin.k, x: origin.x + dx, y: origin.y + dy }, box.size));
    }
  }, [metrics, toAnchor]);

  const endPointer = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) drag.current = null;
  }, []);

  /* A pointer that leaves the map never reports its release here, and a stale
     entry would make the next press look like the second finger of a pinch.
     Ending the gesture at the edge keeps the bookkeeping honest. */
  const onPointerLeave = useCallback(() => {
    pointers.current.clear();
    pinch.current = null;
    drag.current = null;
  }, []);

  // Wheel goes on natively, not through JSX: React registers wheel listeners as
  // passive, and without preventDefault a trackpad pinch (which arrives as
  // ctrl+wheel) would zoom the whole page on top of the map.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onWheel = (e: WheelEvent) => {
      const box = metrics();
      if (!box) return;
      e.preventDefault();
      setTransform((current) =>
        zoomTo(current, current.k * Math.exp(-e.deltaY * 0.002), toAnchor({ x: e.clientX, y: e.clientY }, box.rect), box.size),
      );
    };
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, [metrics, toAnchor]);

  const onDoubleClick = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    const box = metrics();
    // While the engine is waiting for a target, the first tap of a double tap
    // already submits that choice — pinch and wheel stay available.
    if (!box || !allowDoubleTap) return;
    const anchor = toAnchor({ x: e.clientX, y: e.clientY }, box.rect);
    setTransform((current) => zoomTo(current, current.k > 1 ? 1 : DOUBLE_TAP_ZOOM, anchor, box.size));
  }, [metrics, toAnchor, allowDoubleTap]);

  // Capture phase: swallow the click that ends a pan before a hex sees it.
  const onClickCapture = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    if (!panned.current) return;
    panned.current = false;
    e.stopPropagation();
  }, []);

  const reset = useCallback(() => setTransform(NO_ZOOM), []);

  const handlers = useMemo(() => ({
    onPointerDown,
    onPointerMove,
    onPointerUp: endPointer,
    onPointerCancel: endPointer,
    onPointerLeave,
    onDoubleClick,
    onClickCapture,
  }), [onPointerDown, onPointerMove, endPointer, onPointerLeave, onDoubleClick, onClickCapture]);

  return { containerRef, transform, handlers, reset };
}
