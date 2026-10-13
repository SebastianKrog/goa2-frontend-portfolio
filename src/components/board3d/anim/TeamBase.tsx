import * as THREE from "three";

/** Literal hex equivalents of the --team-* CSS vars, for use in 3D materials. */
export const TEAM_BASE_COLORS: Record<string, string> = {
  RED: "#e53935",
  BLUE: "#1e88e5",
};

export interface TeamBaseConfig {
  radius: number;
  ringInnerFrac: number; // inner radius as a fraction of radius (→1 = thinner)
  ringOpacity: number;
  fillOpacity: number;
  y: number; // height above the map, to avoid z-fighting
}

export const DEFAULT_TEAM_BASE: TeamBaseConfig = {
  radius: 0.2,
  ringInnerFrac: 0.765,
  ringOpacity: 0.72,
  fillOpacity: 0.27,
  y: 0.025,
};

/**
 * A flat team-colored ring (with a faint fill) that sits on the table under a
 * figurine — the 3D equivalent of a painted miniature base. Lies in the xz
 * plane; the caller keeps it grounded under the unit while the figure itself
 * lifts during movement, so it reads from the default top-down view.
 */
export function TeamBase({
  color,
  radius,
  ringInnerFrac,
  ringOpacity,
  fillOpacity,
}: { color: string } & Omit<TeamBaseConfig, "y">) {
  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      <mesh>
        <circleGeometry args={[radius * ringInnerFrac, 40]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={fillOpacity}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      <mesh>
        <ringGeometry args={[radius * ringInnerFrac, radius, 48]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={ringOpacity}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
