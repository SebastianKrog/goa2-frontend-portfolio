# GoA2 Frontend Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

> **Resume Point (2026-02-16):** Tasks 1-9 are DONE and committed. Resume at **Task 10** (GameView page). Then Task 11 (CreateGame page), then Task 12 (integration test). After Task 11, update `src/App.tsx` to import the real `CreateGame` and `GameView` components.

**Goal:** Build a React + TypeScript frontend for Guards of Atlantis II with an SVG hex grid, WebSocket-driven state, and separated player views.

**Architecture:** Single-page app with two routes — a game creation form and the main game view. All game state flows through a single WebSocket connection. The SVG hex grid renders ~200 tiles with inline interaction (click valid hexes/units directly). A right sidebar shows cards and hero info.

**Tech Stack:** React 18, TypeScript, Vite, React Router, SVG, CSS Modules

---

## Backend Reference

The backend runs at `http://localhost:8000`. Key endpoints:

- `GET /heroes` — list hero IDs (no auth)
- `POST /games` — create game, returns `{ game_id, player_tokens: [{hero_id, token}], spectator_token }`
- `GET /games/{id}` — get view (Bearer token)
- `ws://host/games/{id}/ws?token=xyz` — WebSocket

WebSocket messages:
- Client sends: `COMMIT_CARD`, `PASS_TURN`, `SUBMIT_INPUT`, `GET_VIEW`
- Server sends: `STATE_UPDATE` (view + input_request), `ACTION_RESULT` (events + input_request), `ERROR`

Full API reference: `goa2-backend/docs/CLIENT_INTEGRATION_GUIDE.md`

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/theme.css`

**Step 1: Initialize the Vite project**

Run from `/Users/pedrooliveira/Documents/goa2/goa2-frontend`:

```bash
npm create vite@latest . -- --template react-ts
npm install
npm install react-router-dom
```

If the directory already has files (like docs/), say yes to overwrite prompts or initialize manually.

**Step 2: Clean up scaffolding**

Remove the default Vite boilerplate: `src/App.css`, `src/assets/`, `src/index.css` (we'll use theme.css instead).

**Step 3: Set up theme.css**

Create `src/theme.css`:

```css
:root {
  /* Zone colors */
  --zone-red-base: #8b1a1a;
  --zone-red-beach: #cd5c5c;
  --zone-mid: #d4a017;
  --zone-blue-beach: #6495ed;
  --zone-blue-base: #1a3a8b;
  --zone-jungle: #2e7d32;

  /* Team colors */
  --team-red: #e53935;
  --team-blue: #1e88e5;

  /* Phase colors */
  --phase-planning: #4caf50;
  --phase-revelation: #ff9800;
  --phase-resolution: #f44336;
  --phase-cleanup: #9e9e9e;
  --phase-level-up: #ab47bc;
  --phase-game-over: #333;

  /* Card colors */
  --card-gold: #ffd700;
  --card-silver: #c0c0c0;
  --card-red: #e53935;
  --card-blue: #1e88e5;
  --card-green: #4caf50;
  --card-purple: #ab47bc;

  /* UI */
  --bg-primary: #1a1a2e;
  --bg-secondary: #16213e;
  --bg-panel: #0f3460;
  --text-primary: #e0e0e0;
  --text-secondary: #aaa;
  --border: #333;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Segoe UI', system-ui, sans-serif;
  background: var(--bg-primary);
  color: var(--text-primary);
  overflow: hidden;
  height: 100vh;
}

#root {
  height: 100vh;
}
```

**Step 4: Set up App.tsx with router**

```tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./theme.css";

function CreateGame() {
  return <div>Create Game (TODO)</div>;
}

function GameView() {
  return <div>Game View (TODO)</div>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/create" element={<CreateGame />} />
        <Route path="/game/:gameId" element={<GameView />} />
        <Route path="/" element={<CreateGame />} />
      </Routes>
    </BrowserRouter>
  );
}
```

**Step 5: Update main.tsx**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

**Step 6: Configure Vite proxy**

Update `vite.config.ts` to proxy API and WebSocket requests to the backend:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      "/games": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/heroes": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
```

Note: WebSocket connections will use the full backend URL directly (not proxied).

**Step 7: Verify it runs**

```bash
npm run dev
```

Open `http://localhost:3000` — should show "Create Game (TODO)".

**Step 8: Commit**

```bash
git init
echo "node_modules\ndist\n.DS_Store" > .gitignore
git add -A
git commit -m "feat: scaffold Vite + React + TypeScript frontend"
```

---

## Task 2: TypeScript Types

**Files:**
- Create: `src/types/game.ts`

**Step 1: Define all game types**

These mirror the backend view shapes from `domain/views.py` and `domain/input.py`. Create `src/types/game.ts`:

