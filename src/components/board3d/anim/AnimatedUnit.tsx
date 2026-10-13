import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { useAnimationEvents } from "../../../anim/useAnimationEvents";
import { TeamBase, DEFAULT_TEAM_BASE, type TeamBaseConfig } from "./TeamBase";
import {
  getUnitPosition,
  registerUnitPosition,
  unregisterUnitPosition,
} from "./unitRegistry";
import { piecePlaced } from "../../../audio/gameSounds";

/**
 * "Hand of God" movement: when a unit's hex changes it is picked up, carried
 * over the board, and set down — as if a player moved the figurine. The lift
 * and the horizontal travel are deliberately decoupled in time: the figure
 * rises first and *holds* near its apex while it glides across, then descends
 * as it settles. The shoulders of each phase are smoothed (smoothstep /
 * ease-in-out) so the three beats read distinctly without feeling robotic — the
 * unit is never frozen, it's always gliding at height through the hold.
 *
 * Duration and lift scale with distance (capped): a one-hex step is a small
 * deliberate hop, a long move a slower, taller sweep.
 */
const MOVE_SPEED = 4.0; // world units/sec the travel paces toward
const MOVE_MIN_DUR = 0.72;
const MOVE_MAX_DUR = 1.3;
const ARC_MIN = 0.34; // minimum lift so even a one-hex step clearly leaves the table
const ARC_PER_DIST = 0.13;
const ARC_MAX = 1.05;
const MOVE_EPS = 1e-3; // ignore sub-threshold target jitter

// Phase timing as fractions of the move's timeline. Lift rises over [0, RISE]
// and descends over [1-FALL, 1], holding at apex between. Horizontal travel is
// confined to [H_START, H_END] so it begins after the lift is underway and
// finishes as the descent starts — the overlap is what keeps it organic.
const LIFT_RISE = 0.34;
const LIFT_FALL = 0.34;
const H_START = 0.16;
const H_END = 0.86;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Melee strike: how far toward the target the attacker lunges, as a fraction
 * of the distance between them, and the cap so a long-range attacker doesn't
 * fly across the board. */
const LUNGE_FRACTION = 0.4;
const LUNGE_MAX = 0.55;
const LUNGE_DURATION = 0.3; // seconds, out-and-back

/** Spawn pop-in and defeat sink/shrink. */
const ENTER_DURATION = 0.3;
const EXIT_DURATION = 0.5;
const EXIT_SINK = 0.55; // world units the figurine sinks as it shrinks away

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

interface MoveAnim {
  fx: number; fy: number; fz: number;
  tx: number; ty: number; tz: number;
  t: number; dur: number; lift: number;
}

interface Props {
  unitId: string;
  /** Target position in the parent group's local space. */
  target: [number, number, number];
  /** True once the unit has been removed from the view (defeated); plays the
   * sink/shrink exit before the component unmounts. */
  leaving?: boolean;
  /** Team color for the grounded base disc. Omit for teamless entities (tokens). */
  teamColor?: string;
  /** Shape/opacity config for the base disc (shared across units). */
  baseConfig?: TeamBaseConfig;
  children: ReactNode;
}

/**
 * Wraps a unit (hero/minion/token + its markers) in a group that arcs toward
 * `target` whenever its hex changes — the core of M6's tabletop feel. Driven by
 * view diffs (the unit's latest hex), so it animates identically for the acting
 * player and every observer.
 *
 * On top of movement it applies a transient forward **lunge** when this unit is
 * the actor of a `COMBAT_RESOLVED` event, a **pop-in** on spawn, and a
 * **sink/shrink** exit when `leaving`. The unit's logical position is published
 * to {@link registerUnitPosition} each frame for impact/floater effects.
 */
