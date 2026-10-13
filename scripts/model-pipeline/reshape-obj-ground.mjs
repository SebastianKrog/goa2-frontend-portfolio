import { readFile, writeFile } from "node:fs/promises";

function usage() {
  console.log(`Usage:
  node scripts/model-pipeline/reshape-obj-ground.mjs \\
    --input /path/to/model.obj \\
    --output /path/to/model-with-rounded-ground.obj \\
    --width-ratio 0.82 \\
    --depth-ratio 0.80 \\
    --core-ratio 0.55 \\
    --full-strength-height-ratio 0.14 \\
    --protect-height-ratio 0.22

Rounds a rectangular low terrain footprint without deleting triangles. The
mapping is strongest near the floor and fades to zero at the protection height,
so elevated character geometry such as tails, capes, and weapons is unchanged.
Ratios are measured against the input model bounds.
`);
}

function parseArguments(argv) {
  const options = {};
  const valueOptions = new Set([
    "--input",
    "--output",
    "--width-ratio",
    "--depth-ratio",
    "--core-ratio",
    "--full-strength-height-ratio",
    "--protect-height-ratio",
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help") return { help: true };
    if (!valueOptions.has(argument)) throw new Error(`Unknown option: ${argument}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${argument}`);
    options[argument.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
    index += 1;
  }

  for (const required of [
    "input",
    "output",
    "widthRatio",
    "depthRatio",
    "fullStrengthHeightRatio",
    "protectHeightRatio",
  ]) {
    if (options[required] === undefined) throw new Error(`Missing required option: --${required}`);
  }
  options.coreRatio ??= "0.55";
  for (const property of [
    "widthRatio",
    "depthRatio",
    "coreRatio",
    "fullStrengthHeightRatio",
    "protectHeightRatio",
  ]) {
    options[property] = Number(options[property]);
    if (!Number.isFinite(options[property])) throw new Error(`--${property} must be numeric`);
  }
  if (options.widthRatio <= 0 || options.widthRatio > 1) {
    throw new Error("--width-ratio must be in (0, 1]");
  }
  if (options.depthRatio <= 0 || options.depthRatio > 1) {
    throw new Error("--depth-ratio must be in (0, 1]");
  }
  if (options.coreRatio < 0 || options.coreRatio >= Math.min(options.widthRatio, options.depthRatio)) {
    throw new Error("--core-ratio must be non-negative and smaller than both footprint ratios");
  }
  if (
    options.fullStrengthHeightRatio < 0
    || options.protectHeightRatio <= options.fullStrengthHeightRatio
    || options.protectHeightRatio > 1
  ) {
    throw new Error("Height ratios must satisfy 0 <= full-strength < protect <= 1");
  }
  return options;
}

function parseVector(line, length) {
  const values = line.trim().split(/\s+/).slice(1, length + 1).map(Number);
  if (values.length !== length || values.some((value) => !Number.isFinite(value))) {
    throw new Error(`Invalid OBJ vector: ${line}`);
  }
  return values;
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
  const faces = [];
  let materialLibrary = "";
  let material = "";

  for (const line of source.split(/\r?\n/)) {
    if (line.startsWith("v ")) {
      positions.push(parseVector(line, 3));
    } else if (line.startsWith("vt ")) {
      texcoords.push(parseVector(line, 2));
    } else if (line.startsWith("mtllib ") && !materialLibrary) {
      materialLibrary = line;
    } else if (line.startsWith("usemtl ") && !material) {
      material = line;
    } else if (line.startsWith("f ")) {
      const corners = line.trim().split(/\s+/).slice(1).map((token) => {
        const [positionText, texcoordText] = token.split("/");
        return {
          position: objIndex(positionText, positions.length, "position"),
          texcoord: texcoordText
            ? objIndex(texcoordText, texcoords.length, "texture")
            : null,
        };
      });
      for (let index = 1; index < corners.length - 1; index += 1) {
        faces.push([corners[0], corners[index], corners[index + 1]]);
      }
    }
  }
  if (positions.length === 0 || faces.length === 0) throw new Error("OBJ has no mesh geometry");
  return { positions, texcoords, faces, materialLibrary, material };
}

function bounds(positions) {
  const min = [...positions[0]];
  const max = [...positions[0]];
  for (const position of positions.slice(1)) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], position[axis]);
      max[axis] = Math.max(max[axis], position[axis]);
    }
  }
  return { min, max, size: min.map((value, axis) => max[axis] - value) };
}

function smoothstep(value) {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
}

