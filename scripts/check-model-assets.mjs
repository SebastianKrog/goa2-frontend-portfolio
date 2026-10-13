import { opendir, open, readFile } from "node:fs/promises";
import { join } from "node:path";

const HERO_MODEL_DIRECTORY = new URL("../public/models/heroes/", import.meta.url);
const HERO_ARCHIVE_DIRECTORY = new URL("../model-archive/heroes/", import.meta.url);
const GLB_MAGIC = "glTF";
const LFS_POINTER_PREFIX = "version https://git-lfs.github.com/spec/v1";

const failures = [];

async function validateGlb(path, label) {
  const handle = await open(path, "r");
  try {
    const buffer = Buffer.alloc(LFS_POINTER_PREFIX.length);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const header = buffer.subarray(0, bytesRead).toString("ascii");

    if (header.startsWith(LFS_POINTER_PREFIX)) {
      failures.push(`${label}: unresolved Git LFS pointer`);
    } else if (!header.startsWith(GLB_MAGIC)) {
      failures.push(`${label}: invalid GLB header`);
    }
  } finally {
    await handle.close();
  }
}

const deployedDirectory = await opendir(HERO_MODEL_DIRECTORY);
for await (const entry of deployedDirectory) {
  if (!entry.isFile() || !entry.name.endsWith(".glb")) continue;
  await validateGlb(
    join(HERO_MODEL_DIRECTORY.pathname, entry.name),
    `deployed/${entry.name}`,
  );
}

const archiveDirectory = await opendir(HERO_ARCHIVE_DIRECTORY);
for await (const entry of archiveDirectory) {
  if (!entry.isDirectory()) continue;
  const fileName = `${entry.name}-original.glb`;
  await validateGlb(
    join(HERO_ARCHIVE_DIRECTORY.pathname, entry.name, fileName),
    `archive/${entry.name}/${fileName}`,
  );
}

// Every directory under public/ needs a Cache-Control rule in public/_headers,
// or the browser re-requests those files on every page load (Workers Assets
// defaults to `max-age=0, must-revalidate`). Catches a new asset folder that
// was added without a rule.
const headerRules = await readFile(new URL("../public/_headers", import.meta.url), "utf8");
const ruledPaths = new Set(
  headerRules
    .split("\n")
    .filter((line) => line.startsWith("/"))
    .map((line) => line.trim()),
);
const publicDirectory = await opendir(new URL("../public/", import.meta.url));
for await (const entry of publicDirectory) {
  if (!entry.isDirectory()) continue;
  if (!ruledPaths.has(`/${entry.name}/*`)) {
    failures.push(`public/${entry.name}/: no Cache-Control rule in public/_headers`);
  }
}

if (failures.length > 0) {
  console.error("Asset validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  if (failures.some((failure) => failure.includes("LFS"))) {
    console.error("Run `git lfs pull` before building.");
  }
  process.exitCode = 1;
} else {
  console.log("Asset validation passed.");
}
