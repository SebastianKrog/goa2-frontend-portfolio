import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { EffectView, GameView, Hex } from "../../types/game";
import { splitLineTiles } from "../../utils/realitySplit";
import { hexToLocal } from "./maps/geometry";

interface Props {
  /** An active topology_split / topology_isolation effect with a split line. */
  effect: EffectView;
  view: GameView;
  hexSize: number;
  originX: number;
  originZ: number;
  rotationDeg: number;
}

/** Deterministic pseudo-random in [-1, 1] from a hex + salt, stable across renders. */
const jitter = (q: number, r: number, salt: number): number => {
  const x = Math.sin(q * 127.1 + r * 311.7 + salt * 74.7) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
};

/**
 * The lasting on-board visual for NebKher's reality splits: a jagged violet
 * fissure running the length of the split line for as long as the effect is in
 * `view.effects` (the rest of the turn). Purely state-driven, so spectators and
 * reconnecting players see it too. `topology_isolation` (Shift Reality) also
 * pulses an isolation ring on NebKher's own tile — he is cut off from both
 * sides, not just standing on the bridge.
 */
export function RealityCrackEffect({ effect, view, hexSize, originX, originZ, rotationDeg }: Props) {
  const rotationRad = (rotationDeg * Math.PI) / 180;
  const coreMat = useRef<THREE.MeshBasicMaterial>(null);
  const glowMat = useRef<THREE.MeshBasicMaterial>(null);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null);
  const ringMesh = useRef<THREE.Mesh>(null);

  const lineHexes = useMemo(() => {
    const axis = effect.split_axis;
    if (!axis) return [];
    const hexes = splitLineTiles(view.board.tiles, axis, effect.split_value ?? 0);
    // Order the tiles along the line so the fissure is one continuous run.
    const sortKey: keyof Hex = axis === "q" ? "r" : "q";
    return [...hexes].sort((a, b) => a[sortKey] - b[sortKey]);
  }, [effect.split_axis, effect.split_value, view.board.tiles]);

  // NebKher's tile, for the Shift Reality isolation ring.
  const isolatedHex = useMemo(() => {
    if (effect.type !== "topology_isolation") return null;
    const originId = effect.scope.origin_id;
    if (!originId) return null;
    const tile = Object.values(view.board.tiles).find((t) => t.occupant_id === originId);
    return tile ? tile.hex : null;
  }, [effect.type, effect.scope.origin_id, view.board.tiles]);

  // One jagged ribbon through the tile centers: centers plus midpoints, each
  // displaced perpendicular to the line by a hex-seeded offset so the crack is
  // crooked but never shimmers between renders.
  const { coreGeom, glowGeom } = useMemo(() => {
    const build = (width: number): THREE.BufferGeometry | null => {
      if (lineHexes.length < 2) return null;
      const pts: Array<[number, number]> = [];
      for (let i = 0; i < lineHexes.length; i++) {
        const [x, z] = hexToLocal(lineHexes[i], hexSize);
        pts.push([x, z]);
        if (i < lineHexes.length - 1) {
          const [nx, nz] = hexToLocal(lineHexes[i + 1], hexSize);
          pts.push([(x + nx) / 2, (z + nz) / 2]);
        }
      }
      // Perpendicular of the overall line direction (the line is straight, so
      // one perp serves every point).
      const [sx, sz] = pts[0];
      const [ex, ez] = pts[pts.length - 1];
      const dlen = Math.hypot(ex - sx, ez - sz) || 1;
      const px = -(ez - sz) / dlen;
      const pz = (ex - sx) / dlen;

      const jagged = pts.map(([x, z], i) => {
        // Endpoints stay put so the crack spans tip to tip.
        const amp = i === 0 || i === pts.length - 1 ? 0 : hexSize * 0.24;
        const off = jitter(lineHexes[0].q + i, lineHexes[0].r - i, 1) * amp;
        return [x + px * off, z + pz * off] as [number, number];
      });

      const positions: number[] = [];
      for (let i = 0; i < jagged.length - 1; i++) {
        const [ax, az] = jagged[i];
        const [bx, bz] = jagged[i + 1];
        const wA = width * (0.6 + 0.4 * Math.abs(jitter(i, 3, 2)));
        const wB = width * (0.6 + 0.4 * Math.abs(jitter(i + 1, 3, 2)));
        const aL: [number, number] = [ax + px * wA, az + pz * wA];
        const aR: [number, number] = [ax - px * wA, az - pz * wA];
        const bL: [number, number] = [bx + px * wB, bz + pz * wB];
        const bR: [number, number] = [bx - px * wB, bz - pz * wB];
        positions.push(aL[0], 0, aL[1], aR[0], 0, aR[1], bL[0], 0, bL[1]);
        positions.push(aR[0], 0, aR[1], bR[0], 0, bR[1], bL[0], 0, bL[1]);
      }
      const geom = new THREE.BufferGeometry();
      geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      return geom;
    };
    return { coreGeom: build(hexSize * 0.09), glowGeom: build(hexSize * 0.28) };
  }, [lineHexes, hexSize]);

  // Geometries passed via the `geometry` prop are not auto-disposed by r3f.
  useEffect(() => {
    return () => {
      coreGeom?.dispose();
      glowGeom?.dispose();
    };
  }, [coreGeom, glowGeom]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
    if (coreMat.current) coreMat.current.opacity = 0.8 + 0.2 * pulse;
    if (glowMat.current) glowMat.current.opacity = 0.22 + 0.14 * pulse;
    if (ringMat.current) ringMat.current.opacity = 0.55 + 0.35 * pulse;
    if (ringMesh.current) {
      const s = 1 + 0.08 * pulse;
      ringMesh.current.scale.set(s, s, 1);
    }
  });

  if (!coreGeom || !glowGeom) return null;
  const ringPos = isolatedHex ? hexToLocal(isolatedHex, hexSize) : null;

  return (
    <group position={[originX, 0, originZ]} rotation={[0, rotationRad, 0]}>
      {/* Faint violet wash on the line's tiles: the bridge between both sides. */}
      {lineHexes.map((hex) => {
        const [x, z] = hexToLocal(hex, hexSize);
        return (
          <mesh key={`${hex.q},${hex.r}`} position={[x, 0.025, z]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
            <circleGeometry args={[hexSize * 0.9, 6]} />
            <meshBasicMaterial color="#6a3fb5" transparent opacity={0.14} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        );
      })}
      {/* Soft under-glow, then the bright crack core. */}
      <mesh geometry={glowGeom} position={[0, 0.04, 0]} raycast={() => null}>
        <meshBasicMaterial
          ref={glowMat}
          color="#9b5cff"
          transparent
          opacity={0.28}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh geometry={coreGeom} position={[0, 0.05, 0]} raycast={() => null}>
        <meshBasicMaterial
          ref={coreMat}
          color="#e6d4ff"
          transparent
          opacity={0.9}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* Shift Reality only: NebKher is severed from both sides. */}
      {ringPos && (
        <mesh ref={ringMesh} position={[ringPos[0], 0.06, ringPos[1]]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
          <ringGeometry args={[hexSize * 0.62, hexSize * 0.74, 48]} />
          <meshBasicMaterial
            ref={ringMat}
            color="#c9a6ff"
            transparent
            opacity={0.7}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}
    </group>
  );
}
