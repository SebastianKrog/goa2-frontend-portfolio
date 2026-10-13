# 3D Board Rework — M1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Stand up a working 3D scene behind the `?3d=1` URL flag: wooden table, warm lighting, the forgotten_island map plane, calibrated hex overlay tiles with hover + click input.

**Architecture:** Add `@react-three/fiber` + `@react-three/drei`. New `src/components/board3d/` directory hosts the scene. `GameView.tsx` branches on a `?3d=1` URL flag to render either the existing SVG `HexGrid` (untouched) or the new `Board3D`. All existing hooks (`useGameSocket`, types) are reused. No backend changes.

**Tech Stack:** React 19, R3F (`@react-three/fiber`), `@react-three/drei`, Vite, TS, existing socket layer.

**Risk ordering:** Each checkpoint surfaces the riskiest decision *first* so a wrong call costs minutes, not days. Order: dependencies/wiring → aesthetic baseline → camera feel → map alignment → hex calibration → click interaction.

**Feedback workflow:** Each task ends with "open `localhost:5173/game/.../?3d=1`, check X". Pedro gives 👍 / "change X" / "rethink Y" before next task begins.

---

## Task 1: Install R3F deps + `?3d=1` flag + skeleton Board3D

**Why first:** Cheapest possible "is this wired up" test. If anything's broken in deps or routing, we want to know now before we've written any 3D code.

**Files:**
- Modify: `/Users/pedrooliveira/Documents/goa2/goa2-frontend/package.json`
- Create: `/Users/pedrooliveira/Documents/goa2/goa2-frontend/src/components/board3d/Board3D.tsx`
- Modify: `/Users/pedrooliveira/Documents/goa2/goa2-frontend/src/components/pages/GameView.tsx`

**Step 1: Install dependencies**

Run:
```bash
cd /Users/pedrooliveira/Documents/goa2/goa2-frontend && npm install three @react-three/fiber @react-three/drei && npm install -D @types/three
```

Expected: deps added to `package.json`, no errors.

**Step 2: Create skeleton Board3D component**

Create `src/components/board3d/Board3D.tsx`:

```tsx
import { Canvas } from "@react-three/fiber";

export function Board3D() {
  return (
    <Canvas
      style={{ width: "100%", height: "100%", background: "#1a1a1a" }}
      camera={{ position: [0, 8, 0], fov: 45 }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 10, 5]} intensity={0.8} />
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#c45c2c" />
      </mesh>
    </Canvas>
  );
}
```

**Step 3: Wire `?3d=1` flag into GameView**

Modify `src/components/pages/GameView.tsx`:

- Add import: `import { Board3D } from "../board3d/Board3D";`
- After the existing `const [searchParams] = useSearchParams();` line, add:

```tsx
const use3D = searchParams.get("3d") === "1";
```

- In the JSX, replace the `<div className={styles.boardArea}>...</div>` content with a branch:

```tsx
{use3D ? (
  <Board3D />
) : (
  <>
    {/* existing board content here — phaseBanner, HexGrid, PromptBanner, etc. */}
  </>
)}
```

(Wrap the existing children in a fragment; do not delete them.)

**Step 4: Visual verification**

Run:
```bash
cd /Users/pedrooliveira/Documents/goa2/goa2-frontend && npm run dev
```

