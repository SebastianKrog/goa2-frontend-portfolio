import { useRef, useState, useCallback, useEffect } from "react";
import { Billboard } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useAnimationEvents } from "../../../anim/useAnimationEvents";
import { getUnitPosition } from "./unitRegistry";

/**
 * Transient board feedback rendered in board-group local space: floating
 * numbers/labels that rise and fade, and ground-impact rings that flash.
 * Driven by events that carry no hexes (`COMBAT_RESOLVED`, `GOLD_GAINED`,
 * `MINE_TRIGGERED`), so positions are read live from the unit registry by id at
 * trigger time and frozen — the effect stays put even if the unit then moves or
 * is defeated. Each effect is removed by a single TTL timer so its children are
 * free to be different lengths.
 */

const FLOAT_DURATION = 1.05; // seconds
const FLOAT_RISE = 0.9; // world units
const RING_DURATION = 0.42;

interface Effect {
  id: number;
  origin: [number, number, number];
  ttl: number; // seconds until removed
  text?: string;
  textColor?: string;
  ring?: boolean;
  ringColor?: string;
  ringRadius?: number;
}

function makeTextTexture(text: string, color: string): { tex: THREE.CanvasTexture; aspect: number } {
  const fontSize = 88;
  const font = `900 ${fontSize}px system-ui, -apple-system, sans-serif`;
  const measure = document.createElement("canvas").getContext("2d")!;
  measure.font = font;
  const padX = 18;
  const padY = 14;
  const w = Math.ceil(measure.measureText(text).width) + padX * 2;
  const h = fontSize + padY * 2;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = fontSize * 0.16;
  ctx.strokeStyle = "rgba(0,0,0,0.9)";
  ctx.strokeText(text, w / 2, h / 2);
  ctx.fillStyle = color;
  ctx.fillText(text, w / 2, h / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { tex, aspect: w / h };
}

function FloatingLabel({ text, color, origin }: { text: string; color: string; origin: [number, number, number] }) {
  const group = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const t = useRef(0);
  const { tex, aspect } = useState(() => makeTextTexture(text, color))[0];
  useEffect(() => () => tex.dispose(), [tex]);

  const height = 0.42;
  const width = height * aspect;

  useFrame((_, dt) => {
    t.current += dt;
    const p = Math.min(t.current / FLOAT_DURATION, 1);
    const g = group.current;
    if (g) {
      g.position.y = origin[1] + 0.6 + FLOAT_RISE * (1 - Math.pow(1 - p, 2));
      const pop = p < 0.12 ? 0.6 + (p / 0.12) * 0.4 : 1;
      g.scale.setScalar(pop);
    }
    if (matRef.current) {
      matRef.current.opacity = p > 0.6 ? Math.max(1 - (p - 0.6) / 0.4, 0) : 1;
    }
  });

  return (
    <Billboard ref={group} position={[origin[0], origin[1] + 0.6, origin[2]]}>
      <mesh>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial ref={matRef} map={tex} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </Billboard>
  );
}

function ImpactRing({ origin, color, maxRadius }: { origin: [number, number, number]; color: string; maxRadius: number }) {
  const mesh = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const t = useRef(0);
  const [done, setDone] = useState(false);

  useFrame((_, dt) => {
    if (done) return;
    t.current += dt;
    const p = t.current / RING_DURATION;
    if (p >= 1) {
      setDone(true);
      return;
    }
    const r = maxRadius * (0.2 + 0.8 * p);
    if (mesh.current) mesh.current.scale.setScalar(r);
    if (matRef.current) matRef.current.opacity = 0.85 * (1 - p);
  });

  if (done) return null;
  return (
    <mesh ref={mesh} position={[origin[0], 0.06, origin[2]]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.62, 0.92, 32]} />
      <meshBasicMaterial
        ref={matRef}
        color={color}
        transparent
        opacity={0.85}
        depthWrite={false}
        toneMapped={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

export function CombatEffects() {
  const [effects, setEffects] = useState<Effect[]>([]);
  const nextId = useRef(0);
  const timers = useRef<Set<number>>(new Set());

  const remove = useCallback((id: number) => {
    setEffects((prev) => prev.filter((e) => e.id !== id));
  }, []);

  useAnimationEvents((events) => {
    const spawned: Effect[] = [];
    for (const ev of events) {
      if (ev.event_type === "COMBAT_RESOLVED") {
        const pos = getUnitPosition(ev.target_id);
        if (!pos) continue;
        const origin: [number, number, number] = [pos.x, pos.y, pos.z];
        if ((ev.metadata.outcome as string) === "BLOCKED") {
          spawned.push({ id: nextId.current++, origin, ttl: FLOAT_DURATION, text: "BLOCKED", textColor: "#7fc8ff" });
        } else {
          const attack = ev.metadata.attack_value;
          const text = typeof attack === "number" && attack > 0 ? `${attack}` : "HIT";
          spawned.push({ id: nextId.current++, origin, ttl: FLOAT_DURATION, text, textColor: "#ff5a4d", ring: true, ringColor: "#ff5a4d", ringRadius: 0.7 });
        }
      } else if (ev.event_type === "GOLD_GAINED") {
        const pos = getUnitPosition(ev.actor_id);
        const amount = ev.metadata.amount;
        if (!pos || typeof amount !== "number" || amount <= 0) continue;
        spawned.push({ id: nextId.current++, origin: [pos.x, pos.y, pos.z], ttl: FLOAT_DURATION, text: `+${amount}`, textColor: "#ffcf4d" });
      } else if (ev.event_type === "MINE_TRIGGERED") {
        const pos = getUnitPosition(ev.target_id);
        if (!pos) continue;
        spawned.push({ id: nextId.current++, origin: [pos.x, pos.y, pos.z], ttl: RING_DURATION + 0.1, ring: true, ringColor: "#ff8a3d", ringRadius: 1.0 });
      }
    }
    if (spawned.length === 0) return;
    setEffects((prev) => [...prev, ...spawned]);
    for (const e of spawned) {
      const handle = window.setTimeout(() => {
        timers.current.delete(handle);
        remove(e.id);
      }, e.ttl * 1000 + 80);
      timers.current.add(handle);
    }
  });

  useEffect(() => {
    const handles = timers.current;
    return () => {
      for (const h of handles) clearTimeout(h);
      handles.clear();
    };
  }, []);

  return (
    <>
      {effects.map((e) => (
        <group key={e.id}>
          {e.ring && <ImpactRing origin={e.origin} color={e.ringColor ?? "#ffffff"} maxRadius={e.ringRadius ?? 0.7} />}
          {e.text && <FloatingLabel text={e.text} color={e.textColor ?? "#ffffff"} origin={e.origin} />}
        </group>
      ))}
    </>
  );
}
