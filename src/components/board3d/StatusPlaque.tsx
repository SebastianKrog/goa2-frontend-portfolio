import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { plaqueNameText } from "./statusPlaqueText";

interface Props {
  level: number;
  gold: number;
  /** Player behind this hero. Absent for games created without names. */
  playerName?: string;
  /** Centre of the plaque, on the mat surface. */
  position: [number, number, number];
  rotationY: number;
  /** Plaque width in world units. */
  width?: number;
}

const TEX_W = 512;
const TEX_H = 256;
const ASPECT = TEX_H / TEX_W;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Shrink the font until `text` fits within maxWidth at the given baseline size.
function fitFont(ctx: CanvasRenderingContext2D, text: string, base: number, maxWidth: number, weight = "bold") {
  let size = base;
  do {
    ctx.font = `${weight} ${size}px sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 4;
  } while (size > 20);
  return size;
}

function paintPlaque(
  ctx: CanvasRenderingContext2D,
  level: number,
  gold: number,
  playerName?: string,
) {
  ctx.clearRect(0, 0, TEX_W, TEX_H);

  // Backing panel.
  roundRect(ctx, 8, 8, TEX_W - 16, TEX_H - 16, 30);
  ctx.fillStyle = "rgba(28, 22, 16, 0.94)";
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = "rgba(212, 175, 55, 0.55)";
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // The name takes a strip off the top, so the coin and level chip shrink and
  // shift down to keep clear of it.
  const name = plaqueNameText(playerName);
  if (name) {
    ctx.font = `bold ${fitFont(ctx, name, 40, TEX_W - 60)}px sans-serif`;
    ctx.fillStyle = "#e8dcc0";
    ctx.fillText(name, TEX_W / 2, 46);
  }

  // Gold coin with the number inside it.
  const cx = 148;
  const cy = name ? 156 : 128;
  const r = name ? 76 : 94;
  const grad = ctx.createRadialGradient(cx - 28, cy - 28, 12, cx, cy, r);
  grad.addColorStop(0, "#ffe680");
  grad.addColorStop(0.6, "#f4c430");
  grad.addColorStop(1, "#b8860b");
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = 7;
  ctx.strokeStyle = "#8a6508";
  ctx.stroke();

  const goldText = String(gold);
  ctx.font = `bold ${fitFont(ctx, goldText, 96, r * 1.5)}px sans-serif`;
  ctx.fillStyle = "#3a2a00";
  ctx.fillText(goldText, cx, cy + 4);

  // Level chip on the right.
  const chipY = name ? 92 : 56;
  const chipH = name ? 116 : 144;
  roundRect(ctx, 286, chipY, 192, chipH, 22);
  ctx.fillStyle = "rgba(120, 160, 255, 0.16)";
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(150, 185, 255, 0.5)";
  ctx.stroke();

  ctx.fillStyle = "#cfe0ff";
  ctx.font = "bold 32px sans-serif";
  ctx.fillText("LEVEL", 382, chipY + 36);
  const lvlText = String(level);
  ctx.font = `bold ${fitFont(ctx, lvlText, name ? 72 : 86, 150)}px sans-serif`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(lvlText, 382, chipY + chipH - 48);
}

// A flat panel lying on the mat showing the hero's gold (a coin with the number
// inside) and level. Painted to a canvas so the digits stay large and readable.
export function StatusPlaque({ level, gold, playerName, position, rotationY, width = 1.1 }: Props) {
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
    paintPlaque(ctx, level, gold, playerName);
    setTex((prev) => {
      if (prev) { prev.needsUpdate = true; return prev; }
      const t = new THREE.CanvasTexture(canvas);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      return t;
    });
  }, [level, gold, playerName]);

  useEffect(() => () => { if (tex) tex.dispose(); }, [tex]);

  if (!tex) return null;

  return (
    <mesh position={[position[0], position[1] + 0.03, position[2]]} rotation={[-Math.PI / 2, 0, rotationY]}>
      <planeGeometry args={[width, width * ASPECT]} />
      <meshBasicMaterial map={tex} transparent side={THREE.FrontSide} />
    </mesh>
  );
}
