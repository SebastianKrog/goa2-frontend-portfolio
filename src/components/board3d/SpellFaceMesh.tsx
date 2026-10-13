import { useEffect, useState, useSyncExternalStore } from "react";
import * as THREE from "three";
import { SPELL_W, SPELL_H, loadSpellFace } from "./cards/paintCard";
import { getLocale, subscribeLocale } from "../../i18n/locale";

interface Props {
  imageId: string;
  /** Centre of the card, on the mat surface. */
  position: [number, number, number];
  rotationY: number;
  /** Card width in world units (spells are landscape; height follows). */
  width: number;
  onHoverChange?: (hovered: boolean) => void;
}

// A faceup spell card lying on the mat. Spell faces ship as complete
// pre-rendered landscape images, so this is just a textured plane — no
// painter, no flip animation (facedown spells live in the spellbook stack).
export function SpellFaceMesh({ imageId, position, rotationY, width, onHoverChange }: Props) {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  // A translated face is a different image, so the texture is rebuilt on a switch.
  const locale = useSyncExternalStore(subscribeLocale, getLocale, getLocale);

  useEffect(() => {
    let cancelled = false;
    let created: THREE.Texture | null = null;
    loadSpellFace(imageId).then((img) => {
      if (cancelled || !img) return;
      created = new THREE.Texture(img);
      created.needsUpdate = true;
      created.colorSpace = THREE.SRGBColorSpace;
      created.anisotropy = 8;
      setTex(created);
    });
    return () => {
      cancelled = true;
      created?.dispose();
    };
  }, [imageId, locale]);

  if (!tex) return null;

  return (
    <mesh
      position={position}
      rotation={[-Math.PI / 2, 0, rotationY]}
      castShadow
      onPointerOver={(e) => { e.stopPropagation(); onHoverChange?.(true); }}
      onPointerOut={() => onHoverChange?.(false)}
    >
      <planeGeometry args={[width, width * (SPELL_H / SPELL_W)]} />
      <meshBasicMaterial map={tex} side={THREE.FrontSide} />
    </mesh>
  );
}