```ts
// Hex coordinate (cube system: q + r + s = 0)
export interface Hex {
  q: number;
  r: number;
  s: number;
}

// Board
export interface TileView {
  hex: Hex;
  zone_id: string;
  is_terrain: boolean;
  occupant_id: string | null;
  spawn_point: SpawnPointView | null;
}

export interface SpawnPointView {
  location: Hex;
  team: string;
  type: string;
  minion_type: string | null;
}

export interface ZoneView {
  id: string;
  neighbors: string[];
  spawn_points: SpawnPointView[];
}

export interface BoardView {
  tiles: Record<string, TileView>;
  zones: Record<string, ZoneView>;
  entity_locations: Record<string, Hex>;
}

// Units
export interface HeroView {
  id: string;
  name: string;
  title: string;
  team: string;
  level: number;
  gold: number;
  items: Record<string, unknown>;
  hand: CardView[];
  deck: CardView[] | { count: number };
  played_cards: CardView[];
  current_turn_card: CardView | null;
  discard_pile: CardView[];
  ultimate_card: CardView | null;
}

export interface MinionView {
  id: string;
  type: string; // MELEE, RANGED, HEAVY
  team: string;
  value: number;
  is_heavy: boolean;
}

export interface CardView {
  id: string;
  name: string;
  tier: string;
  color: string | null;
  primary_action: string | null;
  primary_action_value: number | null;
  secondary_actions: Record<string, number>;
  effect_id: string | null;
  effect_text: string | null;
  initiative: number;
  state: string;
  is_facedown: boolean;
  is_ranged: boolean;
  range_value: number | null;
  radius_value: number | null;
  item: string | null;
  is_active: boolean;
}

// Teams
export interface TeamView {
  color: string;
  life_counters: number;
  heroes: HeroView[];
  minions: MinionView[];
}

// Effects & Markers
export interface EffectView {
  id: string;
  type: string;
  source_card_id: string;
  duration: string;
  is_active: boolean;
  scope: {
    shape: string;
    range: number;
    origin: Hex | null;
    affects: string;
  };
  stat_type: string | null;
  stat_value: number | null;
}

export interface MarkerView {
  target_id: string;
  value: number;
  source_id: string;
}

// Top-level game view
export interface GameView {
  phase: string;
  round: number;
  turn: number;
  current_actor_id: string | null;
  unresolved_hero_ids: string[];
  active_zone_id: string | null;
  teams: Record<string, TeamView>;
  board: BoardView;
  effects: EffectView[];
  markers: Record<string, MarkerView>;
}

// Input requests
export interface InputOption {
  id: string;
  text: string;
  [key: string]: unknown;
}

export interface InputRequest {
  type: string;
  player_id: string;
  prompt: string;
  can_skip?: boolean;
  // Type-specific fields
  valid_options?: (string | number | Hex)[];
  valid_hexes?: Hex[];
  options?: (InputOption | string)[];
  player_ids?: string[];
  players?: unknown;
  [key: string]: unknown;
}

// WebSocket messages
export interface StateUpdateMessage {
  type: "STATE_UPDATE";
  view: GameView;
  input_request?: InputRequest;
}

export interface ActionResultMessage {
  type: "ACTION_RESULT";
  result_type: string;
  current_phase: string;
  events: GameEvent[];
  input_request?: InputRequest;
  winner: string | null;
}

export interface ErrorMessage {
  type: "ERROR";
  detail: string;
}

export type ServerMessage =
  | StateUpdateMessage
  | ActionResultMessage
  | ErrorMessage;

export interface GameEvent {
  event_type: string;
  actor_id: string | null;
  target_id: string | null;
  from_hex: Hex | null;
  to_hex: Hex | null;
  metadata: Record<string, unknown>;
}

// REST API
export interface PlayerToken {
  hero_id: string;
  token: string;
}

export interface CreateGameResponse {
  game_id: string;
  player_tokens: PlayerToken[];
  spectator_token: string;
}
```

**Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/types/game.ts
git commit -m "feat: add TypeScript types mirroring backend view shapes"
```

---

## Task 3: Hex Utilities

**Files:**
- Create: `src/utils/hex.ts`, `src/utils/colors.ts`

**Step 1: Create hex math utilities**

Create `src/utils/hex.ts`:

```ts
import type { Hex } from "../types/game";

// Flat-top hex layout constants
const HEX_SIZE = 28; // pixels — radius of hex

export function hexToPixel(hex: Hex): { x: number; y: number } {
  const x = HEX_SIZE * (3 / 2) * hex.q;
  const y = HEX_SIZE * (Math.sqrt(3) / 2 * hex.q + Math.sqrt(3) * hex.r);
  return { x, y };
}

export function hexCorners(cx: number, cy: number, size: number = HEX_SIZE): string {
  const points: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i);
    const px = cx + size * Math.cos(angle);
    const py = cy + size * Math.sin(angle);
    points.push(`${px},${py}`);
  }
  return points.join(" ");
}

export function hexKey(hex: Hex): string {
  return `${hex.q}_${hex.r}_${hex.s}`;
}

export function hexEqual(a: Hex, b: Hex): boolean {
  return a.q === b.q && a.r === b.r && a.s === b.s;
}

export function hexInList(hex: Hex, list: Hex[]): boolean {
  return list.some((h) => hexEqual(h, hex));
}

export { HEX_SIZE };
```

**Step 2: Create color utilities**

Create `src/utils/colors.ts`:

```ts
export const ZONE_COLORS: Record<string, string> = {
  RedBase: "var(--zone-red-base)",
  RedBeach: "var(--zone-red-beach)",
  Mid: "var(--zone-mid)",
  BlueBeach: "var(--zone-blue-beach)",
  BlueBase: "var(--zone-blue-base)",
  RedJungle: "var(--zone-jungle)",
  BlueJungle: "var(--zone-jungle)",
};

export const TEAM_COLORS: Record<string, string> = {
  RED: "var(--team-red)",
  BLUE: "var(--team-blue)",
};

export const PHASE_COLORS: Record<string, string> = {
  PLANNING: "var(--phase-planning)",
  REVELATION: "var(--phase-revelation)",
  RESOLUTION: "var(--phase-resolution)",
  CLEANUP: "var(--phase-cleanup)",
  LEVEL_UP: "var(--phase-level-up)",
  GAME_OVER: "var(--phase-game-over)",
};

export const CARD_COLORS: Record<string, string> = {
  GOLD: "var(--card-gold)",
  SILVER: "var(--card-silver)",
  RED: "var(--card-red)",
  BLUE: "var(--card-blue)",
  GREEN: "var(--card-green)",
  PURPLE: "var(--card-purple)",
};

export function getUnitLabel(entityId: string, name?: string): string {
  if (entityId.startsWith("hero_") && name) {
    return name[0].toUpperCase();
  }
  if (entityId.startsWith("minion_")) {
    // Minion type is in the view data, fallback to "m"
    return "m";
  }
  return "?";
}
```

**Step 3: Verify it compiles**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/utils/
git commit -m "feat: add hex math and color utilities"
```

---

## Task 4: REST API Client

**Files:**
- Create: `src/api/rest.ts`

**Step 1: Create REST client**

Create `src/api/rest.ts`:

```ts
import type { CreateGameResponse } from "../types/game";

const API_BASE = "";  // Uses Vite proxy

export async function fetchHeroes(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/heroes`);
  if (!res.ok) throw new Error(`Failed to fetch heroes: ${res.status}`);
  return res.json();
}

