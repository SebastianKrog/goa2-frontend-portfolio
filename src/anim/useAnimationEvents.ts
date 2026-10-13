import { useEffect, useRef } from "react";
import type { GameEvent } from "../types/game";
import { subscribeAnimationEvents } from "./animationBus";

/**
 * Subscribe to animation event batches for the lifetime of the component.
 *
 * The handler is held in a ref so subscribers can close over fresh props/state
 * without re-subscribing on every render — the subscription itself is set up
 * once on mount.
 */
export function useAnimationEvents(handler: (events: GameEvent[]) => void): void {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(
    () => subscribeAnimationEvents((events) => handlerRef.current(events)),
    [],
  );
}
