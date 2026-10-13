import { describe, expect, it } from "vitest";
import {
  CHECK_TOLERANCE,
  checkCalibration,
  hexToLocal,
  hexToWorld,
  imageUVToWorld,
  planeSize,
} from "./geometry";
import type { MapConfig } from "./types";
import { MAPS } from "./index";

const hex = (q: number, r: number) => ({ q, r, s: -q - r });

const SAMPLE = [
  hex(0, 0), hex(1, 0), hex(0, 1), hex(-1, 0), hex(0, -1),
  hex(3, -7), hex(-5, 4), hex(9, 9), hex(-8, -2),
];

/** World (x, z) -> normalised image (u, v). Inverse of imageUVToWorld by definition. */
function worldToImageUV(
  x: number,
  z: number,
  imageSize: number,
  aspect: number,
): [number, number] {
  return [x / imageSize + 0.5, z / (imageSize * aspect) + 0.5];
}

describe("hexToLocal", () => {
  it("matches the flat-top axial formula the board used inline", () => {
    for (const h of SAMPLE) {
      const [x, z] = hexToLocal(h, 0.295);
      expect(x).toBeCloseTo(0.295 * (3 / 2) * h.q, 12);
      expect(z).toBeCloseTo(0.295 * (Math.sqrt(3) / 2 * h.q + Math.sqrt(3) * h.r), 12);
    }
  });

  it("is linear in hexSize", () => {
    const [x1, z1] = hexToLocal(hex(4, -3), 1);
    const [x2, z2] = hexToLocal(hex(4, -3), 0.25);
    expect(x2).toBeCloseTo(x1 * 0.25, 12);
    expect(z2).toBeCloseTo(z1 * 0.25, 12);
  });

  it("keeps all six neighbours one hex diameter away", () => {
    const size = 0.31;
    const [ox, oz] = hexToLocal(hex(0, 0), size);
    const neighbours = [hex(1, 0), hex(1, -1), hex(0, -1), hex(-1, 0), hex(-1, 1), hex(0, 1)];
    for (const n of neighbours) {
      const [x, z] = hexToLocal(n, size);
      expect(Math.hypot(x - ox, z - oz)).toBeCloseTo(size * Math.sqrt(3), 12);
    }
  });
});

describe("frame identity with the map editor", () => {
  // The editor draws a pointy-top grid at HEX_SIZE = 22 px:
  //   zE(q,r) = 22*sqrt(3)*(q + r/2) + i*33*r
  // and its export conversion relies on zE == 22 * e^(-i*pi/6) * zu, where zu is
  // hexToLocal at unit hexSize. If this ever fails, the editor's rotationDeg
  // (which adds a literal 30 degrees) is wrong and every new map is misaligned.
  const EDITOR_HEX_PX = 22;

  it("holds for every sample hex", () => {
    const c = Math.cos(-Math.PI / 6);
    const s = Math.sin(-Math.PI / 6);
    for (const h of SAMPLE) {
      const [ux, uz] = hexToLocal(h, 1);
      const rotatedX = EDITOR_HEX_PX * (ux * c - uz * s);
      const rotatedZ = EDITOR_HEX_PX * (ux * s + uz * c);

      const editorX = EDITOR_HEX_PX * Math.sqrt(3) * (h.q + h.r / 2);
      const editorY = EDITOR_HEX_PX * 1.5 * h.r;

      expect(rotatedX).toBeCloseTo(editorX, 10);
      expect(rotatedZ).toBeCloseTo(editorY, 10);
    }
  });

  it("is a rotation, not a reflection (both frames share handedness)", () => {
    const cross = (a: [number, number], b: [number, number]) => a[0] * b[1] - a[1] * b[0];
    const ours = cross(hexToLocal(hex(1, 0), 1), hexToLocal(hex(0, 1), 1));
    const editor = cross(
      [22 * Math.sqrt(3), 0],
      [22 * Math.sqrt(3) * 0.5, 33],
    );
    expect(Math.sign(ours)).toBe(Math.sign(editor));
  });
});

describe("hexToWorld", () => {
  it("places hex (0,0,0) exactly on the config origin", () => {
    for (const config of Object.values(MAPS)) {
      const [x, z] = hexToWorld(hex(0, 0), config);
      expect(x).toBeCloseTo(config.origin.x, 12);
      expect(z).toBeCloseTo(config.origin.z, 12);
    }
  });

  it("rotates by rotationDeg about the origin, three.js sign convention", () => {
    const config: MapConfig = {
      name: "t", imagePath: "", imageSize: 10,
      hexSize: 1, origin: { x: 0, z: 0 }, rotationDeg: 90,
    };
    // rotation-y by +90: x' = z, z' = -x. hexToLocal((0,1)) is (0, sqrt(3)).
    const [x, z] = hexToWorld(hex(0, 1), config);
    expect(x).toBeCloseTo(Math.sqrt(3), 12);
    expect(z).toBeCloseTo(0, 12);
  });

  it("preserves distances under rotation and offset", () => {
    const config = MAPS.narrow_passages;
    const [ax, az] = hexToWorld(hex(2, -3), config);
    const [bx, bz] = hexToWorld(hex(-4, 5), config);
    const [lax, laz] = hexToLocal(hex(2, -3), config.hexSize);
    const [lbx, lbz] = hexToLocal(hex(-4, 5), config.hexSize);
    expect(Math.hypot(bx - ax, bz - az)).toBeCloseTo(Math.hypot(lbx - lax, lbz - laz), 12);
  });
});