export async function createGame(
  redHeroes: string[],
  blueHeroes: string[],
  mapName: string = "forgotten_island"
): Promise<CreateGameResponse> {
  const res = await fetch(`${API_BASE}/games`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      map_name: mapName,
      red_heroes: redHeroes,
      blue_heroes: blueHeroes,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail || `Failed to create game: ${res.status}`);
  }
  return res.json();
}
```

**Step 2: Commit**

```bash
git add src/api/rest.ts
git commit -m "feat: add REST API client for game creation and hero listing"
```

---

## Task 5: WebSocket Hook

**Files:**
- Create: `src/api/socket.ts`, `src/hooks/useGameSocket.ts`

**Step 1: Create WebSocket connection manager**

Create `src/api/socket.ts`:

```ts
export type MessageHandler = (data: unknown) => void;

export class GameSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private onMessage: MessageHandler;
  private onStatusChange: (connected: boolean) => void;
  private reconnectTimer: number | null = null;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private shouldReconnect = true;

  constructor(
    url: string,
    onMessage: MessageHandler,
    onStatusChange: (connected: boolean) => void
  ) {
    this.url = url;
    this.onMessage = onMessage;
    this.onStatusChange = onStatusChange;
  }

  connect() {
    this.shouldReconnect = true;
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.reconnectDelay = 1000;
      this.onStatusChange(true);
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.onMessage(data);
      } catch {
        console.error("Failed to parse WS message:", event.data);
      }
    };

    this.ws.onclose = (event) => {
      this.onStatusChange(false);
      if (this.shouldReconnect && event.code !== 4001 && event.code !== 4003 && event.code !== 4004) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      // onclose will fire after this
    };
  }

  send(message: Record<string, unknown>) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    this.ws?.close();
  }

  private scheduleReconnect() {
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
      this.connect();
    }, this.reconnectDelay);
  }
}
```

**Step 2: Create useGameSocket hook**

Create `src/hooks/useGameSocket.ts`:

```ts
import { useEffect, useRef, useCallback, useState } from "react";
import { GameSocket } from "../api/socket";
import type {
  ServerMessage,
  GameView,
  InputRequest,
  GameEvent,
  Hex,
} from "../types/game";

interface GameState {
  view: GameView | null;
  inputRequest: InputRequest | null;
  lastEvents: GameEvent[];
  error: string | null;
  connected: boolean;
  myHeroId: string | null;
}

export function useGameSocket(gameId: string, token: string) {
  const [state, setState] = useState<GameState>({
    view: null,
    inputRequest: null,
    lastEvents: [],
    error: null,
    connected: false,
    myHeroId: null,
  });

  const socketRef = useRef<GameSocket | null>(null);
  const errorTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!gameId || !token) return;

    const wsUrl = `ws://localhost:8000/games/${gameId}/ws?token=${token}`;

    const handleMessage = (data: unknown) => {
      const msg = data as ServerMessage;

      switch (msg.type) {
        case "STATE_UPDATE":
          setState((prev) => ({
            ...prev,
            view: msg.view,
            inputRequest: msg.input_request ?? null,
            myHeroId: prev.myHeroId ?? detectHeroId(msg.view, token),
          }));
          break;

        case "ACTION_RESULT":
          setState((prev) => ({
            ...prev,
            lastEvents: msg.events,
            inputRequest: msg.input_request ?? null,
          }));
          break;

        case "ERROR":
          setState((prev) => ({ ...prev, error: msg.detail }));
          // Auto-clear error after 5 seconds
          if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
          errorTimerRef.current = window.setTimeout(() => {
            setState((prev) => ({ ...prev, error: null }));
          }, 5000);
          break;
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
  }, [gameId, token]);

  const send = useCallback((message: Record<string, unknown>) => {
    socketRef.current?.send(message);
  }, []);

  const commitCard = useCallback(
    (cardId: string) => send({ type: "COMMIT_CARD", card_id: cardId }),
    [send]
  );

  const passTurn = useCallback(
    () => send({ type: "PASS_TURN" }),
    [send]
  );

  const submitInput = useCallback(
    (selection: string | Hex | number | null) =>
      send({ type: "SUBMIT_INPUT", selection }),
    [send]
  );

  const requestView = useCallback(
    () => send({ type: "GET_VIEW" }),
    [send]
  );

  return {
    ...state,
    commitCard,
    passTurn,
    submitInput,
    requestView,
  };
}

/**
 * Detect which hero belongs to this token by checking which hero's
 * hand has full card details (show_facedown=true gives effect_text etc.).
 * On first STATE_UPDATE, own hero's hand cards have non-null effect_text.
 */
function detectHeroId(view: GameView, _token: string): string | null {
  for (const team of Object.values(view.teams)) {
    for (const hero of team.heroes) {
      if (
        Array.isArray(hero.hand) &&
        hero.hand.length > 0 &&
        hero.hand[0].effect_text !== null
      ) {
        return hero.id;
      }
      // Also check deck — own hero sees full deck, others see {count}
      if (Array.isArray(hero.deck)) {
        return hero.id;
      }
    }
  }
  return null;
}
```

**Step 3: Verify it compiles**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/api/socket.ts src/hooks/useGameSocket.ts
git commit -m "feat: add WebSocket connection manager and useGameSocket hook"
```

---

## Task 6: HexGrid + HexTile + UnitToken Components

**Files:**
- Create: `src/components/board/HexGrid.tsx`, `src/components/board/HexTile.tsx`, `src/components/board/UnitToken.tsx`, `src/components/board/HexGrid.module.css`

**Step 1: Create UnitToken component**

Create `src/components/board/UnitToken.tsx`:

```tsx
import { TEAM_COLORS } from "../../utils/colors";
import type { HeroView, MinionView } from "../../types/game";

interface Props {
  entityId: string;
  team: string;
  hero?: HeroView;
  minion?: MinionView;
  isCurrentActor?: boolean;
}

export function UnitToken({ entityId, team, hero, minion, isCurrentActor }: Props) {
  const color = TEAM_COLORS[team] || "#888";
  let label = "?";

  if (hero) {
    label = hero.name[0].toUpperCase();
  } else if (minion) {
    switch (minion.type) {
      case "HEAVY": label = "H"; break;
      case "RANGED": label = "r"; break;
      default: label = "m"; break;
    }
  }

  return (
    <g>
      <circle
        r={14}
        fill={color}
        stroke={isCurrentActor ? "#ffd700" : "#000"}
        strokeWidth={isCurrentActor ? 3 : 1.5}
        opacity={0.9}
      />
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fill="#fff"
        fontSize={hero ? 14 : 11}
        fontWeight={hero ? "bold" : "normal"}
      >
        {label}
      </text>
    </g>
  );
}
```

