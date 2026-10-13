import { useEffect, useRef, useCallback, useState } from "react";
import { GameSocket } from "../api/socket";
import { emitAnimationEvents } from "../anim/animationBus";
import { CHEATS_AVAILABLE } from "../config/features";
import { pingCue } from "../audio/gameSounds";
import { mergeHeroNames, type HeroNames } from "./heroNames";
import { captureNames, type EntityNames } from "../utils/eventLogText";
import type {
  ServerMessage,
  GameView,
  InputRequest,
  GameEvent,
  Hex,
  PingTarget,
  ActivePing,
  RemotePointer,
  RemotePointerLocation,
  ActiveOverrideProposal,
  OverrideFamily,
  OverrideResolution,
  StartingPositionAction,
} from "../types/game";

export interface TimestampedEvent {
  id: number;
  event: GameEvent;
  timestamp: number;
  names: EntityNames;
}

let nextEventId = 0;

interface GameState {
  view: GameView | null;
  inputRequest: InputRequest | null;
  /** Heroes the pending decision is waiting on, whether or not it is ours. */
  awaitingInput: string[];
  eventLog: TimestampedEvent[];
  error: string | null;
  connected: boolean;
  /** Close code that ended reconnection (see TERMINAL_CLOSE_CODES); cleared on reconnect. */
  closeCode: number | null;
  myHeroId: string | null;
  winner: string | null;
  pings: ActivePing[];
  /** hero_id -> last known board position of everyone else's pointer. */
  pointers: Record<string, RemotePointer>;
  /** The one open consensus-override proposal, if any (server enforces one). */
  overrideProposal: ActiveOverrideProposal | null;
  /** Outcome of the last resolved proposal, shown briefly then cleared. */
  overrideResolution: OverrideResolution | null;
  /** hero_id -> seat token, for every reveal the table has approved. */
  revealedPlayerTokens: Record<string, string>;
}

const PING_LIFETIME_MS = 3600;
const PING_SEND_INTERVAL_MS = 500;
const POINTER_SEND_INTERVAL_MS = 60;
const POINTER_STALE_MS = 4000;
const MAX_LATENCY_SAMPLES = 100;
const MEASURED_MUTATION_TYPES = new Set([
  "SUBMIT_INPUT",
  "COMMIT_CARD",
  "UNCOMMIT_CARD",
  "PASS_TURN",
  "FINISH_PLANNING",
  "STARTING_POSITION",
  "ROLLBACK",
  "CHEATS_GOLD",
  "SET_READY",
]);

// Timings start at the send call, not the originating click, and end at the
// React DOM commit: the r3f canvas repaints on its own loop, so board
// animation is outside the window these numbers cover.
export interface ActionLatencySample {
  actionId: string;
  action: string;
  recordedAt: string;
  sendToUpdateMs: number;
  updateToDomMs?: number;
  sendToDomMs?: number;
}

declare global {
  interface Window {
    /** Rolling, in-memory diagnostics; never transmitted or persisted. */
    __GOA2_LATENCY_SAMPLES__?: ActionLatencySample[];
  }
}

