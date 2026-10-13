import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

interface Props {
  position: [number, number, number];
  color: string;
  label: string;
  receivedAtMs: number;
  stackIndex?: number;
}

const FADE_START_MS = 2700;
const LIFETIME_MS = 3600;

/** A TTS-style bobbing arrow, expanding ground ring, and pinger nameplate. */
export function PingMarker3D({
  position,
  color,
  label,
  receivedAtMs,
  stackIndex = 0,
}: Props) {
  const floatRef = useRef<THREE.Group>(null);
  const arrowMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const coneMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const ringMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const reducedMotionRef = useRef(window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  useFrame((state) => {
    const age = Date.now() - receivedAtMs;
    const fade = age <= FADE_START_MS
      ? 1
      : Math.max(0, 1 - (age - FADE_START_MS) / (LIFETIME_MS - FADE_START_MS));
    const reducedMotion = reducedMotionRef.current;
    const pulse = reducedMotion ? 1 : 1 + 0.12 * Math.sin(state.clock.elapsedTime * 7 + stackIndex);
    if (floatRef.current) {
      floatRef.current.position.y = 0.62 + stackIndex * 0.12
        + (reducedMotion ? 0 : 0.06 * Math.sin(state.clock.elapsedTime * 5));
      if (!reducedMotion) floatRef.current.rotation.y += 0.018;
      floatRef.current.scale.setScalar(pulse);
    }
    if (arrowMaterialRef.current) arrowMaterialRef.current.opacity = fade;
    if (coneMaterialRef.current) coneMaterialRef.current.opacity = 0.95 * fade;
    if (ringMaterialRef.current) ringMaterialRef.current.opacity = 0.7 * fade;
    if (ringRef.current) {
      const ringScale = reducedMotion ? 1 : 1 + ((age % 900) / 900) * 0.8;
      ringRef.current.scale.setScalar(ringScale);
    }
    if (labelRef.current) labelRef.current.style.opacity = String(fade);
  });

  return (
    <group position={position}>
      <mesh ref={ringRef} position={[0, 0.045, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <ringGeometry args={[0.14, 0.19, 32]} />
        <meshBasicMaterial
          ref={ringMaterialRef}
          color={color}
          transparent
          opacity={0.7}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <group ref={floatRef}>
        <mesh position={[0, 0.12, 0]} raycast={() => null}>
          <cylinderGeometry args={[0.035, 0.035, 0.28, 12]} />
          <meshBasicMaterial ref={arrowMaterialRef} color={color} transparent opacity={1} depthTest={false} />
        </mesh>
        <mesh position={[0, -0.09, 0]} rotation={[0, 0, Math.PI]} raycast={() => null}>
          <coneGeometry args={[0.11, 0.22, 16]} />
          <meshBasicMaterial ref={coneMaterialRef} color={color} transparent opacity={0.95} depthTest={false} />
        </mesh>
        <Html center position={[0, 0.42, 0]} zIndexRange={[80, 0]} style={{ pointerEvents: "none" }}>
          <div
            ref={labelRef}
            aria-hidden="true"
            style={{
              padding: "3px 8px",
              color: "#fff",
              border: `1px solid ${color}`,
              borderRadius: 999,
              background: "rgba(7, 9, 13, 0.88)",
              boxShadow: `0 0 18px ${color}55`,
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.04em",
              lineHeight: 1.3,
              textShadow: "0 1px 2px #000",
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </div>
        </Html>
      </group>
    </group>
  );
}