**Step 2: Create HexTile component**

Create `src/components/board/HexTile.tsx`:

```tsx
import { hexCorners } from "../../utils/hex";
import { ZONE_COLORS } from "../../utils/colors";
import { UnitToken } from "./UnitToken";
import type { Hex, HeroView, MinionView } from "../../types/game";

interface Props {
  hex: Hex;
  cx: number;
  cy: number;
  zoneId: string;
  occupantId: string | null;
  hero?: HeroView;
  minion?: MinionView;
  isValidTarget: boolean;
  isCurrentActor: boolean;
  onClick?: () => void;
}

export function HexTile({
  hex,
  cx,
  cy,
  zoneId,
  occupantId,
  hero,
  minion,
  isValidTarget,
  isCurrentActor,
  onClick,
}: Props) {
  const points = hexCorners(0, 0);
  const fillColor = ZONE_COLORS[zoneId] || "#444";
  const team = hero?.team || minion?.team || "";

  return (
    <g
      transform={`translate(${cx}, ${cy})`}
      onClick={isValidTarget ? onClick : undefined}
      style={{ cursor: isValidTarget ? "pointer" : "default" }}
    >
      {/* Hex shape */}
      <polygon
        points={points}
        fill={fillColor}
        stroke={isValidTarget ? "#4caf50" : "#222"}
        strokeWidth={isValidTarget ? 2.5 : 1}
        opacity={0.85}
      />

      {/* Valid target highlight */}
      {isValidTarget && (
        <polygon
          points={points}
          fill="rgba(76, 175, 80, 0.25)"
          stroke="none"
        />
      )}

      {/* Occupant */}
      {occupantId && (
        <UnitToken
          entityId={occupantId}
          team={team}
          hero={hero}
          minion={minion}
          isCurrentActor={isCurrentActor}
        />
      )}
    </g>
  );
}
```

**Step 3: Create HexGrid component**

Create `src/components/board/HexGrid.module.css`:

```css
.container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
}

.svg {
  width: 100%;
  height: 100%;
}
```

Create `src/components/board/HexGrid.tsx`:

```tsx
import { useMemo } from "react";
import { hexToPixel, hexKey } from "../../utils/hex";
import { HexTile } from "./HexTile";
import type { GameView, InputRequest, Hex, HeroView, MinionView } from "../../types/game";
import styles from "./HexGrid.module.css";

interface Props {
  view: GameView;
  inputRequest: InputRequest | null;
  myHeroId: string | null;
  onHexClick: (hex: Hex) => void;
  onUnitClick: (unitId: string) => void;
}

export function HexGrid({ view, inputRequest, myHeroId, onHexClick, onUnitClick }: Props) {
  // Build lookup maps for heroes and minions
  const unitLookup = useMemo(() => {
    const heroes = new Map<string, HeroView>();
    const minions = new Map<string, MinionView>();
    for (const team of Object.values(view.teams)) {
      for (const hero of team.heroes) heroes.set(hero.id, hero);
      for (const minion of team.minions) minions.set(minion.id, minion);
    }
    return { heroes, minions };
  }, [view.teams]);

  // Determine valid targets from input request
  const validHexes = useMemo((): Hex[] => {
    if (!inputRequest || inputRequest.player_id !== myHeroId) return [];
    return inputRequest.valid_hexes ?? inputRequest.valid_options?.filter(isHex) as Hex[] ?? [];
  }, [inputRequest, myHeroId]);

  const validUnitIds = useMemo((): string[] => {
    if (!inputRequest || inputRequest.player_id !== myHeroId) return [];
    if (inputRequest.type === "SELECT_UNIT" || inputRequest.type === "SELECT_UNIT_OR_TOKEN") {
      return (inputRequest.valid_options as string[]) ?? [];
    }
    return [];
  }, [inputRequest, myHeroId]);

  // Calculate SVG viewBox from tile positions
  const { tiles, viewBox } = useMemo(() => {
    const tileEntries = Object.values(view.board.tiles).filter((t) => !t.is_terrain);
    const positions = tileEntries.map((t) => ({
      tile: t,
      ...hexToPixel(t.hex),
    }));

    if (positions.length === 0) return { tiles: [], viewBox: "0 0 100 100" };

    const xs = positions.map((p) => p.x);
    const ys = positions.map((p) => p.y);
    const pad = 40;
    const minX = Math.min(...xs) - pad;
    const minY = Math.min(...ys) - pad;
    const maxX = Math.max(...xs) + pad;
    const maxY = Math.max(...ys) + pad;

    return {
      tiles: positions,
      viewBox: `${minX} ${minY} ${maxX - minX} ${maxY - minY}`,
    };
  }, [view.board.tiles]);

  return (
    <div className={styles.container}>
      <svg className={styles.svg} viewBox={viewBox}>
        {tiles.map(({ tile, x, y }) => {
          const occupantId = tile.occupant_id;
          const hero = occupantId ? unitLookup.heroes.get(occupantId) : undefined;
          const minion = occupantId ? unitLookup.minions.get(occupantId) : undefined;

          const isValidHex = validHexes.some(
            (h) => h.q === tile.hex.q && h.r === tile.hex.r && h.s === tile.hex.s
          );
          const isValidUnit = occupantId ? validUnitIds.includes(occupantId) : false;
          const isValid = isValidHex || isValidUnit;

          return (
            <HexTile
              key={hexKey(tile.hex)}
              hex={tile.hex}
              cx={x}
              cy={y}
              zoneId={tile.zone_id}
              occupantId={occupantId}
              hero={hero}
              minion={minion}
              isValidTarget={isValid}
              isCurrentActor={occupantId === view.current_actor_id}
              onClick={() => {
                if (isValidUnit && occupantId) {
                  onUnitClick(occupantId);
                } else if (isValidHex) {
                  onHexClick(tile.hex);
                }
              }}
            />
          );
        })}
      </svg>
    </div>
  );
}

function isHex(value: unknown): value is Hex {
  return (
    typeof value === "object" &&
    value !== null &&
    "q" in value &&
    "r" in value &&
    "s" in value
  );
}
```

