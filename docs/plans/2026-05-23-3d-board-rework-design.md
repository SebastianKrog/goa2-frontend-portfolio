# 3D Board Rework — Design

**Date:** 2026-05-23
**Branch:** `3d-board-rework`
**Status:** Design (not yet implemented)

## Motivation

Friends' feedback on the current web version called out two consistent themes:

- **Positive:** automation, click-and-play accessibility, clean UI, no need to count hexes.
- **Negative:** doesn't feel like a tabletop game; cards look like buttons/rows, not cards; missing tactile/visual charm; audio cues for events absent.

The current frontend is architecturally sound (small, modern React + SVG, server-authoritative state via WebSocket), but its **visual primitives** are wrong for a tabletop feel:

- Cards are list rows (`CardRow.tsx`), not card-shaped objects.
- The board is a flat 2D SVG without depth, shadows, or camera control.
- Player-owned state (hand, played cards, mat) is collapsed into a sidebar panel rather than spatially arranged around a table.

This document defines the vision and architecture for a 3D tabletop-style rendering of the existing game, keeping the data layer and server protocol unchanged.

## Vision

Recreate the feel of playing GoA2 on a friend's table:

- A 3D table at the center of the screen, viewable from above by default, freely orbitable.
- The hex map sits flat on the table — using the existing painted map image (`public/map/forgotten_island.png`) as a textured plane.
- Each player has their own area around the table: a themed hero mat plus surrounding board with deck, ultimate, items, status markers.
- Units, tokens, and cards are 3D objects placed on the table.
- The player's hand is shown as a 2D HUD row at the bottom of the screen.
- All input prompts and pickers are non-blocking — the player can always look at, zoom, and orbit the board.

The existing data model (`GameView`, `InputRequest`, `GameEvent`), socket protocol, and React state plumbing are **kept entirely**. Only the rendering layer changes.

## Scene Layout

### Default view

Top-down overhead with a slight tilt (~10–15°). Free orbit / pan / zoom from this starting view. `R` resets to default.

### Spatial arrangement

```
                [TOP HUD: Phase | Round R/T | RED life | BLUE life]

         ┌────────────────────────────────────┐
         │       Blue Player 2's board        │
         │   [mat: 4 slots + discard] [deck]  │
         │   [items] [ultimate] [markers]     │
         └────────────────────────────────────┘
                   ▲ committed card here
   ┌──────┐                                          ┌──────┐
   │ Red  │      ┌─────────────────────────┐         │ Blue │
   │ P3   │ ◀── │  HEX MAP                 │ ───▶    │ P1   │
   │board │      │  (map image + hexes)    │         │board │
   └──────┘      └─────────────────────────┘         └──────┘
                   ▲ committed card here
         ┌────────────────────────────────────┐
         │       Red Player 1's board         │ ← "your seat" default
         └────────────────────────────────────┘

         [BOTTOM HUD: your hand cards as a row]
```

- **Table center:** hex map plane + transparent hex tile overlays for interaction.
- **Player seating:** alternating R/B/R/B around the perimeter. Each board oriented so its art faces outward.
- **Committed-card zone:** the space between each player's mat and the central map. Committed cards float here.
- **HUD overlay:** drawn on top of the 3D canvas in screen space.

### Per-player board

The board area is split into:

1. **The hero mat** — a themed image specific to each hero (loaded from `public/mats/<hero_id>.png` or similar). Holds:
   - 4 played-card slots (turn 1 → slot 0, turn 2 → slot 1, etc. — matches `played_cards` array semantics).
   - 1 discard pile slot.

2. **The board area around the mat** (bare table surface):
   - Deck stack (own deck shows nothing extra; others show count).
   - Ultimate card slot.
   - Items / equipment strip.
   - Status markers (stun, poison, etc.).

Hero identity is communicated through the mat art itself — no separate portrait/name panel needed on the board.

## Card Lifecycle

How each card slot in the `HeroView` data model maps to a physical position:

| Data field | Physical position | Notes |
|---|---|---|
| `hand: CardView[]` | 2D HUD row at bottom of screen (own hero only) | Other heroes' hand is private — not shown |
| `current_turn_card` (PLANNING) | Floating facedown card in the committed-card zone | Appears when player commits |
| `current_turn_card` (after REVELATION) | Same position, flips faceup | Y-axis rotation animation, ~400ms |
| `current_turn_card` (this hero is currently resolving) | Same position, **gold spotlight from above + glow ring** | No re-positioning; just lighting |
| `played_cards[N]` | Slot N on the hero mat | Position fixed by turn index |
| `discard_pile` | Stack in discard slot on mat | Show top card + count |
| `deck` | Facedown stack on the board area | Own deck shows full state; others see count |
| `ultimate_card` | Dedicated slot on board area | Special visual treatment (gold border) |

