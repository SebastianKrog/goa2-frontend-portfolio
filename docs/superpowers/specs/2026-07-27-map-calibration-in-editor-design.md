# Map calibration in the map editor

**Date:** 2026-07-27
**Repos touched:** `goa2-backend` (`tools/map_editor.html`), `goa2-frontend` (`src/components/board3d/`)

## Problem

Adding a new map today takes three steps, and the third dominates the cost:

1. Import `source_csv/<name>_qrs_integer.csv` into `tools/map_editor.html`, paint zones/tags/lanes, export JSON.
2. Drop the map PNG into `goa2-frontend/public/map/`.
3. Open a real game with the map, load it with `&calibrate=1`, and hand-tune four
   numbers (`hexSize`, `origin.x`, `origin.z`, `rotationDeg`) with sliders until the
   hex grid lines up with the image.

Step 3 costs ~20 minutes per map. Two reasons:

- It is a hand search over four coupled parameters, viewed through a perspective
  camera, requiring a running game to even start.
- Misalignment has no diagnostic. A grid that is 1% off looks exactly like a grid
  that is badly tuned, so there is no signal telling you when to stop adjusting and
  start suspecting something else.

The second point is not hypothetical. `MapPlane` currently renders every map on a
*square* plane. `magma_and_ice.png` is 3172x3200, so it is stretched ~0.9%
vertically, and **no** choice of the four numbers can align a grid to a
non-uniformly stretched image. Tuning that map by hand would never converge.

## Approach

Move alignment into the editor, where the grid is authored and the geometry is
already known, and replace the slider search with a closed-form solve from two
clicks.

Grid-to-image is a 2D similarity transform: scale, rotation, translation. Four
unknowns. Two point correspondences determine it exactly.

## 1. The math

Both frames, in complex numbers (`x + iy` for SVG, `x + iz` for world):

- Editor SVG, pointy-top, `HEX_SIZE = 22`:
  `zE(q,r) = 22*sqrt(3)*(q + r/2) + i*33*r`
- Frontend local, flat-top:
  `zu(q,r) = 1.5*q + i*sqrt(3)*(q/2 + r)`

A three.js `rotation-y` of theta is multiplication by `e^(-i*theta)` in `x + iz`
(from `Ry`: `x' = x*cos + z*sin`, `z' = -x*sin + z*cos`). So the frontend places a
hex at:

```
world(q,r) = origin + hexSize * zu(q,r) * e^(-i*theta)
```

The two frames are related by exactly:

```
zE = 22 * e^(-i*pi/6) * zu
```

A pure -30 degree rotation with scale 22. No reflection. Verified on the basis
vectors: `zu(1,0) = sqrt(3)*e^(i*pi/6)`, `zE(1,0) = 22*sqrt(3)`;
`zu(0,1) = sqrt(3)*e^(i*pi/2)`, `zE(0,1) = 22*sqrt(3)*e^(i*pi/3)`.

Therefore the editor can work entirely in its own SVG frame and convert only on
export.

### Image placement state

The editor stores the image placement as a single complex pair `(m, c)`: image pixel
`p = px + i*py` renders at SVG point `m*p + c`. Emitted as an SVG transform:

```
matrix(Re m, Im m, -Im m, Re m, Re c, Im c)
```

Composition, nudging, and fine scale/rotate are all complex arithmetic on `(m, c)`,
so there is no separate scale/rotation/translation bookkeeping to keep consistent.

### Two-anchor solve

Anchor hexes A and B sit at known SVG points `E1`, `E2`. The user clicks their true
centers on the displayed image at SVG points `C1`, `C2`. The correction is the
similarity taking `C -> E`:

```
m' = (E2 - E1) / (C2 - C1)
c' = E1 - m' * C1
```

Composed onto the current placement: `m <- m'*m`, `c <- m'*c + c'`.

### Export conversion

With `S = imageSize = 10` (world units spanned horizontally) and `W`, `H` the
image's natural pixel dimensions, the plane maps pixels to world with uniform scale
`S/W` (see section 3 for why the aspect fix is what makes this uniform):

```
z_pix = (W/S) * z_world + (W/2 + i*H/2)
```

Requiring `m*z_pix + c == zE` for all hexes and matching the `zu` coefficient and
the constant term gives:

```
hexSize     = 22 * S / (W * |m|)
rotationDeg = deg(arg m) + 30                       (mod 360)
origin      = -(S/W) * (W/2 + i*H/2 + c/m)          -> { x: Re, z: Im }
```