**Step 4: Verify it compiles**

```bash
npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add src/components/board/
git commit -m "feat: add HexGrid, HexTile, and UnitToken SVG components"
```

---

## Task 7: UI Components — PhaseBar, PromptBanner, ErrorToast

**Files:**
- Create: `src/components/ui/PhaseBar.tsx`, `src/components/ui/PhaseBar.module.css`, `src/components/ui/PromptBanner.tsx`, `src/components/ui/PromptBanner.module.css`, `src/components/ui/ErrorToast.tsx`, `src/components/ui/ErrorToast.module.css`

**Step 1: Create PhaseBar**

Create `src/components/ui/PhaseBar.module.css`:

```css
.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  font-size: 14px;
}

.phase {
  padding: 4px 12px;
  border-radius: 4px;
  font-weight: bold;
  color: #fff;
}

.info {
  display: flex;
  gap: 20px;
  align-items: center;
}

.lives {
  font-weight: bold;
}

.red { color: var(--team-red); }
.blue { color: var(--team-blue); }
```

Create `src/components/ui/PhaseBar.tsx`:

```tsx
import { PHASE_COLORS } from "../../utils/colors";
import type { GameView } from "../../types/game";
import styles from "./PhaseBar.module.css";

interface Props {
  view: GameView;
}

export function PhaseBar({ view }: Props) {
  const redTeam = view.teams["RED"];
  const blueTeam = view.teams["BLUE"];

  return (
    <div className={styles.bar}>
      <div className={styles.info}>
        <span className={`${styles.lives} ${styles.red}`}>
          RED: {redTeam?.life_counters ?? 0}
        </span>
      </div>

      <div className={styles.info}>
        <span>Round {view.round}</span>
        <span
          className={styles.phase}
          style={{ background: PHASE_COLORS[view.phase] || "#333" }}
        >
          {view.phase}
        </span>
        <span>Turn {view.turn}</span>
      </div>

      <div className={styles.info}>
        <span className={`${styles.lives} ${styles.blue}`}>
          BLUE: {blueTeam?.life_counters ?? 0}
        </span>
      </div>
    </div>
  );
}
```

**Step 2: Create PromptBanner**

Create `src/components/ui/PromptBanner.module.css`:

```css
.banner {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.85);
  color: #fff;
  padding: 8px 24px;
  border-radius: 8px;
  font-size: 14px;
  z-index: 10;
  border: 1px solid var(--phase-resolution);
  max-width: 500px;
  text-align: center;
}

.skipBtn {
  margin-left: 12px;
  padding: 4px 12px;
  background: var(--bg-panel);
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.skipBtn:hover {
  background: #555;
}
```

Create `src/components/ui/PromptBanner.tsx`:

```tsx
import type { InputRequest } from "../../types/game";
import styles from "./PromptBanner.module.css";

interface Props {
  inputRequest: InputRequest;
  onSkip?: () => void;
}

export function PromptBanner({ inputRequest, onSkip }: Props) {
  return (
    <div className={styles.banner}>
      {inputRequest.prompt}
      {inputRequest.can_skip && onSkip && (
        <button className={styles.skipBtn} onClick={onSkip}>
          Skip
        </button>
      )}
    </div>
  );
}
```

**Step 3: Create ErrorToast**

Create `src/components/ui/ErrorToast.module.css`:

```css
.toast {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: #d32f2f;
  color: #fff;
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 14px;
  z-index: 100;
  max-width: 500px;
}
```

Create `src/components/ui/ErrorToast.tsx`:

```tsx
import styles from "./ErrorToast.module.css";

interface Props {
  message: string;
}

export function ErrorToast({ message }: Props) {
  return <div className={styles.toast}>{message}</div>;
}
```

**Step 4: Verify it compiles**

```bash
npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add src/components/ui/
git commit -m "feat: add PhaseBar, PromptBanner, and ErrorToast UI components"
```

---

## Task 8: CardList + HeroInfo Sidebar Components

**Files:**
- Create: `src/components/ui/CardList.tsx`, `src/components/ui/CardList.module.css`, `src/components/ui/CardRow.tsx`, `src/components/ui/HeroInfo.tsx`, `src/components/ui/HeroInfo.module.css`, `src/components/ui/Sidebar.tsx`, `src/components/ui/Sidebar.module.css`

**Step 1: Create CardRow component**

Create `src/components/ui/CardRow.tsx`:

```tsx
import { CARD_COLORS } from "../../utils/colors";
import type { CardView } from "../../types/game";

interface Props {
  card: CardView;
  isSelected?: boolean;
  onClick?: () => void;
}

export function CardRow({ card, isSelected, onClick }: Props) {
  const colorPip = CARD_COLORS[card.color ?? ""] || "#888";

  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        background: isSelected ? "rgba(76, 175, 80, 0.3)" : "transparent",
        border: isSelected ? "1px solid #4caf50" : "1px solid transparent",
        borderRadius: 4,
        cursor: onClick ? "pointer" : "default",
        fontSize: 13,
      }}
    >
      {/* Color pip */}
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: colorPip,
          flexShrink: 0,
        }}
      />

      {/* Name */}
      <span style={{ flex: 1, fontWeight: 500 }}>{card.name}</span>

      {/* Stats */}
      {card.primary_action && (
        <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>
          {card.primary_action[0]}
          {card.primary_action_value ? `:${card.primary_action_value}` : ""}
        </span>
      )}
      <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>
        I:{card.initiative}
      </span>
    </div>
  );
}
```

**Step 2: Create CardList component**

Create `src/components/ui/CardList.module.css`:

```css
.container {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.btn {
  flex: 1;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  font-weight: bold;
}

.confirm {
  background: #4caf50;
  color: #fff;
}

.confirm:hover { background: #388e3c; }

.pass {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.pass:hover { background: #333; }

.label {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 1px;
}
```

Create `src/components/ui/CardList.tsx`:

