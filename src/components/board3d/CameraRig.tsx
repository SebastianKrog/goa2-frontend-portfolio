import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

const PAN_SPEED = 14; // world units per second
const RESET_TARGET: [number, number, number] = [0, 0, 3.51];
const TARGET_LIMIT = 8.5;
const CAMERA_RESET_EVENT = "goa2:camera-reset";
const BASE_TABLE_HALF_EXTENT = 11;
const MAX_TABLE_FRAME_SCALE = 1.7;
const DEFAULT_CAMERA_POSITION: [number, number, number] = [0, 8.46, 10.58];

interface Props {
  tableHalfExtent?: number;
}

// Key off physical key codes, not e.key: on macOS holding Alt/Option rewrites
// e.key into composed characters (Alt+w → "∑"), which would break WASD while
// the player holds Alt to read a card. e.code is modifier/layout-independent.
const PAN_CODES: Record<string, "w" | "a" | "s" | "d"> = {
  KeyW: "w", KeyA: "a", KeyS: "s", KeyD: "d",
};

export function CameraRig({ tableHalfExtent = BASE_TABLE_HALF_EXTENT }: Props) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const camera = useThree((s) => s.camera);
  const pressed = useRef({ w: false, a: false, s: false, d: false });

  // three captures the reset target (`target0`) at construction from the
  // default [0,0,0]; the `target` prop is applied later, so reset() would snap
  // the look-target back to origin. Re-save the state once mounted so R resets
  // to the seated framing for camera AND target.
  useEffect(() => {
    const c = controlsRef.current;
    if (!c) return;
    c.target.set(...RESET_TARGET);
    c.update();
    c.saveState();
  }, []);

  useEffect(() => {
    const c = controlsRef.current;
    if (!c) return;
    const frameScale = Math.min(
      MAX_TABLE_FRAME_SCALE,
      Math.max(1, tableHalfExtent / BASE_TABLE_HALF_EXTENT),
    );
    const target = new THREE.Vector3(...RESET_TARGET);
    const position = new THREE.Vector3(...DEFAULT_CAMERA_POSITION)
      .sub(target)
      .multiplyScalar(frameScale)
      .add(target);
    camera.position.copy(position);
    c.target.copy(target);
    c.update();
    c.saveState();
  }, [camera, tableHalfExtent]);

  useEffect(() => {
    const isTypingTarget = (t: EventTarget | null) => {
      if (!(t instanceof HTMLElement)) return false;
      const tag = t.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || t.isContentEditable;
    };

    const handleDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const dir = PAN_CODES[e.code];
      if (e.code === "KeyR" || dir) {
        // Suppress the browser's Alt+<key> accelerators (e.g. Alt+D focuses
        // Chrome's address bar) so holding Alt to read a card while panning
        // with WASD keeps focus in the game.
        e.preventDefault();
      }
      if (e.code === "KeyR") controlsRef.current?.reset();
      if (dir) pressed.current[dir] = true;
    };
    const resetFromUi = () => controlsRef.current?.reset();
    const handleUp = (e: KeyboardEvent) => {
      const dir = PAN_CODES[e.code];
      if (dir) pressed.current[dir] = false;
    };
    const blur = () => { pressed.current = { w: false, a: false, s: false, d: false }; };
    window.addEventListener("keydown", handleDown);
    window.addEventListener("keyup", handleUp);
    window.addEventListener("blur", blur);
    window.addEventListener(CAMERA_RESET_EVENT, resetFromUi);
    return () => {
      window.removeEventListener("keydown", handleDown);
      window.removeEventListener("keyup", handleUp);
      window.removeEventListener("blur", blur);
      window.removeEventListener(CAMERA_RESET_EVENT, resetFromUi);
    };
  }, []);

  const forward = useRef(new THREE.Vector3());
  const right = useRef(new THREE.Vector3());
  const delta = useRef(new THREE.Vector3());

  useFrame((_, dt) => {
    const p = pressed.current;
    if (!p.w && !p.a && !p.s && !p.d) return;
    const controls = controlsRef.current;
    if (!controls) return;

    // TTS-style ground pan: forward is the horizontal projection of camera's
    // look direction. Camera Y stays constant — WASD slides the view across
    // the table without changing the tilt or elevation.
    camera.getWorldDirection(forward.current);
    forward.current.y = 0;
    if (forward.current.lengthSq() < 1e-6) return;
    forward.current.normalize();
    right.current.crossVectors(forward.current, camera.up).normalize();

    delta.current.set(0, 0, 0);
    if (p.w) delta.current.addScaledVector(forward.current, 1);
    if (p.s) delta.current.addScaledVector(forward.current, -1);
    if (p.d) delta.current.addScaledVector(right.current, 1);
    if (p.a) delta.current.addScaledVector(right.current, -1);
    if (delta.current.lengthSq() === 0) return;
    delta.current.normalize().multiplyScalar(PAN_SPEED * dt);

    camera.position.add(delta.current);
    controls.target.add(delta.current);

    // Keep the table recoverable. Without a boundary, sustained WASD panning
    // can lose the entire play surface and make a reset feel mandatory.
    const clampedX = THREE.MathUtils.clamp(controls.target.x, -TARGET_LIMIT, TARGET_LIMIT);
    const clampedZ = THREE.MathUtils.clamp(controls.target.z, -TARGET_LIMIT, TARGET_LIMIT);
    camera.position.x += clampedX - controls.target.x;
    camera.position.z += clampedZ - controls.target.z;
    controls.target.x = clampedX;
    controls.target.z = clampedZ;
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.1}
      mouseButtons={{
        LEFT: THREE.MOUSE.PAN,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.ROTATE,
      }}
      touches={{
        ONE: THREE.TOUCH.PAN,
        TWO: THREE.TOUCH.DOLLY_ROTATE,
      }}
      minDistance={4}
      maxDistance={20}
      minPolarAngle={Math.PI / 7}
      maxPolarAngle={Math.PI / 2.2}
      zoomToCursor
      target={[0, 0, 3.51]}
    />
  );
}