### Phase transition animations

- **PLANNING → REVELATION:** all committed cards flip simultaneously (slight 50ms stagger per player).
- **RESOLUTION (turn N starts):** active card gains spotlight + golden glow.
- **RESOLUTION (turn N ends):** spotlight fades, card drops into `played_cards[N]` slot on the mat.
- **CLEANUP:** played cards slide from mat slots into the discard pile.
- **Round start:** if deck is empty, discard pile shuffles back into deck (visible animation).

### Turn indication

Minimal — no initiative queue UI. The active hero's committed card has a spotlight + glow; other committed cards remain flat on the table with their printed initiative number readable. Players track the order by reading the cards.

## 2D HUD Layer

The HUD is drawn over the 3D canvas using standard React + CSS modules. The 3D scene is always interactive — the HUD never blocks the center of the screen.

### Top bar (always visible)

- Phase pill (PLANNING / REVELATION / RESOLUTION / CLEANUP / LEVEL_UP / GAME_OVER) with color coding.
- Round + turn counters.
- Both team life counters with team color.
- Settings (camera reset, sound toggle, mute).

### Prompt + picker docks

**Prompt dock (top-left, under phase bar):** compact panel showing the current `InputRequest.prompt` text plus skip/rollback buttons when allowed. Collapsible.

**Picker dock (bottom-right):** vertical list of options for non-spatial inputs, sized to content. Collapsible to a header strip.

| Input type | Treatment |
|---|---|
| `SELECT_HEX` / `SELECT_UNIT` / `SELECT_UNIT_OR_TOKEN` / `CHOOSE_RESPAWN_HEX` | No picker; valid targets glow in 3D, click directly. Prompt dock shows text. |
| `CHOOSE_ACTION` / `SELECT_OPTION` / `CONFIRM_PASSIVE` / `CHOOSE_ACTOR` | Picker dock (bottom-right) with vertical buttons. |
| `SELECT_CARD_OR_PASS` (defense) | Picker dock, slightly wider — shows card name + defense value + base. Attacking unit gets a red ring in 3D. |
| `UPGRADE_PHASE` | Side-docked panel (right edge, ~30% width). Board still visible. |

### Hand (bottom of screen)

Horizontal row of card thumbnails for the player's own hand only. Numeric badges 1–9 for keyboard shortcuts (matches existing pattern). Hover to enlarge; click to select; Enter or click commit button to play.

### Event log (right side, collapsible)

Existing `EventLog.tsx` content, docked as a slide-in drawer. Auto-collapses by default. Toggle with `L`.

### Error toasts

Float top-center, same as existing `ErrorToast.tsx`.

### What goes away

The existing `Sidebar.tsx` (hero info, card list) is removed — its content is now spatially distributed on the 3D player boards, with the hand portion moving to the bottom HUD.

## Interactions

### Camera controls (desktop)

| Input | Action |
|---|---|
| Left-click drag | Pan the table |
| Right-click drag | Orbit around table center |
| Scroll wheel | Zoom in / out |
| `R` | Reset to default overhead view |
| `Space` (hold) | Smooth zoom to "your seat" cinematic angle |

**Limits:** can't go below the table plane; min zoom shows the whole table; max zoom focuses ~3 hexes.

**Mobile readiness (not built now):** input handlers are abstracted so touch gestures can be added later without touching scene code. R3F's controls library supports both modes.

### Click interactions

| Object | Behavior |
|---|---|
| Highlighted hex | Calls `submitInput(hex)` |
| Highlighted unit / token / board entity | Calls `submitInput(id)` |
| Unhighlighted unit / mat / card | Hover tooltip (stats, full card text, markers) |
| Hand card (HUD) | Select; click again or Enter to commit |
| Opponent's mat slot | Click to enlarge the card (read it) |
| Your own committed card | Click to enlarge / re-read |

### Hover feedback (3D)

- Hex tiles: subtle lift + glow on hover; valid-target hexes always carry a colored ring.
- Units: outline + tooltip after 500ms hover.
- Cards on the table: lift slightly + tilt toward camera so they're readable.

