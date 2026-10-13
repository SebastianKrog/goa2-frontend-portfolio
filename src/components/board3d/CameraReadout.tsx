import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

// One captured camera state, expressed relative to a player's seat so the same
// numbers reproduce the shot at every seat around the ring.
export interface CameraRead {
  seatTheta: number; // seat angle in degrees (0 = south / your seat)
  anchorLabel: string; // which seat the numbers are relative to
  camBack: number; // camera distance outward behind the seat (away from board)
  camLateral: number; // camera sideways offset (0 = centered on the seat)
  camHeight: number; // camera world Y
  tgtBack: number; // look-target outward offset behind the seat
  tgtLateral: number; // look-target sideways offset
  tgtHeight: number; // look-target world Y
  distance: number; // camera -> target distance (zoom)
  fov: number;
}

export interface SeatInfo {
  id: string;
  position: [number, number, number];
  theta: number; // radians, as used by matPlacements
  isMine: boolean;
}

interface ProbeProps {
  seats: SeatInfo[];
  onRead: (r: CameraRead) => void;
}

// Lives INSIDE the Canvas. Reads the live camera + OrbitControls target each
// frame, decomposes both into seat-local coordinates, and pushes the result up
// at ~8 Hz (per-frame setState would thrash React for no visible gain).
export function CameraReadoutProbe({ seats, onRead }: ProbeProps) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const acc = useRef(0);

  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.12) return;
    acc.current = 0;
    if (seats.length === 0) return;

    const target = controls?.target ?? new THREE.Vector3(0, 0, 0);

    // Anchor: your own seat if known, else the seat nearest the camera.
    let seat = seats.find((s) => s.isMine) ?? null;
    if (!seat) {
      let best = Infinity;
      for (const s of seats) {
        const dx = camera.position.x - s.position[0];
        const dz = camera.position.z - s.position[2];
        const d = dx * dx + dz * dz;
        if (d < best) { best = d; seat = s; }
      }
    }
    if (!seat) return;

    const cx = seat.position[0];
    const cz = seat.position[2];
    // Board center is world origin (mats ring is centered there).
    const outLen = Math.hypot(cx, cz) || 1;
    const outX = cx / outLen; // outward = seat -> away from board
    const outZ = cz / outLen;
    const rightX = outZ; // horizontal perpendicular (outward rotated -90°)
    const rightZ = -outX;

    const decompose = (px: number, py: number, pz: number) => {
      const vx = px - cx;
      const vz = pz - cz;
      return {
        back: vx * outX + vz * outZ,
        lateral: vx * rightX + vz * rightZ,
        height: py,
      };
    };

    const cam = decompose(camera.position.x, camera.position.y, camera.position.z);
    const tgt = decompose(target.x, target.y, target.z);

    onRead({
      seatTheta: (seat.theta * 180) / Math.PI,
      anchorLabel: `${seat.id}${seat.isMine ? " (you)" : " (nearest)"}`,
      camBack: cam.back,
      camLateral: cam.lateral,
      camHeight: cam.height,
      tgtBack: tgt.back,
      tgtLateral: tgt.lateral,
      tgtHeight: tgt.height,
      distance: camera.position.distanceTo(target),
      fov: camera.fov,
    });
  });

  return null;
}

const panelStyle: React.CSSProperties = {
  position: "fixed",
  bottom: 16,
  right: 16,
  background: "rgba(20, 16, 12, 0.92)",
  border: "1px solid rgba(255, 255, 255, 0.18)",
  borderRadius: 8,
  padding: "12px 14px",
  color: "#fff",
  fontFamily: "monospace",
  fontSize: 12,
  lineHeight: 1.6,
  zIndex: 100,
  minWidth: 240,
};

const num = (n: number) => (n >= 0 ? " " : "") + n.toFixed(2);

// Lives OUTSIDE the Canvas (HTML). Shows the latest probe reading.
export function CameraReadoutPanel({ read }: { read: CameraRead | null }) {
  return (
    <div style={panelStyle}>
      <div style={{ fontWeight: 700, opacity: 0.7, letterSpacing: 1 }}>CAMERA (seat-local)</div>
      {!read ? (
        <div style={{ opacity: 0.6, marginTop: 6 }}>orbit the camera…</div>
      ) : (
        <>
          <div style={{ opacity: 0.7 }}>seat θ {read.seatTheta.toFixed(1)}°</div>
          <div style={{ opacity: 0.7, marginBottom: 6 }}>anchor {read.anchorLabel}</div>
          <div>camera  back{num(read.camBack)}  lat{num(read.camLateral)}  h{num(read.camHeight)}</div>
          <div>target  back{num(read.tgtBack)}  lat{num(read.tgtLateral)}  h{num(read.tgtHeight)}</div>
          <div style={{ marginTop: 4 }}>distance {read.distance.toFixed(2)}   fov {read.fov.toFixed(0)}</div>
          <div style={{ opacity: 0.6, fontSize: 11, marginTop: 8 }}>
            Press R for the reset default; orbit to taste, then send me both readings.
          </div>
        </>
      )}
    </div>
  );
}
