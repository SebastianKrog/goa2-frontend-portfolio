# Replay Viewer — Design

**Date:** 2026-06-20
**Status:** Approved (pending spec review)
**Repos:** `goa2-frontend` (viewer), `goa2-backend` (replay HTTP API + view change)

## Goal

A developer debugging tool to **replay recorded games** in the existing 3D board.
Pick a recorded replay, then step through it action-by-action, jump to a round/turn
or decision index, and watch the board reconstruct at each point — with **all hands
revealed** (omniscient view), since the purpose is bug investigation.

This is a frontend for the replay system already built in
`goa2-backend/src/goa2/server/replay.py` (the `.jsonl` setup-header + ordered
decisions format, reconstructed deterministically from the RNG seed).

### Decisions locked during brainstorming

- **Data source:** recorded `.jsonl` replays only. "Start a match" = open a recorded
  game. (No starting/driving fresh games — out of scope.)
- **Audience:** dev debug tool. Internal, functional over polished; reuse existing
  board renderer.
- **Perspective:** omniscient — reveal every hero's hand and facedown cards.
- **Controls:** step ± decision (with First/Last), jump to round/turn and to a
  decision index, and a clickable decision timeline list.
- **Out of scope (YAGNI):** event-log panel, per-player switchable perspective,
  driving fresh games, autoplay, polished/user-facing UI.

## Architecture overview

```
ReplayList page ──GET /api/replays──────────────► list headers
ReplayViewer page
  ├─ useReplay(gameId)
  │    ├─ GET /api/replays/{id}            (once: setup + decision list)
  │    └─ GET /api/replays/{id}/state?...  (per position change)
  ├─ Board3D            (reused, read-only: inputRequest=null, no-op handlers)
  ├─ ReplayControls     (transport bar)
  ├─ DecisionTimeline   (clickable decision list / scrubber)
  └─ ReplayRosterPanel  (all heroes' revealed hands + committed card)

Backend /state handler
  └─ ReplaySessionCache → reconstruct/advance GameSession → build_view(reveal_all=True)
```

Each position request reduces internally to a **target decision index** (round/turn
jumps are translated to an index via the same `_decision_at_or_after` logic used by
`replay_game`). The client only ever asks for a position; reconstruction is a
server concern.

---

## Backend (goa2-backend)

New `src/goa2/server/routes_replays.py` — read-only endpoints behind the existing
**spectator-token** auth. Plus a contained `build_view` change.

### Endpoints

1. **`GET /api/replays`**
   Lists available replays by reading each `data/replays/*.jsonl` header (first line
   only) and counting decision lines.
   → `[{ game_id, map, red, blue, game_type, created_at, num_decisions, engine }]`

2. **`GET /api/replays/{id}`**
   Setup header + the full ordered decision list. The frontend renders the timeline
   from this **once**; it never re-fetches the list.
   → `{ setup: {...header...}, decisions: [{ index, type, r, t, hero, card? }] }`

3. **`GET /api/replays/{id}/state?decision=N`** _(or `?round=R&turn=T`)_
   Reconstructs (or advances the cached session) to the target index and returns the
   omniscient view + position.
   → `{ view: build_view(state, reveal_all=True), position: { decision_index, round,
     turn, total_decisions }, winner }`

   Query handling: `decision=N` is authoritative; if absent, `round`/`turn` are
   translated to an index. Out-of-range indices are clamped defensively.

### `build_view` change — `reveal_all`

Add a **keyword-only** parameter, default `False`:

```python
def build_view(state, for_hero_id=None, *, reveal_all=False) -> dict[str, Any]: ...
```

When `reveal_all` is true, every hero is treated as "own" — hands are populated and
facedown cards are revealed. Threads through `_build_team_view`, `_build_hero_view`,
`_build_card_view`, `_build_tokens_view`, `_build_unresolved_cards_view` (each gains
the flag; `is_own_hero` becomes `reveal_all or hero.id == for_hero_id`).

#### Security — must not be exploitable in live games

The omniscient view must never leak into live play. Guarantees:

- `reveal_all` is **keyword-only, defaults `False`**. No request field, query param,
  or body value is ever forwarded into it.
- The **only** call site passing `reveal_all=True` is `routes_replays.py`, and it does
  so on a `GameSession` reconstructed from a `.jsonl` file on disk — entirely separate
  from the live games in the registry. The flag is the literal `True`, not derived
  from input.
- Live paths (`routes_games.get_game_view`, `ws.broadcast`) never mention it; they keep
  hiding non-owner hands/facedown cards.
- **Review guard:** the token `reveal_all=` may appear only in `views.py` (definition)
  and `routes_replays.py` (the literal `True`).
- **Test guard:** a test asserts `reveal_all` defaults `False` and that the live view
  paths still hide non-owner hands/facedown cards.

### ReplaySessionCache (incremental stepping)

A small in-process LRU (a handful of games) mapping `game_id → (GameSession, cursor)`,
where `cursor` = number of decisions applied. Serving a target index `N`:

- **`N >= cursor`** (next / forward jump): apply only decisions `[cursor, N)` to the
  cached session. `N → N+1` applies exactly **one** decision — no rebuild.
- **`N < cursor`** (prev / backward jump): rebuild from the seed to `N` (engine is
  forward-only; no cheap un-apply), then cache.

