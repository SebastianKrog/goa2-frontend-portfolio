import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { cloneHeroScene } from "./heroMaterials";

function testScene() {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const texture = new THREE.Texture();
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0.4, 0.25, 0.1),
    map: texture,
  });
  const scene = new THREE.Group();
  scene.add(new THREE.Mesh(geometry, material));
  return { scene, geometry, texture, material };
}

describe("hero material brightness", () => {
  it("shares everything when brightness is neutral", () => {
    const source = testScene();
    const clone = cloneHeroScene(source.scene, 1);
    const mesh = clone.object.children[0] as THREE.Mesh;

    expect(mesh.geometry).toBe(source.geometry);
    expect(mesh.material).toBe(source.material);
    expect(clone.ownedMaterials).toEqual([]);
  });

  it("clones only materials and preserves texture sharing", () => {
    const source = testScene();
    const clone = cloneHeroScene(source.scene, 1.5);
    const mesh = clone.object.children[0] as THREE.Mesh<
      THREE.BufferGeometry,
      THREE.MeshStandardMaterial
    >;

    expect(mesh.geometry).toBe(source.geometry);
    expect(mesh.material).not.toBe(source.material);
    expect(mesh.material.map).toBe(source.texture);
    expect(mesh.material.color.r).toBeCloseTo(0.6);
    expect(mesh.material.color.g).toBeCloseTo(0.375);
    expect(mesh.material.color.b).toBeCloseTo(0.15);
    expect(source.material.color.toArray()).toEqual([0.4, 0.25, 0.1]);
    expect(clone.ownedMaterials).toEqual([mesh.material]);
  });
});
