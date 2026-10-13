import {
  copyFileSync,
  createReadStream,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
} from "node:fs";
import { basename, join, resolve } from "node:path";
import { defineConfig } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";

import { cloudflare } from "@cloudflare/vite-plugin";

const archivedHeroRoot = resolve("model-archive/heroes");
const archivedHeroRequest = /^\/models\/heroes\/original\/([a-z0-9_-]+)\.glb$/;

function archivedHeroEntries(): Array<{ key: string; path: string }> {
  return readdirSync(archivedHeroRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      key: entry.name,
      path: join(archivedHeroRoot, entry.name, `${entry.name}-original.glb`),
    }))
    .filter((entry) => existsSync(entry.path));
}

/**
 * Archived GLBs stay outside `public` so there is only one restorable copy in
 * Git. Calibration can still request them in dev, and production builds copy
 * them into a dedicated on-demand asset directory.
 */
function archivedHeroModels(): Plugin {
  return {
    name: "archived-hero-models",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = request.url?.split("?", 1)[0] ?? "";
        const match = archivedHeroRequest.exec(pathname);
        if (!match) {
          next();
          return;
        }

        const entry = archivedHeroEntries().find(({ key }) => key === match[1]);
        if (!entry) {
          next();
          return;
        }

        response.statusCode = 200;
        response.setHeader("Content-Type", "model/gltf-binary");
        response.setHeader("Content-Length", statSync(entry.path).size);
        createReadStream(entry.path).pipe(response);
      });
    },
    writeBundle(outputOptions) {
      if (!outputOptions.dir || basename(outputOptions.dir) !== "client") return;

      const outputDirectory = join(outputOptions.dir, "models/heroes/original");
      mkdirSync(outputDirectory, { recursive: true });
      for (const entry of archivedHeroEntries()) {
        copyFileSync(entry.path, join(outputDirectory, `${entry.key}.glb`));
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), archivedHeroModels(), cloudflare()],
  css: {
    modules: {
      localsConvention: "camelCaseOnly",
    },
  },
  server: {
    // /api/* is proxied to the backend by the Worker (worker/index.ts), which
    // @cloudflare/vite-plugin also runs in dev. BACKEND_ORIGIN comes from
    // .dev.vars. No Vite-level proxy needed.
    port: 3000,
  },
});
