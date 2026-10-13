import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  access,
  copyFile,
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(SCRIPT_DIRECTORY, "../..");
const THREE_ROOT = resolve(REPOSITORY_ROOT, "node_modules/three");
const CONVERTER_PATH = join(SCRIPT_DIRECTORY, "converter.html");
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

function usage() {
  console.log(`Usage:
  npm run model:convert -- \\
    --hero min \\
    --input /path/to/min.zip \\
    --reference model-archive/heroes/min/min-original.glb \\
    --output public/models/heroes/min.glb \\
    --rotation-y 180

Options:
  --hero NAME              Hero slug used for object/material names.
  --input PATH             ZIP archive or extracted directory.
  --reference PATH         Existing GLB whose height and floor should be matched.
  --output PATH            Destination GLB.
  --rotation-y DEGREES     Uniform-model Y rotation before export (default: 0).
  --texture-size PIXELS    Maximum texture width/height (default: 1024).
  --base-format FORMAT     jpeg or png (default: jpeg).
  --archive PATH           Backup path for an existing output.
  --no-archive             Do not archive an existing output.
  --chrome PATH            Chrome/Chromium executable override.
  --obj PATH               OBJ override inside the extracted input.
  --base-color PATH        Base-color texture override.
  --metallic PATH          Metallic texture override.
  --normal PATH            Normal texture override.
  --roughness PATH         Roughness texture override.
  --help                   Show this help.
`);
}