```tsx
import { useState } from "react";
import { CardRow } from "./CardRow";
import type { CardView } from "../../types/game";
import styles from "./CardList.module.css";

interface Props {
  cards: CardView[];
  phase: string;
  onCommit: (cardId: string) => void;
  onPass: () => void;
}

export function CardList({ cards, phase, onCommit, onPass }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const isPlanning = phase === "PLANNING";

  return (
    <div>
      <div className={styles.label}>Hand</div>
      <div className={styles.container}>
        {cards.map((card) => (
          <CardRow
            key={card.id}
            card={card}
            isSelected={selectedId === card.id}
            onClick={isPlanning ? () => setSelectedId(card.id) : undefined}
          />
        ))}
        {cards.length === 0 && (
          <div style={{ color: "var(--text-secondary)", fontSize: 13, padding: 8 }}>
            No cards in hand
          </div>
        )}
      </div>

      {isPlanning && (
        <div className={styles.actions}>
          <button
            className={`${styles.btn} ${styles.confirm}`}
            disabled={!selectedId}
            onClick={() => selectedId && onCommit(selectedId)}
          >
            Commit
          </button>
          <button className={`${styles.btn} ${styles.pass}`} onClick={onPass}>
            Pass
          </button>
        </div>
      )}
    </div>
  );
}
```

**Step 3: Create HeroInfo component**

Create `src/components/ui/HeroInfo.module.css`:

```css
.container {
  padding: 8px 0;
  border-top: 1px solid var(--border);
}

.name {
  font-weight: bold;
  font-size: 14px;
}

.details {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 2px;
}
```

Create `src/components/ui/HeroInfo.tsx`:

```tsx
import { TEAM_COLORS } from "../../utils/colors";
import type { HeroView } from "../../types/game";
import styles from "./HeroInfo.module.css";

interface Props {
  hero: HeroView;
  isYou?: boolean;
}

export function HeroInfo({ hero, isYou }: Props) {
  const teamColor = TEAM_COLORS[hero.team] || "#888";

  return (
    <div className={styles.container}>
      <div className={styles.name} style={{ color: teamColor }}>
        {hero.name} {isYou && "(You)"}
      </div>
      <div className={styles.details}>
        {hero.title} &middot; Lv {hero.level} &middot; {hero.gold} Gold
      </div>
    </div>
  );
}
```

**Step 4: Create Sidebar container**

Create `src/components/ui/Sidebar.module.css`:

```css
.sidebar {
  width: 280px;
  background: var(--bg-secondary);
  border-left: 1px solid var(--border);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
}
```

Create `src/components/ui/Sidebar.tsx`:

```tsx
import { CardList } from "./CardList";
import { HeroInfo } from "./HeroInfo";
import type { GameView, HeroView } from "../../types/game";
import styles from "./Sidebar.module.css";

interface Props {
  view: GameView;
  myHeroId: string | null;
  onCommit: (cardId: string) => void;
  onPass: () => void;
}

export function Sidebar({ view, myHeroId, onCommit, onPass }: Props) {
  // Find my hero and opponent heroes
  let myHero: HeroView | null = null;
  const otherHeroes: HeroView[] = [];

  for (const team of Object.values(view.teams)) {
    for (const hero of team.heroes) {
      if (hero.id === myHeroId) {
        myHero = hero;
      } else {
        otherHeroes.push(hero);
      }
    }
  }

  return (
    <div className={styles.sidebar}>
      {myHero && (
        <>
          <HeroInfo hero={myHero} isYou />
          <CardList
            cards={myHero.hand}
            phase={view.phase}
            onCommit={onCommit}
            onPass={onPass}
          />

          {myHero.current_turn_card && (
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              Current card: {myHero.current_turn_card.name}
            </div>
          )}
        </>
      )}

      {otherHeroes.map((hero) => (
        <HeroInfo key={hero.id} hero={hero} />
      ))}
    </div>
  );
}
```

**Step 5: Verify it compiles**

```bash
npx tsc --noEmit
```

**Step 6: Commit**

```bash
git add src/components/ui/CardList.tsx src/components/ui/CardList.module.css src/components/ui/CardRow.tsx src/components/ui/HeroInfo.tsx src/components/ui/HeroInfo.module.css src/components/ui/Sidebar.tsx src/components/ui/Sidebar.module.css
git commit -m "feat: add CardList, HeroInfo, and Sidebar components"
```

---

## Task 9: Input Request Handling for Non-Board Inputs

**Files:**
- Create: `src/components/ui/OptionPicker.tsx`, `src/components/ui/OptionPicker.module.css`

Some input requests can't be handled by clicking the board (CHOOSE_ACTION, SELECT_OPTION, CONFIRM_PASSIVE, SELECT_CARD_OR_PASS, CHOOSE_ACTOR). These need a modal-like picker displayed over the board.

**Step 1: Create OptionPicker**

Create `src/components/ui/OptionPicker.module.css`:

```css
.overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  z-index: 20;
}

.picker {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 20px;
  min-width: 300px;
  max-width: 450px;
}

.title {
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 12px;
}

.option {
  display: block;
  width: 100%;
  padding: 10px 16px;
  margin-bottom: 6px;
  background: var(--bg-panel);
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  text-align: left;
}

.option:hover {
  background: #1a5276;
}

.skip {
  margin-top: 8px;
  color: var(--text-secondary);
  background: transparent;
  border-color: var(--text-secondary);
}
```

Create `src/components/ui/OptionPicker.tsx`:

