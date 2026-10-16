import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export const MOBILE_PANES = ["heroes", "hand", "deck", "log", "settings"] as const;
export type MobilePane = "board" | typeof MOBILE_PANES[number];
export type MobileDialog = "report" | "share" | "override";

interface NavigationEntry {
  owner: string;
  pane: MobilePane;
  dialog?: MobileDialog;
}

/**
 * One history entry per open pane; switching panes replaces that entry.
 * A dialog adds one entry above its pane, so Back closes the top surface first.
 * Ownership is ephemeral: a new game/viewer cannot inherit an old pane or dialog.
 * React Router owns all history writes; URLs (including credentials) stay intact.
 */
export function useMobileNavigation(enabled: boolean) {
  const location = useLocation();
  const navigate = useNavigate();
  const [owner] = useState(() => crypto.randomUUID());
  const pendingKey = useRef<string | null>(null);
  const dialogOpener = useRef<HTMLElement | null>(null);
  const previousDialog = useRef<MobileDialog | undefined>(undefined);
  const routeState = location.state && typeof location.state === "object" ? location.state : {};
  const candidate = routeState.goa2Mobile as NavigationEntry | undefined;
  const entry = enabled && candidate?.owner === owner ? candidate : undefined;
  const pane = entry?.pane ?? "board";
  const dialog = entry?.dialog;

  useEffect(() => { pendingKey.current = null; }, [location.key]);

  useEffect(() => {
    if (previousDialog.current && !dialog && dialogOpener.current?.isConnected) {
      dialogOpener.current.focus();
    }
    previousDialog.current = dialog;
  }, [dialog]);

  function write(next: Omit<NavigationEntry, "owner">, replace: boolean) {
    if (pendingKey.current === location.key) return;
    pendingKey.current = location.key;
    void navigate(
      { pathname: location.pathname, search: location.search, hash: location.hash },
      { replace, state: { ...routeState, goa2Mobile: { ...next, owner } } },
    );
  }

  function close() {
    // Only entries created by this mounted session can be traversed by Back.
    if (!entry || pendingKey.current === location.key) return;
    pendingKey.current = location.key;
    void navigate(-1);
  }

  function showPane(next: MobilePane) {
    if (next === "board") {
      if (!entry || pendingKey.current === location.key) return;
      pendingKey.current = location.key;
      void navigate(dialog && pane !== "board" ? -2 : -1);
    }
    else write({ pane: next }, !!entry);
  }

  useEffect(() => {
    if (!enabled || (!entry || (pane === "board" && !dialog))) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.repeat) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (pendingKey.current === location.key) return;
      pendingKey.current = location.key;
      void navigate(-1);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [enabled, entry, pane, dialog, navigate, location.key]);

  return {
    pane, dialog, close, showPane,
    togglePane: (next: Exclude<MobilePane, "board">) => next === pane ? close() : showPane(next),
    openDialog: (next: MobileDialog) => {
      if (!dialog) dialogOpener.current = document.activeElement as HTMLElement | null;
      write({ pane, dialog: next }, !!dialog);
    },
  };
}
