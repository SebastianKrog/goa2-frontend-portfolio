import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { CARD_BACK_ART_VERSION, CARD_W, CARD_H, loadHeroLogo, paintFacedown } from "./cards/paintCard";

interface Props {
  heroSlug: string;
  count: number;
  /** Base position: centre of the deck footprint, on the mat surface. */
  position: [number, number, number];
  rotationY: number;
  /** Card width in world units (matches the cards in the slots). */
  width: number;
  /** When set, the stack is clickable (e.g. to open the deck viewer). */
  onClick?: () => void;
}

const EDGE_COLOR = "#23201a";
const BASE_THICKNESS = 0.012; // a 1-card deck still has a little body
const PER_CARD = 0.007; // each remaining card adds this much height
const MAX_CARDS = 30; // clamp so a freak count can't make a skyscraper

// A solid box standing in for the draw pile: the hero card-back on top, dark
// card-edge material on the sides, and a thickness that grows with how many
// cards are left in the deck.
export function DeckStack({ heroSlug, count, position, rotationY, width, onClick }: Props) {
  const depth = width * (CARD_H / CARD_W); // card height becomes the box footprint depth
  const [topTex, setTopTex] = useState<THREE.CanvasTexture | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const backPaintKey = `${heroSlug}:${CARD_BACK_ART_VERSION}`;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let canvas = canvasRef.current;
      if (!canvas) {
        canvas = document.createElement("canvas");
        canvas.width = CARD_W;
        canvas.height = CARD_H;
        canvasRef.current = canvas;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const logo = await loadHeroLogo(heroSlug);
      if (cancelled) return;
      paintFacedown(canvas, ctx, logo);
      setTopTex((prev) => {
        if (prev) { prev.needsUpdate = true; return prev; }
        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        return tex;
      });
    })();
    return () => { cancelled = true; };
  }, [heroSlug, backPaintKey]);

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
