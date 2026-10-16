# GoA2 frontend

A browser client for online multiplayer games of *Guards of Atlantis II*, a
hero-based tabletop strategy game. It talks to a separate Python game server
over REST and WebSockets and renders the match as a 3D tabletop or a 2D board.

This is a portfolio copy of a private repository. The licensed game art, hero
models and card text are not included, so the app cannot be built or play a
real game from this repo alone. The test suite runs without them.

## Highlights

- **3D tabletop** built with React Three Fiber: hex maps, painted hero
  models, a card hand and HUD, board-space overlays for targeting, movement
  and direction choices, and sound.
- **2D board** kept as a lighter alternative view with the same game logic.
- **Real-time play** over WebSockets: the server sends JSON patches, the
  client applies them and animates the resulting events.
- **Match flow:** game creation, hero drafting, ready checks, chess-style
  time controls, pings and pointer presence between players.
- **Replays** with step-through controls and shareable links.
- **Moderation tools:** voted state overrides to fix a stuck game, and
  in-game bug reports with a review page.
- **Localization:** card text and hero names in English, Brazilian
  Portuguese and Simplified Chinese, with card faces painted to canvas
  per locale.
- **Asset pipeline:** Node scripts that convert, simplify, inspect and
  checksum hero models, and fetch them as a versioned bundle at build time.

## Stack

- React 19, TypeScript, Vite, React Router
- three.js via `@react-three/fiber` and `@react-three/drei`
- Vitest
- Cloudflare Workers: serves the SPA and proxies `/api/*` to the game
  server, so the app and API share one origin

## Layout

```
src/
  api/          REST + WebSocket clients
  components/
    board/      2D board
    board3d/    3D board, HUD, hero models, maps
    draft/      draft lobby
    mobile/     opt-in mobile 2D shell and navigation
    pages/      routed pages
    ui/         shared panels and overlays
  hooks/        game socket, replay, clocks, reveals
  i18n/         locale loading and card text
  vendor/       card painter and fonts shared with the translations project
worker/         Cloudflare Worker entry
scripts/        model asset and translation tooling
```

## Running the tests

```sh
npm install
npm test
```

## Mobile UI (opt-in)

Add `ui=mobile` to a game URL to use the mobile 2D shell. Desktop 2D also has a
Mobile UI button; desktop 3D offers it inside Help. Use mobile Settings to switch
back. The shell reuses the current game session and keeps the board mounted while
switching between Heroes, Hand, Deck, Log, and Settings.

M1 implements the shell/navigation; richer mobile presentation and full gameplay
acceptance follow in later milestones. See [the milestone plan](MOBILE_UI_TODO.md)
and [integration/validation notes](docs/mobile-ui-integration.md). Asset-dependent
browser/device validation remains pending.
