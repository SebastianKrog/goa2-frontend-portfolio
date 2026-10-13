import { useCallback, useEffect, useRef, useState } from "react";
import { GameSocket } from "../api/socket";
import type { DraftSocketMessage, DraftView } from "../types/draft";

interface DraftSocketState {
  view: DraftView | null;
  connected: boolean;
  error: string | null;
}

/**
 * Live draft-lobby connection. Reuses GameSocket (reconnect + 4001/4003/4004
 * close-code handling). The channel is read-only: every REST mutation by any
 * participant is broadcast back as a player-scoped STATE_UPDATE.
 */
export function useDraftSocket(draftId: string, token: string) {
  const [state, setState] = useState<DraftSocketState>({
    view: null,
    connected: false,
    error: null,
  });

  const socketRef = useRef<GameSocket | null>(null);
  const errorTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!draftId || !token) return;

    const apiBase = import.meta.env.VITE_API_URL || "/api";
    let wsUrl: string;
    if (/^https?:\/\//.test(apiBase)) {
      const wsBase = apiBase.replace(/^http/, "ws");
      wsUrl = `${wsBase}/drafts/${draftId}/ws?token=${token}`;
    } else {
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      wsUrl = `${proto}//${window.location.host}${apiBase}/drafts/${draftId}/ws?token=${token}`;
    }

    const handleMessage = (data: unknown) => {
      const msg = data as DraftSocketMessage;
      if (msg.type === "STATE_UPDATE") {
        setState((prev) => ({
          ...prev,
          view: { draft: msg.draft, you: msg.you, game_id: msg.game_id, game_token: msg.game_token },
        }));
      } else if (msg.type === "ERROR") {
        setState((prev) => ({ ...prev, error: msg.detail }));
        if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
        errorTimerRef.current = window.setTimeout(
          () => setState((prev) => ({ ...prev, error: null })),
          5000
        );
      }
    };

    const handleStatusChange = (connected: boolean) => {
      setState((prev) => ({ ...prev, connected }));
    };

    const socket = new GameSocket(wsUrl, handleMessage, handleStatusChange);
    socketRef.current = socket;
    socket.connect();

    return () => {
      socket.disconnect();
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, [draftId, token]);

  const getView = useCallback(() => socketRef.current?.send({ type: "GET_VIEW" }), []);

  return { ...state, getView };
}
