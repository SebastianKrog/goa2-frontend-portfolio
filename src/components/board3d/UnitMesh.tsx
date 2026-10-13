import { useLoader } from "@react-three/fiber";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";

interface Props {
  objPath: string;
  texturePath: string;
  position: [number, number, number];
  scale?: number;
  xOffset?: number;
  yOffset?: number;
  zOffset?: number;
  rotationDeg?: number;
}

export function UnitMesh({
  objPath, texturePath, position,
  scale = 1, xOffset = 0, yOffset = 0, zOffset = 0, rotationDeg = 0,
}: Props) {
  const obj = useLoader(OBJLoader, objPath);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load(texturePath, (loaded) => {
      loaded.colorSpace = THREE.SRGBColorSpace;
      setTexture(loaded);
    });
  }, [texturePath]);

  const cloned = useMemo(() => {
    const clone = obj.clone(true);
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.6,
      metalness: 0.2,
    });
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.material = material;
        mesh.castShadow = true;
        mesh.receiveShadow = false;
        mesh.geometry.computeVertexNormals();
      }
    });
    return clone;
  }, [obj, texture]);

  const rotationRad = (rotationDeg * Math.PI) / 180;
  const finalPos: [number, number, number] = [
    position[0] + xOffset,
    position[1] + yOffset,
    position[2] + zOffset,
  ];

  return (
    <primitive
      object={cloned}
      position={finalPos}
      scale={scale}
      rotation={[0, rotationRad, 0]}
    />
  );
}