```tsx
import type { InputRequest } from "../../types/game";
import styles from "./OptionPicker.module.css";

interface Props {
  inputRequest: InputRequest;
  onSelect: (value: string | number | null) => void;
}

/**
 * Renders a picker overlay for non-board input requests:
 * CHOOSE_ACTION, SELECT_OPTION, CONFIRM_PASSIVE, SELECT_CARD_OR_PASS, CHOOSE_ACTOR
 */
export function OptionPicker({ inputRequest, onSelect }: Props) {
  const type = inputRequest.type;

  // Extract options based on input type
  let displayOptions: { id: string; text: string }[] = [];

  if (type === "CHOOSE_ACTION" || type === "SELECT_OPTION") {
    const opts = inputRequest.options ?? [];
    displayOptions = opts.map((opt) =>
      typeof opt === "string"
        ? { id: opt, text: opt }
        : { id: (opt as { id: string }).id, text: (opt as { id: string; text: string }).text }
    );
  } else if (type === "CONFIRM_PASSIVE") {
    const opts = (inputRequest.options as string[]) ?? ["YES", "NO"];
    displayOptions = opts.map((o) => ({ id: o, text: o }));
  } else if (type === "SELECT_CARD_OR_PASS") {
    const opts = (inputRequest.options as string[]) ?? [];
    displayOptions = opts.map((o) => ({ id: o, text: o === "PASS" ? "Pass (no defense)" : o }));
  } else if (type === "CHOOSE_ACTOR") {
    const ids = inputRequest.player_ids ?? [];
    displayOptions = ids.map((id) => ({ id, text: id }));
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.picker}>
        <div className={styles.title}>{inputRequest.prompt}</div>
        {displayOptions.map((opt) => (
          <button
            key={opt.id}
            className={styles.option}
            onClick={() => onSelect(opt.id)}
          >
            {opt.text}
          </button>
        ))}
        {inputRequest.can_skip && (
          <button
            className={`${styles.option} ${styles.skip}`}
            onClick={() => onSelect(null)}
          >
            Skip
          </button>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/components/ui/OptionPicker.tsx src/components/ui/OptionPicker.module.css
git commit -m "feat: add OptionPicker for non-board input requests"
```

---

## Task 10: GameView Page — Compose Everything

**Files:**
- Create: `src/components/pages/GameView.tsx`, `src/components/pages/GameView.module.css`

**Step 1: Create GameView page layout**

Create `src/components/pages/GameView.module.css`:

```css
.layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.main {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.boardArea {
  flex: 1;
  position: relative;
}

.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  font-size: 18px;
  color: var(--text-secondary);
}

.disconnected {
  position: fixed;
  top: 50px;
  left: 50%;
  transform: translateX(-50%);
  background: #d32f2f;
  color: #fff;
  padding: 6px 16px;
  border-radius: 4px;
  font-size: 13px;
  z-index: 50;
}
```

Create `src/components/pages/GameView.tsx`:

```tsx
import { useParams, useSearchParams } from "react-router-dom";
import { useGameSocket } from "../../hooks/useGameSocket";
import { HexGrid } from "../board/HexGrid";
import { PhaseBar } from "../ui/PhaseBar";
import { Sidebar } from "../ui/Sidebar";
import { PromptBanner } from "../ui/PromptBanner";
import { OptionPicker } from "../ui/OptionPicker";
import { ErrorToast } from "../ui/ErrorToast";
import type { Hex } from "../../types/game";
import styles from "./GameView.module.css";

// Input types that are handled by clicking the board
const BOARD_INPUT_TYPES = new Set([
  "SELECT_HEX",
  "SELECT_UNIT",
  "SELECT_UNIT_OR_TOKEN",
]);

export function GameView() {
  const { gameId } = useParams<{ gameId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const {
    view,
    inputRequest,
    error,
    connected,
    myHeroId,
    commitCard,
    passTurn,
    submitInput,
  } = useGameSocket(gameId ?? "", token);

  if (!view) {
    return <div className={styles.loading}>Connecting...</div>;
  }

  // Determine if current input is for us and needs a picker (non-board)
  const isMyInput = inputRequest?.player_id === myHeroId;
  const needsPicker =
    isMyInput && inputRequest && !BOARD_INPUT_TYPES.has(inputRequest.type);
  const needsBanner =
    isMyInput && inputRequest && BOARD_INPUT_TYPES.has(inputRequest.type);

  const handleHexClick = (hex: Hex) => {
    submitInput(hex);
  };

  const handleUnitClick = (unitId: string) => {
    submitInput(unitId);
  };

  const handleOptionSelect = (value: string | number | null) => {
    submitInput(value);
  };

  const handleSkip = () => {
    submitInput(null);
  };

  return (
    <div className={styles.layout}>
      <PhaseBar view={view} />

      <div className={styles.main}>
        <div className={styles.boardArea}>
          <HexGrid
            view={view}
            inputRequest={isMyInput ? inputRequest : null}
            myHeroId={myHeroId}
            onHexClick={handleHexClick}
            onUnitClick={handleUnitClick}
          />

          {needsBanner && inputRequest && (
            <PromptBanner
              inputRequest={inputRequest}
              onSkip={inputRequest.can_skip ? handleSkip : undefined}
            />
          )}

          {needsPicker && inputRequest && (
            <OptionPicker
              inputRequest={inputRequest}
              onSelect={handleOptionSelect}
            />
          )}
        </div>

        <Sidebar
          view={view}
          myHeroId={myHeroId}
          onCommit={commitCard}
          onPass={passTurn}
        />
      </div>

      {!connected && (
        <div className={styles.disconnected}>Disconnected — reconnecting...</div>
      )}

      {error && <ErrorToast message={error} />}
    </div>
  );
}
```

**Step 2: Update App.tsx to use the real components**

Update `src/App.tsx`:

```tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { GameView } from "./components/pages/GameView";
import "./theme.css";

function CreateGame() {
  return <div>Create Game (TODO)</div>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/create" element={<CreateGame />} />
        <Route path="/game/:gameId" element={<GameView />} />
        <Route path="/" element={<CreateGame />} />
      </Routes>
    </BrowserRouter>
  );
}
```

**Step 3: Verify it compiles**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/components/pages/ src/App.tsx
git commit -m "feat: add GameView page composing board, sidebar, and input handling"
```

---

## Task 11: CreateGame Page

**Files:**
- Create: `src/components/pages/CreateGame.tsx`, `src/components/pages/CreateGame.module.css`

**Step 1: Create the game creation form**

Create `src/components/pages/CreateGame.module.css`:

```css
.page {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
}

.form {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 32px;
  width: 400px;
}

.title {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 24px;
  text-align: center;
}

.field {
  margin-bottom: 16px;
}

