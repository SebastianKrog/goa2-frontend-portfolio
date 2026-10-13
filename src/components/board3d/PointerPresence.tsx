import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { GameView, RemotePointer } from "../../types/game";
import { heroPresentation } from "../../utils/pings";
import { MAP_HALF_WIDTH, type SeatPlacement } from "./seating";
import { BOARD_ZONES, type BoardZone, zoneAnchor, zoneAtPoint } from "./boardZones";
import styles from "./PointerPresence.module.css";

/**
 * What the sender reports: either a point on the shared map (world space,
 * meaningful on every client) or the board zone being hovered — seat layouts
 * differ per client, so only the semantic target survives the trip.
 */
export type WorldPointerReport =
  | { x: number; z: number }
  | { target_hero_id: string; zone: BoardZone }
  | null;

/**
 * Sender side. Raycasts the local pointer from the camera onto the table
 * plane (y=0) and classifies the hit: over a hero's board it reports that
 * zone; over the shared map it reports world-space coordinates; anywhere
 * else (empty table whose position depends on the viewer's seating) it
 * hides, since no client-independent meaning exists there.
 */
export function PointerProjector({
  onWorldPointer,
  placements,
}: {
  onWorldPointer: (report: WorldPointerReport) => void;
  placements: SeatPlacement[];
}) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    const canvas = gl.domElement;
    const raycaster = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const ndc = new THREE.Vector2();
    const hit = new THREE.Vector3();

    const report = (x: number, z: number) => {
      const zoneHit = zoneAtPoint(x, z, placements);
      if (zoneHit) {
        onWorldPointer({ target_hero_id: zoneHit.hero_id, zone: zoneHit.zone });
      } else if (Math.abs(x) <= MAP_HALF_WIDTH && Math.abs(z) <= MAP_HALF_WIDTH) {
        onWorldPointer({ x, z });
      } else {
        onWorldPointer(null);
      }
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      ndc.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
      if (raycaster.ray.intersectPlane(plane, hit)) {
        report(hit.x, hit.z);
      } else {
        onWorldPointer(null);
      }
    };
    const onLeave = () => onWorldPointer(null);

    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    return () => {
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
    };
  }, [camera, gl, onWorldPointer, placements]);

  return null;
}

const LERP_RATE = 8;

// Classic arrow glyph, shared by the 3D (HTML) and 2D (SVG) renderers.
export const CURSOR_PATH = "M2 1l16 11.5-7.4 1.4 3.6 7.6-3.4 1.6-3.9-7.8L2 21V1z";

interface MarkerProps {
  at: { x: number; y: number; z: number };
  color: string;
  label: string;
}

function RemoteMarker({ at, color, label }: MarkerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const destRef = useRef(new THREE.Vector3(at.x, at.y, at.z));

  useEffect(() => {
    destRef.current.set(at.x, at.y, at.z);
  }, [at.x, at.y, at.z]);

  useFrame((_, deltaMs) => {
    const group = groupRef.current;
    if (!group) return;
    // Frame-rate independent exponential smoothing toward the latest report.
    const k = 1 - Math.exp(-deltaMs * LERP_RATE);
    group.position.lerp(destRef.current, k);
  });

  return (
    <group ref={groupRef} position={[at.x, at.y, at.z]}>
      <Html zIndexRange={[45, 0]} style={{ pointerEvents: "none" }}>
        <div
          className={styles.cursor}
          style={{ "--cursor-color": color } as React.CSSProperties}
        >
          <svg className={styles.arrow} width="19" height="19" viewBox="0 0 24 24">
            <path
              d={CURSOR_PATH}
              fill="var(--cursor-color)"
              fillOpacity={0.14}
              stroke="var(--cursor-color)"
              strokeOpacity={0.5}
              strokeWidth={1.6}
              strokeLinejoin="round"
            />
          </svg>
          <span className={styles.label}>{label}</span>
        </div>
      </Html>
    </group>
  );
}

/** Resolve a pointer to world coordinates in this client's seating. */
function resolvePointer(
  pointer: RemotePointer,
  placements: SeatPlacement[],
): { x: number; y: number; z: number } | null {
  if (pointer.kind === "point") return { x: pointer.x, y: 0, z: pointer.z };
  if (!BOARD_ZONES.has(pointer.zone)) return null;
  return zoneAnchor(pointer.target_hero_id, pointer.zone as BoardZone, placements);
}

/** Receiver side: one remote mouse cursor per other player's pointer. */
export function RemotePointers3D({
  pointers,
  view,
  placements,
}: {
  pointers: Record<string, RemotePointer>;
  view: GameView;
  placements: SeatPlacement[];
}) {
  const markers = Object.entries(pointers).flatMap(([heroId, pointer]) => {
    const at = resolvePointer(pointer, placements);
    if (!at) return [];
    const presentation = heroPresentation(view, heroId);
    return [{ key: heroId, at, ...presentation }];
  });

  return (
    <>
      {markers.map(({ key, at, color, label }) => (
        <RemoteMarker key={key} at={at} color={color} label={label} />
      ))}
    </>
  );
}
