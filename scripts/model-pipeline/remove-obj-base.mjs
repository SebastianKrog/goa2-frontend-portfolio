import { readFile, writeFile } from "node:fs/promises";
import {
  ShapeUtils,
  Vector2,
} from "three";

function usage() {
  console.log(`Usage:
  npm run model:remove-base -- \\
    --input /path/to/model.obj \\
    --output /path/to/model-without-base.obj \\
    --cutoff-y 0.150

  npm run model:remove-base -- \\
    --input /path/to/model.obj \\
    --output /path/to/model-without-base.obj \\
    --cutoff-ratio 0.17

  npm run model:remove-base -- \\
    --input /path/to/model.obj \\
    --scan \\
    --min-ratio 0.02 \\
    --max-ratio 0.25 \\
    --step-ratio 0.005

Clips an OBJ above a horizontal plane, interpolates UVs and normals at the
cut, then seals every planar opening. The cutoff is measured in source-model
units and must be chosen by inspecting the model.
`);
}

function parseArguments(argv) {
  const options = {
    minRatio: 0.02,
    maxRatio: 0.25,
    stepRatio: 0.005,
    scan: false,
  };
  const valueOptions = new Set([
    "--input",
    "--output",
    "--cutoff-y",
    "--cutoff-ratio",
    "--min-ratio",
    "--max-ratio",
    "--step-ratio",
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help") return { help: true };
    if (argument === "--scan") {
      options.scan = true;
      continue;
    }
    if (!valueOptions.has(argument)) {
      throw new Error(`Unknown option: ${argument}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${argument}`);
    options[argument.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
    index += 1;
  }
  const requiredOptions = options.scan ? ["input"] : ["input", "output"];
  for (const required of requiredOptions) {
    if (options[required] === undefined) throw new Error(`Missing required option: --${required}`);
  }
  for (const property of ["cutoffY", "cutoffRatio", "minRatio", "maxRatio", "stepRatio"]) {
    if (options[property] === undefined) continue;
    options[property] = Number(options[property]);
    if (!Number.isFinite(options[property])) throw new Error(`--${property} must be numeric`);
  }
  if (
    options.minRatio < 0
    || options.maxRatio <= options.minRatio
    || options.maxRatio > 1
    || options.stepRatio <= 0
  ) {
    throw new Error("Scan ratios must satisfy 0 <= min < max <= 1 and step > 0");
  }
  if (!options.scan) {
    const cutoffOptions = [options.cutoffY, options.cutoffRatio]
      .filter((value) => value !== undefined);
    if (cutoffOptions.length !== 1) {
      throw new Error("Provide exactly one of --cutoff-y or --cutoff-ratio");
    }
    if (options.cutoffRatio !== undefined && (options.cutoffRatio <= 0 || options.cutoffRatio >= 1)) {
      throw new Error("--cutoff-ratio must be between 0 and 1");
    }
  }
  return options;
}

function objIndex(text, length, description) {
  if (!text) throw new Error(`OBJ face is missing a ${description} index`);
  const value = Number(text);
  if (!Number.isInteger(value) || value === 0) throw new Error(`Invalid OBJ ${description} index`);
  return value > 0 ? value - 1 : length + value;
}

function parseObj(source) {
  const positions = [];
  const texcoords = [];
  const normals = [];
  const faces = [];
  let materialLibrary = "";
  let material = "";

  for (const line of source.split(/\r?\n/)) {
    if (line.startsWith("v ")) {
      positions.push(line.trim().split(/\s+/).slice(1, 4).map(Number));
    } else if (line.startsWith("vt ")) {
      texcoords.push(line.trim().split(/\s+/).slice(1, 3).map(Number));
    } else if (line.startsWith("vn ")) {
      normals.push(line.trim().split(/\s+/).slice(1, 4).map(Number));
    } else if (line.startsWith("mtllib ") && !materialLibrary) {
      materialLibrary = line;
    } else if (line.startsWith("usemtl ") && !material) {
      material = line;
    } else if (line.startsWith("f ")) {
      const corners = line.trim().split(/\s+/).slice(1).map((token) => {
        const [positionText, texcoordText, normalText] = token.split("/");
        return {
          position: positions[objIndex(positionText, positions.length, "position")],
          texcoord: texcoords[objIndex(texcoordText, texcoords.length, "texture")],
          normal: normals[objIndex(normalText, normals.length, "normal")],
        };
      });
      for (let index = 1; index < corners.length - 1; index += 1) {
        faces.push([corners[0], corners[index], corners[index + 1]]);
      }
    }
  }

  if (positions.length === 0 || faces.length === 0) throw new Error("OBJ has no mesh geometry");
  return { positions, texcoords, normals, faces, materialLibrary, material };
}

function interpolate(left, right, amount) {
  const mix = (a, b) => a + (b - a) * amount;
  const normal = left.normal.map((value, axis) => mix(value, right.normal[axis]));
  const normalLength = Math.hypot(...normal) || 1;
  return {
    position: left.position.map((value, axis) => mix(value, right.position[axis])),
    texcoord: left.texcoord.map((value, axis) => mix(value, right.texcoord[axis])),
    normal: normal.map((value) => value / normalLength),
  };
}

function clipFace(face, cutoff) {
  const clipped = [];
  for (let index = 0; index < face.length; index += 1) {
    const current = face[index];
    const previous = face[(index + face.length - 1) % face.length];
    const currentInside = current.position[1] >= cutoff;
    const previousInside = previous.position[1] >= cutoff;
    if (currentInside !== previousInside) {
      const amount =
        (cutoff - previous.position[1]) / (current.position[1] - previous.position[1]);
      const corner = interpolate(previous, current, amount);
      corner.position[1] = cutoff;
      clipped.push(corner);
    }
    if (currentInside) clipped.push(current);
  }

  const triangles = [];
  for (let index = 1; index < clipped.length - 1; index += 1) {
    triangles.push([clipped[0], clipped[index], clipped[index + 1]]);
  }
  return triangles;
}

function topology(faces) {
  const weldedIndex = new Map();
  const weldedPositions = [];
  const weldedFaces = [];

  function weld(position) {
    const key = position.map((value) => Math.round(value * 1e7)).join(",");
    if (!weldedIndex.has(key)) {
      weldedIndex.set(key, weldedPositions.length);
      weldedPositions.push(position);
    }
    return weldedIndex.get(key);
  }

  const edgeCounts = new Map();
  for (const face of faces) {
    const welded = face.map((corner) => weld(corner.position));
    weldedFaces.push(welded);
    for (let index = 0; index < 3; index += 1) {
      const left = welded[index];
      const right = welded[(index + 1) % 3];
      const key = left < right ? `${left},${right}` : `${right},${left}`;
      edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1);
    }
  }

  const boundaryEdges = [...edgeCounts]
    .filter(([, count]) => count === 1)
    .map(([key]) => key.split(",").map(Number));
  const nonManifoldEdges = [...edgeCounts.values()].filter((count) => count > 2).length;
  return { weldedPositions, weldedFaces, boundaryEdges, nonManifoldEdges };
}

function boundaryLoops(boundaryEdges) {
  const adjacency = new Map();
  for (const [left, right] of boundaryEdges) {
    if (!adjacency.has(left)) adjacency.set(left, []);
    if (!adjacency.has(right)) adjacency.set(right, []);
    adjacency.get(left).push(right);
    adjacency.get(right).push(left);
  }
  for (const [vertex, neighbors] of adjacency) {
    if (neighbors.length !== 2) {
      throw new Error(`Cut boundary vertex ${vertex} has degree ${neighbors.length}, expected 2`);
    }
  }

  const unvisited = new Set(
    boundaryEdges.map(([left, right]) => left < right ? `${left},${right}` : `${right},${left}`),
  );
  const loops = [];
  while (unvisited.size > 0) {
    const firstKey = unvisited.values().next().value;
    const [start, next] = firstKey.split(",").map(Number);
    const loop = [start];
    let previous = start;
    let current = next;
    unvisited.delete(firstKey);
    while (current !== start) {
      loop.push(current);
      const target = adjacency.get(current).find((candidate) => candidate !== previous);
      const key = current < target ? `${current},${target}` : `${target},${current}`;
      if (!unvisited.delete(key) && target !== start) {
        throw new Error("Cut boundary is not a simple closed contour");
      }
      previous = current;
      current = target;
    }
    loops.push(loop);
  }
  return loops;
}

function positionKey(position) {
  return position.map((value) => Math.round(value * 1e7)).join(",");
}

function edgeKey(positions, [left, right]) {
  const keys = [positionKey(positions[left]), positionKey(positions[right])].sort();
  return keys.join("|");
}

function capFaces(clippedFaces, cutoff) {
  const before = topology(clippedFaces);
  const loops = boundaryLoops(before.boundaryEdges);
  const caps = [];
  const preservedBoundaryEdges = [];
  let capLoops = 0;

  for (const loop of loops) {
    const points = loop.map((index) => before.weldedPositions[index]);
    const onCutPlane = points.map((position) => Math.abs(position[1] - cutoff) <= 1e-6);
    if (onCutPlane.every((value) => !value)) {
      for (let index = 0; index < loop.length; index += 1) {
        preservedBoundaryEdges.push([loop[index], loop[(index + 1) % loop.length]]);
      }
      continue;
    }
    if (!onCutPlane.every(Boolean)) {
      throw new Error("A pre-existing open boundary intersects the cut plane");
    }
    capLoops += 1;
    const contour = points.map(([x, , z]) => new Vector2(x, z));
    const triangles = ShapeUtils.triangulateShape(contour, []);
    if (triangles.length !== Math.max(0, points.length - 2)) {
      throw new Error("Could not safely triangulate a cut boundary");
    }
    const corners = points.map((position) => ({
      position,
      texcoord: [0.5, 0.5],
      normal: [0, -1, 0],
    }));
    for (const triangle of triangles) {
      let [a, b, c] = triangle;
      const left = points[a];
      const middle = points[b];
      const right = points[c];
      const signedArea =
        (middle[0] - left[0]) * (right[2] - left[2])
        - (middle[2] - left[2]) * (right[0] - left[0]);
      if (signedArea < 0) [b, c] = [c, b];
      caps.push([corners[a], corners[b], corners[c]]);
    }
  }

  const sealedFaces = [...clippedFaces, ...caps];
  const after = topology(sealedFaces);
  const expectedBoundaryKeys = new Set(
    preservedBoundaryEdges.map((edge) => edgeKey(before.weldedPositions, edge)),
  );
  const actualBoundaryKeys = new Set(
    after.boundaryEdges.map((edge) => edgeKey(after.weldedPositions, edge)),
  );
  const boundariesChanged =
    actualBoundaryKeys.size !== expectedBoundaryKeys.size
    || [...actualBoundaryKeys].some((key) => !expectedBoundaryKeys.has(key));
  if (
    boundariesChanged
    || after.nonManifoldEdges > before.nonManifoldEdges
  ) {
    throw new Error(
      `Sealed mesh validation failed: ${after.boundaryEdges.length} boundary edges, `
      + `${after.nonManifoldEdges} non-manifold edges `
      + `(clipped input had ${before.nonManifoldEdges})`,
    );
  }
  return {
    faces: sealedFaces,
    loops: capLoops,
    capTriangles: caps.length,
    boundaryEdges: after.boundaryEdges.length,
    nonManifoldEdges: after.nonManifoldEdges,
  };
}

function serializeObj(parsed, faces, cutoff) {
  const positions = [];
  const texcoords = [];
  const normals = [];
  const indexedFaces = [];

  for (const face of faces) {
    const indices = [];
    for (const corner of face) {
      positions.push(corner.position);
      texcoords.push(corner.texcoord);
      normals.push(corner.normal);
      indices.push(positions.length);
    }
    indexedFaces.push(indices);
  }

  const lines = [
    "# Horizontal display base removed and cut surface sealed",
    `# source_cutoff_y ${cutoff}`,
  ];
  if (parsed.materialLibrary) lines.push(parsed.materialLibrary);
  lines.push("o model_without_base");
  positions.forEach((position) => {
    lines.push(`v ${position.map((value) => value.toFixed(9)).join(" ")}`);
  });
  texcoords.forEach((texcoord) => {
    lines.push(`vt ${texcoord.map((value) => value.toFixed(9)).join(" ")}`);
  });
  normals.forEach((normal) => {
    lines.push(`vn ${normal.map((value) => value.toFixed(9)).join(" ")}`);
  });
  lines.push("s 1");
  if (parsed.material) lines.push(parsed.material);
  indexedFaces.forEach((face) => {
    lines.push(`f ${face.map((index) => `${index}/${index}/${index}`).join(" ")}`);
  });
  return `${lines.join("\n")}\n`;
}

function clipAndSeal(parsed, cutoff) {
  const clippedFaces = parsed.faces.flatMap((face) => clipFace(face, cutoff));
  if (clippedFaces.length === 0) throw new Error("Cutoff removed the entire mesh");
  const sealed = capFaces(clippedFaces, cutoff);
  return {
    ...sealed,
    clippedTriangles: clippedFaces.length,
    removedTriangles: parsed.faces.length - clippedFaces.length,
  };
}

function scanCutoffs(parsed, options) {
  const yValues = parsed.positions.map((position) => position[1]);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);
  const height = maxY - minY;
  const candidates = [];

  for (
    let ratio = options.minRatio;
    ratio <= options.maxRatio + options.stepRatio * 0.1;
    ratio += options.stepRatio
  ) {
    const roundedRatio = Number(ratio.toFixed(9));
    const cutoff = minY + roundedRatio * height;
    try {
      const sealed = clipAndSeal(parsed, cutoff);
      candidates.push({
        ratio: roundedRatio,
        cutoffY: cutoff,
        outputTriangles: sealed.faces.length,
        removedTriangles: sealed.removedTriangles,
        capLoops: sealed.loops,
        capTriangles: sealed.capTriangles,
      });
    } catch (error) {
      candidates.push({
        ratio: roundedRatio,
        cutoffY: cutoff,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return { minY, maxY, height, candidates };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    usage();
    return;
  }
  const parsed = parseObj(await readFile(options.input, "utf8"));
  if (options.scan) {
    console.log(JSON.stringify({
      input: options.input,
      inputTriangles: parsed.faces.length,
      ...scanCutoffs(parsed, options),
    }, null, 2));
    return;
  }
  const yValues = parsed.positions.map((position) => position[1]);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);
  const cutoffY = options.cutoffRatio === undefined
    ? options.cutoffY
    : minY + (maxY - minY) * options.cutoffRatio;
  const sealed = clipAndSeal(parsed, cutoffY);
  await writeFile(options.output, serializeObj(parsed, sealed.faces, cutoffY));
  console.log(JSON.stringify({
    input: options.input,
    output: options.output,
    cutoffY,
    cutoffRatio: options.cutoffRatio ?? null,
    inputTriangles: parsed.faces.length,
    outputTriangles: sealed.faces.length,
    removedTriangles: sealed.removedTriangles,
    capLoops: sealed.loops,
    capTriangles: sealed.capTriangles,
    boundaryEdges: sealed.boundaryEdges,
    nonManifoldEdges: sealed.nonManifoldEdges,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
