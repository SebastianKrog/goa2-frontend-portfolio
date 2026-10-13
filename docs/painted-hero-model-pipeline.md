# Painted hero model pipeline

Use this workflow when replacing an existing unpainted hero GLB with an OBJ and
PBR texture set.

## Input contract

The ZIP or extracted directory should contain:

- one `.obj`;
- one base-color image;
- one metallic image whose name contains `metallic`;
- one normal image whose name contains `normal`;
- one roughness image whose name contains `roughness`.

Pass explicit map paths when automatic discovery is ambiguous.

## Remove a fused horizontal base

First check whether the base is a separate connected object. Delete a separate
base in the source tool instead of cutting the whole mesh.

When the character and a flat display base are welded into one watertight mesh,
test a horizontal cut on a copy:

```bash
npm run model:remove-base -- \
  --input /path/to/source.obj \
  --scan \
  --min-ratio 0.02 \
  --max-ratio 0.25 \
  --step-ratio 0.005

npm run model:remove-base -- \
  --input /path/to/source.obj \
  --output /path/to/source-without-base.obj \
  --cutoff-ratio HEIGHT_RATIO
```

The command keeps geometry above the plane, interpolates UVs and normals where
triangles cross it, and seals every resulting opening. It rejects any new open
boundary or non-manifold edge. If simplification preserved a pre-existing open
boundary or non-manifold edge away from the cut plane, the cut reports and
retains it instead of silently claiming the output is manifold. A pre-existing
opening that intersects the chosen plane remains an error.

`HEIGHT_RATIO` is measured from the OBJ's minimum Y to maximum Y, which makes a
reviewed cutoff portable across reruns. `--cutoff-y` remains available for an
exact source-coordinate cut. Determine either value by inspecting the
base/feet junction and rendering several temporary candidates. A cut that is
too low leaves the top of the base; a cut that is too high damages feet,
clothing, or props. Always review the result from every side. Preserve sculpted
supports such as Emmitt's clock, Razzle's drum, Misa/Swift's rocks, and
Silverarrow's log. This method is appropriate only when a horizontal plane
cleanly separates the colored display base from the visible character.

## Round an oversized terrain footprint

Do not use a vertical box cut when low terrain is rectangular but character
geometry such as a tail, cape, or weapon extends beyond it. Instead, reshape
only the low terrain while protecting everything above a reviewed height:

```bash
npm run model:reshape-ground -- \
  --input /path/to/source-without-base.obj \
  --output /path/to/source-with-rounded-ground.obj \
  --width-ratio 0.82 \
  --depth-ratio 0.80 \
  --core-ratio 0.55 \
  --full-strength-height-ratio 0.14 \
  --protect-height-ratio 0.22
```

This maps the square footprint to an oval without deleting triangles or
creating cut boundaries. The deformation fades from full strength near the
floor to zero at `protect-height-ratio`; all vertices at or above that height
keep their exact source coordinates. Render both four-angle and top-down views
to confirm feet and ground-level props have not been distorted:

```bash
npm run model:render-thumbnails -- --top \
  --output-dir /tmp/painted-top-view \
  /tmp/painted-previews/HERO_SLUG.glb
```

For reproducible batch conversion, record the reviewed parameters in the hero's
manifest entry under `groundReshape`. Trinkets is the regression case: its low
rectangular dirt slab becomes an oval comparable to the legacy base while its
elevated tail remains unchanged.

## Batch conversion

For an archive containing multiple painted heroes, record one reviewed source
folder, cutoff, and baked orientation per hero in:

```text
scripts/model-pipeline/painted-hero-batch.json
```

Google Drive downloads may contain one ZIP per model inside an outer ZIP. For
those deliveries, use `sourceArchive` on the manifest entry instead of
`sourceFolder`; the batch command extracts the nested archive automatically.

Generate temporary GLBs first:

```bash
npm run model:convert-batch -- \
  --archive /path/to/painted-heroes.zip \
  --output-dir /tmp/painted-previews

npm run model:render-thumbnails -- \
  --output-dir /tmp/painted-thumbnails \
  /tmp/painted-previews/*.glb
```

Compare every four-angle preview with the current model. The manifest's
`rotationY` should make the painted front/side/back views match the current
asset so existing runtime calibration remains valid.

After every preview passes:

```bash
npm run model:convert-batch -- \
  --archive /path/to/painted-heroes.zip \
  --final
```

`--final` archives each current GLB before replacement. Entries marked
`pilot-complete` are skipped unless `--include-pilots` is supplied. Use repeated
`--hero HERO_SLUG` options to rerun only selected models.

If a source is much denser than the normal approximately 22,500-triangle
inputs, add `simplifyTriangles`, `simplifyError`, and `maxTriangles` to its
manifest entry. The batch uses `npm run model:simplify` to retain indexed UV
seams, generates normals, removes the base, and rejects the final model if it
exceeds the triangle limit. Razzle is the regression case: 1,500,000 source
triangles become 22,452 final triangles without removing the sculpted drum.
When `groundReshape` is present, the batch rounds the low terrain after base
removal and before GLB conversion.