export function AnimatedUnit({ unitId, target, leaving = false, teamColor, baseConfig, children }: Props) {
  const cfg = baseConfig ?? DEFAULT_TEAM_BASE;
  const figureRef = useRef<THREE.Group>(null);
  const baseRef = useRef<THREE.Group>(null);
  const initialized = useRef(false);
  // The unit's logical position (mid-arc), before any transient strike offset.
  const base = useRef(new THREE.Vector3(target[0], target[1], target[2]));
  // In-flight move arc, or null when settled.
  const move = useRef<MoveAnim | null>(null);
  // Active strike: direction (horizontal, unit length) + elapsed/duration.
  const strike = useRef<{ dir: THREE.Vector3; amp: number; t: number } | null>(null);
  // Lifecycle progress: enter 0→1 on spawn, exit 0→1 once leaving.
  const enter = useRef(0);
  const exit = useRef(0);
  // Fires once when the spawn pop-in completes (gated to armed units only).
  const clackedSpawn = useRef(false);

  useEffect(() => {
    registerUnitPosition(unitId, base.current);
    return () => unregisterUnitPosition(unitId);
  }, [unitId]);

  useAnimationEvents((events) => {
    for (const ev of events) {
      if (ev.event_type !== "COMBAT_RESOLVED" || ev.actor_id !== unitId) continue;
      const targetPos = getUnitPosition(ev.target_id);
      if (!targetPos) continue;
      const dir = new THREE.Vector3().subVectors(targetPos, base.current);
      dir.y = 0;
      const dist = dir.length();
      if (dist < 1e-3) continue;
      dir.normalize();
      strike.current = { dir, amp: Math.min(dist * LUNGE_FRACTION, LUNGE_MAX), t: 0 };
    }
  });

  useFrame((_, dt) => {
    const fig = figureRef.current;
    if (!fig) return;
    const [tx, ty, tz] = target;

    if (!initialized.current) {
      base.current.set(tx, ty, tz);
      initialized.current = true;
    } else {
      // Where are we currently headed? Start a fresh arc if the destination
      // moved (a new hex), re-launching from the current mid-arc position.
      const m = move.current;
      const headX = m ? m.tx : base.current.x;
      const headZ = m ? m.tz : base.current.z;
      const headY = m ? m.ty : base.current.y;
      const dx = tx - headX;
      const dz = tz - headZ;
      if (Math.hypot(dx, dz) > MOVE_EPS || Math.abs(ty - headY) > MOVE_EPS) {
        const dist = Math.hypot(tx - base.current.x, tz - base.current.z);
        // Per-move timing jitter (0.9x..1.1x) so successive steps don't all take
        // exactly the same time, which reads as mechanical.
        const durJitter = 0.9 + Math.random() * 0.2;
        move.current = {
          fx: base.current.x, fy: base.current.y, fz: base.current.z,
          tx, ty, tz,
          t: 0,
          dur: THREE.MathUtils.clamp(dist / MOVE_SPEED, MOVE_MIN_DUR, MOVE_MAX_DUR) * durJitter,
          lift: THREE.MathUtils.clamp(ARC_MIN + dist * ARC_PER_DIST, ARC_MIN, ARC_MAX),
        };
      }

      const cur = move.current;
      if (cur) {
        cur.t += dt;
        const p = Math.min(cur.t / cur.dur, 1);
        // Horizontal travel confined to the middle of the timeline, eased.
        const h = easeInOutCubic(
          THREE.MathUtils.clamp((p - H_START) / (H_END - H_START), 0, 1),
        );
        // Lift: rise, hold near apex, descend — smooth shoulders, no hard plateau.
        const lift =
          cur.lift * smoothstep(0, LIFT_RISE, p) * smoothstep(0, LIFT_FALL, 1 - p);
        base.current.x = cur.fx + (cur.tx - cur.fx) * h;
        base.current.z = cur.fz + (cur.tz - cur.fz) * h;
        base.current.y = cur.fy + (cur.ty - cur.fy) * h + lift;
        if (p >= 1) {
          base.current.set(cur.tx, cur.ty, cur.tz);
          move.current = null;
          piecePlaced(); // touchdown: the piece is set on the board
        }
      }
    }

    let offX = 0;
    let offZ = 0;
    const s = strike.current;
    if (s) {
      s.t += dt;
      const progress = Math.min(s.t / LUNGE_DURATION, 1);
      const shape = Math.sin(Math.PI * progress); // 0 -> 1 -> 0
      offX = s.dir.x * s.amp * shape;
      offZ = s.dir.z * s.amp * shape;
      if (progress >= 1) strike.current = null;
    }

    // Lifecycle: pop in on spawn, sink + shrink away on defeat.
    enter.current = Math.min(enter.current + dt / ENTER_DURATION, 1);
    if (!clackedSpawn.current && enter.current >= 1) {
      clackedSpawn.current = true;
      piecePlaced(); // pop-in finished: the figure has landed
    }
    // Exit ramps up while leaving; ramps back down if the unit returns (e.g.
    // scrubbing backward in a replay re-spawns a defeated unit) so it grows back
    // to full scale instead of staying stuck small. In live play units never
    // return after defeat, so exit only ever rises — behavior is unchanged there.
    if (leaving) {
      exit.current = Math.min(exit.current + dt / EXIT_DURATION, 1);
    } else if (exit.current > 0) {
      exit.current = Math.max(exit.current - dt / ENTER_DURATION, 0);
    }
    const enterScale = 1 - Math.pow(1 - enter.current, 3); // ease-out
    const exitScale = 1 - exit.current;
    const figScale = Math.max(enterScale * exitScale, 0.0001);
    const sink = exit.current * EXIT_SINK;

    // The figure lifts/sinks; the base disc tracks its ground position only.
    fig.scale.setScalar(figScale);
    fig.position.set(base.current.x + offX, base.current.y - sink, base.current.z + offZ);

    const b = baseRef.current;
    if (b) {
      b.scale.setScalar(figScale);
      b.position.set(base.current.x, cfg.y, base.current.z);
    }
  });

  return (
    <group>
      <group ref={figureRef} scale={0.0001}>
        {children}
      </group>
      {teamColor && (
        <group ref={baseRef} scale={0.0001}>
          <TeamBase
            color={teamColor}
            radius={cfg.radius}
            ringInnerFrac={cfg.ringInnerFrac}
            ringOpacity={cfg.ringOpacity}
            fillOpacity={cfg.fillOpacity}
          />
        </group>
      )}
    </group>
  );
}
