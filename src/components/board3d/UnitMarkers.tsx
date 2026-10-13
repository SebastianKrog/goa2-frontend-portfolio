import { Suspense } from "react";
import { Billboard, useTexture } from "@react-three/drei";

const MARKER_ICONS: Record<string, string> = {
  poison: "/icons/marker_poison.png",
  bounty: "/icons/marker_bounty.png",
};

interface Props {
  markers: { type: string; value: number }[];
  /** Unit base position in the board group's local space. */
  position: [number, number, number];
  /** How high above the base the icon row floats. */
  height?: number;
}

const ICON_SIZE = 0.22;
const ICON_GAP = ICON_SIZE * 1.1;
const ICON_OPACITY = 0.7;

function MarkerIcon({ url, x }: { url: string; x: number }) {
  const tex = useTexture(url);
  return (
    <mesh position={[x, 0, 0]}>
      <planeGeometry args={[ICON_SIZE, ICON_SIZE]} />
      <meshBasicMaterial map={tex} transparent opacity={ICON_OPACITY} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

// Status markers (poison, bounty, ...) shown above a unit — the 3D equivalent of
// the 2D UnitToken markers. The icons billboard to face the camera, and a faint
// vertical stem ties them to the exact unit below so ownership stays clear from
// any camera angle (a floating icon alone reads ambiguously at shallow angles).
export function UnitMarkers({ markers, position, height = 1.3 }: Props) {
  const known = markers.filter((m) => MARKER_ICONS[m.type]);
  if (known.length === 0) return null;

  const totalW = (known.length - 1) * ICON_GAP;
  return (
    <group position={position}>
      <mesh position={[0, height / 2, 0]}>
        <cylinderGeometry args={[0.01, 0.01, height, 6]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.28} depthWrite={false} toneMapped={false} />
      </mesh>
      <Billboard position={[0, height, 0]}>
        <Suspense fallback={null}>
          {known.map((m, i) => (
            <MarkerIcon key={m.type} url={MARKER_ICONS[m.type]} x={-totalW / 2 + i * ICON_GAP} />
          ))}
        </Suspense>
      </Billboard>
    </group>
  );
}
