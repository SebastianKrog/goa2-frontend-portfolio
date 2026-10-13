import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { prepareModels, sha256 } from "./prepare-model-assets.mjs";

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "model-bundle-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const bytes = Buffer.from("glTFtest model bytes");
  const file = { path: "public/models/heroes/test.glb", size: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
  const path = join(root, file.path);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes);
  const archive = join(root, "source.tar.gz");
  execFileSync("tar", ["-czf", archive, "-C", root, file.path], { env: { ...process.env, COPYFILE_DISABLE: "1" } });
  const manifest = { files: [file], sha256: await sha256(archive) };
  const pointer = `version https://git-lfs.github.com/spec/v1\noid sha256:${file.sha256}\nsize ${file.size}\n`;
  return { root, path, bytes, archive, manifest, pointer, download: (target) => copyFile(archive, target) };
}

test("matching local models need no network or token", async (t) => {
  const f = await fixture(t);
  await prepareModels(f.root, f.manifest, () => assert.fail("Unexpected download"));
});

test("a fresh checkout pointer is replaced from the verified release", async (t) => {
  const f = await fixture(t);
  await writeFile(f.path, f.pointer);
  await prepareModels(f.root, f.manifest, f.download);
  assert.deepEqual(await readFile(f.path), f.bytes);
});

test("missing models are restored", async (t) => {
  const f = await fixture(t);
  await rm(f.path);
  await prepareModels(f.root, f.manifest, f.download);
  assert.deepEqual(await readFile(f.path), f.bytes);
});

test("a corrupt download leaves the checkout untouched", async (t) => {
  const f = await fixture(t);
  await writeFile(f.path, f.pointer);
  await assert.rejects(prepareModels(f.root, f.manifest, (target) => writeFile(target, "corrupt")), /bundle checksum mismatch/);
  assert.equal(await readFile(f.path, "utf8"), f.pointer);
});

test("modified local models are preserved", async (t) => {
  const f = await fixture(t);
  await writeFile(f.path, "glTFuser changes");
  await assert.rejects(prepareModels(f.root, f.manifest, () => assert.fail("Unexpected download")), /Preserving changed model/);
  assert.equal(await readFile(f.path, "utf8"), "glTFuser changes");
});

test("a new model pointer rejects an outdated bundle before downloading", async (t) => {
  const f = await fixture(t);
  await writeFile(f.path, f.pointer.replace(f.manifest.files[0].sha256, "0".repeat(64)));
  await assert.rejects(prepareModels(f.root, f.manifest, () => assert.fail("Unexpected download")), /bundle is outdated/);
});

test("individual model hashes are checked before replacement", async (t) => {
  const f = await fixture(t);
  await writeFile(f.path, f.pointer);
  f.manifest.files[0].sha256 = "0".repeat(64);
  await rm(f.path);
  await assert.rejects(prepareModels(f.root, f.manifest, f.download), /model checksum mismatch/);
});

test("failed downloads preserve pointers", async (t) => {
  const f = await fixture(t);
  await writeFile(f.path, f.pointer);
  await assert.rejects(prepareModels(f.root, f.manifest, async () => { throw new Error("HTTP 403"); }), /HTTP 403/);
  assert.equal(await readFile(f.path, "utf8"), f.pointer);
});
