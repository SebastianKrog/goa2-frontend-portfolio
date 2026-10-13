import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameSocket } from "./socket";

class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static instances: FakeWebSocket[] = [];
  readyState = FakeWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;

  url: string;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  serverClose(code: number) {
    this.readyState = 3;
    this.onclose?.({ code });
  }

  close() {
    this.closed = true;
  }
}

let fakeDocument: EventTarget & { visibilityState: string };

function setup() {
  const onStatus = vi.fn();
  const onTerminal = vi.fn();
  const socket = new GameSocket("ws://test", () => {}, onStatus, onTerminal);
  socket.connect();
  return { socket, onStatus, onTerminal };
}

const latest = () => FakeWebSocket.instances[FakeWebSocket.instances.length - 1];

beforeEach(() => {
  vi.useFakeTimers();
  FakeWebSocket.instances = [];
  const fakeWindow = new EventTarget() as EventTarget & Record<string, unknown>;
  fakeWindow.setTimeout = setTimeout;
  fakeDocument = Object.assign(new EventTarget(), { visibilityState: "visible" });
  vi.stubGlobal("window", fakeWindow);
  vi.stubGlobal("document", fakeDocument);
  vi.stubGlobal("WebSocket", FakeWebSocket);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("GameSocket", () => {
  it("abandons a handshake that hangs and tries again", () => {
    setup();
    const hung = latest();
    vi.advanceTimersByTime(10000);
    expect(hung.closed).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(FakeWebSocket.instances).toHaveLength(2);
  });

  it("keeps a socket that opens before the timeout", () => {
    setup();
    latest().open();
    vi.advanceTimersByTime(60000);
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(latest().closed).toBe(false);
  });

  it("caps the backoff at ten seconds", () => {
    setup();
    for (let i = 0; i < 6; i++) {
      latest().serverClose(1006);
      vi.advanceTimersByTime(10000);
    }
    expect(FakeWebSocket.instances).toHaveLength(7);
  });

  it("retries at once when the tab becomes visible during a backoff", () => {
    setup();
    latest().serverClose(1006);
    fakeDocument.dispatchEvent(new Event("visibilitychange"));
    expect(FakeWebSocket.instances).toHaveLength(2);
    vi.advanceTimersByTime(1000);
    expect(FakeWebSocket.instances).toHaveLength(2);
  });

  it("retries at once when the network comes back", () => {
    setup();
    latest().serverClose(1006);
    window.dispatchEvent(new Event("online"));
    expect(FakeWebSocket.instances).toHaveLength(2);
  });

  it("ignores wake events while connected", () => {
    setup();
    latest().open();
    fakeDocument.dispatchEvent(new Event("visibilitychange"));
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it("reports a superseded connection instead of retrying, and reconnects on request", () => {
    const { socket, onTerminal } = setup();
    latest().open();
    latest().serverClose(4002);
    expect(onTerminal).toHaveBeenCalledWith(4002);
    vi.advanceTimersByTime(60000);
    fakeDocument.dispatchEvent(new Event("visibilitychange"));
    expect(FakeWebSocket.instances).toHaveLength(1);

    socket.reconnect();
    expect(FakeWebSocket.instances).toHaveLength(2);
  });

  it("stops everything on disconnect", () => {
    const { socket } = setup();
    latest().serverClose(1006);
    socket.disconnect();
    vi.advanceTimersByTime(60000);
    window.dispatchEvent(new Event("online"));
    expect(FakeWebSocket.instances).toHaveLength(1);
  });
});