export function useGameSocket(gameId: string, token: string) {
  const [heroNames, setHeroNames] = useState<HeroNames>({});
  const [state, setState] = useState<GameState>({
    view: null,
    inputRequest: null,
    awaitingInput: [],
    eventLog: [],
    error: null,
    connected: false,
    closeCode: null,
    myHeroId: null,
    winner: null,
    pings: [],
    pointers: {},
    overrideProposal: null,
    overrideResolution: null,
    revealedPlayerTokens: {},
  });

  const socketRef = useRef<GameSocket | null>(null);
  const errorTimerRef = useRef<number | null>(null);
  const overrideResolutionTimerRef = useRef<number | null>(null);
  const lastPingSentRef = useRef(Number.NEGATIVE_INFINITY);
  const lastPointerSentRef = useRef(Number.NEGATIVE_INFINITY);
  const pendingPointerZoneTimerRef = useRef<number | null>(null);
  const actionSequenceRef = useRef(0);
  const pendingActionsRef = useRef(new Map<string, { action: string; startedAt: number }>());
  const pendingRenderSamplesRef = useRef<
    Array<{ sample: ActionLatencySample; updateReceivedAt: number }>
  >([]);

  useEffect(() => {
    if (!state.view || pendingRenderSamplesRef.current.length === 0) return;
    const pending = pendingRenderSamplesRef.current.splice(0);
    window.requestAnimationFrame(() => {
      const renderedAt = performance.now();
      for (const { sample, updateReceivedAt } of pending) {
        sample.updateToDomMs = renderedAt - updateReceivedAt;
        sample.sendToDomMs = sample.sendToUpdateMs + sample.updateToDomMs;
      }
    });
  }, [state.view]);

  useEffect(() => {
    if (!gameId || !token) return;
    const pingTimers = new Set<number>();
    const pendingActions = pendingActionsRef.current;
    const pendingRenderSamples = pendingRenderSamplesRef.current;

    // Remote cursors vanish once their owner stops moving (disconnect, tab
    // closed) rather than freezing at their last position.
    const pointerPruneTimer = window.setInterval(() => {
      const cutoff = Date.now() - POINTER_STALE_MS;
      setState((prev) => {
        const next: Record<string, RemotePointer> = {};
        for (const [heroId, pointer] of Object.entries(prev.pointers)) {
          if (pointer.received_at_ms > cutoff) next[heroId] = pointer;
        }
        return Object.keys(next).length === Object.keys(prev.pointers).length
          ? prev
          : { ...prev, pointers: next };
      });
    }, 1000);

    const apiBase = import.meta.env.VITE_API_URL || "/api";
    let wsUrl: string;
    if (/^https?:\/\//.test(apiBase)) {
      // Absolute backend URL: swap the scheme http(s) -> ws(s).
      const wsBase = apiBase.replace(/^http/, "ws");
      wsUrl = `${wsBase}/games/${gameId}/ws?token=${token}`;
    } else {
      // Relative/empty base (e.g. "/api"): same-origin WebSocket, proxied to
      // the backend by the Worker. A relative URL is invalid for WebSocket, so
      // build an absolute ws(s):// URL from the current page origin.
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      wsUrl = `${proto}//${window.location.host}${apiBase}/games/${gameId}/ws?token=${token}`;
    }

    const handleMessage = (data: unknown) => {
      const msg = data as ServerMessage;

      switch (msg.type) {
        case "STATE_UPDATE":
          if (msg.client_action_id) {
            const pending = pendingActionsRef.current.get(msg.client_action_id);
            if (pending) {
              const updateReceivedAt = performance.now();
              const sample: ActionLatencySample = {
                actionId: msg.client_action_id,
                action: pending.action,
                recordedAt: new Date().toISOString(),
                sendToUpdateMs: updateReceivedAt - pending.startedAt,
              };
              const samples = window.__GOA2_LATENCY_SAMPLES__ ?? [];
              samples.push(sample);
              if (samples.length > MAX_LATENCY_SAMPLES) {
                samples.splice(0, samples.length - MAX_LATENCY_SAMPLES);
              }
              window.__GOA2_LATENCY_SAMPLES__ = samples;
              pendingRenderSamplesRef.current.push({ sample, updateReceivedAt });
              pendingActionsRef.current.delete(msg.client_action_id);
            }
          }
          setHeroNames((prev) => mergeHeroNames(prev, msg.hero_names));
          // Drive 3D animations off the broadcast event stream (every client
          // receives it), never off ACTION_RESULT — one path for actor and
          // observers alike. Absent on connect/GET_VIEW, hence the guard.
          if (msg.events && msg.events.length > 0) {
            emitAnimationEvents(msg.events);
          }
          if (msg.view.clock) {
            msg.view.clock = {
              ...msg.view.clock,
              client_received_at_ms: Date.now(),
            };
          }
          setState((prev) => ({
            ...prev,
            view: msg.view,
            inputRequest: msg.input_request ?? null,
            awaitingInput: msg.awaiting_input ?? [],
            // The scoped STATE_UPDATE broadcast is the one event path shared
            // by the actor, opponents, and spectators, so logging it gives
            // every client the same history. ACTION_RESULT would log the
            // actor's own events a second time.
            eventLog: msg.events && msg.events.length > 0
              ? [
                  ...prev.eventLog,
                  ...msg.events.map((event) => ({
                    id: nextEventId++,
                    event,
                    timestamp: Date.now(),
                    names: captureNames(event, [msg.view, prev.view]),
                  })),
                ].slice(-100)
              : prev.eventLog,
            myHeroId: prev.myHeroId ?? detectHeroId(msg.view),
            winner: msg.winner ?? null,
          }));
          break;

        case "ACTION_RESULT": {
          setState((prev) => ({
            ...prev,
            // Events arrive again in the recipient-scoped STATE_UPDATE sent
            // immediately after this reply. Logging only that broadcast avoids
            // duplicates while giving observers the same history.
            inputRequest: msg.input_request ?? null,
            awaitingInput: msg.awaiting_input ?? [],
            winner: msg.winner ?? prev.winner,
          }));
          break;
        }

        case "READY_UPDATED":
          // The authoritative readiness list arrives in the accompanying
          // STATE_UPDATE broadcast.
          break;

        case "PING": {
          const activePing: ActivePing = {
            ...msg,
            received_at_ms: Date.now(),
          };
          setState((prev) => ({
            ...prev,
            pings: [...prev.pings.filter((ping) => ping.ping_id !== msg.ping_id), activePing].slice(-8),
          }));
          const timer = window.setTimeout(() => {
            pingTimers.delete(timer);
            setState((prev) => ({
              ...prev,
              pings: prev.pings.filter((ping) => ping.ping_id !== msg.ping_id),
            }));
          }, PING_LIFETIME_MS);
          pingTimers.add(timer);
          // State first: browser audio policy or a device failure must not
          // suppress the marker/name cue for remote players.
          pingCue();
          break;
        }

        case "POINTER":
          setState((prev) => {
            if (msg.hidden) {
              if (!(msg.hero_id in prev.pointers)) return prev;
              const next = { ...prev.pointers };
              delete next[msg.hero_id];
              return { ...prev, pointers: next };
            }
            let location: RemotePointerLocation | null = null;
            if (msg.x !== undefined && msg.z !== undefined) {
              location = { kind: "point", x: msg.x, z: msg.z };
            } else if (msg.target_hero_id !== undefined && msg.zone !== undefined) {
              location = { kind: "zone", target_hero_id: msg.target_hero_id, zone: msg.zone };
            }
            if (!location) return prev;
            return {
              ...prev,
              pointers: {
                ...prev.pointers,
                [msg.hero_id]: {
                  ...location,
                  received_at_ms: Date.now(),
                },
              },
            };
          });
          break;

        case "OVERRIDE_PROPOSED": {
          const { type: _type, ...proposal } = msg;
          void _type;
          setState((prev) => ({ ...prev, overrideProposal: proposal }));
          break;
        }

        case "OVERRIDE_UPDATED":
          setState((prev) =>
            prev.overrideProposal && prev.overrideProposal.proposal_id === msg.proposal_id
              ? {
                  ...prev,
                  overrideProposal: { ...prev.overrideProposal, tally: msg.tally },
                }
              : prev
          );
          break;

        case "OVERRIDE_RESOLVED":
          setState((prev) => ({
            ...prev,
            overrideProposal:
              prev.overrideProposal?.proposal_id === msg.proposal_id
                ? null
                : prev.overrideProposal,
            overrideResolution: {
              outcome: msg.outcome,
              summary:
                prev.overrideProposal?.proposal_id === msg.proposal_id
                  ? prev.overrideProposal.summary
                  : "",
              family:
                prev.overrideProposal?.proposal_id === msg.proposal_id
                  ? prev.overrideProposal.family
                  : undefined,
              reason: msg.reason,
            },
          }));
          if (overrideResolutionTimerRef.current) {
            clearTimeout(overrideResolutionTimerRef.current);
          }
          overrideResolutionTimerRef.current = window.setTimeout(() => {
            setState((prev) => ({ ...prev, overrideResolution: null }));
          }, 6000);
          break;

        case "PLAYER_LINK_REVEALED":
          setState((prev) => ({
            ...prev,
            revealedPlayerTokens: { ...prev.revealedPlayerTokens, [msg.hero_id]: msg.token },
          }));
          break;

        case "ERROR":
          setState((prev) => ({ ...prev, error: msg.detail }));
          if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
          errorTimerRef.current = window.setTimeout(() => {
            setState((prev) => ({ ...prev, error: null }));
          }, 5000);
          break;
      }
    };

    const handleStatusChange = (connected: boolean) => {
      setState((prev) => ({ ...prev, connected, closeCode: connected ? null : prev.closeCode }));
    };

    const handleTerminalClose = (closeCode: number) => {
      setState((prev) => ({ ...prev, closeCode }));
    };

    const socket = new GameSocket(wsUrl, handleMessage, handleStatusChange, handleTerminalClose);
    socketRef.current = socket;
    socket.connect();

    return () => {
      socket.disconnect();
      window.clearInterval(pointerPruneTimer);
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      if (overrideResolutionTimerRef.current) clearTimeout(overrideResolutionTimerRef.current);
      if (pendingPointerZoneTimerRef.current !== null) {
        window.clearTimeout(pendingPointerZoneTimerRef.current);
        pendingPointerZoneTimerRef.current = null;
      }
      for (const timer of pingTimers) window.clearTimeout(timer);
      pendingActions.clear();
      pendingRenderSamples.length = 0;
      setState((prev) => (prev.pings.length > 0 ? { ...prev, pings: [] } : prev));
    };
  }, [gameId, token]);

  const send = useCallback((message: Record<string, unknown>) => {
    const action = typeof message.type === "string" ? message.type : "";
    if (!MEASURED_MUTATION_TYPES.has(action)) {
      socketRef.current?.send(message);
      return;
    }

    const actionId = `${Date.now().toString(36)}-${++actionSequenceRef.current}`;
    const startedAt = performance.now();
    if (socketRef.current?.send({ ...message, client_action_id: actionId })) {
      pendingActionsRef.current.set(actionId, { action, startedAt });
      if (pendingActionsRef.current.size > MAX_LATENCY_SAMPLES) {
        const oldest = pendingActionsRef.current.keys().next().value;
        if (oldest) pendingActionsRef.current.delete(oldest);
      }
    }
  }, []);

  const changeStartingPosition = useCallback(
    (action: StartingPositionAction) =>
      send({ type: "STARTING_POSITION", ...action }),
    [send],
  );

  const commitCard = useCallback(
    (cardId: string) => send({ type: "COMMIT_CARD", card_id: cardId }),
    [send]
  );

  // Planning take-back: return the committed card to hand (LIFO for a
  // two-card hero). Valid until the last player commits.
  const uncommitCard = useCallback(
    () => send({ type: "UNCOMMIT_CARD" }),
    [send]
  );

  const passTurn = useCallback(
    () => send({ type: "PASS_TURN" }),
    [send]
  );

  // Emmitt's Alternative Timelines: declare "playing only one card this turn"
  // after the first commit, instead of committing a second card.
  const finishPlanning = useCallback(
    () => send({ type: "FINISH_PLANNING" }),
    [send]
  );

  const rollback = useCallback(
    () => send({ type: "ROLLBACK" }),
    [send]
  );

  const submitInput = useCallback(
    (selection: string | Hex | number | null | { hero_id: string; card_id: string }) => {
      // Newer backends use an opaque ID to prevent an input intended for an
      // earlier prompt from being applied to the current one. Older backends
      // do not issue IDs, so omit the field for those prompts.
      const message: Record<string, unknown> = {
        type: "SUBMIT_INPUT",
        selection,
      };
      if (state.inputRequest?.request_id) {
        message.request_id = state.inputRequest.request_id;
      }
      send(message);
    },
    [send, state.inputRequest]
  );

  const requestView = useCallback(
    () => send({ type: "GET_VIEW" }),
    [send]
  );

  const setReady = useCallback(
    (ready: boolean) => send({ type: "SET_READY", ready }),
    [send],
  );

  const sendPing = useCallback(
    (target: PingTarget) => {
      const now = performance.now();
      if (now - lastPingSentRef.current < PING_SEND_INTERVAL_MS) return;
      lastPingSentRef.current = now;
      send({ type: "PING", target });
    },
    [send],
  );

  const sendPointer = useCallback(
    (x: number, z: number) => {
      if (pendingPointerZoneTimerRef.current !== null) {
        window.clearTimeout(pendingPointerZoneTimerRef.current);
        pendingPointerZoneTimerRef.current = null;
      }
      const now = performance.now();
      if (now - lastPointerSentRef.current < POINTER_SEND_INTERVAL_MS) return;
      lastPointerSentRef.current = now;
      send({ type: "POINTER", x, z });
    },
    [send],
  );

  // Hovering a hero's board is reported semantically (whose board, which
  // zone) because each client lays seats out differently; the receiver draws
  // the cursor at that zone in its own layout.
  const sendPointerZone = useCallback(
    (targetHeroId: string, zone: string) => {
      const now = performance.now();
      const elapsed = now - lastPointerSentRef.current;
      if (elapsed < POINTER_SEND_INTERVAL_MS) {
        if (pendingPointerZoneTimerRef.current !== null) {
          window.clearTimeout(pendingPointerZoneTimerRef.current);
        }
        pendingPointerZoneTimerRef.current = window.setTimeout(() => {
          pendingPointerZoneTimerRef.current = null;
          lastPointerSentRef.current = performance.now();
          send({ type: "POINTER", target_hero_id: targetHeroId, zone });
        }, POINTER_SEND_INTERVAL_MS - elapsed);
        return;
      }
      if (pendingPointerZoneTimerRef.current !== null) {
        window.clearTimeout(pendingPointerZoneTimerRef.current);
        pendingPointerZoneTimerRef.current = null;
      }
      lastPointerSentRef.current = now;
      send({ type: "POINTER", target_hero_id: targetHeroId, zone });
    },
    [send],
  );

  // Leaving the table (hand, HUD, sky) must always propagate so the remote
  // marker vanishes at once instead of lingering until the stale timeout.
  const hidePointer = useCallback(() => {
    if (pendingPointerZoneTimerRef.current !== null) {
      window.clearTimeout(pendingPointerZoneTimerRef.current);
      pendingPointerZoneTimerRef.current = null;
    }
    send({ type: "POINTER", hidden: true });
  }, [send]);

  // Consensus overrides: propose / vote / cancel. The server broadcasts
  // OVERRIDE_PROPOSED / UPDATED / RESOLVED; rejections arrive as ERROR.
  const proposeOverride = useCallback(
    (payload: { family: OverrideFamily; op?: string; args?: Record<string, unknown>; to?: number }) =>
      send({ type: "PROPOSE_OVERRIDE", ...payload }),
    [send]
  );

  const voteOverride = useCallback(
    (proposalId: string, approve: boolean) =>
      send({ type: "VOTE_OVERRIDE", proposal_id: proposalId, approve }),
    [send]
  );

  const requestPlayerLink = useCallback(
    (heroId: string) =>
      send({ type: "PROPOSE_OVERRIDE", family: "reveal_player", args: { hero_id: heroId } }),
    [send]
  );

  const cancelOverride = useCallback(
    (proposalId: string) => send({ type: "CANCEL_OVERRIDE", proposal_id: proposalId }),
    [send]
  );

  const cheatsGold = useCallback(
    (heroId: string, amount: number) => {
      if (CHEATS_AVAILABLE) {
        send({ type: "CHEATS_GOLD", hero_id: heroId, amount });
      }
    },
    [send]
  );

  const reconnect = useCallback(() => {
    setState((prev) => ({ ...prev, closeCode: null }));
    socketRef.current?.reconnect();
  }, []);

  return {
    ...state,
    winner: state.winner,
    reconnect,
    heroNames,
    commitCard,
    changeStartingPosition,
    uncommitCard,
    passTurn,
    finishPlanning,
    rollback,
    submitInput,
    requestView,
    setReady,
    sendPing,
    sendPointer,
    sendPointerZone,
    hidePointer,
    cheatsGold,
    proposeOverride,
    voteOverride,
    cancelOverride,
    requestPlayerLink,
  };
}

/**
 * Detect which hero belongs to this token by checking which hero's
 * deck is an array (own hero sees full deck, others see {count}).
 */
function detectHeroId(view: GameView): string | null {
  for (const team of Object.values(view.teams)) {
    for (const hero of team.heroes) {
      if (Array.isArray(hero.deck)) {
        return hero.id;
      }
    }
  }
  return null;
}
