import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface Props {
  /** Centre of the glow, on the mat surface (just under the card). */
  position: [number, number, number];
  rotationY: number;
  width: number;
  height: number;
}

// Soft radial golden glow texture, built once and shared.
let glowTex: THREE.CanvasTexture | null = null;
function getGlowTexture(): THREE.CanvasTexture {
  if (glowTex) return glowTex;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 64);
  g.addColorStop(0, "rgba(255,224,130,0.95)");
  g.addColorStop(0.45, "rgba(255,200,80,0.4)");
  g.addColorStop(1, "rgba(255,190,70,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

// A gently-pulsing golden glow pooled around the card currently being resolved,
// to draw the eye to it during the resolution phase.
export function ResolveSpotlight({ position, rotationY, width, height }: Props) {
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  useFrame((state) => {
    if (matRef.current) {
      matRef.current.opacity = 0.5 + 0.25 * Math.sin(state.clock.elapsedTime * 3);
    }
  });
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, rotationY]} raycast={() => null}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial
        ref={matRef}
        map={getGlowTexture()}
        color="#ffd23f"
        transparent
        opacity={0.6}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
