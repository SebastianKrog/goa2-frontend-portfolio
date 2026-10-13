import { useMemo, useState } from "react";
import * as THREE from "three";
import type { Hex } from "../../types/game";
import { DIRECTION_VECTORS } from "../../utils/direction";
import { hexToLocal } from "./maps/geometry";

interface Props {
  /** Hex the directions radiate from (the acting hero's hex). */
  originHex: Hex;
  hexSize: number;
  originX: number;
  originZ: number;
  rotationDeg: number;
  /** Send the chosen direction index (0-5) as a string, mirroring the dock. */
  onSelect: (value: string) => void;
}

/**
 * Paints the six engine directions as clickable arrows (plus a glow on the
 * neighbor hex) radiating from the acting hero, so the player picks a direction
 * by clicking it on the board instead of decoding NE..NW chips. The option index
 * is the direction index, so clicking sends `onSelect(String(index))` — the same
 * path the PickerDock chips use. Because the click lands on the visually-correct
 * neighbor, board rotation can never cause a label/direction mismatch.
 */
export function DirectionOverlay({ originHex, hexSize, originX, originZ, rotationDeg, onSelect }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);
  const rotationRad = (rotationDeg * Math.PI) / 180;
  const r = hexSize * 0.9;

  const arrows = useMemo(() => {
    const [ox, oz] = hexToLocal(originHex, hexSize);
    return DIRECTION_VECTORS.map((_, i) => {
      const neighbor: Hex = {
        q: originHex.q + DIRECTION_VECTORS[i].q,
        r: originHex.r + DIRECTION_VECTORS[i].r,
        s: originHex.s + DIRECTION_VECTORS[i].s,
      };
      const [nx, nz] = hexToLocal(neighbor, hexSize);
      const dx = nx - ox;
      const dz = nz - oz;
      const dist = Math.hypot(dx, dz) || 1;
      const ux = dx / dist;
      const uz = dz / dist;
      // Perpendicular in the ground plane.
      const px = -uz;
      const pz = ux;

      const halfW = hexSize * 0.34;
      const tipX = ox + ux * dist * 0.94;
      const tipZ = oz + uz * dist * 0.94;
      const baseX = ox + ux * dist * 0.42;
      const baseZ = oz + uz * dist * 0.42;

      const positions = new Float32Array([
        tipX, 0, tipZ,
        baseX + px * halfW, 0, baseZ + pz * halfW,
        baseX - px * halfW, 0, baseZ - pz * halfW,
      ]);

      return { index: i, positions, nx, nz };
    });
  }, [originHex, hexSize]);

  return (
    <group position={[originX, 0, originZ]} rotation={[0, rotationRad, 0]}>
      {arrows.map(({ index, positions, nx, nz }) => {
        const isHovered = hovered === index;
        const onEnter = (e: { stopPropagation: () => void }) => {
          e.stopPropagation();
          setHovered(index);
        };
        const onLeave = () => setHovered((p) => (p === index ? null : p));
        const pick = (e: { stopPropagation: () => void }) => {
          e.stopPropagation();
          onSelect(String(index));
        };

        return (
          <group key={index}>
            {/* Glow on the neighbor hex (matches HexOverlay's valid-hex language). */}
            <mesh
              position={[nx, 0.03, nz]}
              rotation={[-Math.PI / 2, 0, 0]}
              onPointerOver={onEnter}
              onPointerOut={onLeave}
              onClick={pick}
            >
              <circleGeometry args={[r, 6]} />
              <meshBasicMaterial color="#4caf50" transparent opacity={isHovered ? 0.42 : 0.22} side={THREE.DoubleSide} depthWrite={false} />
            </mesh>
            <mesh position={[nx, 0.035, nz]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
              <ringGeometry args={[r * 0.82, r, 6]} />
              <meshBasicMaterial color="#7bed8a" transparent opacity={isHovered ? 1 : 0.85} side={THREE.DoubleSide} depthWrite={false} />
            </mesh>

            {/* Outward arrow toward the neighbor. */}
            <mesh
              position={[0, 0.06, 0]}
              onPointerOver={onEnter}
              onPointerOut={onLeave}
              onClick={pick}
            >
              <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[positions, 3]} />
              </bufferGeometry>
              <meshBasicMaterial color={isHovered ? "#aaffb0" : "#7bed8a"} transparent opacity={isHovered ? 1 : 0.9} side={THREE.DoubleSide} depthWrite={false} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