The cache is a pure optimization: identical inputs yield identical views, so the
endpoint stays idempotent from the client's view. Single-user dev tool → no
concurrency hardening. A correctness test asserts the cached path returns the same
view as a cold rebuild at the same index.

### Retention / wiring

No changes to recording, retention, or cleanup. The router is registered in `app.py`
alongside the existing game routes.

---

## Frontend (goa2-frontend)

A read-only viewer that **reuses `Board3D`** unchanged, driven by REST polling instead
of `useGameSocket`. No changes to `useGameSocket` or the live `GameView`.

### Routes (`App.tsx`)

- `/replays` → `ReplayList`
- `/replay/:gameId` → `ReplayViewer`

### `src/api/replay.ts`

- `listReplays(): Promise<ReplaySummary[]>`
- `fetchReplayMeta(gameId): Promise<{ setup, decisions }>`
- `fetchReplayState(gameId, pos: { decision: number } | { round: number; turn?: number })
  : Promise<{ view, position, winner }>`

Uses the same `API_BASE` (`/api`) and spectator-token convention as `rest.ts`.

### `useReplay(gameId)` hook

Replay analog of `useGameSocket`. Owns `position`; fetches meta once and `view` on each
position change. Exposes:

- state: `view`, `decisions`, `position` (`{ decisionIndex, round, turn, total }`),
  `winner`, `loading`, `error`
- actions: `next()`, `prev()`, `first()`, `last()`, `jumpToDecision(n)`,
  `jumpToRoundTurn(r, t?)`

Clamps indices client-side; keeps the last good `view` if a fetch errors.

### Components

- **`ReplayList`** — table of replays (map, red vs blue, type, created, # decisions);
  row click → `/replay/:gameId`.
- **`ReplayViewer`** — same layout shell as `GameView`. Renders `Board3D` with
  `view`, `inputRequest={null}`, no-op `onHexClick`/`onUnitClick`, `myHeroId={null}`
  (read-only; never submits input). Hosts the controls, timeline, and roster panel.
- **`ReplayControls`** — transport bar: ⏮ First / ◀ Prev / Next ▶ / Last ⏭; a
  "decision N / M · round R · turn T" indicator; number inputs to jump to a decision
  index or a round/turn.
- **`DecisionTimeline`** — scrollable decision list (round/turn/hero/type/card), current
  row highlighted, click any row to jump. Doubles as a scrubber.
- **`ReplayRosterPanel`** — every hero grouped by team with their revealed hand and the
  card committed for the current turn (from the `reveal_all` view). This is what
  actually surfaces "see all hands," since `Board3D`'s `HandRow` only renders the
  local player's hand.

### Reuse vs. new

- **Reuse unchanged:** `Board3D` and sub-renderers, `ErrorToast`, layout/styles.
- **New:** `ReplayList`, `ReplayViewer`, `ReplayControls`, `DecisionTimeline`,
  `ReplayRosterPanel`, `useReplay`, `replay.ts`.

---

## Data flow (one position change)

```
user clicks Next ▶
  → useReplay.next(): decisionIndex + 1
  → fetchReplayState(gameId, { decision: N })
  → GET /api/replays/{id}/state?decision=N   (spectator token)
      → ReplaySessionCache: cursor ≤ N ? apply N−cursor decisions : rebuild to N
      → build_view(session.state, reveal_all=True)
      → { view, position, winner }
  → hook sets view → Board3D + ReplayRosterPanel + ReplayControls re-render
```

Meta (`GET /api/replays/{id}`) is fetched once on mount; the timeline never re-fetches.

## Error handling

- **Unknown game_id** → backend `404`; viewer shows an inline "replay not found"
  state (no crash, no infinite "Connecting…").
- **Reconstruction error** (engine/replay drift — `replay_game` raises `ValueError`,
  e.g. a recorded card no longer in hand) → backend `422` with the message; viewer
  shows it in `ErrorToast` and keeps the last good view. This is itself a useful
  signal: compare the header `engine` sha to the current engine.
- **Out-of-range decision index** → clamped client-side and defensively server-side.
- **Missing/invalid spectator token** → `401`; same handling as the live app.

## Testing

- **Backend** (`tests/server/test_replays_api.py`):
  - list returns recorded games; meta returns the full decision list
  - `/state` at decision N; at round/turn
  - `reveal_all` reveals all hands & facedown cards, while default/live paths still
    hide them (the security lock)
  - cached incremental path returns the same view as a cold rebuild at the same index
  - unknown id → 404; corrupt / engine-mismatch replay → 422
- **Frontend:** no automated tests (the repo has no test stack and we keep it that
  way). Behavioral confidence lives in the backend tests above — the frontend is a
  thin REST-driven view whose only branching logic (`useReplay` index math,
  round/turn→query mapping) is exercised end-to-end by the smoke pass. Verify via:
  1. **Typecheck + build:** `npx tsc -b && npx vite build` (catches type/compile errors).
  2. **Manual smoke pass** driving the real app: record a short game, open `/replays`,
     open it, step Next/Prev through several decisions, jump to a round/turn and to a
     decision index, click a timeline row — confirming at each point that the board
     reconstructs, the `ReplayRosterPanel` shows every hero's hand (omniscient
     `reveal_all` actually rendering), and the position indicator matches. This covers
     `Board3D` rendering the reveal_all view, which no unit test would meaningfully assert.

## Build / verify commands

- Backend: `PYTHONPATH=src uv run pytest tests/server/ -q`
- Frontend: `npx tsc -b && npx vite build`
