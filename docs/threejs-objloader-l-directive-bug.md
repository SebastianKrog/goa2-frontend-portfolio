# three.js OBJLoader: trailing `l` directives silently drop the mesh

**Date observed:** 2026-05-23
**Where encountered:** `goa2-frontend` 3D board rework, loading Tabletop Simulator hero figurine `.obj` files via `OBJLoader` from `three/addons/loaders/OBJLoader.js`.
**Versions in use:**
- `three@^0.184.0`
- `@react-three/fiber@^9.6.1`
- `@react-three/drei@^10.7.7`

---

## Summary

`OBJLoader` returns an `Object3D` with **zero `Mesh` children** when the input `.obj` file contains `l` (line) directives *after* its `f` (face) directives. The mesh data appears to be silently replaced/dropped in favor of a `LineSegments` object. Stripping the `l` lines from the file (or never exporting them) makes the same model load correctly.

This is consistent with behavior we observed across 4 of 6 minion `.obj` files exported from Blender 4.1.1, all of which contained loose edges encoded as `l` directives at the end of the file.

## Observed symptoms

We rendered each `.obj` with `useLoader(OBJLoader, path)` (from `@react-three/fiber`), then traversed the loaded root and applied a `MeshStandardMaterial` to every `Mesh` descendant.

**For files with `0` `l` directives:** loaded correctly. The root had `children.length === 1`, one `Mesh` descendant with `positions === uvs === 9717` (for one model), textured rendering looked correct.

**For files with any `l` directives:** root had `children.length === 1` but **0 `Mesh` descendants**. The loaded `Object3D` was apparently a `LineSegments` instead. Result: nothing in the material-assignment loop ran, the mesh rendered with no texture or appeared as a wireframe-like blob in the scene.

Diagnostic console output (representative):

```
[UnitMesh] cloned /models/red_heavy.obj:   children=1 meshes=1   ← 0 l-directives
[UnitMesh] cloned /models/blue_melee.obj:  children=1 meshes=1   ← 0 l-directives
[UnitMesh] cloned /models/blue_heavy.obj:  children=1 meshes=0   ← 14 l-directives
[UnitMesh] cloned /models/red_melee.obj:   children=1 meshes=0   ← 2 l-directives
[UnitMesh] cloned /models/red_ranged.obj:  children=1 meshes=0   ← 9 l-directives
[UnitMesh] cloned /models/blue_ranged.obj: children=1 meshes=0   ← 2 l-directives
```

100% correlation between presence of `l` directives and zero-`Mesh` outcome.

## Investigation chain

The path of elimination, in order:

1. **"Texture isn't loading."**  Added explicit `THREE.TextureLoader.load` with success/error callbacks. All textures loaded successfully (200 OK, correct dimensions). Eliminated.
2. **"Texture is too large for the GPU."**  Several offending textures were 4096×4096. Downsampled to 1024×1024. Did not fix it. Eliminated.
3. **"Material/lighting issue with `MeshStandardMaterial`."**  Switched to `MeshBasicMaterial` (no lighting, no normals required). Still rendered without texture. Eliminated.
4. **"Material assignment loop is skipping these meshes."**  Added a `console.log` inside the `clone.traverse((child) => { if ((child as THREE.Mesh).isMesh) { ... } })` block. The log only fired for the *working* models. Narrowed the problem to: the loaded `Object3D` has no `Mesh` descendant for broken files.
5. **"OBJLoader is producing zero meshes for these files."**  Added a pre-loop log: `clone.children.length` and `meshCount`. Confirmed: `children=1, meshCount=0`.
6. **"What's structurally different about the broken `.obj` files?"**  Diffed headers (identical), face lines (identical format), and *tails*. Broken files all ended with `l N M` lines. Working files did not.
7. **Cross-validated** by counting `^l ` lines in all 6 files. Perfect correlation with the failing set.
8. **Verified the fix:** removing the `l` directives (via `grep -v '^l '`) made the same files load correctly with `meshCount=1`.