This is directly testable: the three shipped map configs are known-good, so
projecting two hexes to pixels with each config and feeding those pixels to the
solver must recover the config.

## 2. Editor changes (`goa2-backend/tools/map_editor.html`)

The file is already split into a pure-logic script block (node-testable, with
`module.exports` at line 360) and a UI block. The solver goes in the pure block
beside `hexX`/`hexY` and is added to the exports.

New **Map image** sidebar section:

- **Load**: drop or file-pick a PNG. Rendered as an SVG `<image>` at natural size
  inside `gWorld`, beneath `gHexes`, under the `(m, c)` matrix. Being inside
  `gWorld` means it rotates with the existing view-rotation control and stays
  consistent with the grid.
- **Visibility**: a `has-image` class on `<body>` turns ghost hexes transparent
  (`fill-opacity: 0; pointer-events: all` so they still hit-test) and painted hexes
  semi-transparent (`fill-opacity: .55`). Side benefit beyond calibration: zones,
  tags, and lanes can be painted while looking at the actual terrain instead of bare
  coordinates.
- **Align**: auto-picks the two hexes in the current set with maximum separation.
  Imported CSV geometry outlines the map, so these are corner hexes and
  unambiguous on the art. They are drawn as labelled A/B markers in distinct
  colors. Grid polygons go `pointer-events: none` during align so clicks land on the
  image. The A/B labelling enforces click order, which rules out the 180-degree
  hex-symmetry ambiguity (swapped anchors would otherwise also "solve").
  Requires hexes to exist; with an empty map the button is disabled with the hint
  "import geometry first".
- **Marker legibility**: anchors are crosshairs with a dark halo under every stroke
  and a light halo behind the label, arms stopping short of the centre so the target
  pixel stays visible. Plain thin circles disappear into painted terrain art —
  confirmed by looking at one over the magma_and_ice ice field.
- **After solving**: the grid snaps over the image. Arrow keys nudge `c` by 1 SVG
  unit (shift for 10); two fine sliders trim `|m|` and `arg m` about the grid
  centroid.
- **Verify (optional third click)**: a two-anchor solve is exact *at* the anchors, so
  their residual is always zero and carries no information. Instead, a Verify button
  takes one more click on a third hex's center and reports the error there in
  hex-radii. That is an independent measurement, and it is what would catch a
  non-similarity problem such as a stretched image from inside the editor.
- **Readout**: the four frontend numbers, the verify error if measured, and a **Copy
  MapConfig** button yielding the complete `.ts` file body including the `check`
  field from section 4.

### Persistence

`serializeState` gains
`calib: { m: [re, im], c: [re, im], imageName, imageW, imageH, checkHex, aligned }`.
`aligned` gates the readout and the Copy button, so a freshly-loaded image shows
"Not aligned yet" rather than plausible-looking numbers from its arbitrary starting
placement. Saving also flushes on `pagehide`: refreshing is a normal part of this
workflow, and the existing 250ms debounce would otherwise drop an alignment solved
moments earlier.
The image blob itself is **not** persisted: the PNGs are 1-5 MB and would blow the
`localStorage` quota. On reload the numbers survive and the sidebar shows
"drop `<imageName>` again". When re-dropped, natural dimensions are compared against
the stored pair and a warning is shown on mismatch (the stored transform is only
valid for the dimensions it was solved against).

## 3. Frontend changes

### `maps/geometry.ts` (new) — single source of truth

The hex-to-local formula is currently copy-pasted at 10 sites: `Board3D.tsx` (lines
412, 414, 802, 823, 846, 871), `HexOverlay.tsx:85`, `DirectionOverlay.tsx:19`,
`RealitySplitOverlay.tsx:21`, `RealityCrackEffect.tsx:19`. The pixel-to-world
mapping is nowhere named at all; it is implicit in `MapPlane`'s geometry args. That
duplication is what lets the editor's model of the renderer and the renderer itself
disagree silently.

```ts
hexToLocal(hex, hexSize): [x, z]
hexToWorld(hex, config): [x, z]                    // local + rotate + translate
planeSize(imgW, imgH, imageSize): [w, h]           // the ONLY place aspect is decided
imageUVToWorld(u, v, imageSize, aspect): [x, z]    // exact inverse of the plane
```

