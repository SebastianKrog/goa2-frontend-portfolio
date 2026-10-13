import { spawn } from "node:child_process";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(SCRIPT_DIRECTORY, "../..");
const THREE_ROOT = resolve(REPOSITORY_ROOT, "node_modules/three");
const RENDERER_PATH = join(SCRIPT_DIRECTORY, "render-glb-thumbnail.html");

function usage() {
  console.log(`Usage:
  node scripts/model-pipeline/render-glb-thumbnails.mjs \\
    --output-dir /tmp/model-thumbnails \\
    [--top] \\
    /path/to/model-a.glb /path/to/model-b.glb
`);
}

function parseArguments(argv) {
  const options = { models: [], top: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help") return { help: true };
    if (argument === "--top") {
      options.top = true;
      continue;
    }
    if (argument === "--output-dir") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error("Missing value for --output-dir");
      options.outputDir = value;
      index += 1;
    } else if (argument.startsWith("--")) {
      throw new Error(`Unknown option: ${argument}`);
    } else {
      options.models.push(argument);
    }
  }
  if (!options.outputDir) throw new Error("Missing required option: --output-dir");
  if (options.models.length === 0) throw new Error("Provide at least one GLB");
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

function safeServedPath(root, requestedPath) {
  const path = resolve(root, requestedPath);
  if (path !== root && !path.startsWith(`${root}${sep}`)) {
    throw new Error("Requested path escapes its root");
  }
  return path;
}

async function detectChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (await exists(candidate)) return candidate;
  }
  throw new Error("Chrome/Chromium not found");
}

async function renderModel(modelPath, outputPath, chromePath, top) {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "goa-model-render-"));
  let resolveResult;
  let rejectResult;
  const result = new Promise((resolvePromise, rejectPromise) => {
    resolveResult = resolvePromise;
    rejectResult = rejectPromise;
  });
  let failure = "";

  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://127.0.0.1");
      if (request.method === "POST" && url.pathname === "/result") {
        const chunks = [];
        for await (const chunk of request) chunks.push(chunk);
        await writeFile(outputPath, Buffer.concat(chunks));
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

      let path;
      if (url.pathname === "/") path = RENDERER_PATH;
      else if (url.pathname === "/model.glb") path = modelPath;
      else if (url.pathname.startsWith("/three/")) {
        path = safeServedPath(THREE_ROOT, url.pathname.slice("/three/".length));
      }
      if (!path || !await exists(path)) {
        response.writeHead(404);
        response.end("Not found");
        return;
      }
      const body = await readFile(path);
      const extension = extname(path).toLowerCase();
      const contentType = extension === ".html"
        ? "text/html; charset=utf-8"
        : extension === ".js"
          ? "text/javascript; charset=utf-8"
          : extension === ".glb"
            ? "model/gltf-binary"
            : "application/octet-stream";
      response.writeHead(200, {
        "Content-Type": contentType,
        "Content-Length": body.length,
        "Cache-Control": "no-store",
      });
      response.end(body);
    } catch (error) {
      response.writeHead(500);
      response.end(String(error));
    }
  });

  try {
    await new Promise((resolvePromise, rejectPromise) => {
      server.once("error", rejectPromise);
      server.listen(0, "127.0.0.1", resolvePromise);
    });
    const address = server.address();
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
      `http://127.0.0.1:${address.port}/?top=${top ? "1" : "0"}`,
    ], { stdio: ["ignore", "ignore", "pipe"] });
    const chromeExited = new Promise((resolvePromise) => chrome.once("exit", resolvePromise));
    let chromeErrors = "";
    chrome.stderr.on("data", (chunk) => {
      chromeErrors += chunk.toString("utf8");
    });
    chrome.once("exit", (code) => {
      if (!failure) {
        rejectResult(new Error(
          `Chrome exited before rendering completed (code ${code}).\n${chromeErrors.slice(-4000)}`,
        ));
      }
    });
    const timeout = setTimeout(() => {
      rejectResult(new Error(`Rendering timed out.\n${chromeErrors.slice(-4000)}`));
    }, 120_000);
    try {
      await result;
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
    }
  } finally {
    await new Promise((resolvePromise) => server.close(resolvePromise));
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    usage();
    return;
  }
  const outputDirectory = resolve(options.outputDir);
  await mkdir(outputDirectory, { recursive: true });
  const chrome = await detectChrome();
  for (const modelArgument of options.models) {
    const model = resolve(modelArgument);
    const output = join(outputDirectory, `${basename(model, extname(model))}.png`);
    console.error(`Rendering ${basename(model)}...`);
    await renderModel(model, output, chrome, options.top);
    console.log(JSON.stringify({ model, output }));
  }
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
