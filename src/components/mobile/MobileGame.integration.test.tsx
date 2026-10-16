// @vitest-environment jsdom
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { BrowserRouter, createMemoryRouter, Route, RouterProvider, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CardView, GameView as GameViewData, HeroView } from "../../types/game";
import { GameView } from "../pages/GameView";

const harness = vi.hoisted(() => ({
  sessions: 0,
  view: null as GameViewData | null,
  myHeroId: "hero_test" as string | null,
  commit: vi.fn(),
  action: vi.fn(),
}));

// Only the session transport and asset renderer are substitutes. Navigation,
// GameView composition, the SVG board/camera, and pane content are production code.
vi.mock("../../hooks/useGameSocket", () => ({
  useGameSocket: function useGameSocket() {
    useEffect(() => { harness.sessions += 1; }, []);
    return {
      view: harness.view, myHeroId: harness.myHeroId, inputRequest: null,
      awaitingInput: [], eventLog: [], heroNames: {}, pings: [], pointers: {},
      error: null, connected: true, closeCode: null, winner: null,
      overrideProposal: null, overrideResolution: null, revealedPlayerTokens: {},
      reconnect: harness.action, commitCard: harness.commit,
      changeStartingPosition: harness.action, uncommitCard: harness.action,
      finishPlanning: harness.action, rollback: harness.action, submitInput: harness.action,
      cheatsGold: harness.action, setReady: harness.action, sendPing: harness.action,
      sendPointer: harness.action, sendPointerZone: harness.action, hidePointer: harness.action,
      proposeOverride: harness.action, voteOverride: harness.action,
      cancelOverride: harness.action, requestPlayerLink: harness.action,
    };
  },
}));
vi.mock("../board3d/Board3D", () => ({ Board3D: () => <div data-testid="board3d" /> }));
vi.mock("../board3d/hud/CardCanvas", () => ({ CardCanvas: ({ card }: { card: CardView }) => <span>{card.name}</span> }));
vi.mock("../../audio/audioEngine", () => ({ installAudioUnlock: vi.fn(), armSounds: vi.fn() }));
vi.mock("../../audio/gameSounds", () => ({ turnCue: vi.fn() }));
// Synthetic catalogs are enough for these tests; no assets or network requests.
vi.mock("../../i18n/cardText", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../i18n/cardText")>(),
  ensureCardTextReady: () => Promise.resolve(),
}));

function fixture(): GameViewData {
  const card: CardView = {
    id: "test_card", name: "Test card", color: "RED", tier: "I", primary_action: null,
    primary_action_value: null, secondary_actions: {}, initiative: 5,
    effect_id: null, effect_text: null, state: "HAND", is_facedown: false,
    is_ranged: false, range_value: null, radius_value: null, item: null, is_active: false,
  };
  const hero: HeroView = {
    id: "hero_test", name: "Test hero", title: "", team: "RED", level: 1, gold: 0,
    items: {}, hand: [card], deck: [card], played_cards: [], discard_pile: [],
    current_turn_card: null, extra_turn_card: null, can_commit_second_card: false, ultimate_card: null,
  };
  return {
    phase: "PLANNING", round: 1, turn: 1, current_actor_id: null,
    unresolved_cards: [], unresolved_hero_ids: [], effects: [], markers: {}, tokens: [],
    battle_zones: {}, wave_counters: {}, active_zone_id: null, cheats_enabled: false,
    tie_breaker_team: "RED", clock: null, time_control: null,
    board: { map: "test", tiles: {}, zones: {}, entity_locations: {} },
    teams: {
      RED: { color: "RED", life_counters: 5, heroes: [hero], minions: [] },
      BLUE: { color: "BLUE", life_counters: 5, heroes: [], minions: [] },
    },
  };
}

let host: HTMLDivElement;
let root: Root;
let router: ReturnType<typeof createMemoryRouter>;

async function mount(url = "/game/one?token=seat%2Bsecret&ui=mobile&3d=1&custom=keep#table") {
  router = createMemoryRouter([
    { path: "/", element: <p>Outside game</p> },
    { path: "/game/:gameId", element: <GameView /> },
  ], { initialEntries: ["/", url] });
  await act(async () => root.render(<RouterProvider router={router} />));
}

function button(label: string) {
  const result = [...host.querySelectorAll<HTMLButtonElement>("button")]
    .find((element) => element.textContent?.trim() === label || element.getAttribute("aria-label") === label);
  if (!result) throw new Error(`Button missing: ${label}`);
  return result;
}

async function click(label: string) { await act(async () => button(label).click()); }
async function back() { await act(async () => { await router.navigate(-1); }); }
async function escape() {
  await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
}

