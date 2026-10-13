import { defineConfig } from "vitest/config";

// Deliberately does not extend vite.config.ts: the Cloudflare Worker plugin there
// rejects the Node externals vitest needs, and these are pure-logic unit tests
// that want no app build pipeline at all.
export default defineConfig({
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