## Likely root cause (hypothesis — not source-verified)

Browsing the public behavior of `OBJLoader`, our best inference is:

- The loader's internal state machine builds a "current object" as it parses, starting with `Mesh` when it encounters faces.
- When it then encounters an `l` directive, it transitions the current object into a `LineSegments`-type, *replacing* the running geometry rather than starting a new sibling object.
- The previously-accumulated face data is dropped or attached to the now-Line object in a way that doesn't surface as a `Mesh`.

A spec-correct loader should treat `f` and `l` as **independent geometry types** within the same object, returning a `Group` containing both a `Mesh` (from `f`) and a `LineSegments` (from `l`).

We have not yet read OBJLoader's source to verify the exact mishandled branch — that's the natural next step for anyone investigating.

## Minimal reproduction

A pure-vanilla three.js repro should be straightforward. Save the following as `repro.obj`:

```
# minimal repro
o ReproMesh
v 0 0 0
v 1 0 0
v 0 1 0
v 1 1 0
vt 0 0
vt 1 0
vt 0 1
vt 1 1
vn 0 0 1
f 1/1/1 2/2/1 3/3/1
f 2/2/1 4/4/1 3/3/1
l 1 4
```

Then:

```js
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";

new OBJLoader().load("/repro.obj", (root) => {
  let meshCount = 0;
  root.traverse((c) => { if (c.isMesh) meshCount++; });
  console.log({ children: root.children.length, meshCount });
});
```

Expected: `{ children: 1, meshCount: 1 }` (or, ideally for a fully correct loader, `children: 2` with one Mesh and one LineSegments inside a Group).

Predicted actual (based on what we observed): `{ children: 1, meshCount: 0 }`.

If you remove the last `l 1 4` line and reload, the result becomes `{ children: 1, meshCount: 1 }`.

## Workaround applied in goa2-frontend

A one-liner preprocessing step strips `l` directives from each affected `.obj` before serving:

```bash
grep -v '^l ' input.obj > output.obj
```

This is harmless: `l` directives only describe loose/wireframe edges that aren't part of the renderable surface. They're typically Blender artifacts from "loose edges" or "mark sharp" annotations that aren't needed for a textured 3D model.

For a longer-term solution we would migrate the affected assets to glTF (`.glb`) format, which has a stricter schema and avoids OBJ's many parsing edge cases entirely.

## Possible fix in OBJLoader

A speculative fix (not source-verified, would need to be validated against the actual parser):

- When the parser sees the first `l` directive while a face-mode object is being built, **finalize** the current Mesh and **start a new sibling LineSegments**, attaching both as children of a parent `Group` returned as the root.
- A simpler "back-compat preserving" alternative: if both `f` and `l` are present for the same `o`, emit two separate three.js objects rather than mutating one.

## Filing it upstream

If you want to file this as an issue:

1. Repo: <https://github.com/mrdoob/three.js>
2. Use the minimal repro above as the example
3. Reference `OBJLoader` (path: `examples/jsm/loaders/OBJLoader.js` in their tree)
4. Tag it as a parsing/loader issue, not a rendering one

The bug is small, the repro is tiny, and a maintainer should be able to confirm or fix it quickly.

## Context: why this took a while to find

OBJ is permissive; most exports from common tools (Blender, Maya, ZBrush) emit only `f` for typical models, never `l`. The `l` directive only shows up when:
- The source model has loose edges (vertices connected by an edge but not part of any face)
- "Export edges" or equivalent is enabled in the exporter options
- The model includes wireframe/blueprint annotations

So the population of users who hit this bug at all is narrow, and most who do probably blame their export rather than the loader.

In our case, the figurines came from a Tabletop Simulator workshop pipeline that re-exports Blender models with whatever Blender's defaults are. Some of the heroes happened to have loose edges, some didn't.
