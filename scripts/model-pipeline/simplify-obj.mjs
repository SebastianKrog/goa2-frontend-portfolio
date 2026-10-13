import { createReadStream } from "node:fs";
import { writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { MeshoptSimplifier } from "meshoptimizer/simplifier";

function usage() {
  console.log(`Usage:
  node scripts/model-pipeline/simplify-obj.mjs \\
    --input /path/to/high-poly.obj \\
    --output /path/to/simplified.obj \\
    --target-triangles 28000 \\
    --target-error 0.05

Reduces an indexed, textured triangle OBJ while retaining its UV seams. The
output contains generated flat normals so it can be passed directly to the
painted-hero base-removal and conversion scripts.
`);
}

function parseArguments(argv) {
  const options = { targetError: 0.05 };
  const names = new Set(["--input", "--output", "--target-triangles", "--target-error"]);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help") return { help: true };
    if (!names.has(argument)) throw new Error(`Unknown option: ${argument}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${argument}`);
    options[argument.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
    index += 1;
  }
  for (const required of ["input", "output", "targetTriangles"]) {
    if (!options[required]) throw new Error(`Missing required option: --${required}`);
  }
  options.targetTriangles = Number(options.targetTriangles);
  options.targetError = Number(options.targetError);
  if (!Number.isInteger(options.targetTriangles) || options.targetTriangles < 4) {
    throw new Error("--target-triangles must be an integer of at least 4");
  }
  if (!Number.isFinite(options.targetError) || options.targetError <= 0 || options.targetError > 1) {
    throw new Error("--target-error must be greater than 0 and at most 1");
  }
  return options;
}

function objIndex(text, length, description) {
  if (!text) throw new Error(`OBJ face is missing a ${description} index`);
  const value = Number(text);
  if (!Number.isInteger(value) || value === 0) throw new Error(`Invalid OBJ ${description} index`);
  return value > 0 ? value - 1 : length + value;
}

async function parseObj(path) {
  const sourcePositions = [];
  const sourceTexcoords = [];
  const positions = [];
  const texcoords = [];
  const indices = [];
  const vertexByCorner = new Map();
  let materialLibrary = "";
  let material = "";
  let sourceTriangles = 0;

  const lines = createInterface({
    input: createReadStream(path),
    crlfDelay: Infinity,
  });
  for await (const line of lines) {
    if (line.startsWith("v ")) {
      sourcePositions.push(...line.trim().split(/\s+/).slice(1, 4).map(Number));
    } else if (line.startsWith("vt ")) {
      sourceTexcoords.push(...line.trim().split(/\s+/).slice(1, 3).map(Number));
    } else if (line.startsWith("mtllib ") && !materialLibrary) {
      materialLibrary = line;
    } else if (line.startsWith("usemtl ") && !material) {
      material = line;
    } else if (line.startsWith("f ")) {
      const corners = line.trim().split(/\s+/).slice(1).map((token) => {
        const [positionText, texcoordText] = token.split("/");
        const position = objIndex(positionText, sourcePositions.length / 3, "position");
        const texcoord = objIndex(texcoordText, sourceTexcoords.length / 2, "texture");
        const key = `${position}/${texcoord}`;
        let vertex = vertexByCorner.get(key);
        if (vertex === undefined) {
          vertex = positions.length / 3;
          vertexByCorner.set(key, vertex);
          positions.push(
            sourcePositions[position * 3],
            sourcePositions[position * 3 + 1],
            sourcePositions[position * 3 + 2],
          );
          texcoords.push(
            sourceTexcoords[texcoord * 2],
            sourceTexcoords[texcoord * 2 + 1],
          );
        }
        return vertex;
      });
      for (let index = 1; index < corners.length - 1; index += 1) {
        indices.push(corners[0], corners[index], corners[index + 1]);
        sourceTriangles += 1;
      }
    }
  }
  if (positions.length === 0 || indices.length === 0) throw new Error("OBJ has no mesh geometry");
  return {
    positions: new Float32Array(positions),
    texcoords: new Float32Array(texcoords),
    indices: new Uint32Array(indices),
    materialLibrary,
    material,
    sourceTriangles,
  };
}

function compactAttributes(indices, positions, texcoords) {
  const [remap, vertexCount] = MeshoptSimplifier.compactMesh(indices);
  const compactPositions = new Float32Array(vertexCount * 3);
  const compactTexcoords = new Float32Array(vertexCount * 2);
  const missing = 0xffffffff;
  for (let source = 0; source < remap.length; source += 1) {
    const target = remap[source];
    if (target === missing) continue;
    compactPositions.set(positions.subarray(source * 3, source * 3 + 3), target * 3);
    compactTexcoords.set(texcoords.subarray(source * 2, source * 2 + 2), target * 2);
  }
  return { positions: compactPositions, texcoords: compactTexcoords };
}

function faceNormal(positions, leftIndex, middleIndex, rightIndex) {
  const a = leftIndex * 3;
  const b = middleIndex * 3;
  const c = rightIndex * 3;
  const ab = [
    positions[b] - positions[a],
    positions[b + 1] - positions[a + 1],
    positions[b + 2] - positions[a + 2],
  ];
  const ac = [
    positions[c] - positions[a],
    positions[c + 1] - positions[a + 1],
    positions[c + 2] - positions[a + 2],
  ];
  const normal = [
    ab[1] * ac[2] - ab[2] * ac[1],
    ab[2] * ac[0] - ab[0] * ac[2],
    ab[0] * ac[1] - ab[1] * ac[0],
  ];
  const length = Math.hypot(...normal) || 1;
  return normal.map((value) => value / length);
}

function serializeObj(parsed, indices, positions, texcoords, summary) {
  const lines = [
    "# Simplified with meshoptimizer for the GoA2 painted-hero pipeline",
    `# source_triangles ${summary.sourceTriangles}`,
    `# output_triangles ${summary.outputTriangles}`,
    `# simplification_error ${summary.error}`,
  ];
  if (parsed.materialLibrary) lines.push(parsed.materialLibrary);
  lines.push("o simplified_model");
  for (let index = 0; index < positions.length; index += 3) {
    lines.push(`v ${positions[index].toFixed(9)} ${positions[index + 1].toFixed(9)} ${positions[index + 2].toFixed(9)}`);
  }
  for (let index = 0; index < texcoords.length; index += 2) {
    lines.push(`vt ${texcoords[index].toFixed(9)} ${texcoords[index + 1].toFixed(9)}`);
  }
  for (let index = 0; index < indices.length; index += 3) {
    lines.push(`vn ${faceNormal(
      positions,
      indices[index],
      indices[index + 1],
      indices[index + 2],
    ).map((value) => value.toFixed(9)).join(" ")}`);
  }
  lines.push("s 0");
  if (parsed.material) lines.push(parsed.material);
  for (let index = 0; index < indices.length; index += 3) {
    const normal = index / 3 + 1;
    const face = [indices[index], indices[index + 1], indices[index + 2]]
      .map((vertex) => `${vertex + 1}/${vertex + 1}/${normal}`);
    lines.push(`f ${face.join(" ")}`);
  }
  return `${lines.join("\n")}\n`;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    usage();
    return;
  }
  const parsed = await parseObj(options.input);
  await MeshoptSimplifier.ready;
  const targetIndices = options.targetTriangles * 3;
  let [indices, error] = MeshoptSimplifier.simplify(
    parsed.indices,
    parsed.positions,
    3,
    targetIndices,
    options.targetError,
    ["Prune"],
  );
  let method = "simplify";
  if (indices.length > targetIndices * 1.05) {
    [indices, error] = MeshoptSimplifier.simplifySloppy(
      parsed.indices,
      parsed.positions,
      3,
      null,
      targetIndices,
      options.targetError,
    );
    method = "simplifySloppy";
  }
  const compact = compactAttributes(indices, parsed.positions, parsed.texcoords);
  const summary = {
    input: options.input,
    output: options.output,
    sourceTriangles: parsed.sourceTriangles,
    outputTriangles: indices.length / 3,
    sourceVertices: parsed.positions.length / 3,
    outputVertices: compact.positions.length / 3,
    targetTriangles: options.targetTriangles,
    targetError: options.targetError,
    error,
    method,
  };
  await writeFile(
    options.output,
    serializeObj(parsed, indices, compact.positions, compact.texcoords, summary),
  );
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
