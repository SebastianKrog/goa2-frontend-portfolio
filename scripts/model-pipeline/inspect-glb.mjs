import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

function parseGlb(bytes) {
  if (bytes.toString("ascii", 0, 4) !== "glTF") throw new Error("Not a GLB");
  if (bytes.readUInt32LE(4) !== 2) throw new Error("Not glTF 2.0");
  let offset = 12;
  let json;
  while (offset < bytes.length) {
    const length = bytes.readUInt32LE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    if (type === "JSON") {
      json = JSON.parse(
        bytes.toString("utf8", offset + 8, offset + 8 + length)
          .replace(/\u0000+$/, "")
          .trim(),
      );
    }
    offset += 8 + length;
  }
  if (!json) throw new Error("Missing GLB JSON chunk");
  return json;
}

for (const argument of process.argv.slice(2)) {
  const path = resolve(argument);
  const bytes = await readFile(path);
  const json = parseGlb(bytes);
  let triangles = 0;
  let vertices = 0;
  const positionAccessors = [];

  for (const mesh of json.meshes || []) {
    for (const primitive of mesh.primitives || []) {
      const position = json.accessors[primitive.attributes.POSITION];
      positionAccessors.push(position);
      vertices += position.count;
      const count = primitive.indices === undefined
        ? position.count
        : json.accessors[primitive.indices].count;
      if ((primitive.mode ?? 4) === 4) triangles += count / 3;
    }
  }

  const min = [0, 1, 2].map((axis) => Math.min(
    ...positionAccessors.filter((accessor) => accessor.min).map((accessor) => accessor.min[axis]),
  ));
  const max = [0, 1, 2].map((axis) => Math.max(
    ...positionAccessors.filter((accessor) => accessor.max).map((accessor) => accessor.max[axis]),
  ));

  console.log(JSON.stringify({
    file: basename(path),
    path,
    bytes: bytes.byteLength,
    generator: json.asset?.generator,
    meshes: json.meshes?.length || 0,
    materials: json.materials?.length || 0,
    images: (json.images || []).map((image) => image.mimeType || image.uri),
    extensionsUsed: json.extensionsUsed || [],
    extensionsRequired: json.extensionsRequired || [],
    vertices,
    triangles,
    bounds: {
      min,
      max,
      size: max.map((value, axis) => value - min[axis]),
    },
  }));
}
