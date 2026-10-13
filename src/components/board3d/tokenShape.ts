import * as THREE from "three";

interface ExtrudeOptions {
  sampleSize: number;
  alphaThreshold: number;
  depth: number;
  worldSize: number;
}

interface Point {
  x: number;
  y: number;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${url}`));
    img.src = url;
  });
}

function alphaGridFromImage(img: HTMLImageElement, size: number, threshold: number): boolean[][] {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context unavailable");
  ctx.drawImage(img, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size).data;
  const grid: boolean[][] = [];
  for (let y = 0; y < size; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4 + 3;
      row.push(data[idx] > threshold);
    }
    grid.push(row);
  }
  return grid;
}

function opaquePoints(grid: boolean[][]): Point[] {
  const h = grid.length;
  const w = grid[0]?.length ?? 0;
  const points: Point[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (grid[y][x]) points.push({ x, y });
    }
  }
  return points;
}

function convexHull(points: Point[]): Point[] {
  if (points.length < 3) return points.slice();
  const sorted = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Point, a: Point, b: Point) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  const lower: Point[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Point[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

const cache = new Map<string, Promise<THREE.ExtrudeGeometry>>();

async function build(url: string, options: ExtrudeOptions): Promise<THREE.ExtrudeGeometry> {
  const img = await loadImage(url);
  const grid = alphaGridFromImage(img, options.sampleSize, options.alphaThreshold);
  const opaque = opaquePoints(grid);
  if (opaque.length === 0) {
    return new THREE.ExtrudeGeometry(
      new THREE.Shape([
        new THREE.Vector2(-0.5, -0.5),
        new THREE.Vector2(0.5, -0.5),
        new THREE.Vector2(0.5, 0.5),
        new THREE.Vector2(-0.5, 0.5),
      ]),
      { depth: options.depth, bevelEnabled: false },
    );
  }

  const hull = convexHull(opaque);
  // Flip Y because image coordinates grow downward while three.js shapes grow upward.
  // Reverse the hull so the post-flip winding stays CCW (required for correct face normals).
  const shape = new THREE.Shape(
    hull.map((p) => new THREE.Vector2(p.x, options.sampleSize - p.y)).reverse(),
  );

  // Pre-scale depth so it matches options.depth after the uniform scaling below.
  const worldPerSample = options.worldSize / options.sampleSize;
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: options.depth / worldPerSample,
    bevelEnabled: false,
  });

  // Normalize all UVs to [0, 1] in image space. ExtrudeGeometry's default UV
  // generator emits values equal to the shape's 2D coords (pixel-space here),
  // which would clamp at the transparent edge of the icon and render blank.
  // This three.js version (r184) does not split caps/sides into material groups,
  // so we rewrite every UV uniformly. Side faces inherit edge-pixel UVs, which
  // looks fine for thin extrusions.
  const uv = geometry.attributes.uv as THREE.BufferAttribute;
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    uv.setXY(i, vx / options.sampleSize, vy / options.sampleSize);
  }
  uv.needsUpdate = true;

  // Uniform scale to world size and recenter; flip onto the XZ plane.
  geometry.scale(worldPerSample, worldPerSample, worldPerSample);
  geometry.translate(-options.worldSize / 2, -options.worldSize / 2, 0);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, options.depth, 0);

  return geometry;
}

export function getTokenGeometry(url: string, options: ExtrudeOptions): Promise<THREE.ExtrudeGeometry> {
  const key = `${url}|${options.sampleSize}|${options.alphaThreshold}|${options.depth}|${options.worldSize}`;
  let promise = cache.get(key);
  if (!promise) {
    promise = build(url, options);
    cache.set(key, promise);
  }
  return promise;
}
