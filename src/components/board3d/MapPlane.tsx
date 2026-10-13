import { useTexture } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import type { MapConfig } from "./maps/types";
import { CHECK_TOLERANCE, checkCalibration, planeSize } from "./maps/geometry";

interface Props {
  config: MapConfig;
}

export function MapPlane({ config }: Props) {
  const texture = useTexture(config.imagePath);
  const { gl } = useThree();

  useEffect(() => {
    texture.anisotropy = gl.capabilities.getMaxAnisotropy();
    texture.needsUpdate = true;
  }, [texture, gl]);

  // useTexture suspends until the image has loaded, so its natural size is known.
  const image = texture.image as { width?: number; height?: number } | undefined;
  const imageW = image?.width ?? 0;
  const imageH = image?.height ?? 0;
  const [planeW, planeH] = planeSize(imageW, imageH, config.imageSize);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const error = checkCalibration(config, imageW, imageH);
    if (error === null) return;
    if (error > CHECK_TOLERANCE * config.hexSize) {
      console.error(
        `[map calibration] ${config.name}: grid and image disagree by ${error.toFixed(4)} ` +
        `world units (${(error / config.hexSize).toFixed(3)} hex radii, limit ` +
        `${CHECK_TOLERANCE}). Image is ${imageW}x${imageH}. Re-align this map in ` +
        `tools/map_editor.html, or check whether the image was re-cropped.`,
      );
    }
  }, [config, imageW, imageH]);

  return (
    <mesh
      receiveShadow
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.01, 0]}
    >
      <planeGeometry args={[planeW, planeH]} />
      <meshStandardMaterial map={texture} roughness={0.7} metalness={0} />
    </mesh>
  );
}
