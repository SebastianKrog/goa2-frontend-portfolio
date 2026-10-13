# On-board direction selection (3D)

Date: 2026-06-21
Status: Design (approved)

## Problem

Direction decisions arrive as a `SELECT_NUMBER` input request:

```json
{
  "type": "SELECT_NUMBER",
  "prompt": "Choose a direction",
  "valid_options": [0, 1, 2, 3, 4, 5],
  "options": [
    {"id": "0", "text": "NE"}, {"id": "1", "text": "E"}, {"id": "2", "text": "SE"},
    {"id": "3", "text": "SW"}, {"id": "4", "text": "W"}, {"id": "5", "text": "NW"}
  ]
}
```

These render as glass `PickerDock` chips labelled NE…NW. Two-letter compass labels are
unintuitive: the player has to mentally map a label to a board direction, and the labels
do not account for the board's visual rotation. The option index maps directly to the
engine's neighbor vector table:

```python
vectors = [
    Hex(q=1, r=0, s=-1),   # 0
    Hex(q=1, r=-1, s=0),   # 1
    Hex(q=0, r=-1, s=1),   # 2
    Hex(q=-1, r=0, s=1),   # 3
    Hex(q=-1, r=1, s=0),   # 4
    Hex(q=0, r=1, s=-1),   # 5
]
```

We want the player to pick a direction by clicking it **on the board**, around the
acting hero.

## Decisions

- **Detection:** frontend heuristic (no backend/protocol change).
- **Origin:** always the acting hero's hex (`view.current_actor_id`).
- **Fallback:** keep the NE…NW `PickerDock` chips alongside the board UI.
- **Marker style:** outward arrow + a glow on the neighbor hex (both).

## Detection

Add a predicate (e.g. in `src/utils/` or alongside `GameView`):

```ts
function isDirectionRequest(req: InputRequest | null): boolean {
  if (!req || req.type !== "SELECT_NUMBER") return false;
  if (!/direction/i.test(req.prompt)) return false;
  const opts = (req.options as Array<{ id: string }> | undefined) ?? [];
  // The 6 compass directions, ids "0".."5".
  return opts.length === 6 && opts.every((o, i) => o.id === String(i));
}
```

The option `id` **is** the direction index. Selecting sends `onSelect(String(index))`,
identical to the existing dock path — no new socket message.

## Origin resolution

Find the tile whose `occupant_id === view.current_actor_id`. If no such tile exists,
the board UI is skipped and only the dock chips show (graceful fallback).

## Rendering: `DirectionOverlay`

New component, sibling to `HexOverlay`, rendered inside the same translated + rotated
board `group` so board rotation is handled for free. Props: `view`, `originHex`,
`hexSize`, plus `onSelect(index: string)`.

For each direction index `0..5`:

1. Compute neighbor hex via the vector table above (`origin.q + dq`, `origin.r + dr`).
2. World position with the existing formulas used in `HexOverlay`:
   - `x = hexSize * (3/2) * q`
   - `z = hexSize * (Math.sqrt(3)/2 * q + Math.sqrt(3) * r)`
3. Draw, at/toward that neighbor position:
   - an **arrow** (triangular wedge) pointing outward from origin toward the neighbor,
   - a **glow** ring/disc on the neighbor hex, reusing `HexOverlay`'s green valid-hex
     colour language (`#4caf50` / `#7bed8a`), brightening on hover.
4. The clickable mesh calls `onSelect(String(index))`.

All 6 markers render regardless of whether a real board tile exists at the neighbor
(the engine accepts all 6 directions; `direction_index % 6`). Because the player clicks
the visually-correct neighbor position, board rotation can never cause a label/direction
mismatch — the core fix.

Hover state is local to the component (mirrors `HexOverlay`'s `hovered` pattern).

## Wiring

- `Board3D` already receives `inputRequest`. Thread the existing select handler down so
  `DirectionOverlay` can call it. Render `DirectionOverlay` only when
  `isDirectionRequest(inputRequest)` and an origin tile is found.
- `GameView` continues to route `SELECT_NUMBER` to `PickerDock` as today (the fallback).

## Out of scope

- Backend metadata for direction requests (origin hex / explicit kind flag).
- Directions centered on a unit other than the actor.
- Keyboard selection of on-board arrows (dock chips already cover keyboard/accessibility).

## Verification

- `npm run build` (tsc -b) for typecheck.
- Manual browser smoke on a live direction decision: confirm 6 arrows + glows appear
  around the acting hero, clicking one resolves the decision, and the choice matches the
  expected neighbor. Hold pushes until asked.
