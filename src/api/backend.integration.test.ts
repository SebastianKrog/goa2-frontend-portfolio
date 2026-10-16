/// <reference types="node" />
import { env } from "node:process";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { GameSocket } from "./socket";
import type { GameEvent, ServerMessage } from "../types/game";

// Opt in explicitly: the normal unit suite never requires a running server.
const apiBase = env.GOA2_INTEGRATION_API_URL?.replace(/\/$/, "");

type RetainedEvent = GameEvent & { event_id: number; event_time: number };
interface EventPage {
  events: RetainedEvent[];
  last_event_id: number;
  last_event_time: number;
  has_more: boolean;
}

describe.skipIf(!apiBase)("live backend event-history compatibility", () => {
  beforeAll(() => {
    vi.stubEnv("VITE_API_URL", apiBase!);
    // GameSocket's browser lifecycle listeners need event targets. Fetch and
    // WebSocket remain Node's real implementations, connected to the server.
    vi.stubGlobal("window", Object.assign(new EventTarget(), { setTimeout, clearTimeout }));
    vi.stubGlobal("document", Object.assign(new EventTarget(), { visibilityState: "visible" }));
  });

  afterAll(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("recovers events missed while disconnected using the live IDs and time cursors", async () => {
    const { createGame, fetchHeroes } = await import("./rest");
    expect(await fetchHeroes()).toContain("Arien");
    const game = await createGame(["Arien"], ["Wasp"], "forgotten_island", true);
    const playerToken = (heroId: string) => {
      const seat = game.player_tokens.find((entry) => entry.hero_id === heroId);
      if (!seat) throw new Error(`Missing seat ${heroId}`);
      return seat.token;
    };
    const wsBase = apiBase!.replace(/^http/, "ws");
    const actorMessages: ServerMessage[] = [];
    const observerMessages: ServerMessage[] = [];
    const actor = new GameSocket(
      `${wsBase}/games/${game.game_id}/ws?token=${playerToken("hero_arien")}`,
      (message) => actorMessages.push(message as ServerMessage),
      () => {},
    );
    const observer = new GameSocket(
      `${wsBase}/games/${game.game_id}/ws?token=${playerToken("hero_wasp")}`,
      (message) => observerMessages.push(message as ServerMessage),
      () => {},
    );
    const history = async (query: string, token = playerToken("hero_wasp")): Promise<EventPage> => {
      const response = await fetch(`${apiBase}/games/${game.game_id}/events?${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(response.status).toBe(200);
      return response.json();
    };
    const stateUpdates = (messages: ServerMessage[]) => messages.filter(
      (message) => message.type === "STATE_UPDATE",
    );
    const waitForEvent = (messages: ServerMessage[], eventId: number) => vi.waitFor(() => {
      const update = stateUpdates(messages).find((message) => message.events?.some(
        (event) => (event as RetainedEvent).event_id === eventId,
      ));
      expect(update, `Expected broadcast event ${eventId}`).toBeDefined();
      return update!.events as RetainedEvent[];
    }, { timeout: 5_000 });

    try {
      actor.connect();
      observer.connect();
      await vi.waitFor(() => {
        expect(stateUpdates(actorMessages)).toHaveLength(1);
        expect(stateUpdates(observerMessages)).toHaveLength(1);
      }, { timeout: 5_000 });

      expect(actor.send({ type: "CHEATS_GOLD", hero_id: "hero_arien", amount: 2 })).toBe(true);
      const firstLive = await waitForEvent(observerMessages, 1);
      const first = await history("after_event_id=0");
      expect(first.events).toEqual(firstLive);
      expect(first.last_event_id).toBe(1);

      observer.disconnect();
      expect(actor.send({ type: "CHEATS_GOLD", hero_id: "hero_arien", amount: 5 })).toBe(true);
      const missedLive = await waitForEvent(actorMessages, 2);
      expect(stateUpdates(observerMessages).flatMap((message) => message.events ?? []))
        .toEqual(firstLive);

      const updatesBeforeReconnect = stateUpdates(observerMessages).length;
      observer.connect();
      await vi.waitFor(() => {
        expect(stateUpdates(observerMessages)).toHaveLength(updatesBeforeReconnect + 1);
      }, { timeout: 5_000 });
      // Reconnect sends a fresh snapshot. Missed events require the REST API.
      expect(stateUpdates(observerMessages).at(-1)?.events).toBeUndefined();
      const missed = await history(`after_event_id=${first.last_event_id}`);
      expect(missed.events).toEqual(missedLive);
      expect(missed.has_more).toBe(false);
      expect(await history(`after_event_time=${first.last_event_time}`)).toEqual(missed);

      const page = await history("after_event_id=0&limit=1");
      expect(page.events).toEqual(firstLive);
      expect(page.has_more).toBe(true);
      expect(await history(`after_event_id=${page.last_event_id}`)).toEqual(missed);
      expect((await history(`after_event_id=${missed.last_event_id}`)).events).toEqual([]);
      expect((await history("after_event_id=0", game.spectator_token)).events)
        .toEqual([...firstLive, ...missedLive]);
      const unauthenticated = await fetch(`${apiBase}/games/${game.game_id}/events`);
      expect(unauthenticated.status).toBe(401);
    } finally {
      actor.disconnect();
      observer.disconnect();
    }
  }, 20_000);
});