Open `http://localhost:5173/game/<any-game-id>?token=<any>&3d=1`. (Even with a fake/invalid game ID — Board3D doesn't read game state yet.)

Verify:
- Page loads without console errors related to three.js / R3F
- You see an orange cube on a dark background
- The cube is lit (one side brighter than another)
- Open same URL without `&3d=1` → existing SVG view still works (regression check)

**Step 5: Commit**

```bash
cd /Users/pedrooliveira/Documents/goa2/goa2-frontend && git add package.json package-lock.json src/components/board3d/Board3D.tsx src/components/pages/GameView.tsx && git commit -m "feat(3d): scaffold R3F with ?3d=1 flag and skeleton scene"
```

**Stop point:** Confirm with Pedro:
- "Cube renders, no console errors, old view still works" → continue
- Else → fix before moving on

---

## Task 2: Wooden table + warm lighting (aesthetic baseline)

**Why second:** This locks in the visual tone. Every later checkpoint inherits the lighting, materials, and color temperature defined here. Wrong call here = rework everything.

**Files:**
- Create: `/Users/pedrooliveira/Documents/goa2/goa2-frontend/src/components/board3d/Table.tsx`
- Modify: `/Users/pedrooliveira/Documents/goa2/goa2-frontend/src/components/board3d/Board3D.tsx`

**Step 1: Create Table component**

Create `src/components/board3d/Table.tsx`:

```tsx
export function Table() {
  return (
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <planeGeometry args={[20, 20]} />
      <meshStandardMaterial color="#3d2817" roughness={0.85} metalness={0.05} />
    </mesh>
  );
}
```

A dark wood-tone plane lying flat. 20×20 world units gives plenty of room for the map + 6 player boards later.

**Step 2: Rewrite Board3D with proper lighting**

Replace `src/components/board3d/Board3D.tsx`:

```tsx
import { Canvas } from "@react-three/fiber";
import { Table } from "./Table";

export function Board3D() {
  return (
    <Canvas
      shadows
      style={{ width: "100%", height: "100%", background: "#1a1410" }}
      camera={{ position: [0, 12, 4], fov: 45 }}
    >
      <ambientLight intensity={0.35} color="#fff1d6" />
      <directionalLight
        position={[5, 12, 8]}
        intensity={1.2}
        color="#ffd89b"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-6, 8, -4]} intensity={0.3} color="#a0c8ff" />
      <Table />
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#c45c2c" />
      </mesh>
    </Canvas>
  );
}
```

Warm key light from above-right, cool fill light from the left for contrast. Camera angled slightly forward (~20° tilt) from overhead. Cube stays so we have something to look at.

**Step 3: Visual verification**

Reload the dev server. Open `?3d=1`.

Verify:
- Wood-tone table fills the view
- Cube casts a soft shadow on the table
- Lighting feels warm/cozy, not clinical (the goal is "friend's table", not "operating room")
- Background is a slightly warmer dark tone, not pure black

Take a screenshot for reference.

**Step 4: Commit**

```bash
git add src/components/board3d/Table.tsx src/components/board3d/Board3D.tsx && git commit -m "feat(3d): wooden table surface + warm tabletop lighting"
```

**Stop point:** Confirm with Pedro:
- "Lighting/wood feel right for tabletop?" → continue
- "Wood too dark / too red / shadows too soft" → tweak values before next task
- This is the LAST cheap moment to change the aesthetic baseline

---

## Task 3: Camera controls — left-pan, right-orbit, wheel-zoom

**Why third:** Camera feel is the second-biggest "you'll know it when you see it" risk. Get this validated on an empty table before content depends on camera positioning.

**Files:**
- Create: `/Users/pedrooliveira/Documents/goa2/goa2-frontend/src/components/board3d/CameraRig.tsx`
- Modify: `/Users/pedrooliveira/Documents/goa2/goa2-frontend/src/components/board3d/Board3D.tsx`

**Step 1: Create CameraRig**

Create `src/components/board3d/CameraRig.tsx`:

```tsx
import { OrbitControls } from "@react-three/drei";
import { useEffect, useRef } from "react";
import * as THREE from "three";

export function CameraRig() {
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "r" || e.key === "R") {
        controlsRef.current?.reset();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.1}
      mouseButtons={{
        LEFT: THREE.MOUSE.PAN,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.ROTATE,
      }}
      minDistance={4}
      maxDistance={20}
      maxPolarAngle={Math.PI / 2.2}  // can't go below the table
      target={[0, 0, 0]}
    />
  );
}
```

`MOUSE.PAN` = pan (left), `MOUSE.ROTATE` = orbit (right), wheel = zoom by default. `maxPolarAngle` prevents flipping below the table.

**Step 2: Add CameraRig to Board3D**

Modify `src/components/board3d/Board3D.tsx`:

- Add import: `import { CameraRig } from "./CameraRig";`
- Add `<CameraRig />` inside `<Canvas>` (anywhere — it's a controls component, not visual)

**Step 3: Visual verification**

Reload. Open `?3d=1`.

Verify:
- **Left-drag** pans the camera (the cube slides relative to your view)
- **Right-drag** orbits around the table center
- **Wheel** zooms in/out (clamped at min/max)
- **R key** snaps back to the default view
- You cannot orbit below the table (try dragging up — it stops)
- Damping feels smooth, not jittery

**Step 4: Commit**

```bash
git add src/components/board3d/CameraRig.tsx src/components/board3d/Board3D.tsx && git commit -m "feat(3d): camera rig with left-pan/right-orbit/wheel-zoom + R reset"
```

**Stop point:** Confirm with Pedro:
- "Camera bindings feel right? Pan/orbit/zoom responsive?" → continue
- "Damping too floaty / too snappy / orbit too fast" → tweak `dampingFactor` or rotation speed before next task

---

## Task 4: Map plane on the table

**Why fourth:** Foundational. Every later component (hex overlays, units, mats, cards) is positioned relative to the map. We want to lock down its size, position, and orientation before building anything else on top.

**Files:**
- Create: `/Users/pedrooliveira/Documents/goa2/goa2-frontend/src/components/board3d/MapPlane.tsx`
- Create: `/Users/pedrooliveira/Documents/goa2/goa2-frontend/src/components/board3d/maps/forgotten_island.ts`
- Modify: `/Users/pedrooliveira/Documents/goa2/goa2-frontend/src/components/board3d/Board3D.tsx`

**Step 1: Create the map config**

Create `src/components/board3d/maps/forgotten_island.ts`:

```ts
export interface MapConfig {
  name: string;
  imagePath: string;
  imageSize: number;   // world units the plane spans (square)
  hexSize: number;     // hex radius in world units (for later)
  origin: { x: number; z: number };  // where hex (0,0,0) sits
}

export const forgottenIsland: MapConfig = {
  name: "forgotten_island",
  imagePath: "/map/forgotten_island.png",
  imageSize: 10,        // 10x10 world units; tune in next task
  hexSize: 0.4,         // placeholder; calibrated in Task 5
  origin: { x: 0, z: 0 },
};
```

**Step 2: Create MapPlane component**

Create `src/components/board3d/MapPlane.tsx`:

```tsx
import { useTexture } from "@react-three/drei";
import type { MapConfig } from "./maps/forgotten_island";

interface Props {
  config: MapConfig;
}

export function MapPlane({ config }: Props) {
  const texture = useTexture(config.imagePath);

  return (
    <mesh
      receiveShadow
      rotation={[-Math.PI / 2, 0, 0]}
      position={[config.origin.x, 0.01, config.origin.z]}
    >
      <planeGeometry args={[config.imageSize, config.imageSize]} />
      <meshStandardMaterial map={texture} roughness={0.7} metalness={0} />
    </mesh>
  );
}
```

Plane lies flat on the table (rotated -90° around X). Sits at `y = 0.01` so it's just barely above the table plane — prevents z-fighting.

**Step 3: Add MapPlane to Board3D**

Modify `src/components/board3d/Board3D.tsx`:

- Add imports:
```tsx
import { MapPlane } from "./MapPlane";
import { forgottenIsland } from "./maps/forgotten_island";
```
- Replace the placeholder cube `<mesh position={[0, 0.5, 0]}...>` with:
```tsx
<MapPlane config={forgottenIsland} />
```

**Step 4: Visual verification**

Reload. Open `?3d=1`.

Verify:
- The forgotten_island map appears on the table
- It's centered (table edges visible around all sides)
- Orientation is right-side-up (rocks/water look natural from default view)
- Map size feels right relative to the table (not microscopic, not overflowing)
- Lighting still feels warm; map texture isn't washed out
- You can orbit + zoom around the map

If size feels wrong, tweak `imageSize` in `forgotten_island.ts` and reload.

**Step 5: Commit**

```bash
git add src/components/board3d/MapPlane.tsx src/components/board3d/maps/forgotten_island.ts src/components/board3d/Board3D.tsx && git commit -m "feat(3d): render forgotten_island map plane on table"
```

**Stop point:** Confirm with Pedro:
- "Map size right? Position right? Lighting flatters it?" → continue
- Adjust `imageSize` or material values before next task

---

## Task 5: Hex overlay calibration

**Why fifth:** Now that the map is locked in, we calibrate the cube→world transform so hex coordinates from the backend align with the painted hexes on the map image. One-time per map; cascades into every later feature.

**Files:**
- Create: `/Users/pedrooliveira/Documents/goa2/goa2-frontend/src/utils/hex3d.ts`
- Create: `/Users/pedrooliveira/Documents/goa2/goa2-frontend/src/components/board3d/HexOverlay.tsx`
- Modify: `/Users/pedrooliveira/Documents/goa2/goa2-frontend/src/components/board3d/Board3D.tsx`
- Modify: `/Users/pedrooliveira/Documents/goa2/goa2-frontend/src/components/board3d/maps/forgotten_island.ts` (calibration values)

**Step 1: Create hex→world utility**

Create `src/utils/hex3d.ts`:

```ts
import type { Hex } from "../types/game";
import type { MapConfig } from "../components/board3d/maps/forgotten_island";

// Flat-top hex layout, matching the existing src/utils/hex.ts logic
// but emitting 3D coordinates (x, z) on the map plane.
export function hexToWorld(hex: Hex, config: MapConfig): { x: number; z: number } {
  const size = config.hexSize;
  const x = config.origin.x + size * (3 / 2) * hex.q;
  const z = config.origin.z + size * (Math.sqrt(3) / 2 * hex.q + Math.sqrt(3) * hex.r);
  return { x, z };
}
```

**Step 2: Create HexOverlay component**

Create `src/components/board3d/HexOverlay.tsx`:

```tsx
import { useMemo } from "react";
import { useGameSocket } from "../../hooks/useGameSocket";
import { hexToWorld } from "../../utils/hex3d";
import { hexKey } from "../../utils/hex";
import { forgottenIsland } from "./maps/forgotten_island";
import * as THREE from "three";

interface Props {
  gameId: string;
  token: string;
}

export function HexOverlay({ gameId, token }: Props) {
  const { view } = useGameSocket(gameId, token);

  const tiles = useMemo(() => {
    if (!view) return [];
    return Object.values(view.board.tiles).filter((t) => !t.is_terrain);
  }, [view]);

  if (!view) return null;

  return (
    <group>
      {tiles.map((tile) => {
        const { x, z } = hexToWorld(tile.hex, forgottenIsland);
        return (
          <mesh
            key={hexKey(tile.hex)}
            position={[x, 0.02, z]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <circleGeometry args={[forgottenIsland.hexSize * 0.9, 6]} />
            <meshBasicMaterial color="#00ffff" transparent opacity={0.15} side={THREE.DoubleSide} />
          </mesh>
        );
      })}
    </group>
  );
}
```

For calibration, we draw flat translucent cyan hex outlines (6-sided circle = hex). They sit slightly above the map at `y = 0.02`.

**Note:** `HexOverlay` uses its own `useGameSocket` call which will create a duplicate connection. Acceptable for calibration; will be refactored in Task 6 / future tasks to share the connection.

**Step 3: Pass gameId/token to Board3D**

Modify `src/components/board3d/Board3D.tsx`:

- Update the function signature to accept props:
```tsx
interface Props {
  gameId: string;
  token: string;
}

export function Board3D({ gameId, token }: Props) {
```
- Add `<HexOverlay gameId={gameId} token={token} />` inside the `<Canvas>` after `<MapPlane>`.

Modify `src/components/pages/GameView.tsx`:

- Update the Board3D render to pass props:
```tsx
{use3D ? <Board3D gameId={gameId ?? ""} token={token} /> : (
  ...
)}
```

**Step 4: Calibration loop**

Make sure the backend is running and you have a real game URL with a valid token.

Open `http://localhost:5173/game/<real-game-id>?token=<real-token>&3d=1`.

Iterate on `forgotten_island.ts` values:
- If the hex grid is **too small** → increase `hexSize`
- If the hex grid is **too big** → decrease `hexSize`
- If the grid is **off-center** → adjust `origin.x` / `origin.z`
- Reload after each tweak

Goal: cyan hex outlines visually overlap the painted hex pattern on the map image. Tolerance: ~5% off is fine.

**Step 5: Commit calibrated values**

Once aligned:
```bash
git add src/utils/hex3d.ts src/components/board3d/HexOverlay.tsx src/components/board3d/Board3D.tsx src/components/board3d/maps/forgotten_island.ts src/components/pages/GameView.tsx && git commit -m "feat(3d): hex coordinate overlay calibrated to forgotten_island"
```

**Stop point:** Confirm with Pedro:
- "Hex outlines align with the painted map?" → continue
- Tweak calibration values further if needed

---

## Task 6: Hex hover + valid-target highlight + click

**Why sixth:** Last task in M1. This proves the input plumbing works in 3D — the foundation of every game interaction. After this, M1 is shippable.

**Files:**
- Modify: `/Users/pedrooliveira/Documents/goa2/goa2-frontend/src/components/board3d/HexOverlay.tsx`
- Refactor: pass `view` and `submitInput` from `GameView` rather than calling `useGameSocket` twice
- Modify: `/Users/pedrooliveira/Documents/goa2/goa2-frontend/src/components/board3d/Board3D.tsx`
- Modify: `/Users/pedrooliveira/Documents/goa2/goa2-frontend/src/components/pages/GameView.tsx`

**Step 1: Refactor — single socket, props flow**

In `GameView.tsx`, the existing `useGameSocket` call already returns `view`, `inputRequest`, `submitInput`, etc. Update the Board3D render to pass these as props:

```tsx
{use3D ? (
  <Board3D
    view={view}
    inputRequest={isMyInput ? inputRequest : null}
    onHexClick={handleHexClick}
    onUnitClick={handleUnitClick}
    myHeroId={myHeroId}
  />
) : ( ... )}
```

In `Board3D.tsx`, replace the gameId/token props with these:

```tsx
import type { GameView, InputRequest, Hex } from "../../types/game";

interface Props {
  view: GameView | null;
  inputRequest: InputRequest | null;
  onHexClick: (hex: Hex) => void;
  onUnitClick: (id: string) => void;
  myHeroId: string | null;
}

export function Board3D({ view, inputRequest, onHexClick }: Props) {
  ...
  {view && <HexOverlay view={view} inputRequest={inputRequest} onHexClick={onHexClick} />}
  ...
}
```

In `HexOverlay.tsx`, update to accept props instead of calling `useGameSocket`:

```tsx
import type { GameView, InputRequest, Hex } from "../../types/game";

interface Props {
  view: GameView;
  inputRequest: InputRequest | null;
  onHexClick: (hex: Hex) => void;
}

export function HexOverlay({ view, inputRequest, onHexClick }: Props) {
  // ... existing tile mapping logic ...
}
```

**Step 2: Add hover state + valid-target highlight**

In `HexOverlay.tsx`, replace the static circle with one that responds to hover and validity:

```tsx
import { useMemo, useState } from "react";
import { hexToWorld } from "../../utils/hex3d";
import { hexKey } from "../../utils/hex";
import { forgottenIsland } from "./maps/forgotten_island";
import * as THREE from "three";
import type { GameView, InputRequest, Hex } from "../../types/game";

interface Props {
  view: GameView;
  inputRequest: InputRequest | null;
  onHexClick: (hex: Hex) => void;
}

export function HexOverlay({ view, inputRequest, onHexClick }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);

  const tiles = useMemo(() => {
    return Object.values(view.board.tiles).filter((t) => !t.is_terrain);
  }, [view.board.tiles]);

  const validKeys = useMemo(() => {
    const set = new Set<string>();
    if (inputRequest?.valid_hexes) {
      for (const h of inputRequest.valid_hexes) set.add(hexKey(h));
    }
    return set;
  }, [inputRequest]);

  return (
    <group>
      {tiles.map((tile) => {
        const { x, z } = hexToWorld(tile.hex, forgottenIsland);
        const k = hexKey(tile.hex);
        const isValid = validKeys.has(k);
        const isHovered = hovered === k;

        const color = isValid ? "#00e5ff" : "#ffffff";
        const opacity = isValid ? 0.4 : (isHovered ? 0.2 : 0);

        return (
          <mesh
            key={k}
            position={[x, isHovered ? 0.05 : 0.02, z]}
            rotation={[-Math.PI / 2, 0, 0]}
            onPointerOver={(e) => { e.stopPropagation(); setHovered(k); }}
            onPointerOut={() => setHovered(null)}
            onClick={(e) => {
              e.stopPropagation();
              if (isValid) onHexClick(tile.hex);
            }}
          >
            <circleGeometry args={[forgottenIsland.hexSize * 0.9, 6]} />
            <meshBasicMaterial color={color} transparent opacity={opacity} side={THREE.DoubleSide} />
          </mesh>
        );
      })}
    </group>
  );
}
```

Behavior:
- Valid-target hexes (per `inputRequest.valid_hexes`) glow cyan, opacity 0.4, always visible.
- Non-valid hexes are invisible by default, faintly white on hover.
- Hovered hex lifts slightly (y from 0.02 → 0.05).
- Clicking a valid hex calls `onHexClick(hex)`.

**Step 3: Visual verification**

Reload. Open a real game URL with `?3d=1` where it's your turn for a SELECT_HEX input (e.g. movement).

Verify:
- Valid destination hexes glow cyan
- Hovering any hex (valid or not) shows a faint highlight
- Hovered hex visibly lifts
- Clicking a valid hex submits the input and the game progresses
- Clicking a non-valid hex does nothing

If you can't easily produce a SELECT_HEX state, also verify by visiting in PLANNING phase (no valid hexes) and confirming hover-only behavior works without errors.

**Step 4: Commit**

```bash
git add src/components/board3d/HexOverlay.tsx src/components/board3d/Board3D.tsx src/components/pages/GameView.tsx && git commit -m "feat(3d): hex hover, valid-target highlight, and click-to-submit"
```

**Stop point:** Confirm with Pedro:
- "Hover/click feels right? Cyan highlight visible enough? Lift on hover too much/little?" → M1 complete
- "Click registers in 3D and the game responds" → M1 complete
- Tweak colors / opacities / lift heights as needed

---

## M1 Definition of Done

- `?3d=1` URL flag toggles between old SVG view and new 3D scene
- Wooden table, warm lighting, soft shadows
- forgotten_island map plane sitting on the table
- Camera: left-pan, right-orbit, wheel-zoom, R-reset, table-floor clamp
- Hex overlays aligned with the painted map (cyan for valid targets, hover lift)
- Hex click submits input via the existing socket flow
- Old SVG view untouched and still functional without `?3d=1`
- 6 commits on `3d-board-rework`
- No console errors

## What M1 deliberately does NOT include

- Units / heroes / minions (M2)
- Tokens / board entities (M2)
- Player boards / mats / hands (M3, M4)
- 2D HUD changes (M3+)
- Sound (M7)
- Animations beyond OrbitControls damping (M6)

## After M1

Pause for wider review. Validate camera feel, aesthetic, hex calibration before planning M2 (units on hexes). Adjustments to lighting, materials, or camera limits are cheaper now than after M2+.