## Convert

```bash
npm run model:convert -- \
  --hero HERO_SLUG \
  --input /path/to/painted-hero.zip \
  --reference public/models/heroes/HERO_SLUG.glb \
  --output public/models/heroes/HERO_SLUG.glb \
  --rotation-y BAKED_ROTATION
```

Before overwriting the output, the converter archives the existing model at:

```text
model-archive/heroes/HERO_SLUG/HERO_SLUG-original.glb
```

It never overwrites an existing archive. Use `--no-archive` only for temporary
comparison outputs.

The defaults are:

- 1024×1024 maximum textures;
- JPEG base color;
- PNG normal and combined metallic/roughness data;
- core glTF 2.0 GLB without optional texture extensions.

## Geometry invariant

The converter derives one scale from:

```text
reference height / painted-source height
```

It applies that exact value to X, Y, and Z. Never independently fit width,
height, and depth: per-axis fitting distorts the sculpt. Width and depth may
differ from the reference model because the painted source can have a different
silhouette or pose.

After uniform scaling and the requested baked Y rotation, the converter moves
the model vertically so its floor matches the reference GLB. It does not shift
or stretch X/Z.

`--rotation-y` corrects the asset's intrinsic orientation. It is separate from
the runtime `rotationDeg` calibration in
`src/components/board3d/heroes/index.ts`.

## Inspect

```bash
npm run model:inspect -- \
  model-archive/heroes/HERO_SLUG/HERO_SLUG-original.glb \
  public/models/heroes/HERO_SLUG.glb
```

Review:

- byte size;
- triangle and vertex counts;
- texture formats and extensions;
- height and floor position;
- proportional scaling reported by the converter.

The converter canonicalizes GLB buffer ordering. Identical inputs and options
should produce an identical SHA-256, which makes reruns and LFS deduplication
easy to verify.

## Calibrate and validate

1. Render the exported GLB from four sides before changing runtime
   configuration.
2. Either open a live 3D game with `?calibrate=models`, or open an existing replay
   and click **Model calibration**. A replay is usually faster because the same
   real board position can be reused for every model. Use the older
   `?calibrate=1` mode only when tuning the map, cards, camera, or team base too.
3. In **Live Hero Preview**, choose any occupied board unit and the hero model
   to display on it. This is visual-only and does not change the game state.
   The selection is stored in the URL so a refresh or shared calibration link
   keeps the same preview models.
4. Use **Asset version** to switch between the current painted GLB and the
   archived model that it replaced. Archived originals are copied into the
   production asset bundle by the Vite build, but are fetched only when this
   calibration option is selected. The selected board units are stored in the
   URL's `original=` parameter.
5. Tune model-specific `scale`, offsets, `rotationDeg`, and `brightness` in
   `src/components/board3d/heroes/index.ts`.
   Brightness `1.00` is neutral. Values above one multiply only that model's
   material base colors; geometry and textures remain shared with other
   instances.
6. Confirm team outline thickness, floor contact, facing, and neighboring-unit
   spacing.
7. Run:

```bash
npm run check:models
npm run model:inspect -- public/models/heroes/HERO_SLUG.glb
npm test
WRANGLER_LOG=none npm run build
npx eslint src/components/board3d/heroes/index.ts scripts/model-pipeline/*.mjs
git diff --check
```

For a materially larger or more complex model, repeat the isolated browser
load/render benchmark instead of inferring performance from file size alone.

## Runtime legacy option

The in-game **Legacy** button in the table-tools rail switches every hero
between the painted model and the archived pre-paint model. Legacy mode uses
the dedicated `LEGACY_HERO_MODELS` transform snapshot copied from `master` at
`0bc2c0e`; do not reuse painted calibration values for those meshes.

The preference is stored under `goa2:hero-model-style` in browser local storage.
Archived GLBs remain on-demand assets: a normal painted game does not fetch
them, and legacy mode fetches only the heroes present on the current board.

## LFS and restoration

Hero and archive GLBs are tracked by Git LFS through `.gitattributes`.

Before the first LFS commit:

```bash
git lfs install
git lfs status
```

The build runs `npm run check:models` first and fails if a deployed hero is an
unresolved LFS pointer or has an invalid GLB header.

For the first pushed pilot, verify that Cloudflare fetched LFS content by
checking the deployed GLB's byte length or SHA-256. Do not process the remaining
heroes until that pilot succeeds.

Restore an archived model with:

```bash
git lfs pull
cp model-archive/heroes/HERO_SLUG/HERO_SLUG-original.glb \
  public/models/heroes/HERO_SLUG.glb
npm run check:models
npm run build
```

## Min reference

Min was converted with:

```bash
npm run model:convert -- \
  --hero min \
  --input /Users/pedrooliveira/Downloads/min.zip \
  --reference model-archive/heroes/min/min-original.glb \
  --output public/models/heroes/min.glb \
  --rotation-y 180
```

Approved runtime calibration:

```text
scale       1.40
xOffset     0.000
yOffset    -0.050
zOffset     0.000
rotation  184°
```
