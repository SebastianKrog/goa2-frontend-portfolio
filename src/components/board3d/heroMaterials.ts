import * as THREE from "three";

export interface HeroSceneClone {
  object: THREE.Object3D;
  ownedMaterials: THREE.Material[];
}

function materialWithBrightness(
  source: THREE.Material,
  brightness: number,
): THREE.Material {
  const material = source.clone();
  const color = (material as THREE.Material & { color?: unknown }).color;
  if (color instanceof THREE.Color) color.multiplyScalar(brightness);
  material.needsUpdate = true;
  return material;
}

/**
 * Clones a loaded hero scene while keeping geometry and textures shared.
 *
 * Neutral-brightness models retain their shared source materials. A calibrated
 * model clones only its materials before multiplying their base colors, so one
 * hero's setting cannot leak into another instance that uses the same GLB.
 */
export function cloneHeroScene(
  source: THREE.Object3D,
  brightness: number,
): HeroSceneClone {
  const object = source.clone(true);
  const ownedMaterials: THREE.Material[] = [];
  if (brightness === 1) return { object, ownedMaterials };

  object.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map((material) => {
        const clone = materialWithBrightness(material, brightness);
        ownedMaterials.push(clone);
        return clone;
      });
    } else {
      const clone = materialWithBrightness(mesh.material, brightness);
      ownedMaterials.push(clone);
      mesh.material = clone;
    }
  });
  return { object, ownedMaterials };
}
