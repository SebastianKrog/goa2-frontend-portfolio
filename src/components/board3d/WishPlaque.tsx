import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

interface Props {
  /** Wishes resolved so far (the caster's team wins on the third). */
  count: number;
  /** Centre of the plaque, on the mat surface. */
  position: [number, number, number];
  rotationY: number;
  width?: number;
}

const TEX_W = 256;
const TEX_H = 256;
const REQUIRED = 3;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function paintWish(ctx: CanvasRenderingContext2D, count: number) {
  ctx.clearRect(0, 0, TEX_W, TEX_H);

  roundRect(ctx, 8, 8, TEX_W - 16, TEX_H - 16, 26);
  ctx.fillStyle = "rgba(30, 20, 48, 0.94)";
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = "rgba(186, 148, 255, 0.6)";
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#d9c7ff";
  ctx.font = "bold 40px sans-serif";
  ctx.fillText("WISH", TEX_W / 2, 62);

  // Three star pips: filled per resolved Wish.
  const y = 160;
  const spacing = 72;
  ctx.font = "72px sans-serif";
  for (let i = 0; i < REQUIRED; i++) {
    const x = TEX_W / 2 + (i - 1) * spacing;
    ctx.fillStyle = i < count ? "#ffd700" : "rgba(160, 140, 200, 0.28)";
    ctx.fillText("★", x, y);
  }
}

// A small mat plaque tracking Gydion's Wish win condition: three star pips,
// one lit per Wish that finished resolving. Public information for everyone.
export function WishPlaque({ count, position, rotationY, width = 0.6 }: Props) {
  const [tex, setTex] = useState<THREE.CanvasTexture | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let canvas = canvasRef.current;
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.width = TEX_W;
      canvas.height = TEX_H;
      canvasRef.current = canvas;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    paintWish(ctx, count);
    setTex((prev) => {
      if (prev) { prev.needsUpdate = true; return prev; }
      const t = new THREE.CanvasTexture(canvas);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      return t;
    });
  }, [count]);

  useEffect(() => () => { if (tex) tex.dispose(); }, [tex]);

  if (!tex) return null;

  return (
    <mesh position={[position[0], position[1] + 0.03, position[2]]} rotation={[-Math.PI / 2, 0, rotationY]}>
      <planeGeometry args={[width, width * (TEX_H / TEX_W)]} />
      <meshBasicMaterial map={tex} transparent side={THREE.FrontSide} />
    </mesh>
  );
}
