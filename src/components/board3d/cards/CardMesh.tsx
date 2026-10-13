import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useFrame } from "@react-three/fiber";
import { damp, damp3 } from "maath/easing";
import * as THREE from "three";
import { getLocale, subscribeLocale } from "../../../i18n/locale";
import type { CardView } from "../../../types/game";
import {
  CARD_BACK_ART_VERSION, CARD_W, CARD_H,
  ensureCardAssetsReady, loadCardBackground,
  paintCard, paintFacedown, loadHeroLogo,
  type HeroStats,
} from "./paintCard";

interface Props {
  card: CardView;
  heroSlug: string;
  heroStats?: HeroStats;
  position: [number, number, number];
  rotation?: [number, number, number];
  width?: number;
  animateFlip?: boolean;
  onHoverChange?: (hovered: boolean) => void;
}

const FLIP_DURATION_MS = 400;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Soft golden halo that pools around a card while its effect is active,
// mirroring the pulsing glow the 2D card view used for is_active cards.
// Built once and shared across every card mesh.
let activeGlowTex: THREE.CanvasTexture | null = null;
function getActiveGlowTexture(): THREE.CanvasTexture {
  if (activeGlowTex) return activeGlowTex;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 18, 64, 64, 64);
  g.addColorStop(0, "rgba(255,215,0,0.9)");
  g.addColorStop(0.5, "rgba(255,200,60,0.45)");
  g.addColorStop(1, "rgba(255,190,70,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  activeGlowTex = new THREE.CanvasTexture(c);
  activeGlowTex.colorSpace = THREE.SRGBColorSpace;
  return activeGlowTex;
}