function parseArguments(argv) {
  const options = {
    rotationY: 0,
    textureSize: 1024,
    baseFormat: "jpeg",
    archive: true,
  };
  const valueOptions = new Set([
    "hero",
    "input",
    "reference",
    "output",
    "rotation-y",
    "texture-size",
    "base-format",
    "archive",
    "chrome",
    "obj",
    "base-color",
    "metallic",
    "normal",
    "roughness",
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help") return { help: true };
    if (argument === "--no-archive") {
      options.archive = false;
      continue;
    }
    if (!argument.startsWith("--")) throw new Error(`Unexpected argument: ${argument}`);
    const key = argument.slice(2);
    if (!valueOptions.has(key)) throw new Error(`Unknown option: ${argument}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${argument}`);
    index += 1;
    const property = key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    options[property] = value;
  }

  options.rotationY = Number(options.rotationY);
  options.textureSize = Number(options.textureSize);
  if (!Number.isFinite(options.rotationY)) throw new Error("--rotation-y must be numeric");
  if (!Number.isInteger(options.textureSize) || options.textureSize <= 0) {
    throw new Error("--texture-size must be a positive integer");
  }
  if (!["jpeg", "png"].includes(options.baseFormat)) {
    throw new Error("--base-format must be jpeg or png");
  }
  for (const required of ["hero", "input", "reference", "output"]) {
    if (!options[required]) throw new Error(`Missing required option: --${required}`);
  }
  return options;
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function selectSingle(files, root, description, predicate, override) {
  if (override) {
    const resolved = resolve(root, override);
    if (!files.includes(resolved)) {
      throw new Error(`${description} override is not inside the extracted input: ${override}`);
    }
    return resolved;
  }
  const matches = files.filter(predicate);
  if (matches.length !== 1) {
    throw new Error(
      `Expected one ${description}, found ${matches.length}: ${matches.map(basename).join(", ")}`,
    );
  }
  return matches[0];
}

function safeServedPath(root, requestedPath) {
  const path = resolve(root, requestedPath);
  if (path !== root && !path.startsWith(`${root}${sep}`)) {
    throw new Error("Requested path escapes its root");
  }
  return path;
}

function contentType(path) {
  const extension = extname(path).toLowerCase();
  if (extension === ".html") return "text/html; charset=utf-8";
  if (extension === ".js") return "text/javascript; charset=utf-8";
  if (extension === ".obj") return "text/plain; charset=utf-8";
  if (extension === ".png") return "image/png";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  if (extension === ".glb") return "model/gltf-binary";
  return "application/octet-stream";
}

async function sha256(path) {
  const hash = createHash("sha256");
  hash.update(await readFile(path));
  return hash.digest("hex");
}

function gitRevisionFor(path) {
  const result = spawnSync(
    "git",
    ["log", "-1", "--format=%H", "--", relative(REPOSITORY_ROOT, path)],
    { cwd: REPOSITORY_ROOT, encoding: "utf8" },
  );
  return result.status === 0 ? result.stdout.trim() : "";
}

async function archiveExistingModel(outputPath, archivePath, hero) {
  if (!await exists(outputPath)) return null;
  if (await exists(archivePath)) {
    console.error(`Archive already exists; leaving it unchanged: ${archivePath}`);
    return {
      path: archivePath,
      bytes: (await stat(archivePath)).size,
      sha256: await sha256(archivePath),
      existing: true,
    };
  }

  await mkdir(dirname(archivePath), { recursive: true });
  await copyFile(outputPath, archivePath);
  const bytes = (await stat(archivePath)).size;
  const digest = await sha256(archivePath);
  const revision = gitRevisionFor(outputPath);
  const readmePath = join(dirname(archivePath), "README.md");
  if (!await exists(readmePath)) {
    await writeFile(
      readmePath,
      `# Original ${hero} model

\`${basename(archivePath)}\` is the model archived before the painted replacement.

- Source revision: \`${revision || "unknown"}\`
- Size: ${bytes.toLocaleString("en-US")} bytes
- SHA-256: \`${digest}\`
- Deployment status: archive only; this directory is outside \`public/\`.

Restore it with:

\`\`\`bash
git lfs pull
cp ${relative(REPOSITORY_ROOT, archivePath)} ${relative(REPOSITORY_ROOT, outputPath)}
npm run check:models
npm run build
\`\`\`
`,
    );
  }
  return { path: archivePath, bytes, sha256: digest, existing: false };
}

async function detectChrome(override) {
  const candidates = [
    override,
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (await exists(candidate)) return candidate;
  }
  throw new Error("Chrome/Chromium not found. Pass --chrome PATH or set CHROME_PATH.");
}

async function validateGlb(path) {
  const handle = await open(path, "r");
  try {
    const header = Buffer.alloc(12);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    if (bytesRead !== header.length || header.toString("ascii", 0, 4) !== "glTF") {
      throw new Error(`Generated file is not a valid GLB: ${path}`);
    }
    if (header.readUInt32LE(4) !== 2) throw new Error("Generated GLB is not glTF 2.0");
    const declaredLength = header.readUInt32LE(8);
    const actualLength = (await stat(path)).size;
    if (declaredLength !== actualLength) {
      throw new Error(`GLB length mismatch: header=${declaredLength}, file=${actualLength}`);
    }
  } finally {
    await handle.close();
  }
}

async function canonicalizeGlb(path) {
  const bytes = await readFile(path);
  let offset = 12;
  let json;
  let binary;
  while (offset < bytes.length) {
    const length = bytes.readUInt32LE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === "JSON") {
      json = JSON.parse(data.toString("utf8").replace(/\u0000+$/, "").trim());
    } else if (type === "BIN\u0000") {
      binary = data;
    }
    offset += 8 + length;
  }
  if (!json || !binary) throw new Error("Cannot canonicalize GLB without JSON and BIN chunks");
  if ((json.extensionsUsed || []).length > 0) {
    throw new Error("Canonicalization does not support GLB extensions");
  }

  const imageViewIndices = (json.images || []).map((image) => image.bufferView);
  if (imageViewIndices.some((index) => index === undefined)) {
    throw new Error("Canonicalization requires embedded images");
  }
  const imageViewSet = new Set(imageViewIndices);
  const nonImageViewIndices = json.bufferViews
    .map((_, index) => index)
    .filter((index) => !imageViewSet.has(index));
  const orderedOldIndices = [
    ...nonImageViewIndices,
    ...imageViewIndices.filter((index, position) => imageViewIndices.indexOf(index) === position),
  ];
  if (orderedOldIndices.length !== json.bufferViews.length) {
    throw new Error("Canonicalization found unsupported shared or unreferenced buffer views");
  }

  const indexMap = new Map(orderedOldIndices.map((oldIndex, newIndex) => [oldIndex, newIndex]));
  const chunks = [];
  let binaryLength = 0;
  const reorderedViews = orderedOldIndices.map((oldIndex) => {
    const view = json.bufferViews[oldIndex];
    const start = view.byteOffset || 0;
    const data = binary.subarray(start, start + view.byteLength);
    const paddingLength = (4 - (data.length % 4)) % 4;
    chunks.push(data);
    if (paddingLength > 0) chunks.push(Buffer.alloc(paddingLength));
    const reordered = { ...view, byteOffset: binaryLength };
    binaryLength += data.length + paddingLength;
    return reordered;
  });

  for (const accessor of json.accessors || []) {
    if (accessor.bufferView !== undefined) accessor.bufferView = indexMap.get(accessor.bufferView);
    if (accessor.sparse?.indices?.bufferView !== undefined) {
      accessor.sparse.indices.bufferView = indexMap.get(accessor.sparse.indices.bufferView);
    }
    if (accessor.sparse?.values?.bufferView !== undefined) {
      accessor.sparse.values.bufferView = indexMap.get(accessor.sparse.values.bufferView);
    }
  }
  for (const image of json.images || []) {
    image.bufferView = indexMap.get(image.bufferView);
  }
  json.bufferViews = reorderedViews;
  json.buffers[0].byteLength = binaryLength;

  const jsonData = Buffer.from(JSON.stringify(json));
  const jsonPadding = (4 - (jsonData.length % 4)) % 4;
  const jsonChunk = Buffer.concat([jsonData, Buffer.alloc(jsonPadding, 0x20)]);
  const binaryChunk = Buffer.concat(chunks);
  const totalLength = 12 + 8 + jsonChunk.length + 8 + binaryChunk.length;
  const header = Buffer.alloc(12);
  header.write("glTF", 0, "ascii");
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonChunk.length, 0);
  jsonHeader.write("JSON", 4, "ascii");
  const binaryHeader = Buffer.alloc(8);
  binaryHeader.writeUInt32LE(binaryChunk.length, 0);
  binaryHeader.write("BIN\u0000", 4, "ascii");
  await writeFile(path, Buffer.concat([
    header,
    jsonHeader,
    jsonChunk,
    binaryHeader,
    binaryChunk,
  ]));
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    usage();
    return;
  }

  const inputPath = resolve(options.input);
  const referencePath = resolve(options.reference);
  const outputPath = resolve(options.output);
  const temporaryRoot = await mkdtemp(join(tmpdir(), "goa2-painted-hero-"));
  const extractedRoot = join(temporaryRoot, "input");
  const temporaryOutput = join(temporaryRoot, `${options.hero}.glb`);
  let inputRoot = inputPath;

  try {
    if ((await stat(inputPath)).isFile()) {
      if (extname(inputPath).toLowerCase() !== ".zip") {
        throw new Error("--input must be a ZIP archive or directory");
      }
      await mkdir(extractedRoot, { recursive: true });
      const unzip = spawnSync("unzip", ["-q", inputPath, "-d", extractedRoot], {
        encoding: "utf8",
      });
      if (unzip.status !== 0) throw new Error(`unzip failed: ${unzip.stderr}`);
      inputRoot = extractedRoot;
    }

    const files = (await collectFiles(inputRoot)).map((path) => resolve(path));
    const images = files.filter((path) => IMAGE_EXTENSIONS.has(extname(path).toLowerCase()));
    const objPath = selectSingle(
      files,
      inputRoot,
      "OBJ file",
      (path) => extname(path).toLowerCase() === ".obj",
      options.obj,
    );
    const normalPath = selectSingle(
      images,
      inputRoot,
      "normal map",
      (path) => basename(path).toLowerCase().includes("normal"),
      options.normal,
    );
    const metallicPath = selectSingle(
      images,
      inputRoot,
      "metallic map",
      (path) => basename(path).toLowerCase().includes("metallic"),
      options.metallic,
    );
    const roughnessPath = selectSingle(
      images,
      inputRoot,
      "roughness map",
      (path) => basename(path).toLowerCase().includes("roughness"),
      options.roughness,
    );
    const excludedMaps = new Set([normalPath, metallicPath, roughnessPath]);
    const baseColorPath = selectSingle(
      images,
      inputRoot,
      "base-color map",
      (path) => !excludedMaps.has(path),
      options.baseColor,
    );

    const archivePath = options.archive === false
      ? null
      : resolve(
        typeof options.archive === "string"
          ? options.archive
          : join(
            REPOSITORY_ROOT,
            "model-archive/heroes",
            options.hero,
            `${options.hero}-original.glb`,
          ),
      );
    const archive = archivePath
      ? await archiveExistingModel(outputPath, archivePath, options.hero)
      : null;

    const chromePath = await detectChrome(options.chrome);
    let metadata;
    let failure;
    let resolveResult;
    let rejectResult;
    const resultPromise = new Promise((resolvePromise, rejectPromise) => {
      resolveResult = resolvePromise;
      rejectResult = rejectPromise;
    });

    const routes = new Map([
      ["/converter.html", CONVERTER_PATH],
      ["/reference.glb", referencePath],
      ["/input/model.obj", objPath],
      ["/input/base-color", baseColorPath],
      ["/input/metallic", metallicPath],
      ["/input/normal", normalPath],
      ["/input/roughness", roughnessPath],
    ]);

    const server = createServer(async (request, response) => {
      try {
        const url = new URL(request.url, "http://127.0.0.1");
        if (request.method === "POST" && url.pathname === "/result") {
          const chunks = [];
          for await (const chunk of request) chunks.push(chunk);
          await writeFile(temporaryOutput, Buffer.concat(chunks));
          metadata = JSON.parse(decodeURIComponent(request.headers["x-model-metadata"]));
          response.writeHead(204);
          response.end();
          resolveResult();
          return;
        }
        if (request.method === "POST" && url.pathname === "/failure") {
          const chunks = [];
          for await (const chunk of request) chunks.push(chunk);
          failure = Buffer.concat(chunks).toString("utf8");
          response.writeHead(204);
          response.end();
          rejectResult(new Error(failure));
          return;
        }

        let path = routes.get(url.pathname);
        if (!path && url.pathname.startsWith("/three/")) {
          path = safeServedPath(THREE_ROOT, url.pathname.slice("/three/".length));
        }
        if (!path || !await exists(path)) {
          response.writeHead(404);
          response.end("Not found");
          return;
        }
        const body = await readFile(path);
        response.writeHead(200, {
          "Content-Type": contentType(path),
          "Content-Length": body.length,
          "Cache-Control": "no-store",
        });
        response.end(body);
      } catch (error) {
        response.writeHead(500);
        response.end(String(error));
      }
    });

    await new Promise((resolvePromise, rejectPromise) => {
      server.once("error", rejectPromise);
      server.listen(0, "127.0.0.1", resolvePromise);
    });
    const address = server.address();
    const query = new URLSearchParams({
      hero: options.hero,
      textureSize: String(options.textureSize),
      baseFormat: options.baseFormat,
      rotationY: String(options.rotationY),
    });
    const converterUrl = `http://127.0.0.1:${address.port}/converter.html?${query}`;
    const chromeProfile = join(temporaryRoot, "chrome-profile");
    const chrome = spawn(chromePath, [
      "--headless=new",
      "--no-sandbox",
      "--enable-unsafe-swiftshader",
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--disable-background-networking",
      "--disable-component-update",
      `--user-data-dir=${chromeProfile}`,
      converterUrl,
    ], { stdio: ["ignore", "ignore", "pipe"] });
    const chromeExited = new Promise((resolvePromise) => {
      chrome.once("exit", resolvePromise);
    });
    let chromeErrors = "";
    chrome.stderr.on("data", (chunk) => {
      chromeErrors += chunk.toString("utf8");
    });
    chrome.once("exit", (code) => {
      if (!metadata && !failure) {
        rejectResult(new Error(
          `Chrome exited before conversion completed (code ${code}).\n${chromeErrors.slice(-4000)}`,
        ));
      }
    });

    const timeout = setTimeout(() => {
      rejectResult(new Error(`Conversion timed out.\n${chromeErrors.slice(-4000)}`));
    }, 120_000);
    try {
      await resultPromise;
    } finally {
      clearTimeout(timeout);
      if (chrome.exitCode === null) chrome.kill("SIGTERM");
      await Promise.race([
        chromeExited,
        new Promise((resolvePromise) => setTimeout(resolvePromise, 5_000)),
      ]);
      if (chrome.exitCode === null) {
        chrome.kill("SIGKILL");
        await chromeExited;
      }
      await new Promise((resolvePromise) => server.close(resolvePromise));
    }
    if (failure) throw new Error(failure);

    await validateGlb(temporaryOutput);
    await canonicalizeGlb(temporaryOutput);
    await validateGlb(temporaryOutput);
    await mkdir(dirname(outputPath), { recursive: true });
    await copyFile(temporaryOutput, outputPath);
    const outputBytes = (await stat(outputPath)).size;
    const outputSha256 = await sha256(outputPath);

    console.log(JSON.stringify({
      output: outputPath,
      outputBytes,
      outputSha256,
      archive,
      source: {
        obj: objPath,
        baseColor: baseColorPath,
        metallic: metallicPath,
        normal: normalPath,
        roughness: roughnessPath,
      },
      ...metadata,
    }, null, 2));
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