function reshapePositions(positions, options) {
  const sourceBounds = bounds(positions);
  const [width, height, depth] = sourceBounds.size;
  if (width === 0 || height === 0 || depth === 0) throw new Error("OBJ bounds are degenerate");
  const centerX = (sourceBounds.min[0] + sourceBounds.max[0]) / 2;
  const centerZ = (sourceBounds.min[2] + sourceBounds.max[2]) / 2;
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const fullStrengthY = sourceBounds.min[1] + height * options.fullStrengthHeightRatio;
  const protectY = sourceBounds.min[1] + height * options.protectHeightRatio;
  let movedVertices = 0;
  let protectedVertices = 0;
  let maxDisplacement = 0;

  const reshaped = positions.map(([x, y, z]) => {
    if (y >= protectY) {
      protectedVertices += 1;
      return [x, y, z];
    }
    const u = (x - centerX) / halfWidth;
    const v = (z - centerZ) / halfDepth;
    const radius = Math.hypot(u, v);
    if (radius <= options.coreRatio || radius === 0) return [x, y, z];

    const cosine = u / radius;
    const sine = v / radius;
    const squareBoundaryRadius = 1 / Math.max(Math.abs(cosine), Math.abs(sine));
    const ellipseBoundaryRadius = 1 / Math.hypot(
      cosine / options.widthRatio,
      sine / options.depthRatio,
    );
    const radialProgress = Math.max(0, Math.min(
      1,
      (radius - options.coreRatio) / (squareBoundaryRadius - options.coreRatio),
    ));
    const targetRadius = options.coreRatio
      + radialProgress * (ellipseBoundaryRadius - options.coreRatio);
    const targetX = centerX + cosine * targetRadius * halfWidth;
    const targetZ = centerZ + sine * targetRadius * halfDepth;
    const heightStrength = smoothstep((protectY - y) / (protectY - fullStrengthY));
    const outputX = x + (targetX - x) * heightStrength;
    const outputZ = z + (targetZ - z) * heightStrength;
    const displacement = Math.hypot(outputX - x, outputZ - z);
    if (displacement > 1e-9) movedVertices += 1;
    maxDisplacement = Math.max(maxDisplacement, displacement);
    return [outputX, y, outputZ];
  });

  return {
    positions: reshaped,
    sourceBounds,
    outputBounds: bounds(reshaped),
    fullStrengthY,
    protectY,
    movedVertices,
    protectedVertices,
    maxDisplacement,
  };
}

function faceNormal(face, positions) {
  const [left, middle, right] = face.map((corner) => positions[corner.position]);
  const ab = middle.map((value, axis) => value - left[axis]);
  const ac = right.map((value, axis) => value - left[axis]);
  const normal = [
    ab[1] * ac[2] - ab[2] * ac[1],
    ab[2] * ac[0] - ab[0] * ac[2],
    ab[0] * ac[1] - ab[1] * ac[0],
  ];
  const length = Math.hypot(...normal) || 1;
  return normal.map((value) => value / length);
}

function serializeObj(parsed, positions, options) {
  const lines = [
    "# Low terrain footprint reshaped without deleting geometry",
    `# footprint_width_ratio ${options.widthRatio}`,
    `# footprint_depth_ratio ${options.depthRatio}`,
    `# protected_above_height_ratio ${options.protectHeightRatio}`,
  ];
  if (parsed.materialLibrary) lines.push(parsed.materialLibrary);
  lines.push("o model_with_rounded_ground");
  positions.forEach((position) => {
    lines.push(`v ${position.map((value) => value.toFixed(9)).join(" ")}`);
  });
  parsed.texcoords.forEach((texcoord) => {
    lines.push(`vt ${texcoord.map((value) => value.toFixed(9)).join(" ")}`);
  });
  const normals = parsed.faces.map((face) => faceNormal(face, positions));
  normals.forEach((normal) => {
    lines.push(`vn ${normal.map((value) => value.toFixed(9)).join(" ")}`);
  });
  lines.push("s off");
  if (parsed.material) lines.push(parsed.material);
  parsed.faces.forEach((face, faceIndex) => {
    const normalIndex = faceIndex + 1;
    const tokens = face.map((corner) => {
      const positionIndex = corner.position + 1;
      const texcoordIndex = corner.texcoord === null ? "" : corner.texcoord + 1;
      return `${positionIndex}/${texcoordIndex}/${normalIndex}`;
    });
    lines.push(`f ${tokens.join(" ")}`);
  });
  return `${lines.join("\n")}\n`;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    usage();
    return;
  }
  const parsed = parseObj(await readFile(options.input, "utf8"));
  const result = reshapePositions(parsed.positions, options);
  await writeFile(options.output, serializeObj(parsed, result.positions, options));
  console.log(JSON.stringify({
    input: options.input,
    output: options.output,
    vertices: parsed.positions.length,
    triangles: parsed.faces.length,
    sourceBounds: result.sourceBounds,
    outputBounds: result.outputBounds,
    fullStrengthY: result.fullStrengthY,
    protectY: result.protectY,
    movedVertices: result.movedVertices,
    protectedVertices: result.protectedVertices,
    maxDisplacement: result.maxDisplacement,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
