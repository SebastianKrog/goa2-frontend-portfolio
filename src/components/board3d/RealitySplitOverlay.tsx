import { useMemo, useState } from "react";
import * as THREE from "three";
import type { Hex, InputOption, InputRequest, TileView } from "../../types/game";
import { axisFromOptionText, splitLineTiles, type SplitAxis } from "../../utils/realitySplit";
import { hexToLocal } from "./maps/geometry";

interface Props {
  request: InputRequest;
  tiles: Record<string, TileView>;
  /** Hex the three candidate lines cross (the acting hero's hex). */
  originHex: Hex;
  hexSize: number;
  originX: number;
  originZ: number;
  rotationDeg: number;
  /** Send the chosen option id, mirroring the dock. */
  onSelect: (value: string) => void;
}

const hexKey = (h: Hex) => `${h.q},${h.r}`;

/**
 * Paints NebKher's three candidate reality-split lines (constant q/r/s through
 * his hex) as rows of clickable tile glows, so the player picks the line on the
 * board instead of decoding "q-axis" chips. Hovering any tile lights its whole
 * line in the crack's violet — a preview of the fissure to come — and clicking
 * sends that option's id through `onSelect`, the same path the dock chips use.
 * The shared origin hex is drawn once, non-interactive, since all three lines
 * cross there and a click on it would be ambiguous.
 */
export function RealitySplitOverlay({
  request,
  tiles,
  originHex,
  hexSize,
  originX,
  originZ,
  rotationDeg,
  onSelect,
}: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const rotationRad = (rotationDeg * Math.PI) / 180;
  const r = hexSize * 0.9;

  const lines = useMemo(() => {
    const opts = (request.options as InputOption[] | undefined) ?? [];
    const origin = hexKey(originHex);
    return opts.flatMap((opt) => {
      const axis = axisFromOptionText(opt.text ?? "");
      if (!axis) return [];
      const lineTiles = splitLineTiles(tiles, axis as SplitAxis, originHex[axis]).filter(
        (h) => hexKey(h) !== origin,
      );
      return [{ id: opt.id, tiles: lineTiles }];
    });
  }, [request, tiles, originHex]);

  const [cx, cz] = hexToLocal(originHex, hexSize);

  return (
    <group position={[originX, 0, originZ]} rotation={[0, rotationRad, 0]}>
      {/* Shared crossing point: visual anchor only, never clickable. */}
      <mesh position={[cx, 0.03, cz]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <circleGeometry args={[r, 6]} />
        <meshBasicMaterial color="#b388ff" transparent opacity={0.3} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {lines.map(({ id, tiles: lineTiles }) => {
        const isHovered = hoveredId === id;
        const onEnter = (e: { stopPropagation: () => void }) => {
          e.stopPropagation();
          setHoveredId(id);
        };
        const onLeave = () => setHoveredId((p) => (p === id ? null : p));
        const pick = (e: { stopPropagation: () => void }) => {
          e.stopPropagation();
          onSelect(id);
        };
        return (
          <group key={id}>
            {lineTiles.map((hex) => {
              const [x, z] = hexToLocal(hex, hexSize);
              return (
                <group key={hexKey(hex)}>
                  <mesh
                    position={[x, 0.03, z]}
                    rotation={[-Math.PI / 2, 0, 0]}
                    onPointerOver={onEnter}
                    onPointerOut={onLeave}
                    onClick={pick}
                  >
                    <circleGeometry args={[r, 6]} />
                    <meshBasicMaterial
                      color={isHovered ? "#b388ff" : "#4caf50"}
                      transparent
                      opacity={isHovered ? 0.5 : 0.18}
                      side={THREE.DoubleSide}
                      depthWrite={false}
                    />
                  </mesh>
                  <mesh position={[x, 0.035, z]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
                    <ringGeometry args={[r * 0.82, r, 6]} />
                    <meshBasicMaterial
                      color={isHovered ? "#d8c2ff" : "#7bed8a"}
                      transparent
                      opacity={isHovered ? 1 : 0.6}
                      side={THREE.DoubleSide}
                      depthWrite={false}
                    />
                  </mesh>
                </group>
              );
            })}
          </group>
        );
      })}
    </group>
  );
}