function paneTitle() { return host.querySelector("#mobile-pane-heading")?.textContent; }

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  harness.sessions = 0;
  harness.myHeroId = "hero_test";
  harness.view = fixture();
  harness.commit.mockClear();
  harness.action.mockClear();
  localStorage.clear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  router?.dispose();
  host.remove();
});

describe("mobile shell in GameView", () => {
  it("is opt-in, resolves 3d conflicts, and keeps the actual SVG/camera and session across every pane", async () => {
    await mount();
    expect(host.querySelector('[data-testid="board3d"]')).toBeNull();
    const svg = host.querySelector("svg")!;
    const map = svg.parentElement!;
    vi.spyOn(map, "getBoundingClientRect").mockReturnValue({
      x: 0, y: 0, left: 0, top: 0, right: 600, bottom: 400, width: 600, height: 400, toJSON: () => ({}),
    });
    await act(async () => map.dispatchEvent(new WheelEvent("wheel", { deltaY: -300, clientX: 300, clientY: 200, cancelable: true })));
    const zoom = svg.style.transform;
    expect(zoom).toContain("scale(");
    const originalLocation = router.state.location;
    for (const label of ["Heroes", "Hand", "Deck", "Log", "Settings"]) {
      await click(label);
      expect(paneTitle()).toBe(label);
      expect(host.querySelector("svg")).toBe(svg);
      expect(svg.style.transform).toBe(zoom);
      expect(map.closest("[inert]")).not.toBeNull();
      expect(document.activeElement?.getAttribute("aria-labelledby")).toBe("mobile-pane-heading");
      expect(router.state.location.search).toBe(originalLocation.search);
      expect(router.state.location.hash).toBe("#table");
    }
    await click("Settings");
    expect(paneTitle()).toBeUndefined();
    expect(map.closest("[inert]")).toBeNull();
    expect(harness.sessions).toBe(1);
    expect(document.activeElement).toBe(button("Settings"));
    expect(router.state.location.key).toBe(originalLocation.key);
  });

  it("uses a single history entry for pane switches; Back/Escape close without leaving the match", async () => {
    await mount();
    await click("Hand");
    await click("Heroes");
    await back();
    expect(paneTitle()).toBeUndefined();
    expect(router.state.location.pathname).toBe("/game/one");
    await click("Deck");
    await escape();
    expect(paneTitle()).toBeUndefined();
    await click("Log");
    await click("Return to Board");
    expect(paneTitle()).toBeUndefined();
    expect(router.state.location.pathname).toBe("/game/one");
    expect(harness.sessions).toBe(1);
  });

  it("closes a settings dialog before its pane and guards duplicate close actions", async () => {
    await mount();
    await click("Settings");
    await click("Report bug");
    expect(host.querySelector("textarea")).not.toBeNull();
    await escape();
    expect(host.querySelector("textarea")).toBeNull();
    expect(paneTitle()).toBe("Settings");
    await click("Report bug");
    await back();
    expect(host.querySelector("textarea")).toBeNull();
    expect(paneTitle()).toBe("Settings");
    await act(async () => { button("Return to Board").click(); button("Return to Board").click(); });
    expect(paneTitle()).toBeUndefined();
    expect(router.state.location.pathname).toBe("/game/one");
  });

  it("uses the real hero deck shortcut and embedded deck/log content", async () => {
    await mount();
    await click("Heroes");
    const deckButton = [...host.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.includes("View Deck"))!;
    expect(deckButton).toBeDefined();
    await act(async () => deckButton.click());
    expect(paneTitle()).toBe("Deck");
    expect(host.querySelector("#mobile-pane-heading")?.parentElement?.parentElement?.textContent).toContain("Test card");
    await click("Log");
    expect(host.textContent).toContain("No events yet");
  });

  it("retains pane focus/scroll and selected hand state on ordinary game updates", async () => {
    await mount();
    await click("Hand");
    const heading = host.querySelector("#mobile-pane-heading")!;
    const content = heading.parentElement!.nextElementSibling as HTMLElement;
    content.scrollTop = 123;
    const cardName = [...host.querySelectorAll<HTMLElement>("span")].find((item) => item.textContent === "Test card")!;
    await act(async () => cardName.click());
    const commit = button("Commit Enter");
    expect(commit.disabled).toBe(false);
    commit.focus();
    harness.view = { ...harness.view!, round: 2 };
    await act(async () => { await router.navigate(router.state.location, { replace: true, state: router.state.location.state }); });
    expect(paneTitle()).toBe("Hand");
    expect(content.scrollTop).toBe(123);
    expect(button("Commit Enter").disabled).toBe(false);
    expect(document.activeElement).toBe(commit);
    expect(host.textContent).toContain("Round 2");
    expect(harness.sessions).toBe(1);
  });

  it("resets panes/dialogs and card selection when game or credential changes", async () => {
    await mount();
    await click("Hand");
    const row = [...host.querySelectorAll<HTMLElement>("span")].find((item) => item.textContent === "Test card")!;
    await act(async () => row.click());
    expect(button("Commit Enter").disabled).toBe(false);
    const staleState = router.state.location.state;
    await act(async () => { await router.navigate("/game/two?token=other&ui=mobile", { state: staleState }); });
    expect(paneTitle()).toBeUndefined();
    expect(harness.sessions).toBe(2);
    await click("Hand");
    expect(button("Commit Enter").disabled).toBe(true);
    await click("Settings");
    await click("Report bug");
    await act(async () => { await router.navigate("/game/two?token=third&ui=mobile", { state: router.state.location.state }); });
    expect(paneTitle()).toBeUndefined();
    expect(host.querySelector("textarea")).toBeNull();
    expect(harness.sessions).toBe(3);
  });

  it("keeps Tab available and disables game shortcuts while a pane is open", async () => {
    await mount();
    await click("Hand");
    const tab = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    await act(async () => window.dispatchEvent(tab));
    expect(tab.defaultPrevented).toBe(false);
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "1", bubbles: true })));
    expect(button("Commit Enter").disabled).toBe(true);
  });

  it("returns to desktop without reconnecting and preserves unrelated query parameters", async () => {
    await mount();
    await click("Settings");
    const select = host.querySelector("select")!;
    await act(async () => { select.value = "desktop2d"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(host.querySelector('main[aria-label="Mobile game"]')).toBeNull();
    expect(host.textContent).toContain("Mobile UI");
    const query = new URLSearchParams(router.state.location.search);
    expect(query.get("token")).toBe("seat+secret");
    expect(query.get("custom")).toBe("keep");
    expect(query.get("ui")).toBe("desktop");
    expect(query.get("3d")).toBe("0");
    expect(harness.sessions).toBe(1);
    await click("Mobile UI");
    expect(paneTitle()).toBeUndefined();
    expect(harness.sessions).toBe(1);
  });

  it("retains the desktop default and gives spectators working public panes", async () => {
    await mount("/game/one?token=watch");
    expect(host.querySelector('[data-testid="board3d"]')).not.toBeNull();
    expect(host.querySelector('main[aria-label="Mobile game"]')).toBeNull();
    await click("Show table controls");
    await click("Switch to mobile 2D");
    expect(host.querySelector('main[aria-label="Mobile game"]')).not.toBeNull();
    expect(harness.sessions).toBe(1);
    harness.myHeroId = null;
    await act(async () => { await router.navigate("/game/one?token=spectator&ui=mobile"); });
    await click("Hand");
    expect(host.textContent).toContain("Spectators do not have a hand");
    await click("Deck");
    expect(host.textContent).toContain("Your deck is available when you are seated");
    await click("Heroes");
    expect(host.textContent).toContain("Test hero");
    await click("Settings");
    expect(host.textContent).not.toContain("Fix game state");
  });

  it("responds to native Back/Forward and ignores a rapid duplicate close in BrowserRouter", async () => {
    window.history.replaceState(null, "", "/");
    const url = "/game/native?ui=mobile&token=watch&custom=keep#map";
    window.history.pushState(null, "", url);
    await act(async () => root.render(
      <BrowserRouter><Routes>
        <Route path="/" element={<p>Outside game</p>} />
        <Route path="/game/:gameId" element={<GameView />} />
      </Routes></BrowserRouter>,
    ));
    const svg = host.querySelector("svg");
    const nativeHistory = async (action: () => void) => {
      await act(async () => {
        await new Promise<void>((resolve, reject) => {
          const onPop = () => { clearTimeout(timer); resolve(); };
          const timer = setTimeout(() => {
            window.removeEventListener("popstate", onPop);
            reject(new Error("History traversal did not finish"));
          }, 1000);
          window.addEventListener("popstate", onPop, { once: true });
          action();
        });
      });
    };
    await click("Hand");
    await click("Deck");
    await nativeHistory(() => window.history.back());
    expect(paneTitle()).toBeUndefined();
    expect(window.location.pathname + window.location.search + window.location.hash).toBe(url);
    await nativeHistory(() => window.history.forward());
    expect(paneTitle()).toBe("Deck");
    await nativeHistory(() => { button("Return to Board").click(); button("Return to Board").click(); });
    expect(paneTitle()).toBeUndefined();
    expect(window.location.pathname).toBe("/game/native");
    expect(host.querySelector("svg")).toBe(svg);
    expect(harness.sessions).toBe(1);
  });
});