### Color language

| Color | Meaning |
|---|---|
| Soft white glow | Hoverable but not currently a valid target |
| Cyan ring / glow | Valid target for your input |
| Gold spotlight | Currently-resolving card / active hero |
| Red ring | Hostile unit relevant to current resolution |
| Green ring | Friendly unit relevant to current resolution |

### Sound cues

Triggered by `GameEvent` types in `ACTION_RESULT.events`:

| Event | Sound |
|---|---|
| Your turn starts (`isMyInput` flips true) | Soft chime + page title flash |
| `COMBAT_RESOLVED` | Sword/shield clash |
| `UNIT_DEFEATED` | Heavy thud |
| `UNIT_MOVED` | Subtle footstep tick |
| Card commit (own) | Card-on-table thunk |
| Card reveal (REVELATION) | Card flip whoosh |
| `LIFE_COUNTER_CHANGED` | Bell ding (own team) / low gong (enemy) |
| `GAME_OVER` | Victory fanfare / loss tone |

Master volume + mute toggle in Settings.

### Keyboard shortcuts

`1`–`9` select hand card • `Enter` commit • `Esc` deselect • `U` rollback • `S` skip • `R` reset camera • `L` toggle event log

## Technical Approach

### Stack additions

- `three` — Three.js core
- `@react-three/fiber` — React renderer for Three.js
- `@react-three/drei` — helpers (OrbitControls, useTexture, Billboard, Stats, etc.)
- `@react-spring/three` (or `framer-motion-3d`) — animations / springs

Existing React 19 + Vite + TS stack remains unchanged.

### File structure

```
src/
  components/
    board3d/                 ← new 3D scene
      Board3D.tsx            ← scene root, lighting, camera rig
      Table.tsx              ← wooden table surface
      MapPlane.tsx           ← map image as textured plane
      HexOverlay.tsx         ← interactive hex tile overlays
      PlayerSeat.tsx         ← per-player area composition
      PlayerMat.tsx          ← hero-themed mat with slots
      CardMesh.tsx           ← 3D card (plane with textures)
      UnitToken.tsx          ← unit billboard sprite
      TokenMesh.tsx          ← token (mines, bombs) mesh
      Spotlight.tsx          ← lighting for active card
      CameraRig.tsx          ← camera + controls
      Sounds.tsx             ← audio manager
      maps/
        forgotten_island.ts  ← per-map config (hex calibration)
    hud/
      TopBar.tsx
      HandRow.tsx
      PromptDock.tsx
      PickerDock.tsx
      EventLogDrawer.tsx
    pages/
      GameView.tsx           ← composes Board3D + HUD
  utils/
    hex3d.ts                 ← hexToWorld() for 3D positioning
```

### Coordinate system

Backend cube coordinates (`q + r + s = 0`) are kept as-is. A new utility `hexToWorld(hex, mapConfig)` converts to 3D world positions on the map plane.

Per-map calibration config:

```ts
interface MapConfig {
  name: string;
  imagePath: string;
  imageSize: number;     // world units the plane spans
  hexSize: number;       // hex radius in world units
  origin: { x: number; z: number };  // where hex (0,0,0) sits
}
```

We tune `hexSize` and `origin` by eye against the painted map image until overlays align. One-time per map. (Map name not yet exposed in `GameView` — fine for now since only `forgotten_island` exists; will need a backend change later when adding maps.)

### Data flow (unchanged)

```
WebSocket → useGameSocket → view/inputRequest/events
                                  ↓
                            GameView.tsx
                              ↓        ↓
                         Board3D     HUD components
                              ↓        ↓
                        click handlers / hand select
                              ↓
                        submitInput() / commitCard()
                              ↓
                            WebSocket
```

All existing hooks (`useGameSocket`, `useKeyboardShortcuts`), API layer (`api/socket.ts`, `api/rest.ts`), and types (`types/game.ts`) are preserved.

### Animation triggers

Most animations are driven by the `events` array in `ACTION_RESULT` messages:

- `UNIT_MOVED` → tween unit position along path
- `UNIT_PUSHED` / `UNITS_SWAPPED` → tween with different easing
- `COMBAT_RESOLVED` → attack animation (lunge + recoil)
- `UNIT_DEFEATED` → fade out + sink
- `EFFECT_CREATED` → spawn area effect mesh
- Token placement / removal → fade in/out
- Phase transitions → coordinated multi-card animations (flip all, slide all)

