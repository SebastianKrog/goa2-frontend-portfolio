# 3D Reality-Split Input + Lasting Crack Visual

Nebkher's `crack_in_reality` (tier 2, `topology_split`) and `shift_reality`
(tier 3, `topology_isolation`) split the board along a straight line of hexes
through Nebkher's space for the rest of the turn. Backend flow: one
`SELECT_NUMBER` request — prompt "Choose the line of spaces drawn through your
space", options ids `1`/`2`/`3` with text "Line along the {q,r,s}-axis
(through your space)" — then a `CreateEffectStep` storing `split_axis` +
`split_value` fixed at cast time (`goa2-backend/src/goa2/scripts/nebkher_effects.py`).

## 1. Backend: expose the line in the state view

`_build_effects_view` (`goa2-backend/src/goa2/domain/views.py`) adds
`"split_axis"` / `"split_value"` (nullable) to every effect entry, so the
lasting visual is state-driven — works on reconnect and for spectators. The
one-shot `EFFECT_CREATED` event metadata already carries these. Update
`docs/CLIENT_INTEGRATION_GUIDE.md` and add a serialization test.

## 2. Shared util: `src/utils/realitySplit.ts`

- `isRealitySplitRequest(req)` — `SELECT_NUMBER`, prompt `/line of spaces/i`,
  exactly 3 options each naming an axis. Axis parsed per option from its text
  (`/([qrs])-axis/`), so the frontend never hardcodes the 1→q mapping.
- `splitLineTiles(tiles, axis, value)` — tiles where `hex[axis] === value`.
  Shared by the input overlay and the lasting visual.

## 3. Input: `RealitySplitOverlay.tsx`

Mirrors `DirectionOverlay`. All three candidate lines drawn faintly through
Nebkher's hex; hovering any tile of a line lights the whole line; click sends
that option id via `onSelect`. Nebkher's own hex is visual only (all three
lines cross there). Wired in `Board3D.tsx` beside the DirectionOverlay block
(origin = tile occupied by `current_actor_id`); `GameView.tsx` treats it like
direction requests — banner prompt on top, no dock.

## 4. Lasting visual: `RealityCrackEffect.tsx`

Driven purely by `view.effects`: any active `topology_split` /
`topology_isolation` effect with non-null `split_axis` renders a jagged
emissive void-purple fissure along the line's tiles — flat geometry slightly
above the board, subtle pulse (`useFrame`), deterministic per-tile jitter so
it doesn't shimmer between renders. `topology_isolation` additionally pulses
an isolation ring on Nebkher's current tile (via `scope.origin_id`). Mounted
inside Board3D's rotated group; disappears when the turn-long effect leaves
`view.effects`.

## 5. Verification

`npm run build` (frontend types), backend `pytest` for the view test, then
browser checkpoint: cast Crack in Reality, pick a line on the board, watch
the crack persist for the turn; Shift Reality for the ring variant.