All 10 sites call `hexToLocal`. `src/utils/hex.ts:8` holds the same formula for the
2D grid that is slated for deletion; it is left alone.

### `MapPlane.tsx` — aspect

`planeGeometry` args come from `planeSize(texture.image.naturalWidth,
texture.image.naturalHeight, config.imageSize)`. `useTexture` suspends until load,
so the dimensions are available. Square maps get aspect 1, so the three existing
calibrations do not move.

`MapConfig.imageSize`'s doc comment changes to "world units the image spans
**horizontally**; height follows the image aspect", so a future edit does not
re-hardcode a square.

### `maps/index.ts` — registry

`export const MAPS: Record<string, MapConfig>` replaces the `switch` in
`Board3D.tsx:112-120`:

```ts
const mapConfig = useMemo(() => MAPS[view?.board?.map ?? ""] ?? forgottenIsland, [view?.board?.map]);
```

Adding a map becomes one new file plus one registry line.

### In-game calibrate mode

`&calibrate=1` and `CalibrationPanel` are unchanged, and remain available for
touch-ups and for the model/turret/token sliders that share the panel.

## 4. Self-check: making drift loud

Every exported config carries one extra field, produced from anchor B:

```ts
check: { hex: { q: 5, r: -8 }, u: 0.8412, v: 0.1937 }   // normalized 0..1
```

Under `import.meta.env.DEV`, `MapPlane` compares `imageUVToWorld(check.u, check.v, ...)`
against `hexToWorld(check.hex, config)` once per map load and `console.error`s with
the actual delta when they differ by more than `CHECK_TOLERANCE * hexSize`.

`CHECK_TOLERANCE` is `0.05` hex radii. The check hex is the editor's second align
anchor, so a correct config lands on it exactly and the only residual is the rounding
of the exported literals — the editor prints `hexSize` to 5 decimals and `origin` to
4, keeping that around 1e-4 world units. A 1% image stretch shows up as ~0.13 hex
radii at a corner anchor, comfortably above the limit.

This is two independent implementations of the same mapping checking each other
against real data. It is the mechanism that turns "calibration feels slightly off"
into a specific number. With the current square-plane bug present, it fires
immediately on `magma_and_ice`.

`u, v` are normalized rather than pixel coordinates, so the check survives
re-exporting the PNG at any resolution and fails only on a genuine re-crop, which
*should* fail.

`check` is optional in the `MapConfig` type so the three existing configs stay
valid; they gain one when next recalibrated.

### Rejected alternative

Normalizing every map PNG to square in a preprocessing step would fix the aspect
issue at the boundary, but it adds a lossy pipeline step and catches no drift of any
other kind.

## 5. Verification

**Editor** (`goa2-backend/tools/map_editor.test.mjs`, new, run with `node --test`;
extracts the pure script block the way `docs/superpowers/plans/2026-07-04-map-editor.md`
documents):

- Round-trip: for each of the three shipped configs, synthesize two anchor clicks
  from the config, solve, assert all four numbers recover to within 1e-9.
- The `zE = 22 * e^(-i*pi/6) * zu` identity on several `(q,r)`.
- Idempotence: solving against an already-aligned image leaves `(m, c)` unchanged.
- Anchor order: swapping A and B produces a *different* result, confirming the
  180-degree ambiguity is resolved by ordering rather than accidentally hidden.
- Non-square image dimensions produce a uniform-scale solve.

**Frontend** (vitest, added as a devDep with a `test` script and a `vitest.config.ts`
that deliberately does not extend `vite.config.ts` — the Cloudflare Worker plugin
there rejects the Node externals vitest needs):

- `hexToLocal` matches the previous inline arithmetic on a spread of `(q,r)`.
- `hexToWorld` / `imageUVToWorld` round-trip through a config.
- `planeSize` on square and non-square inputs.
- The `-30` degree frame identity, mirroring the editor test, so both repos assert
  the same invariant.

**Build:** `npm run build` (`tsc -b`, which enforces `noUnusedLocals`/`Parameters`).

**Manual:** align `magma_and_ice` end to end, paste the config, confirm in-game that
the grid sits on the art and that the dev self-check is silent.

## Success criteria

- A new map goes from CSV to a correct in-game grid in under a minute: import, drop
  PNG, two clicks, copy, paste.
- The three existing maps render identically to today.
- A mapping mismatch of any kind reports itself with a number instead of looking
  like a bad tune.
