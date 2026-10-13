import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, realpathSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";
import { execFileSync } from "node:child_process";

const pointerPrefix = "version https://git-lfs.github.com/spec/v1\n";

export async function sha256(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

export async function prepareModels(root, manifest, download) {
  const missing = [];
  for (const file of manifest.files) {
    if (!/^(public\/models\/heroes\/[a-z0-9_]+\.glb|model-archive\/heroes\/[a-z0-9_]+\/[a-z0-9_-]+\.glb)$/.test(file.path)) {
      throw new Error(`Invalid model path: ${file.path}`);
    }
    const path = join(root, file.path);
    const info = await stat(path).catch((error) => {
      if (error.code !== "ENOENT") throw error;
      return null;
    });
    if (!info) {
      missing.push(file);
    } else if (info.size === file.size && await sha256(path) === file.sha256) {
      continue;
    } else if (info.size < 1024 && (await readFile(path, "utf8")).startsWith(pointerPrefix)) {
      const pointer = await readFile(path, "utf8");
      if (!pointer.includes(`oid sha256:${file.sha256}\n`) || !pointer.includes(`size ${file.size}\n`)) {
        throw new Error(`Model bundle is outdated for ${file.path}. Publish an updated bundle.`);
      }
      missing.push(file);
    } else {
      throw new Error(`Preserving changed model ${file.path}. Publish an updated bundle or restore this file before building.`);
    }
  }
  if (!missing.length) {
    console.log(`All ${manifest.files.length} models match the bundle; no download needed.`);
    return;
  }

  const staging = await mkdtemp(join(tmpdir(), "goa2-models-"));
  try {
    const archive = join(staging, "models.tar.gz");
    await download(archive);
    if (await sha256(archive) !== manifest.sha256) throw new Error("Model bundle checksum mismatch; no models replaced.");
    const extracted = join(staging, "extracted");
    await mkdir(extracted);
    execFileSync("tar", ["-xzf", archive, "-C", extracted, "--", ...missing.map((file) => file.path)]);
    // Validate every replacement before modifying any model in the checkout.
    for (const file of missing) {
      const path = join(extracted, file.path);
      if ((await stat(path)).size !== file.size || await sha256(path) !== file.sha256) {
        throw new Error(`Bundle model checksum mismatch: ${file.path}`);
      }
    }
    for (const file of missing) {
      await mkdir(dirname(join(root, file.path)), { recursive: true });
      await copyFile(join(extracted, file.path), join(root, file.path));
    }
    console.log(`Prepared ${missing.length} models from GitHub Releases (no Git LFS download).`);
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

export async function downloadRelease(manifest, destination) {
  const token = process.env.MODEL_ASSET_TOKEN;
  if (!token) throw new Error("Set MODEL_ASSET_TOKEN to a GitHub token with Contents: read access to PedroVIOliv/goa2-frontend. See docs/model-assets.md.");
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
  const response = await fetch(`https://api.github.com/repos/PedroVIOliv/goa2-frontend/releases/tags/${encodeURIComponent(manifest.tag)}`, { headers, signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Cannot read model release ${manifest.tag}: HTTP ${response.status}. Check MODEL_ASSET_TOKEN permissions.`);
  const release = await response.json();
  const asset = release.assets.find((item) => item.name === manifest.asset);
  if (!asset || !Number.isSafeInteger(asset.id)) throw new Error(`Missing release attachment: ${manifest.asset}`);
  console.log(`Downloading model bundle ${manifest.tag}/${manifest.asset} (${asset.size} bytes).`);
  const data = await fetch(`https://api.github.com/repos/PedroVIOliv/goa2-frontend/releases/assets/${asset.id}`, {
    headers: { ...headers, Accept: "application/octet-stream" }, signal: AbortSignal.timeout(300_000),
  });
  if (!data.ok || !data.body) throw new Error(`Cannot download model bundle: HTTP ${data.status}`);
  await pipeline(data.body, createWriteStream(destination, { flags: "wx" }));
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL("../", import.meta.url));
  try {
    const manifest = JSON.parse(await readFile(new URL("./model-assets.json", import.meta.url), "utf8"));
    await prepareModels(root, manifest, (destination) => downloadRelease(manifest, destination));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
