# Consensus Overrides — Frontend Design

**Date:** 2026-08-05
**Status:** Approved
**Backend contract:** goa2-backend `docs/CLIENT_INTEGRATION_GUIDE.md` § Consensus Overrides

## Goal

Surface the backend's consensus-override feature: any player can propose a
patch (fix a wrong value), an unstick (escape wedged control flow), or a
rewind; the table votes; the server applies on majority.

## Scope decisions (locked)

- **Curated + fallback:** polished UI for common ops (board fixes, resource
  values, unstick, rewind); a generic schema-driven form for the rest
  (markers, effects, cards) fed by `GET /overrides/schema`.
- **Vote UX:** non-blocking banner with summary, live tally, countdown to the
  absolute `expires_at`, Approve/Reject (voters), Cancel (proposer).
  Spectators see it read-only.
- **Entity/hex picking:** click the actual board. Implemented by synthesizing
  a local `InputRequest` (`SELECT_UNIT_OR_TOKEN` over all on-board entity ids
  from `view.board.entity_locations`, or `SELECT_HEX` over all
  `view.board.tiles`) and rerouting `onUnitClick`/`onHexClick` while pick mode
  is active — no Board3D/HexGrid changes. `place_entity` picks its (off-board)
  entity from a dropdown, then board-clicks the destination hex.

## Components

| Unit | Responsibility |
|---|---|
| `types/game.ts` | `OverrideProposedMessage` / `OverrideUpdatedMessage` / `OverrideResolvedMessage` in `ServerMessage`; `ActiveOverrideProposal`, `OverrideResolution` |
| `hooks/useGameSocket.ts` | Track `overrideProposal` (set on PROPOSED, tally-patched on UPDATED, cleared on RESOLVED) and transient `overrideResolution`; actions `proposeOverride` / `voteOverride` / `cancelOverride` |
| `api/overrides.ts` | `fetchOverrideSchema()` (module-cached, unauthenticated) and `fetchOverrideHistory(gameId, token)` (bearer) |
| `utils/overridePick.ts` | `OverridePick` state machine types + `overridePickRequest(pick, view)` synthetic-request builder + `describePick(pick)` chip text |
| `ui/OverrideVoteBanner.tsx` | Banner + outcome strip (applied / rejected with `reason.message` / expired / cancelled, auto-dismiss ~6s) |
| `ui/OverridePanel.tsx` | Tabbed modal: Board / Values / Advanced / Unstick / Rewind; every path ends in a confirm step showing the payload summary before `PROPOSE_OVERRIDE` |
| `pages/GameView.tsx` | Mounts panel + banner; owns `overridePick` state; passes the synthetic request into Board3D/HexGrid and reroutes clicks; Esc / chip ✕ cancels |
| `hud/GameTools.tsx` | New "Fix game state" entry (3D); 2D gets a button beside "Report bug" |

## Flows

**Propose (board fix):** GameTools → panel → Board tab → "Move a unit" →
panel collapses to instruction chip → click unit → click hex → confirm
dialog with summary → `PROPOSE_OVERRIDE {family:"patch", op:"move_entity",
args:{entity_id, hex}}`.

**Vote:** `OVERRIDE_PROPOSED` broadcast → banner for everyone; eligible
non-voters get Approve/Reject; `OVERRIDE_UPDATED` refreshes the tally;
`OVERRIDE_RESOLVED` swaps in the outcome strip (with structured reason on
apply-time rejection) and clears the proposal. A fresh `STATE_UPDATE` follows
`applied` — no special handling needed beyond the normal view update.

**Rewind:** Rewind tab lazily fetches history; rows show label/round/turn,
superseded rows greyed, `ov_rewind` rows styled as markers; clicking a row →
confirm → `PROPOSE_OVERRIDE {family:"rewind", to:index}`.

**Multi-piece heroes:** board picking naturally yields piece ids (pieces are
the clickable board units), which is exactly what the backend wants.

## Error handling

- Backend `ERROR` replies (proposal already open, out-of-range rewind,
  ineligible vote) flow through the existing `ErrorToast`.
- After an applied patch, a stale in-flight input submit is rejected by the
  backend with a request-id mismatch — existing error path; the fresh
  `input_request` arrives in the broadcast.
- Schema/history fetch failures render inline retry states in their tabs.

## Testing

Vitest + `renderToStaticMarkup` (existing pattern): banner tally/roles/
countdown text, panel payload building per tab, `overridePickRequest` unit
tests, history rendering with superseded greying.

## Out of scope

Replay-viewer admin page changes, REST propose path, optimistic application,
mobile-specific layout work.
