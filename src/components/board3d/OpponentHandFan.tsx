import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import {
  CARD_BACK_ART_VERSION,
  CARD_H,
  CARD_W,
  loadHeroLogo,
  paintFacedown,
} from "./cards/paintCard";
import {
  handFanPlacements,
  OPPONENT_HAND_CARD_WIDTH,
  OPPONENT_HAND_TILT,
} from "./opponentHandFanLayout";

interface Props {
  heroSlug: string;
  count: number;
  position: [number, number, number];
  rotationY: number;
}

const CARD_HEIGHT = OPPONENT_HAND_CARD_WIDTH * (CARD_H / CARD_W);

/** Hero card backs held above an opponent's status plaque, facing the table. */
export function OpponentHandFan({ heroSlug, count, position, rotationY }: Props) {
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cards = useMemo(() => handFanPlacements(count), [count]);
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
      setTexture((previous) => {
        if (previous) {
          previous.needsUpdate = true;
          return previous;
        }
        const next = new THREE.CanvasTexture(canvas);
        next.colorSpace = THREE.SRGBColorSpace;
        next.anisotropy = 8;
        return next;
      });
    })();
    return () => { cancelled = true; };
  }, [heroSlug, backPaintKey]);

  useEffect(() => () => { texture?.dispose(); }, [texture]);

  if (!texture || cards.length === 0) return null;

  return (
    <group
      position={position}
      rotation={[0, rotationY + Math.PI, 0]}
    >
      <group rotation={[OPPONENT_HAND_TILT, 0, 0]}>
        {cards.map((card, index) => (
          <mesh
            key={index}
            position={[card.x, card.y, index * 0.004]}
            rotation={[0, 0, card.rotationZ]}
            castShadow
            raycast={() => null}
          >
            <planeGeometry args={[OPPONENT_HAND_CARD_WIDTH, CARD_HEIGHT]} />
            <meshStandardMaterial
              map={texture}
              roughness={0.65}
              side={THREE.DoubleSide}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}