.label {
  display: block;
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.select, .input {
  width: 100%;
  padding: 8px 12px;
  background: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 14px;
}

.submit {
  width: 100%;
  padding: 12px;
  background: #4caf50;
  color: #fff;
  border: none;
  border-radius: 4px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  margin-top: 8px;
}

.submit:hover { background: #388e3c; }
.submit:disabled { background: #666; cursor: not-allowed; }

.error {
  color: #f44336;
  font-size: 13px;
  margin-top: 8px;
}

.result {
  margin-top: 24px;
}

.resultTitle {
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 12px;
}

.link {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  word-break: break-all;
}

.link a {
  color: #64b5f6;
}

.linkLabel {
  color: var(--text-secondary);
  margin-right: 4px;
}
```

Create `src/components/pages/CreateGame.tsx`:

```tsx
import { useState, useEffect } from "react";
import { fetchHeroes, createGame } from "../../api/rest";
import type { CreateGameResponse } from "../../types/game";
import styles from "./CreateGame.module.css";

export function CreateGame() {
  const [heroes, setHeroes] = useState<string[]>([]);
  const [redHero, setRedHero] = useState("");
  const [blueHero, setBlueHero] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateGameResponse | null>(null);

  useEffect(() => {
    fetchHeroes()
      .then((h) => {
        setHeroes(h);
        if (h.length >= 2) {
          setRedHero(h[0]);
          setBlueHero(h[1]);
        }
      })
      .catch((e) => setError(e.message));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await createGame([redHero], [blueHero]);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create game");
    } finally {
      setLoading(false);
    }
  };

  const baseUrl = window.location.origin;

  return (
    <div className={styles.page}>
      <div className={styles.form}>
        <div className={styles.title}>Guards of Atlantis II</div>

        {!result ? (
          <form onSubmit={handleSubmit}>
            <div className={styles.field}>
              <label className={styles.label}>Red Hero</label>
              <select
                className={styles.select}
                value={redHero}
                onChange={(e) => setRedHero(e.target.value)}
              >
                {heroes.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Blue Hero</label>
              <select
                className={styles.select}
                value={blueHero}
                onChange={(e) => setBlueHero(e.target.value)}
              >
                {heroes.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            <button
              className={styles.submit}
              type="submit"
              disabled={loading || !redHero || !blueHero}
            >
              {loading ? "Creating..." : "Create Game"}
            </button>

            {error && <div className={styles.error}>{error}</div>}
          </form>
        ) : (
          <div className={styles.result}>
            <div className={styles.resultTitle}>Game Created!</div>

            {result.player_tokens.map((pt) => (
              <div key={pt.hero_id} className={styles.link}>
                <span className={styles.linkLabel}>{pt.hero_id}:</span>
                <a
                  href={`${baseUrl}/game/${result.game_id}?token=${pt.token}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {`${baseUrl}/game/${result.game_id}?token=${pt.token}`}
                </a>
              </div>
            ))}

            <div className={styles.link}>
              <span className={styles.linkLabel}>Spectator:</span>
              <a
                href={`${baseUrl}/game/${result.game_id}?token=${result.spectator_token}`}
                target="_blank"
                rel="noreferrer"
              >
                {`${baseUrl}/game/${result.game_id}?token=${result.spectator_token}`}
              </a>
            </div>

            <button
              className={styles.submit}
              onClick={() => setResult(null)}
              style={{ marginTop: 16 }}
            >
              Create Another
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Update App.tsx**

Replace the placeholder `CreateGame` in `src/App.tsx`:

```tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CreateGame } from "./components/pages/CreateGame";
import { GameView } from "./components/pages/GameView";
import "./theme.css";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/create" element={<CreateGame />} />
        <Route path="/game/:gameId" element={<GameView />} />
        <Route path="/" element={<CreateGame />} />
      </Routes>
    </BrowserRouter>
  );
}
```

**Step 3: Verify it compiles**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/components/pages/CreateGame.tsx src/components/pages/CreateGame.module.css src/App.tsx
git commit -m "feat: add CreateGame page with hero selection and shareable links"
```

---

## Task 12: Integration Test — Full Manual Walkthrough

**Step 1: Start the backend**

In a terminal:
```bash
cd /Users/pedrooliveira/Documents/goa2/goa2-backend
PYTHONPATH=src uv run uvicorn goa2.server.app:create_app --factory --reload
```

**Step 2: Start the frontend**

In another terminal:
```bash
cd /Users/pedrooliveira/Documents/goa2/goa2-frontend
npm run dev
```

**Step 3: Manual test checklist**

1. Open `http://localhost:3000` — CreateGame form should render
2. Select heroes, click "Create Game" — should show player links
3. Open a player link in a new tab — hex grid should render with units
4. PhaseBar should show "PLANNING", round 1
5. Card list in sidebar should show your hero's hand
6. Click a card, click "Commit" — card should be committed
7. Open second player link in another browser/tab, commit their card
8. After both commit, phase should transition to REVELATION then RESOLUTION
9. When an input request arrives, valid hexes/units should highlight
10. Click a valid hex/unit — input should be submitted
11. For non-board inputs (CHOOSE_ACTION), the OptionPicker should appear

**Step 4: Fix any issues found during testing**

Address compile errors, rendering bugs, or WebSocket connection problems.

**Step 5: Final commit**

```bash
git add -A
git commit -m "fix: integration fixes from manual testing"
```

---

## Summary

| Task | What | Key Files |
|------|------|-----------|
| 1 | Project scaffolding | package.json, vite.config.ts, App.tsx, theme.css |
| 2 | TypeScript types | types/game.ts |
| 3 | Hex + color utilities | utils/hex.ts, utils/colors.ts |
| 4 | REST API client | api/rest.ts |
| 5 | WebSocket hook | api/socket.ts, hooks/useGameSocket.ts |
| 6 | Hex grid components | board/HexGrid.tsx, HexTile.tsx, UnitToken.tsx |
| 7 | PhaseBar, PromptBanner, ErrorToast | ui/PhaseBar.tsx, PromptBanner.tsx, ErrorToast.tsx |
| 8 | CardList, HeroInfo, Sidebar | ui/CardList.tsx, CardRow.tsx, HeroInfo.tsx, Sidebar.tsx |
| 9 | OptionPicker for non-board inputs | ui/OptionPicker.tsx |
| 10 | GameView page (compose all) | pages/GameView.tsx |
| 11 | CreateGame page | pages/CreateGame.tsx |
| 12 | Integration test | Manual walkthrough |