describe("planeSize", () => {
  it("keeps square images square", () => {
    expect(planeSize(3012, 3012, 10)).toEqual([10, 10]);
  });

  it("follows the image aspect so art is never stretched", () => {
    // magma_and_ice.png is 3172x3200 — the case a square plane got wrong.
    const [w, h] = planeSize(3172, 3200, 10);
    expect(w).toBe(10);
    expect(h).toBeCloseTo(10 * (3200 / 3172), 12);
    expect(h / w).toBeCloseTo(3200 / 3172, 12);
  });

  it("falls back to square before the image has measured", () => {
    expect(planeSize(0, 0, 10)).toEqual([10, 10]);
  });
});

describe("imageUVToWorld", () => {
  it("maps the image centre to the world origin", () => {
    expect(imageUVToWorld(0.5, 0.5, 10, 1)).toEqual([0, 0]);
  });

  it("runs image-right to +x and image-down to +z", () => {
    const [rx, rz] = imageUVToWorld(1, 0.5, 10, 1);
    expect(rx).toBeCloseTo(5, 12);
    expect(rz).toBeCloseTo(0, 12);
    const [dx, dz] = imageUVToWorld(0.5, 1, 10, 1);
    expect(dx).toBeCloseTo(0, 12);
    expect(dz).toBeCloseTo(5, 12);
  });

  it("spans the plane that planeSize produces", () => {
    const [w, h] = planeSize(3172, 3200, 10);
    const [x0, z0] = imageUVToWorld(0, 0, 10, 3200 / 3172);
    const [x1, z1] = imageUVToWorld(1, 1, 10, 3200 / 3172);
    expect(x1 - x0).toBeCloseTo(w, 12);
    expect(z1 - z0).toBeCloseTo(h, 12);
  });

  it("round-trips against worldToImageUV for every map", () => {
    for (const config of Object.values(MAPS)) {
      for (const h of SAMPLE) {
        const [wx, wz] = hexToWorld(h, config);
        const [u, v] = worldToImageUV(wx, wz, config.imageSize, 1);
        const [bx, bz] = imageUVToWorld(u, v, config.imageSize, 1);
        expect(bx).toBeCloseTo(wx, 10);
        expect(bz).toBeCloseTo(wz, 10);
      }
    }
  });
});

describe("checkCalibration", () => {
  const config: MapConfig = {
    ...MAPS.across_the_river,
    check: { hex: hex(6, -11), u: 0, v: 0 },
  };

  /** The check a correctly-aligned editor would export for this config. */
  function selfConsistentCheck(cfg: MapConfig, h: { q: number; r: number; s: number }, aspect: number) {
    const [wx, wz] = hexToWorld(h, cfg);
    const [u, v] = worldToImageUV(wx, wz, cfg.imageSize, aspect);
    return { hex: h, u, v };
  }

  it("returns null when the map carries no check", () => {
    expect(checkCalibration(MAPS.across_the_river, 3012, 3012)).toBeNull();
  });

  it("returns null before the image has measured", () => {
    expect(checkCalibration(config, 0, 0)).toBeNull();
  });

  it("is ~zero for a self-consistent config", () => {
    const cfg = { ...config, check: selfConsistentCheck(config, hex(6, -11), 1) };
    const error = checkCalibration(cfg, 3012, 3012)!;
    expect(error).toBeLessThan(1e-12);
  });

  it("survives re-exporting the same framing at another resolution", () => {
    const cfg = { ...config, check: selfConsistentCheck(config, hex(6, -11), 1) };
    expect(checkCalibration(cfg, 1024, 1024)!).toBeLessThan(1e-12);
  });

  it("stays under tolerance for realistic rounding of the exported literals", () => {
    const cfg = { ...config, check: selfConsistentCheck(config, hex(6, -11), 1) };
    const rounded: MapConfig = {
      ...cfg,
      hexSize: Number(cfg.hexSize.toFixed(5)),
      origin: { x: Number(cfg.origin.x.toFixed(4)), z: Number(cfg.origin.z.toFixed(4)) },
      rotationDeg: Number(cfg.rotationDeg.toFixed(2)),
    };
    expect(checkCalibration(rounded, 3012, 3012)!)
      .toBeLessThan(CHECK_TOLERANCE * cfg.hexSize);
  });

  it("catches the ~1% stretch a square plane applied to a non-square image", () => {
    // The bug this check exists for: magma_and_ice.png is 3172x3200, and the old
    // MapPlane rendered every map on a square plane. A config aligned against one
    // aspect and rendered at the other cannot be corrected by any of the four
    // numbers, so it has to be reported rather than tuned around.
    const corner = hex(1, -10); // near the top edge, where a stretch shows most
    const cfg = { ...config, check: selfConsistentCheck(config, corner, 1) };
    expect(cfg.check.v).toBeLessThan(0.1);

    // Rendered on a square plane, as it was aligned: exact.
    expect(checkCalibration(cfg, 3172, 3172)!).toBeLessThan(1e-12);

    // Rendered with the image's true aspect: off by more than the limit.
    const error = checkCalibration(cfg, 3172, 3200)!;
    expect(error).toBeGreaterThan(CHECK_TOLERANCE * config.hexSize);
    expect(error / config.hexSize).toBeGreaterThan(0.1); // ~0.13 hex radii
  });
});
