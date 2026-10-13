import { spawnSync } from "node:child_process";
import {
  access,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(SCRIPT_DIRECTORY, "../..");
const DEFAULT_MANIFEST = join(SCRIPT_DIRECTORY, "painted-hero-batch.json");
const REMOVE_BASE_SCRIPT = join(SCRIPT_DIRECTORY, "remove-obj-base.mjs");
const RESHAPE_GROUND_SCRIPT = join(SCRIPT_DIRECTORY, "reshape-obj-ground.mjs");
const SIMPLIFY_SCRIPT = join(SCRIPT_DIRECTORY, "simplify-obj.mjs");
const CONVERT_SCRIPT = join(SCRIPT_DIRECTORY, "convert-painted-hero.mjs");

function usage() {
  console.log(`Usage:
  node scripts/model-pipeline/batch-convert-painted-heroes.mjs \\
    --archive /path/to/GOA-COLORIDOS.zip \\
    --output-dir /tmp/painted-previews

Options:
  --archive PATH       Source ZIP containing the manifest folders.
  --manifest PATH      Batch manifest (default: painted-hero-batch.json).
  --output-dir PATH    Preview output directory.
  --final              Replace public hero GLBs and archive originals.
  --hero SLUG          Process only one hero; repeat for multiple heroes.
  --include-pilots     Reprocess entries already marked pilot-complete.
  --help               Show this help.
`);
}

function parseArguments(argv) {
  const options = {
    manifest: DEFAULT_MANIFEST,
    final: false,
    includePilots: false,
    heroes: [],
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help") return { help: true };
    if (argument === "--final") {
      options.final = true;
      continue;
    }
    if (argument === "--include-pilots") {
      options.includePilots = true;
      continue;
    }
    if (!["--archive", "--manifest", "--output-dir", "--hero"].includes(argument)) {
      throw new Error(`Unknown option: ${argument}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${argument}`);
    index += 1;
    if (argument === "--hero") options.heroes.push(value);
    else options[argument.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
  }
  if (!options.archive) throw new Error("Missing required option: --archive");
  if (!options.final && !options.outputDir) {
    throw new Error("Preview conversion requires --output-dir");
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

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: REPOSITORY_ROOT,
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(
      `${basename(command)} failed (${result.status})\n${result.stdout}\n${result.stderr}`,
    );
  }
  return result.stdout.trim();
}

function selectFile(files, description, predicate) {
  const matches = files.filter(predicate);
  if (matches.length !== 1) {
    throw new Error(
      `Expected one ${description}, found ${matches.length}: ${matches.map(basename).join(", ")}`,
    );
  }
  return matches[0];
}

async function processHero(entry, manifest, options) {
  if (entry.status === "pilot-complete" && !options.includePilots) {
    return { hero: entry.hero, status: "skipped-pilot" };
  }
  const temporaryRoot = await mkdtemp(join(tmpdir(), `goa-${entry.hero}-`));
  try {
    let inputRoot;
    if (entry.sourceArchive) {
      run("unzip", ["-q", options.archive, entry.sourceArchive, "-d", temporaryRoot]);
      const nestedArchive = join(temporaryRoot, entry.sourceArchive);
      inputRoot = join(temporaryRoot, "source");
      await mkdir(inputRoot, { recursive: true });
      run("unzip", ["-q", nestedArchive, "-d", inputRoot]);
    } else {
      const archiveFolder = `${manifest.archiveRoot}/${entry.sourceFolder}`;
      run("unzip", [
        "-q",
        options.archive,
        `${archiveFolder}/*`,
        "-d",
        temporaryRoot,
      ]);
      inputRoot = join(temporaryRoot, archiveFolder);
    }
    const files = await collectFiles(inputRoot);
    const sourceObj = selectFile(
      files,
      "OBJ",
      (path) => path.toLowerCase().endsWith(".obj"),
    );
    const texture = (suffix) => selectFile(
      files,
      suffix || "base-color texture",
      (path) => basename(path).toLowerCase() === `texture_pbr_20250901${suffix}.png`,
    );
    const baseColor = texture("");
    const metallic = texture("_metallic");
    const normal = texture("_normal");
    const roughness = texture("_roughness");
    let obj = sourceObj;
    let simplification = null;
    if (entry.simplifyTriangles) {
      obj = join(inputRoot, `${entry.hero}-simplified.obj`);
      simplification = JSON.parse(run(process.execPath, [
        SIMPLIFY_SCRIPT,
        "--input",
        sourceObj,
        "--output",
        obj,
        "--target-triangles",
        String(entry.simplifyTriangles),
        "--target-error",
        String(entry.simplifyError ?? 0.05),
      ]));
    }
    const cutObj = join(inputRoot, `${entry.hero}-without-base.obj`);

    const baseRemoval = JSON.parse(run(process.execPath, [
      REMOVE_BASE_SCRIPT,
      "--input",
      obj,
      "--output",
      cutObj,
      "--cutoff-ratio",
      String(entry.cutoffRatio),
    ]));

    let conversionObj = cutObj;
    let groundReshape = null;
    if (entry.groundReshape) {
      conversionObj = join(inputRoot, `${entry.hero}-rounded-ground.obj`);
      groundReshape = JSON.parse(run(process.execPath, [
        RESHAPE_GROUND_SCRIPT,
        "--input",
        cutObj,
        "--output",
        conversionObj,
        "--width-ratio",
        String(entry.groundReshape.widthRatio),
        "--depth-ratio",
        String(entry.groundReshape.depthRatio),
        "--core-ratio",
        String(entry.groundReshape.coreRatio ?? 0.55),
        "--full-strength-height-ratio",
        String(entry.groundReshape.fullStrengthHeightRatio),
        "--protect-height-ratio",
        String(entry.groundReshape.protectHeightRatio),
      ]));
    }

    const originalArchive = join(
      REPOSITORY_ROOT,
      "model-archive/heroes",
      entry.hero,
      `${entry.hero}-original.glb`,
    );
    const publicModel = join(REPOSITORY_ROOT, "public/models/heroes", `${entry.hero}.glb`);
    const reference = await exists(originalArchive) ? originalArchive : publicModel;
    const output = options.final
      ? publicModel
      : resolve(options.outputDir, `${entry.hero}.glb`);
    await mkdir(dirname(output), { recursive: true });

    const converterArgs = [
      CONVERT_SCRIPT,
      "--hero",
      entry.hero,
      "--input",
      inputRoot,
      "--reference",
      reference,
      "--output",
      output,
      "--rotation-y",
      String(entry.rotationY ?? 180),
      "--obj",
      relative(inputRoot, conversionObj),
      "--base-color",
      relative(inputRoot, baseColor),
      "--metallic",
      relative(inputRoot, metallic),
      "--normal",
      relative(inputRoot, normal),
      "--roughness",
      relative(inputRoot, roughness),
    ];
    if (!options.final) converterArgs.push("--no-archive");
    const conversion = JSON.parse(run(process.execPath, converterArgs));
    if (entry.maxTriangles && conversion.triangles > entry.maxTriangles) {
      throw new Error(
        `${entry.hero} has ${conversion.triangles} triangles, above ${entry.maxTriangles}`,
      );
    }

    return {
      hero: entry.hero,
      status: "converted",
      source: entry.sourceArchive ?? entry.sourceFolder,
      simplification,
      baseRemoval,
      groundReshape,
      conversion,
      outputBytes: (await stat(output)).size,
    };
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    usage();
    return;
  }
  const archive = resolve(options.archive);
  const manifestPath = resolve(options.manifest);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const selected = manifest.heroes.filter((entry) => (
    options.heroes.length === 0 || options.heroes.includes(entry.hero)
  ));
  if (selected.length === 0) throw new Error("No manifest heroes matched");

  const results = [];
  for (const entry of selected) {
    console.error(`Processing ${entry.hero}...`);
    results.push(await processHero(entry, manifest, { ...options, archive }));
  }
  console.log(JSON.stringify({
    archive,
    manifest: manifestPath,
    final: options.final,
    results,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
