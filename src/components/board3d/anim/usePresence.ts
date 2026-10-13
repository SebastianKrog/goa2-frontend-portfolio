import { useEffect, useRef, useState } from "react";

/**
 * Tracks list membership across renders so removed items can play an exit
 * animation before they unmount. Returns the current items (each flagged
 * `leaving: false`) plus any recently-removed items (`leaving: true`) retained
 * for `leaveMs`, after which they are dropped.
 *
 * Used for units: when a hero/minion disappears from the view (defeated), it
 * lingers for half a second so `AnimatedUnit` can sink + shrink it instead of
 * teleporting out. An item that reappears within the window cancels its exit.
 */
export function usePresence<T extends { id: string }>(
  items: T[],
  leaveMs = 520,
): Array<T & { leaving: boolean }> {
  const [leaving, setLeaving] = useState<Map<string, T>>(new Map());
  const prev = useRef<Map<string, T>>(new Map());
  const timers = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const curIds = new Set(items.map((i) => i.id));

    // Items present last render but gone now → begin leaving (unless already).
    const toStart: Array<[string, T]> = [];
    for (const [id, item] of prev.current) {
      if (!curIds.has(id) && !timers.current.has(id)) toStart.push([id, item]);
    }
    // Items currently leaving but back again → cancel their exit.
    const toCancel: string[] = [];
    for (const id of timers.current.keys()) {
      if (curIds.has(id)) toCancel.push(id);
    }

    for (const [id] of toStart) {
      const handle = window.setTimeout(() => {
        timers.current.delete(id);
        setLeaving((m) => {
          if (!m.has(id)) return m;
          const next = new Map(m);
          next.delete(id);
          return next;
        });
      }, leaveMs);
      timers.current.set(id, handle);
    }
    for (const id of toCancel) {
      const handle = timers.current.get(id);
      if (handle) clearTimeout(handle);
      timers.current.delete(id);
    }

    if (toStart.length > 0 || toCancel.length > 0) {
      setLeaving((cur) => {
        const next = new Map(cur);
        for (const [id, item] of toStart) next.set(id, item);
        for (const id of toCancel) next.delete(id);
        return next;
      });
    }

    prev.current = new Map(items.map((i) => [i.id, i]));
  }, [items, leaveMs]);

  useEffect(() => {
    const handles = timers.current;
    return () => {
      for (const handle of handles.values()) clearTimeout(handle);
      handles.clear();
    };
  }, []);

  const result: Array<T & { leaving: boolean }> = items.map((i) => ({ ...i, leaving: false }));
  const present = new Set(items.map((i) => i.id));
  for (const [id, item] of leaving) {
    if (!present.has(id)) result.push({ ...item, leaving: true });
  }
  return result;
}
