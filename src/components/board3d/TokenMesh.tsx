import { useTexture } from "@react-three/drei";
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { getTokenGeometry } from "./tokenShape";

interface Props {
  iconPath: string;
  position: [number, number, number];
  size?: number;
  height?: number;
}

export function TokenMesh({ iconPath, position, size = 0.35, height = 0.05 }: Props) {
  const texture = useTexture(iconPath);
  texture.colorSpace = THREE.SRGBColorSpace;

  const [geometry, setGeometry] = useState<THREE.ExtrudeGeometry | null>(null);

  useEffect(() => {
    let cancelled = false;
    getTokenGeometry(iconPath, {
      sampleSize: 64,
      alphaThreshold: 128,
      depth: height,
      worldSize: size,
    }).then((geom) => {
      if (!cancelled) setGeometry(geom);
    });
    return () => { cancelled = true; };
  }, [iconPath, size, height]);

  const materials = useMemo(() => {
    const cap = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.55,
      metalness: 0.1,
      transparent: true,
    });
    const side = new THREE.MeshStandardMaterial({
      color: "#1a1a1a",
      roughness: 0.8,
      metalness: 0.15,
    });
    return [cap, side];
  }, [texture]);

  if (!geometry) return null;

  return <mesh position={position} geometry={geometry} material={materials} castShadow />;
}
