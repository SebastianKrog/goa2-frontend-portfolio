// @vitest-environment jsdom
import { act, useLayoutEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameView, InputRequest } from "../types/game";
import { useGameController, type GameController } from "./useGameController";
import { card, game } from "./__fixtures__/gameController";

interface Transport {
  url: string;
  receive: (message: unknown) => void;
  status: (connected: boolean) => void;
  terminal: (code: number) => void;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
}
const network = vi.hoisted(() => ({ sockets: [] as Transport[] }));

// Exercise the actual controller AND socket hook. Only the network boundary is
// replaced, so state updates, request correlation, and command timing are real.
vi.mock("../api/socket", () => ({
  GameSocket: class {
    url: string;
    receive: Transport["receive"];
    status: Transport["status"];
    terminal: Transport["terminal"];
    connect = vi.fn(() => this.status(true));
    disconnect = vi.fn();
    send = vi.fn(() => true);
    reconnect = vi.fn();
    constructor(url: string, receive: Transport["receive"], status: Transport["status"], terminal: Transport["terminal"]) {
      this.url = url;
      this.receive = receive;
      this.status = status;
      this.terminal = terminal;
      network.sockets.push(this);
    }
  },
}));
vi.mock("../i18n/cardText", async (importOriginal) => ({
  ...await importOriginal<typeof import("../i18n/cardText")>(),
  ensureCardTextReady: () => Promise.resolve(),
}));

let root: Root;
let host: HTMLDivElement;
let controller: GameController;
function Consumer({ layout = "desktop" }: { layout?: string }) {
  const current = useGameController("game-one", "seat-token");
  useLayoutEffect(() => { controller = current; });
  return <p>{layout}: {current.model.playerStatus?.title}</p>;
}
function transport() { return network.sockets[0]; }
function messages(type: string) {
  return transport().send.mock.calls.map(([message]) => message as Record<string, unknown>)
    .filter((message) => message.type === type);
}
async function update(view: GameView, inputRequest: InputRequest | null = null) {
  await act(async () => transport().receive({ type: "STATE_UPDATE", view, input_request: inputRequest }));
}
async function mount(view = game()) {
  await act(async () => root.render(<Consumer />));
  await update(view);
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  localStorage.clear();
  network.sockets = [];
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.useRealTimers();
});

describe("shared game controller lifecycle and commands", () => {
  it("uses one transport across presentation changes and disconnects/cleans timers on unmount", async () => {
    await mount();
    expect(network.sockets).toHaveLength(1);
    expect(transport().url).toContain("/games/game-one/ws?token=seat-token");
    expect(controller.model.myHero?.id).toBe("hero_own");
    await act(async () => controller.selection.setSelectedCardId("choice"));
    await act(async () => root.render(<Consumer layout="mobile" />));
    expect(network.sockets).toHaveLength(1);
    expect(transport().connect).toHaveBeenCalledTimes(1);
    expect(controller.selection.selectedCardId).toBe("choice");
    await act(async () => root.unmount());
    expect(transport().disconnect).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    // Leave a valid root for the common cleanup.
    root = createRoot(host);
  });

  it("commits directly when planning is open and clears the shared selection", async () => {
    await mount();
    await act(async () => controller.selection.setSelectedCardId("choice"));
    await act(async () => controller.actions.commitOrSwap("choice"));
    expect(messages("COMMIT_CARD")).toEqual([expect.objectContaining({ card_id: "choice" })]);
    expect(messages("UNCOMMIT_CARD")).toEqual([]);
    expect(controller.selection.selectedCardId).toBeNull();
  });

  it("waits for authoritative take-back before swapping and never repeats the commit on unrelated updates", async () => {
    const view = game();
    view.teams.RED.heroes[0].current_turn_card = card("committed");
    await mount(view);
    await act(async () => controller.actions.commitOrSwap("choice"));
    expect(messages("UNCOMMIT_CARD")).toHaveLength(1);
    expect(messages("COMMIT_CARD")).toHaveLength(0);
    await update(structuredClone(view));
    expect(messages("COMMIT_CARD")).toHaveLength(0);
    view.teams.RED.heroes[0].current_turn_card = null;
    await update(structuredClone(view));
    expect(messages("COMMIT_CARD")).toEqual([expect.objectContaining({ card_id: "choice" })]);
    view.teams.BLUE.life_counters -= 1;
    await update(structuredClone(view));
    expect(messages("COMMIT_CARD")).toHaveLength(1);
  });

  it("does not commit a missing swap card or carry a swap into a later planning window", async () => {
    const view = game();
    view.teams.RED.heroes[0].current_turn_card = card("committed");
    await mount(view);
    await act(async () => controller.actions.commitOrSwap("choice"));
    view.teams.RED.heroes[0].current_turn_card = null;
    view.teams.RED.heroes[0].hand = [];
    await update(structuredClone(view));
    expect(messages("COMMIT_CARD")).toHaveLength(0);
    view.phase = "RESOLUTION";
    await update(structuredClone(view));
    view.phase = "PLANNING";
    view.teams.RED.heroes[0].hand = [card("choice")];
    await update(structuredClone(view));
    expect(messages("COMMIT_CARD")).toHaveLength(0);
  });

  it("cancels a rejected take-back and expires the friendly notice without an accidental commit", async () => {
    const view = game();
    view.teams.RED.heroes[0].current_turn_card = card("committed");
    await mount(view);
    await act(async () => controller.actions.commitOrSwap("choice"));
    await act(async () => transport().receive({ type: "ERROR", detail: "All cards locked" }));
    expect(controller.lockedNotice).toBe(true);
    view.teams.RED.heroes[0].current_turn_card = null;
    await update(structuredClone(view));
    expect(messages("COMMIT_CARD")).toHaveLength(0);
    await act(async () => vi.advanceTimersByTime(4000));
    expect(controller.lockedNotice).toBe(false);
  });

  it("passes selections unchanged through the real request-correlation path", async () => {
    await mount();
    const request: InputRequest = {
      type: "SELECT_HEX", player_id: "hero_own", request_id: "old-request", prompt: "Select",
    };
    await update(game(), request);
    const hex = { q: 0, r: 1, s: -1 };
    await act(async () => controller.actions.submitInput(hex));
    expect(messages("SUBMIT_INPUT")[0]).toMatchObject({ selection: hex, request_id: "old-request" });
    await update(game(), { ...request, type: "SELECT_OPTION", request_id: "new-request" });
    await act(async () => controller.actions.submitInput("SKIP"));
    expect(messages("SUBMIT_INPUT")[1]).toMatchObject({ selection: "SKIP", request_id: "new-request" });
    const upgrade = { hero_id: "hero_own", card_id: "upgrade" };
    await act(async () => controller.actions.submitInput(upgrade));
    expect(messages("SUBMIT_INPUT")[2]).toMatchObject({ selection: upgrade, request_id: "new-request" });
  });

  it("retains transport connection errors and player-scoped data without opening a second session", async () => {
    await mount();
    await act(async () => { transport().status(false); transport().terminal(4002); });
    expect(controller.session.connected).toBe(false);
    expect(controller.session.closeCode).toBe(4002);
    expect(controller.model.myHero?.id).toBe("hero_own");
    expect(controller.session.view?.teams.BLUE.heroes[0].deck).toEqual({ count: 5 });
    expect(network.sockets).toHaveLength(1);
  });
});
