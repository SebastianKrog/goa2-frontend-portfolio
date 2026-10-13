# GoA2 Frontend Design

## Overview

A single-page React + TypeScript app that provides a visual hex-grid interface for Guards of Atlantis II. Each player connects via a unique token URL and interacts with the game through WebSocket. The backend remains the single source of truth — the frontend is purely a view + input layer.

## Tech Stack

- **React 18 + TypeScript** — component-based UI
- **Vite** — bundler and dev server
- **React Router** — two routes (`/create`, `/game/:id`)
- **SVG** — hex grid rendering
- **CSS Modules** — scoped styles, no framework
- **No state management library** — hooks (`useState`, `useReducer`) are sufficient

## Routes

### `/create` — Game Creation

Simple form page:
- Dropdowns for red/blue hero selection (fetched from `GET /heroes`)
- Map name field (defaults to `forgotten_island`)
- "Create Game" button → `POST /games`
- On success: displays shareable player URLs (one per hero + spectator link)

### `/game/:gameId?token=xyz` — Game View

Main game interface. Reads `gameId` from path and `token` from query string. Invalid/missing tokens show an error message (based on WS close codes 4001/4003/4004).

No navigation between routes — create page is a standalone tool, players use direct links.

## Page Layout

Three areas on the game page:

### Top Bar (full width)
- Phase indicator with distinct background color per phase
- Round and turn counter
- Life counters for both teams (red left, blue right)
- Current actor name during Resolution

### Center — Hex Grid (SVG)
- The board, taking most of the screen
- Prompt banner overlays the top of the board area when an `input_request` is active (non-blocking — player interacts with the board beneath it)

### Right Panel — Context-Sensitive Sidebar
- **PLANNING phase:** Hero's hand as a card list. Each row: name, color pip, ATK/DEF/MOV/Init stats, action type. Click to select, "Confirm" button to commit. "Pass" button always available.
- **RESOLUTION phase:** Current actor's committed card (if revealed), hero stats/items summary.
- **Always visible at bottom:** Your hero info (name, level, gold, team). Opponent hero summary below.

Spectators see the same layout with no interactive elements.

## Hex Grid Rendering

### Coordinate Conversion

Backend uses cube coordinates (q, r, s). Convert to pixel with flat-top layout:

```
x = size * (3/2 * q)
y = size * (sqrt(3)/2 * q + sqrt(3) * r)
```

### HexTile Component

Each hex is a `<g>` group inside a single `<svg>`:
- `<polygon>` for the hex shape, filled by zone color
- Optional occupant element (colored circle + letter) if tile has a unit
- Highlight overlay when hex is a valid selection target

### Zone Colors

| Zone | Color |
|------|-------|
| RedBase | Dark red |
| RedBeach | Light red |
| Mid | Amber/yellow |
| BlueBeach | Light blue |
| BlueBase | Dark blue |
| RedJungle / BlueJungle | Green |

### Unit Tokens

Colored circles inside the hex with a letter label:
- Heroes: first letter of name, bold
- Minions: `m` (melee), `r` (ranged), `H` (heavy)
- Circle fill = team color (red/blue)

### Interaction States

| State | Visual |
|-------|--------|
| Default | Zone-colored fill |
| Hover | Slight brightness increase |
| Valid selection | Pulsing green/yellow border |
| Selected | Solid bright outline |
| Active actor | Glow effect on hex |

## WebSocket Client

### `useGameSocket` Hook

- Connects on mount with token from URL query params
- Auto-reconnects on disconnect (with exponential backoff)
- Parses incoming messages by `type`: `STATE_UPDATE`, `ACTION_RESULT`, `ERROR`
- Exposes `send()` for outgoing messages: `COMMIT_CARD`, `PASS_TURN`, `SUBMIT_INPUT`, `GET_VIEW`

### `useGameState` Hook

Holds game state in React:
- `view` — full game view from `STATE_UPDATE` (replaced on each update, no diffing)
- `inputRequest` — current pending input request or null
- `lastEvents` — events from last `ACTION_RESULT` (for future animation)
- `error` — last error message (auto-clears)

## Data Flow

### State Updates

`STATE_UPDATE` arrives → entire `view` is replaced in state → React re-renders. No local game logic, no optimistic updates.

### Commit Card (Planning)

1. Player clicks card in side panel → local "selected" highlight
2. Player clicks "Confirm" → sends `{ type: "COMMIT_CARD", card_id: "..." }`
3. Server broadcasts `STATE_UPDATE` → card moves from `hand` to `played_cards`

### Input Request (Resolution)

1. `STATE_UPDATE` arrives with `input_request`
2. If `player_id` matches your hero → board highlights valid options, prompt banner appears
3. Player clicks valid hex/unit → sends `{ type: "SUBMIT_INPUT", selection: ... }`
4. Cycle repeats until no more input requests

## Project Structure

```
goa2-frontend/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── docs/
│   └── plans/
├── src/
│   ├── main.tsx                # Entry point
│   ├── App.tsx                 # Router setup
│   ├── theme.css               # CSS variables (zone colors, team colors, phase colors)
│   ├── api/
│   │   ├── rest.ts             # POST /games, GET /heroes
│   │   └── socket.ts           # WebSocket connection manager
│   ├── hooks/
│   │   ├── useGameSocket.ts    # WS lifecycle + message parsing
│   │   └── useGameState.ts     # Game view state management
│   ├── types/
│   │   └── game.ts             # TS types mirroring backend view shapes
│   ├── utils/
│   │   ├── hex.ts              # Cube-to-pixel math, hex polygon points
│   │   └── colors.ts           # Zone/team/card color maps
│   ├── components/
│   │   ├── board/
│   │   │   ├── HexGrid.tsx     # SVG container, maps tiles to HexTile
│   │   │   ├── HexTile.tsx     # Single hex polygon + occupant
│   │   │   └── UnitToken.tsx   # Circle + letter for hero/minion
│   │   ├── ui/
│   │   │   ├── PhaseBar.tsx    # Top bar: phase, round, lives
│   │   │   ├── CardList.tsx    # Side panel card rows
│   │   │   ├── CardRow.tsx     # Single card display
│   │   │   ├── HeroInfo.tsx    # Hero summary (name, level, gold)
│   │   │   ├── PromptBanner.tsx# Input request prompt overlay
│   │   │   └── ErrorToast.tsx  # Auto-dismissing error display
│   │   └── pages/
│   │       ├── CreateGame.tsx  # Game creation form
│   │       └── GameView.tsx    # Main game page (composes all components)
```

## TypeScript Types

Mirror the backend view shapes directly. Key types:

- `GameView` — top-level view object
- `TeamView`, `HeroView`, `MinionView`
- `CardView` — card with visibility-aware fields
- `BoardView`, `TileView`, `ZoneView`
- `EffectView`, `MarkerView`
- `InputRequest` — discriminated union by `type` field
- `Hex` — `{ q: number, r: number, s: number }`

## Non-Goals for v1

- No animations (events stored for future use)
- No sound
- No hero portraits or card art
- No mobile layout
- No lobby or game listing
- No chat
