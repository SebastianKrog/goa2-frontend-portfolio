import { useEffect, useMemo, useRef, useState } from "react";
import { Billboard } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Literal card colors for the painted swatches — CSS vars (utils/colors.ts)
 * can't reach canvas/shader code, so these mirror theme.css.
 */
const CARD_COLORS_3D: Record<string, string> = {
  GOLD: "#ffd700",
  SILVER: "#c0c0c0",
  RED: "#e53935",
  BLUE: "#1e88e5",
  GREEN: "#4caf50",
};

interface Props {
  /** Card colors publicly named by this hero (usually one, e.g. "RED"). */
  colors: string[];
  /** Unit base position in the board group's local space. */
  position: [number, number, number];
  /** How high above the base the sigil floats (above UnitMarkers' 1.3). */
  height?: number;
}

const TEX_W = 256;
const TEX_H = 352;
const CARD_W = 0.5;
const CARD_H = CARD_W * (TEX_H / TEX_W);
const CARD_GAP = CARD_W * 1.2;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const lighten = (hex: string, amt: number): string => {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.round(v + (255 - v) * amt);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(ch);
  return `rgb(${r}, ${g}, ${b})`;
};

function paintCard(ctx: CanvasRenderingContext2D, color: string) {
  ctx.clearRect(0, 0, TEX_W, TEX_H);

  // Dark halo behind the white border so the card pops against bright skies.
  roundRect(ctx, 4, 4, TEX_W - 8, TEX_H - 8, 34);
  ctx.fillStyle = "rgba(10, 8, 18, 0.9)";
  ctx.fill();

  // Card face: bright vertical gradient of the named color.
  roundRect(ctx, 18, 18, TEX_W - 36, TEX_H - 36, 26);
  const grad = ctx.createLinearGradient(0, 18, 0, TEX_H - 18);
  grad.addColorStop(0, lighten(color, 0.45));
  grad.addColorStop(1, color);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = 10;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();
}

function SigilCard({ colorName, x }: { colorName: string; x: number }) {
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
    paintCard(ctx, CARD_COLORS_3D[colorName]);
    setTex((prev) => {
      if (prev) { prev.needsUpdate = true; return prev; }
      const t = new THREE.CanvasTexture(canvas);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      return t;
    });
  }, [colorName]);

  useEffect(() => () => { if (tex) tex.dispose(); }, [tex]);

  if (!tex) return null;
  return (
    <mesh position={[x, 0, 0]}>
      <planeGeometry args={[CARD_W, CARD_H]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

/**
 * Floating mini-card above a hero who has publicly named a card color
 * (NebKher's Imbue Doubt family). "Name a color" is announced aloud at the
 * table, so everyone — enemies planning their next turn most of all — sees at
 * a glance which color is threatened while the effect is pending. Painted to a
 * canvas (StatusPlaque convention) so the bright gradient face and white
 * border stay crisp at distance; the gentle bob marks it as a pending threat
 * rather than static decoration.
 */
export function NamedColorSigil({ colors, position, height = 1.75 }: Props) {
  const bob = useRef<THREE.Group>(null);
  const known = useMemo(() => colors.filter((c) => CARD_COLORS_3D[c]), [colors]);

  useFrame(({ clock }) => {
    if (bob.current) bob.current.position.y = height + 0.06 * Math.sin(clock.getElapsedTime() * 1.8);
  });

  if (known.length === 0) return null;
  const totalW = (known.length - 1) * CARD_GAP;

  return (
    <group position={position}>
      <mesh position={[0, height / 2, 0]}>
        <cylinderGeometry args={[0.01, 0.01, height, 6]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.35} depthWrite={false} toneMapped={false} />
      </mesh>
      <group ref={bob} position={[0, height, 0]}>
        <Billboard>
          {known.map((colorName, i) => (
            <SigilCard key={`${colorName}-${i}`} colorName={colorName} x={-totalW / 2 + i * CARD_GAP} />
          ))}
        </Billboard>
      </group>
    </group>
  );
}
