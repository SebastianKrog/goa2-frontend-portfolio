import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { SPELL_W, SPELL_H, loadHeroLogo } from "./cards/paintCard";

interface Props {
  heroSlug: string;
  count: number;
  /** Base position: centre of the stack footprint, on the mat surface. */
  position: [number, number, number];
  rotationY: number;
  /** Card width in world units (landscape; footprint depth follows). */
  width: number;
  /** When set, the stack is clickable (e.g. to open the spellbook viewer). */
  onClick?: () => void;
}

const EDGE_COLOR = "#23201a";
const BASE_THICKNESS = 0.012;
const PER_CARD = 0.007;
const MAX_CARDS = 12;

function paintSpellbookBack(ctx: CanvasRenderingContext2D, logo: HTMLImageElement | undefined) {
  ctx.clearRect(0, 0, SPELL_W, SPELL_H);
  // Arcane purple back so the spellbook reads as its own pile next to the deck.
  const grad = ctx.createRadialGradient(SPELL_W / 2, SPELL_H / 2, 60, SPELL_W / 2, SPELL_H / 2, SPELL_W / 2);
  grad.addColorStop(0, "#3d2b5e");
  grad.addColorStop(1, "#241738");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SPELL_W, SPELL_H);
  ctx.lineWidth = 18;
  ctx.strokeStyle = "rgba(212, 175, 55, 0.6)";
  ctx.strokeRect(28, 28, SPELL_W - 56, SPELL_H - 56);
  if (logo) {
    const h = SPELL_H * 0.55;
    const w = h * (logo.width / logo.height);
    ctx.globalAlpha = 0.85;
    ctx.drawImage(logo, (SPELL_W - w) / 2, (SPELL_H - h) / 2, w, h);
    ctx.globalAlpha = 1;
  }
}

// The facedown pile of prepared spells: a landscape box with an arcane back on
// top, growing in thickness with how many spells are prepared. Identity stays
// hidden — opponents only ever know the count.
export function SpellbookStack({ heroSlug, count, position, rotationY, width, onClick }: Props) {
  const depth = width * (SPELL_H / SPELL_W);
  const [topTex, setTopTex] = useState<THREE.CanvasTexture | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let canvas = canvasRef.current;
      if (!canvas) {
        canvas = document.createElement("canvas");
        canvas.width = SPELL_W;
        canvas.height = SPELL_H;
        canvasRef.current = canvas;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const logo = await loadHeroLogo(heroSlug);
      if (cancelled) return;
      paintSpellbookBack(ctx, logo);
      setTopTex((prev) => {
        if (prev) { prev.needsUpdate = true; return prev; }
        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        return tex;
      });
    })();
    return () => { cancelled = true; };
  }, [heroSlug]);

  useEffect(() => () => { if (topTex) topTex.dispose(); }, [topTex]);

  if (count <= 0 || !topTex) return null;

  const thickness = BASE_THICKNESS + Math.min(count, MAX_CARDS) * PER_CARD;
  const interactive = !!onClick;

  return (
    <mesh
      position={[position[0], position[1] + thickness / 2, position[2]]}
      rotation={[0, rotationY, 0]}
      castShadow
      onClick={interactive ? (e) => { e.stopPropagation(); onClick?.(); } : undefined}
      onPointerOver={interactive ? (e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; } : undefined}
      onPointerOut={interactive ? () => { document.body.style.cursor = "auto"; } : undefined}
    >
      <boxGeometry args={[width, thickness, depth]} />
      {/* Face order: +x, -x, +y (top), -y, +z, -z */}
      <meshStandardMaterial attach="material-0" color={EDGE_COLOR} roughness={0.85} />
      <meshStandardMaterial attach="material-1" color={EDGE_COLOR} roughness={0.85} />
      <meshStandardMaterial attach="material-2" map={topTex} roughness={0.6} />
      <meshStandardMaterial attach="material-3" color={EDGE_COLOR} roughness={0.85} />
      <meshStandardMaterial attach="material-4" color={EDGE_COLOR} roughness={0.85} />
      <meshStandardMaterial attach="material-5" color={EDGE_COLOR} roughness={0.85} />
    </mesh>
  );
}
