export type MessageHandler = (data: unknown) => void;

// The server closes with these when retrying cannot help: 4001 invalid token,
// 4002 superseded by a newer connection for the same token, 4003 token for a
// different game, 4004 game not found.
export const TERMINAL_CLOSE_CODES = new Set([4001, 4002, 4003, 4004]);

const CONNECT_TIMEOUT_MS = 10000;
const INITIAL_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 10000;

export class GameSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private onMessage: MessageHandler;
  private onStatusChange: (connected: boolean) => void;
  private onTerminalClose: (code: number) => void;
  private reconnectTimer: number | null = null;
  private connectTimer: number | null = null;
  private reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
  private shouldReconnect = true;
  private listening = false;

  constructor(
    url: string,
    onMessage: MessageHandler,
    onStatusChange: (connected: boolean) => void,
    onTerminalClose: (code: number) => void = () => {},
  ) {
    this.url = url;
    this.onMessage = onMessage;
    this.onStatusChange = onStatusChange;
    this.onTerminalClose = onTerminalClose;
  }

  connect() {
    this.shouldReconnect = true;
    this.startListening();
    this.clearTimers();
    const ws = new WebSocket(this.url);
    this.ws = ws;

    // A handshake can hang without ever closing (sleep/wake, network
    // switch), and nothing else would retry it.
    this.connectTimer = window.setTimeout(() => {
      this.connectTimer = null;
      if (this.ws !== ws || ws.readyState !== WebSocket.CONNECTING) return;
      this.detach(ws);
      ws.close();
      this.ws = null;
      this.scheduleReconnect();
    }, CONNECT_TIMEOUT_MS);

    ws.onopen = () => {
      this.clearConnectTimer();
      this.reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
      this.onStatusChange(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.onMessage(data);
      } catch {
        // Silently ignore malformed messages
      }
    };

    ws.onclose = (event) => {
      this.clearConnectTimer();
      this.ws = null;
      this.onStatusChange(false);
      if (!this.shouldReconnect) return;
      if (TERMINAL_CLOSE_CODES.has(event.code)) {
        this.onTerminalClose(event.code);
      } else {
        this.scheduleReconnect();
      }
    };

    ws.onerror = () => {
      // onclose will fire after this
    };
  }

  /** Reconnects immediately, including after a terminal close. */
  reconnect() {
    if (this.ws) {
      this.detach(this.ws);
      this.ws.close();
      this.ws = null;
    }
    this.reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
    this.connect();
  }

  send(message: Record<string, unknown>): boolean {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  disconnect() {
    this.shouldReconnect = false;
    this.stopListening();
    this.clearTimers();
    if (this.ws) {
      // Detach handlers first so this (now-stale) socket's onclose can't fire a
      // disconnected status after a fresh socket has already connected — e.g.
      // under StrictMode's mount/cleanup/mount, which otherwise leaves the UI
      // stuck on "Disconnected" while actually connected.
      this.detach(this.ws);
      this.ws.close();
      this.ws = null;
    }
  }

  // Background tabs throttle timers, so a pending backoff can sit for minutes
  // after the player returns; retry as soon as the tab or network is back.
  private handleWake = () => {
    if (document.visibilityState === "hidden") return;
    if (this.reconnectTimer === null) return;
    this.reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
    this.connect();
  };

  private startListening() {
    if (this.listening) return;
    this.listening = true;
    document.addEventListener("visibilitychange", this.handleWake);
    window.addEventListener("online", this.handleWake);
  }

  private stopListening() {
    if (!this.listening) return;
    this.listening = false;
    document.removeEventListener("visibilitychange", this.handleWake);
    window.removeEventListener("online", this.handleWake);
  }

  private detach(ws: WebSocket) {
    ws.onopen = null;
    ws.onmessage = null;
    ws.onclose = null;
    ws.onerror = null;
  }

  private clearConnectTimer() {
    if (this.connectTimer !== null) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
  }

  private clearTimers() {
    this.clearConnectTimer();
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private scheduleReconnect() {
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
      this.connect();
    }, this.reconnectDelay);
  }
}
