import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

function objIndex(text, length) {
  const value = Number(text);
  if (!Number.isInteger(value) || value === 0) {
    throw new Error(`Invalid OBJ position index: ${text}`);
  }
  return value > 0 ? value - 1 : length + value;
}

function parseObj(source) {
  const positions = [];
  const faces = [];

  for (const line of source.split(/\r?\n/)) {
    if (line.startsWith("v ")) {
      const position = line.trim().split(/\s+/).slice(1, 4).map(Number);
      if (position.length !== 3 || position.some((value) => !Number.isFinite(value))) {
        throw new Error("OBJ contains an invalid position");
      }
      positions.push(position);
    } else if (line.startsWith("f ")) {
      const polygon = line.trim().split(/\s+/).slice(1).map((token) => (
        objIndex(token.split("/")[0], positions.length)
      ));
      for (let index = 1; index < polygon.length - 1; index += 1) {
        faces.push([polygon[0], polygon[index], polygon[index + 1]]);
      }
    }
  }

  if (positions.length === 0 || faces.length === 0) {
    throw new Error("OBJ has no mesh geometry");
  }
  return { positions, faces };
}

class DisjointSet {
  constructor(size) {
    this.parent = Array.from({ length: size }, (_, index) => index);
    this.rank = new Uint8Array(size);
  }

  find(value) {
    let root = value;
    while (this.parent[root] !== root) root = this.parent[root];
    while (this.parent[value] !== value) {
      const next = this.parent[value];
      this.parent[value] = root;
      value = next;
    }
    return root;
  }

  union(left, right) {
    let leftRoot = this.find(left);
    let rightRoot = this.find(right);
    if (leftRoot === rightRoot) return;
    if (this.rank[leftRoot] < this.rank[rightRoot]) {
      [leftRoot, rightRoot] = [rightRoot, leftRoot];
    }
    this.parent[rightRoot] = leftRoot;
    if (this.rank[leftRoot] === this.rank[rightRoot]) this.rank[leftRoot] += 1;
  }
}

function emptyBounds() {
  return {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
  };
}

function include(bounds, position) {
  for (let axis = 0; axis < 3; axis += 1) {
    bounds.min[axis] = Math.min(bounds.min[axis], position[axis]);
    bounds.max[axis] = Math.max(bounds.max[axis], position[axis]);
  }
}

function finishBounds(bounds) {
  return {
    min: bounds.min,
    max: bounds.max,
    size: bounds.max.map((value, axis) => value - bounds.min[axis]),
  };
}

function inspect(parsed) {
  const weldedByPosition = new Map();
  const weldedPositions = [];
  const vertexToWelded = parsed.positions.map((position) => {
    const key = position.map((value) => Math.round(value * 1e7)).join(",");
    let welded = weldedByPosition.get(key);
    if (welded === undefined) {
      welded = weldedPositions.length;
      weldedByPosition.set(key, welded);
      weldedPositions.push(position);
    }
    return welded;
  });

  const disjoint = new DisjointSet(weldedPositions.length);
  const weldedFaces = parsed.faces.map((face) => {
    const welded = face.map((index) => vertexToWelded[index]);
    disjoint.union(welded[0], welded[1]);
    disjoint.union(welded[1], welded[2]);
    return welded;
  });

  const components = new Map();
  for (let index = 0; index < weldedPositions.length; index += 1) {
    const root = disjoint.find(index);
    if (!components.has(root)) {
      components.set(root, {
        bounds: emptyBounds(),
        vertexIndices: [],
        triangles: 0,
      });
    }
    const component = components.get(root);
    component.vertexIndices.push(index);
    include(component.bounds, weldedPositions[index]);
  }
  for (const face of weldedFaces) {
    components.get(disjoint.find(face[0])).triangles += 1;
  }

  const bounds = emptyBounds();
  weldedPositions.forEach((position) => include(bounds, position));
  const completedBounds = finishBounds(bounds);
  const height = completedBounds.size[1];
  const sortedComponents = [...components.values()]
    .map((component) => {
      const componentBounds = finishBounds(component.bounds);
      return {
        vertices: component.vertexIndices.length,
        triangles: component.triangles,
        bounds: componentBounds,
        minHeightRatio: (componentBounds.min[1] - completedBounds.min[1]) / height,
        maxHeightRatio: (componentBounds.max[1] - completedBounds.min[1]) / height,
        footprintRatio:
          (componentBounds.size[0] * componentBounds.size[2])
          / (completedBounds.size[0] * completedBounds.size[2]),
      };
    })
    .sort((left, right) => right.triangles - left.triangles);

  const bins = Array.from({ length: 40 }, (_, index) => ({
    index,
    count: 0,
    bounds: emptyBounds(),
  }));
  for (const position of weldedPositions) {
    const ratio = (position[1] - completedBounds.min[1]) / height;
    const index = Math.min(bins.length - 1, Math.max(0, Math.floor(ratio * bins.length)));
    bins[index].count += 1;
    include(bins[index].bounds, position);
  }

  return {
    positions: parsed.positions.length,
    weldedPositions: weldedPositions.length,
    triangles: parsed.faces.length,
    bounds: completedBounds,
    componentCount: sortedComponents.length,
    components: sortedComponents.slice(0, 20),
    lowerProfile: bins.slice(0, 12)
      .filter((bin) => bin.count > 0)
      .map((bin) => {
        const binBounds = finishBounds(bin.bounds);
        return {
          heightRatio: bin.index / bins.length,
          vertices: bin.count,
          widthRatio: binBounds.size[0] / completedBounds.size[0],
          depthRatio: binBounds.size[2] / completedBounds.size[2],
          footprintRatio:
            (binBounds.size[0] * binBounds.size[2])
            / (completedBounds.size[0] * completedBounds.size[2]),
        };
      }),
  };
}

for (const argument of process.argv.slice(2)) {
  const path = resolve(argument);
  const parsed = parseObj(await readFile(path, "utf8"));
  console.log(JSON.stringify({
    file: basename(path),
    path,
    ...inspect(parsed),
  }));
}