Events are queued and played in sequence so animations don't overlap incoherently. After the event queue drains, the canonical state from `STATE_UPDATE` is the source of truth.

### Performance

- Card meshes: simple `PlaneGeometry` with material from card image texture.
- Units: billboarded sprites first (planes always facing camera), upgradeable to 3D models later.
- Shadows: single shadow map, soft shadows on cards/units, table receives only.
- Total entity count for any game: ~50–100 (board hexes + units + cards). Trivial for any modern desktop GPU.

### Feature flag during iteration

To avoid breaking the existing experience while iterating, the new 3D view is gated behind a URL flag:

- `/game/:id?token=...` → existing SVG view (current behavior, unchanged)
- `/game/:id?token=...&3d=1` → new `Board3D`

Once stable, the flag flips to default-on and the old `HexGrid.tsx` + `Sidebar.tsx` are removed.

## Implementation Milestones

Each milestone is independently shippable and visible behind the `?3d=1` flag.

### M1 — Scaffold + camera + map plane

- Add R3F dependencies.
- Create `Board3D` with table + map plane + lighting + camera rig.
- Free orbit / pan / zoom with the chosen mouse bindings.
- Render hex overlays from `view.board.tiles` aligned with the map image (calibrate `forgotten_island.ts`).
- Goal: load a game with `?3d=1`, see the map on a wooden table, orbit around it. No units, no cards yet.

### M2 — Units on hexes

- `UnitToken.tsx`: render heroes/minions as billboarded sprites using existing `/hero/*.png`.
- `TokenMesh.tsx`: render tokens (mines, bombs) and `BoardEntity`s (turret).
- Hover tooltips for units (port existing tooltip behavior).
- Click-to-select for `SELECT_UNIT` inputs (cyan ring on valid targets).
- Hex clicking for `SELECT_HEX` inputs.

### M3 — Player boards (mats + slots)

- Place player seats around the table (alternating R/B/R/B).
- `PlayerMat.tsx`: themed mat with 4 played-card slots + discard slot.
- Surrounding board: deck stack, ultimate slot, items strip, status markers.
- No cards rendered into the slots yet — just empty geometry.

### M4 — Cards (hand HUD + 3D cards in slots)

- `HandRow.tsx`: 2D HUD card row at bottom (replaces `Sidebar.tsx` / `CardList.tsx`).
- `CardMesh.tsx`: 3D card with front + back textures.
- Render `played_cards`, `current_turn_card`, `discard_pile`, `ultimate_card` in their 3D positions.
- Card flip animation (PLANNING → REVELATION).
- Click-to-enlarge for any card on the table.

### M5 — Spotlight + resolution feedback

- `Spotlight.tsx`: golden spotlight on the currently-resolving card.
- Red/green/cyan rings on units based on current input state.
- Smooth animations between turns.

### M6 — Event-driven animations

- Event queue manager.
- Unit movement tweens.
- Combat animations.
- Defeat / removal animations.
- Phase transition animations (round end, deck shuffle).

### M7 — Sound

- `Sounds.tsx`: audio manager with master volume.
- Sound cues mapped to events.
- "Your turn" chime + title flash.

### M8 — Polish

- Lighting tuning (warm tone, soft shadows).
- Material polish (table grain, card edge highlight).
- Pickers (`PromptDock`, `PickerDock`) styled to match table aesthetic.
- Camera "your seat" cinematic shot.
- Remove old SVG view; flip `?3d=1` flag to default-on.

## Open Questions / Future Work

- **Map name from server:** when more maps are added, the backend needs to expose `view.map_name`. Out of scope for now (only one map exists).
- **3D unit models:** start with billboard sprites; potentially upgrade to 3D miniatures per hero later.
- **Mobile support:** designed to be addable without scene rewrites, but not built in this rework.
- **Drag-to-commit cards:** could add later as an alternative to click-then-Enter; not required for parity.
- **Themed card backs per hero:** generic card back for now; could be themed once art is available.
- **Spectator perspective:** spectator's default view could be a fixed overhead with auto-rotate; consider in M8 polish.

## Out of Scope

- Changes to the backend protocol or data model.
- New game features or rule changes.
- Replay system.
- Cosmetics / hero unlocks.
- Any 3D modeling work — all visuals use existing 2D assets (map, card images, hero portraits, icons).
