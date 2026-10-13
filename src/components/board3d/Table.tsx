import { MIN_TABLE_HALF_EXTENT } from "./seating";

interface Props {
  /** Half-width of the slab; the table is square and centred on the map. */
  halfExtent?: number;
}

const RAIL_INSET = 0.28;
const RAIL_THICKNESS = 0.22;

export function Table({ halfExtent = MIN_TABLE_HALF_EXTENT }: Props) {
  const size = halfExtent * 2;
  const railSpan = size - 0.2;
  const railAt = halfExtent - RAIL_INSET;

  return (
    <group>
      {/* Deep backdrop keeps the edge of the physical table intentional when
          the player pulls the camera back. */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.43, 0]}>
        <planeGeometry args={[size * 6, size * 6]} />
        <meshStandardMaterial color="#07090d" roughness={1} metalness={0} />
      </mesh>

      {/* A real slab reads much better than the former infinite brown plane:
          shadows now fall over an edge and the play space has a clear frame. */}
      <mesh receiveShadow castShadow position={[0, -0.24, 0]}>
        <boxGeometry args={[size, 0.42, size]} />
        <meshStandardMaterial color="#2d1b10" roughness={0.88} metalness={0.03} />
      </mesh>
      <mesh receiveShadow position={[0, -0.013, 0]}>
        <boxGeometry args={[size - 0.45, 0.02, size - 0.45]} />
        <meshStandardMaterial color="#452919" roughness={0.82} metalness={0.02} />
      </mesh>

      {/* Slim rails catch the warm key light and visually contain pieces near
          the perimeter without stealing space from player mats. */}
      <mesh castShadow receiveShadow position={[0, 0.09, -railAt]}>
        <boxGeometry args={[railSpan, 0.18, RAIL_THICKNESS]} />
        <meshStandardMaterial color="#1b100a" roughness={0.72} metalness={0.08} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 0.09, railAt]}>
        <boxGeometry args={[railSpan, 0.18, RAIL_THICKNESS]} />
        <meshStandardMaterial color="#1b100a" roughness={0.72} metalness={0.08} />
      </mesh>
      <mesh castShadow receiveShadow position={[-railAt, 0.09, 0]}>
        <boxGeometry args={[RAIL_THICKNESS, 0.18, railSpan]} />
        <meshStandardMaterial color="#1b100a" roughness={0.72} metalness={0.08} />
      </mesh>
      <mesh castShadow receiveShadow position={[railAt, 0.09, 0]}>
        <boxGeometry args={[RAIL_THICKNESS, 0.18, railSpan]} />
        <meshStandardMaterial color="#1b100a" roughness={0.72} metalness={0.08} />
      </mesh>
    </group>
  );
}
