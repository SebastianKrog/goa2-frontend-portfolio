import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

interface Props {
  iconPath: string;
  value: number;
  position: [number, number, number];
  rotation: [number, number, number];
  size?: number;
}

const TEX_SIZE = 256;

export function MatItemIcon({ iconPath, value, position, rotation, size = 0.28 }: Props) {
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      let canvas = canvasRef.current;
      if (!canvas) {
        canvas = document.createElement("canvas");
        canvas.width = TEX_SIZE;
        canvas.height = TEX_SIZE;
        canvasRef.current = canvas;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
      ctx.drawImage(img, 0, 0, TEX_SIZE, TEX_SIZE);
      if (value > 0) {
        ctx.font = "bold 96px sans-serif";
        ctx.textAlign = "right";
        ctx.textBaseline = "bottom";
        ctx.lineWidth = 14;
        ctx.strokeStyle = "rgba(0,0,0,0.9)";
        ctx.fillStyle = "#fff";
        const text = `+${value}`;
        ctx.strokeText(text, TEX_SIZE - 6, TEX_SIZE - 6);
        ctx.fillText(text, TEX_SIZE - 6, TEX_SIZE - 6);
      }
      setTexture((prev) => {
        if (prev) { prev.needsUpdate = true; return prev; }
        const tex = new THREE.CanvasTexture(canvas!);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        return tex;
      });
    };
    img.src = iconPath;
    return () => { cancelled = true; };
  }, [iconPath, value]);

  useEffect(() => () => { if (texture) texture.dispose(); }, [texture]);

  if (!texture) return null;
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial map={texture} transparent />
    </mesh>
  );
}