export function CardMesh({
  card, heroSlug, heroStats, position, rotation = [0, 0, 0],
  width = 0.8, animateFlip = false, onHoverChange,
}: Props) {
  const height = width * (CARD_H / CARD_W);
  const [frontTex, setFrontTex] = useState<THREE.CanvasTexture | null>(null);
  const [backTex, setBackTex] = useState<THREE.CanvasTexture | null>(null);
  const frontCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const backCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const outerRef = useRef<THREE.Group>(null);
  const posInitRef = useRef(false);
  const glowMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const turnGroupRef = useRef<THREE.Group>(null);
  const flipGroupRef = useRef<THREE.Group>(null);
  const animFromRef = useRef<number>(card.is_facedown ? Math.PI : 0);
  const animStartRef = useRef<number | null>(null);
  const lastTargetRef = useRef<number>(card.is_facedown ? Math.PI : 0);
  const didInitRef = useRef(false);

  const targetRot = card.is_facedown ? Math.PI : 0;
  const liftAmount = height * 0.4;

  useLayoutEffect(() => {
    if (!didInitRef.current && flipGroupRef.current) {
      flipGroupRef.current.rotation.x = targetRot;
      lastTargetRef.current = targetRot;
      didInitRef.current = true;
    }
  });

  useEffect(() => {
    if (targetRot === lastTargetRef.current) return;
    const group = flipGroupRef.current;
    lastTargetRef.current = targetRot;
    if (!group) return;
    if (!animateFlip) {
      group.rotation.x = targetRot;
      group.position.z = 0;
      animStartRef.current = null;
      return;
    }
    animFromRef.current = group.rotation.x;
    animStartRef.current = performance.now();
  }, [targetRot, animateFlip]);

  // Ease the card's world position toward `position` so a card that changes
  // zones (commit → played slot → discard pile) slides there instead of
  // teleporting. Snaps on first frame so a freshly-rendered card appears in
  // place.
  useFrame((state, dt) => {
    if (glowMatRef.current) {
      glowMatRef.current.opacity = 0.5 + 0.22 * Math.sin(state.clock.elapsedTime * 3);
    }

    // Turn the card 90° on the mat while its effect is active, then back.
    if (turnGroupRef.current) {
      damp(turnGroupRef.current.rotation, "z", card.is_active ? Math.PI / 2 : 0, 0.18, dt);
    }

    const outer = outerRef.current;
    if (outer) {
      if (!posInitRef.current) {
        outer.position.set(position[0], position[1], position[2]);
        posInitRef.current = true;
      } else {
        damp3(outer.position, position, 0.3, dt);
      }
    }

    const group = flipGroupRef.current;
    if (!group || animStartRef.current == null) return;
    const elapsed = performance.now() - animStartRef.current;
    const t = Math.min(1, elapsed / FLIP_DURATION_MS);
    const eased = easeInOutCubic(t);
    const cur = animFromRef.current + (targetRot - animFromRef.current) * eased;
    group.rotation.x = cur;
    group.position.z = liftAmount * Math.sin(cur);
    if (t >= 1) {
      animStartRef.current = null;
      group.rotation.x = targetRot;
      group.position.z = 0;
    }
  });

  const locale = useSyncExternalStore(subscribeLocale, getLocale, getLocale);
  const backPaintKey = `${heroSlug}:${CARD_BACK_ART_VERSION}`;

  const frontPaintKey = useMemo(() => {
    const sec = JSON.stringify(card.secondary_actions ?? {});
    return [
      card.id, card.name, card.image_id ?? "", card.color ?? "", card.tier,
      card.primary_action ?? "", card.primary_action_value ?? 0, card.initiative,
      card.effect_text ?? "", card.item ?? "", sec, heroSlug,
      heroStats?.attack ?? 0, heroStats?.defense ?? 0, heroStats?.initiative ?? 0, heroStats?.movement ?? 0,
      locale,
    ].join("|");
  }, [card, heroSlug, heroStats, locale]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let canvas = frontCanvasRef.current;
      if (!canvas) {
        canvas = document.createElement("canvas");
        canvas.width = CARD_W;
        canvas.height = CARD_H;
        frontCanvasRef.current = canvas;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      await ensureCardAssetsReady(card);
      const bg = card.image_id ? await loadCardBackground(heroSlug, card.image_id) : undefined;
      if (cancelled) return;
      paintCard(canvas, ctx, card, bg, heroStats);
      setFrontTex((prev) => {
        if (prev) { prev.needsUpdate = true; return prev; }
        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        return tex;
      });
    })();
    return () => { cancelled = true; };
  }, [frontPaintKey]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let canvas = backCanvasRef.current;
      if (!canvas) {
        canvas = document.createElement("canvas");
        canvas.width = CARD_W;
        canvas.height = CARD_H;
        backCanvasRef.current = canvas;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const logo = await loadHeroLogo(heroSlug);
      if (cancelled) return;
      paintFacedown(canvas, ctx, logo);
      setBackTex((prev) => {
        if (prev) { prev.needsUpdate = true; return prev; }
        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        return tex;
      });
    })();
    return () => { cancelled = true; };
  }, [heroSlug, backPaintKey]);

  useEffect(() => {
    return () => { if (frontTex) frontTex.dispose(); };
  }, [frontTex]);
  useEffect(() => {
    return () => { if (backTex) backTex.dispose(); };
  }, [backTex]);

  if (!frontTex || !backTex) return null;

  return (
    <group ref={outerRef} rotation={rotation}>
      <group ref={turnGroupRef}>
        {card.is_active && (
          <mesh position={[0, 0, -0.003]} raycast={() => null}>
            <planeGeometry args={[width * 1.55, height * 1.42]} />
            <meshBasicMaterial
              ref={glowMatRef}
              map={getActiveGlowTexture()}
              color="#ffd700"
              transparent
              opacity={0.6}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        )}
        <group
          ref={flipGroupRef}
          onPointerOver={(e) => { e.stopPropagation(); onHoverChange?.(true); }}
          onPointerOut={() => onHoverChange?.(false)}
        >
          <mesh castShadow>
            <planeGeometry args={[width, height]} />
            <meshBasicMaterial map={frontTex} side={THREE.FrontSide} />
          </mesh>
          <mesh castShadow rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[width, height]} />
            <meshBasicMaterial map={backTex} side={THREE.FrontSide} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
