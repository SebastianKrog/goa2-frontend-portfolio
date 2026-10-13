import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { hexKey } from "../../utils/hex";
import type { GameView, InputRequest, Hex } from "../../types/game";
import { hexToLocal } from "./maps/geometry";

interface Props {
  view: GameView;
  inputRequest: InputRequest | null;
  hexSize: number;
  originX: number;
  originZ: number;
  rotationDeg: number;
  onHexClick: (hex: Hex) => void;
  onUnitClick: (unitId: string) => void;
  onHoverHex?: (hex: Hex | null) => void;
  showAll?: boolean;
  previewHexes?: { path: Hex[]; mine_hexes: Hex[] } | null;
}

interface SelectionCueProps {
  radius: number;
  hovered: boolean;
}

function SelectionCue({ radius, hovered }: SelectionCueProps) {
  return (
    <>
      <mesh position={[0, 0.031, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <circleGeometry args={[radius, 6]} />
        <meshBasicMaterial color="#55d77b" transparent opacity={hovered ? 0.34 : 0.22} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.038, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <ringGeometry args={[radius * 0.78, radius, 6]} />
        <meshBasicMaterial color="#9affae" transparent opacity={hovered ? 1 : 0.88} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </>
  );
}

export function HexOverlay({
  view, inputRequest, hexSize, originX, originZ, rotationDeg, onHexClick, onUnitClick, onHoverHex, showAll = false, previewHexes = null,
}: Props) {
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => () => {
    document.body.style.cursor = "";
  }, []);

  const validKeys = useMemo(() => {
    const set = new Set<string>();
    if (inputRequest?.valid_hexes) {
      for (const h of inputRequest.valid_hexes) set.add(hexKey(h));
    }
    return set;
  }, [inputRequest]);

  const tiles = useMemo(() => {
    return Object.values(view.board.tiles).filter((t) => !t.is_terrain || validKeys.has(hexKey(t.hex)));
  }, [view.board.tiles, validKeys]);

  const validUnitIds = useMemo(() => {
    const set = new Set<string>();
    if (
      inputRequest?.type === "SELECT_UNIT" ||
      inputRequest?.type === "SELECT_UNIT_OR_TOKEN"
    ) {
      for (const opt of (inputRequest.valid_options as string[] | undefined) ?? []) {
        set.add(opt);
      }
    }
    return set;
  }, [inputRequest]);

  const previewPathSet = useMemo(() => new Set((previewHexes?.path ?? []).map(hexKey)), [previewHexes]);
  const previewMineSet = useMemo(() => new Set((previewHexes?.mine_hexes ?? []).map(hexKey)), [previewHexes]);

  const rotationRad = (rotationDeg * Math.PI) / 180;
  const currentActorId = view.current_actor_id;
  const r = hexSize * 0.9;

  return (
    <group position={[originX, 0, originZ]} rotation={[0, rotationRad, 0]}>
      {tiles.map((tile) => {
        const [x, z] = hexToLocal(tile.hex, hexSize);
        const k = hexKey(tile.hex);
        const isValidHex = validKeys.has(k);
        const isValidUnit = tile.occupant_id ? validUnitIds.has(tile.occupant_id) : false;
        const isValid = isValidHex || isValidUnit;
        const isHovered = hovered === k;
        const isCurrentActor = !!tile.occupant_id && tile.occupant_id === currentActorId;
        const isPreviewPath = !isValid && previewPathSet.has(k);
        const isPreviewMine = !isValid && previewMineSet.has(k);

        // The hit layer stays mostly invisible; valid/current-actor cues are drawn
        // as their own coloured meshes on top (matching the 2D colour language).
        const hitOpacity = showAll ? (isHovered ? 0.28 : 0.12) : (isHovered ? 0.18 : 0);

        return (
          <group key={k} position={[x, 0, z]}>
            <mesh
              position={[0, isHovered ? 0.05 : 0.02, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
              onPointerOver={(e) => {
                e.stopPropagation();
                setHovered(k);
                onHoverHex?.(tile.hex);
                if (isValid) document.body.style.cursor = "pointer";
              }}
              onPointerOut={() => {
                document.body.style.cursor = "";
                setHovered((prev) => {
                  if (prev === k) {
                    onHoverHex?.(null);
                    return null;
                  }
                  return prev;
                });
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (isValidUnit && tile.occupant_id) {
                  onUnitClick(tile.occupant_id);
                } else if (isValidHex) {
                  onHexClick(tile.hex);
                }
              }}
            >
              <circleGeometry args={[r, 6]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={hitOpacity} side={THREE.DoubleSide} depthWrite={false} />
            </mesh>

            {isValid && (
              <SelectionCue radius={r} hovered={isHovered} />
            )}

            {isPreviewPath && (
              <mesh position={[0, 0.032, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
                <ringGeometry args={[r * 0.82, r, 6]} />
                <meshBasicMaterial color="#50a0ff" transparent opacity={0.9} side={THREE.DoubleSide} depthWrite={false} />
              </mesh>
            )}

            {isPreviewMine && (
              <mesh position={[0, 0.033, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
                <ringGeometry args={[r * 0.82, r, 6]} />
                <meshBasicMaterial color="#ff5050" transparent opacity={0.9} side={THREE.DoubleSide} depthWrite={false} />
              </mesh>
            )}

            {isCurrentActor && (
              <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
                <ringGeometry args={[r * 0.86, r * 1.02, 6]} />
                <meshBasicMaterial color="#ffd23f" transparent opacity={0.95} side={THREE.DoubleSide} depthWrite={false} />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}
