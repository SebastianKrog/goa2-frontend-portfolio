import { execFileSync } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256 } from "./prepare-model-assets.mjs";

const [tag, output] = process.argv.slice(2);
if (!/^models-v[0-9]+$/.test(tag ?? "") || !output) {
  throw new Error("Usage: npm run models:bundle -- models-v1 /absolute/output/directory");
}
const root = fileURLToPath(new URL("../", import.meta.url));
const files = JSON.parse(execFileSync("git", ["lfs", "ls-files", "--json"], { cwd: root, encoding: "utf8" })).files;
if (!files.length) throw new Error("No LFS models found.");
const entries = [];
for (const file of files) {
  if (!/^(public\/models\/heroes\/|model-archive\/heroes\/)/.test(file.name) || !file.name.endsWith(".glb")) {
    throw new Error(`Unexpected LFS file: ${file.name}`);
  }
  const path = join(root, file.name);
  const digest = await sha256(path);
  if (digest !== file.oid || (await stat(path)).size !== file.size) {
    throw new Error(`Unresolved or unstaged model: ${file.name}. Stage model changes before creating the bundle.`);
  }
  if ((await readFile(path)).subarray(0, 4).toString() !== "glTF") throw new Error(`Invalid GLB: ${file.name}`);
  entries.push({ path: file.name, size: file.size, sha256: digest });
}
entries.sort((a, b) => a.path.localeCompare(b.path));
await mkdir(resolve(output), { recursive: true });
const asset = `goa2-${tag}.tar.gz`;
const archive = resolve(output, asset);
execFileSync("tar", ["-czf", archive, "-C", root, "--", ...entries.map((file) => file.path)], {
  env: { ...process.env, COPYFILE_DISABLE: "1" },
});
const manifest = { tag, asset, sha256: await sha256(archive), files: entries };
await writeFile(resolve(output, "model-assets.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Created ${archive} with ${entries.length} models. Copy model-assets.json into scripts/ after uploading the release attachment.`);
