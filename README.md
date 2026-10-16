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

## Testing against a local backend

The API and socket integration can be tested without the licensed art or models.
Start the backend branch you want to test on `127.0.0.1:8765`:

```powershell
# In the backend checkout, with its Python environment installed
$env:PYTHONPATH = "src"
$env:GOA2_SAVE_DIR = "$env:TEMP/goa2-event-history-smoke/games"
$env:GOA2_LOG_DIR = "$env:TEMP/goa2-event-history-smoke/logs"
$env:GOA2_REPLAY_DIR = "$env:TEMP/goa2-event-history-smoke/replays"
.\.venv\Scripts\python.exe -m uvicorn goa2.server.app:create_app --factory --host 127.0.0.1 --port 8765
```

In this frontend checkout, configure the local Worker proxy and start Vite:

```powershell
Set-Content .dev.vars "BACKEND_ORIGIN=http://127.0.0.1:8765"
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 3000 --strictPort
```

This runs the dev server without the model-preparation hook. Missing art and
models still limit the rendered game; this is an API compatibility setup, not
a complete asset bundle. The frontend is at `http://127.0.0.1:3000`.

In another terminal, run the opt-in live test through the frontend's proxy:

```powershell
$env:GOA2_INTEGRATION_API_URL = "http://127.0.0.1:3000/api"
npm run test:backend
```

The test uses the frontend's real REST client and `GameSocket`, creates a
disposable game, disconnects one player, and checks event-ID and event-time
catch-up, pagination, spectator access, and authentication. It is skipped by
the normal unit suite unless `GOA2_INTEGRATION_API_URL` is set. It can also
target the backend directly at `http://127.0.0.1:8765`.

The game UI currently logs live broadcasts only. Automatic history fetching
and deduplication on reconnect still need to be wired into `useGameSocket`.
