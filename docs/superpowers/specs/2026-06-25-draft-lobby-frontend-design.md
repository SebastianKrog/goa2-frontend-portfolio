# Draft Lobby Frontend — Design

Date: 2026-06-25

## Goal

Build the frontend for the backend's Character Draft Lobby (documented in
`goa2-backend/docs/CLIENT_INTEGRATION_GUIDE.md`). A host opens a lobby, shares a
link, friends join, pick teams, captains run a ban/pick draft, players claim a
drafted hero, and the backend auto-creates the game. Clients then switch to the
normal `/game/:id?token=` flow.

## Decisions

- **Coexistence:** separate flow with a landing choice. Home (`/`) offers
  "Quick Create" (existing `CreateGame`) and "Draft Lobby".
- **Live updates:** the draft WebSocket, reusing the existing `GameSocket` class
  via a new `useDraftSocket` hook. No polling.
- **Identity:** the player/spectator token lives in the URL `?token=`, same as
  the game flow. Refresh-safe and shareable.
- **Style:** reuse the `CreateGame` aesthetic (hero photos `/hero/{id}.png`,
  dark theme tokens from `theme.css`, CSS modules).

## Routes (App.tsx)

- `/` → `Landing`
- `/create` → existing `CreateGame`
- `/draft/create` → `DraftCreate` (host form)
- `/draft/:draftId` → `DraftLobby`
  - no `?token=` → `JoinScreen` (enter name → POST join → redirect with token)
  - with `?token=` → live draft view (player/host or spectator)

## Files

```
src/types/draft.ts            domain + request/response types
src/api/draft.ts              REST: modes, create, join, get, team,
                              randomize-teams, captain, start, action, claim
src/hooks/useDraftSocket.ts   WS wrapper over GameSocket; exposes view, connected, getView
src/utils/heroDisplay.ts      heroImagePath + formatHeroName helpers
src/components/pages/Landing.tsx (+ .module.css)
src/components/pages/DraftCreate.tsx (+ .module.css)
src/components/pages/DraftLobby.tsx          orchestrator: token, socket, phase switch
src/components/draft/Draft.module.css        shared phase styles
src/components/draft/JoinScreen.tsx
src/components/draft/LobbyPhase.tsx
src/components/draft/DraftingPhase.tsx
src/components/draft/ClaimingPhase.tsx
src/components/draft/HeroPoolCard.tsx         shared hero card (photo + state)
```

## Data flow

- All mutations go through REST (WS is read-only). Every REST response and every
  WS `STATE_UPDATE` carry the same `DraftViewResponse` shape (`draft`, `you`,
  `game_id`, `game_token`).
- `DraftLobby` seeds state with a REST `GET /drafts/:id` on mount (also surfaces
  auth/404 errors), then prefers the live WS view once it arrives. REST mutation
  responses also update local state immediately.
- "Whose turn": `draft.sequence[draft.current_index].team`; that team's captain
  (`is_captain` player on the team) acts. Ban/pick grid is enabled only when
  `you.is_captain` and it is your team's step.
- On `status === "COMPLETE"` with a `game_token`, redirect to
  `/game/:game_id?token=<game_token>`.

## Phases

- **Lobby:** RED/BLUE columns with player chips + captain star; self team-select;
  host-only Randomize teams, Set captain (click a player), Start. Share links
  (bare join URL + spectator URL) with copy buttons.
- **Drafting:** sequence strip with a cursor at `current_index`; per-team
  bans/picks; hero pool grid where the acting captain clicks to ban/pick.
  Unavailable heroes greyed/disabled. Non-actors see read-only status.
- **Claiming:** your team's picked heroes shown as claimable; click to claim.
  Shows who has claimed what; waits for everyone.
- **Complete:** "Game ready" + auto-redirect to the game with your token.

## Errors

- REST errors surfaced inline using the `{detail}` shape.
- WS close codes `4001/4003/4004` already suppress reconnect in `GameSocket`;
  surfaced as an "invalid/expired link" message.

## Verification

No test runner in this repo: verify with `npm run build` (tsc) plus a two-tab
manual smoke (host + joiner).
