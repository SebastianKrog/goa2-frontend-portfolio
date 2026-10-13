import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { cloneHeroScene } from "./heroMaterials";

/**
 * How fast a figure pivots to face a new heading, in radians/sec. The turn is a
 * constant angular sweep (clamped per frame) so the model rotates like a unit
 * pivoting on the spot rather than snapping instantly when its facing changes.
 */
const TURN_RATE = 6.0;

interface Props {
  gltfPath: string;
  position: [number, number, number];
  scale?: number;
  xOffset?: number;
  yOffset?: number;
  zOffset?: number;
  rotationDeg?: number;
  /** Per-model base-color multiplier used to reveal dark painted textures. */
  brightness?: number;
  /** Team color for the silhouette outline. Omit for no outline. */
  outlineColor?: string;
  /** Outline thickness, pushed along normals in the model's object space. */
  outlineWidth?: number;
}

/**
 * Builds a back-face team-color material that expands each vertex along its
 * normal — an inverted-hull outline of uniform width regardless of where the
 * model's origin sits (so it reads as a clean rim, not a halo offset toward the
 * feet). Width changes recompile the shader, which is fine for live calibration.
 */
function useOutlineMaterial(color: string | undefined, width: number): THREE.Material | null {
  return useMemo(() => {
    if (!color || width <= 0) return null;
    const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.outlineWidth = { value: width };
      // Use the raw `normal` attribute (always declared) rather than
      // `objectNormal`, which MeshBasicMaterial only defines under envmap/skinning.
      shader.vertexShader =
        `uniform float outlineWidth;\n${shader.vertexShader}`.replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\n  transformed += normalize(normal) * outlineWidth;",
        );
    };
    return m;
  }, [color, width]);
}

export function HeroMesh({
  gltfPath, position,
  scale = 1, xOffset = 0, yOffset = 0, zOffset = 0, rotationDeg = 0,
  brightness = 1,
  outlineColor, outlineWidth = 0,
}: Props) {
  const { scene } = useGLTF(gltfPath);

  const cloned = useMemo(() => {
    const clone = cloneHeroScene(scene, brightness);
    clone.object.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = false;
      }
    });
    return clone;
  }, [scene, brightness]);

  useEffect(() => () => {
    cloned.ownedMaterials.forEach((material) => material.dispose());
  }, [cloned]);

  const outlineMat = useOutlineMaterial(outlineColor, outlineWidth);

  const outlineObj = useMemo(() => {
    if (!outlineMat) return null;
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.material = outlineMat;
        mesh.castShadow = false;
        mesh.receiveShadow = false;
      }
    });
    return clone;
  }, [scene, outlineMat]);

  const targetRad = (rotationDeg * Math.PI) / 180;
  const finalPos: [number, number, number] = [
    position[0] + xOffset,
    position[1] + yOffset,
    position[2] + zOffset,
  ];

  // Smoothed facing. Driven imperatively (not via the `rotation` prop) so a
  // re-render with a new target doesn't reset rotation.y and re-snap the model;
  // `cur` is null until the first frame, where it locks onto the target so the
  // figure never spins up from zero on spawn.
  const bodyRef = useRef<THREE.Object3D>(null);
  const outlineRef = useRef<THREE.Object3D>(null);
  const cur = useRef<number | null>(null);

  useFrame((_, dt) => {
    if (cur.current === null) cur.current = targetRad;
    // Shortest signed delta to the target, then step at most TURN_RATE*dt toward it.
    const delta = Math.atan2(
      Math.sin(targetRad - cur.current),
      Math.cos(targetRad - cur.current),
    );
    cur.current += THREE.MathUtils.clamp(delta, -TURN_RATE * dt, TURN_RATE * dt);
    if (bodyRef.current) bodyRef.current.rotation.y = cur.current;
    if (outlineRef.current) outlineRef.current.rotation.y = cur.current;
  });

  return (
    <group>
      {outlineObj && (
        <primitive
          ref={outlineRef}
          object={outlineObj}
          position={finalPos}
          scale={scale}
        />
      )}
      <primitive
        ref={bodyRef}
        object={cloned.object}
        position={finalPos}
        scale={scale}
      />
    </group>
  );
}
