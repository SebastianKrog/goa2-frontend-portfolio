// Cloudflare Worker entry: serves the built SPA and reverse-proxies /api/* to
// the backend (Cloudflare Tunnel -> Raspberry Pi). Keeping the API on the same
// origin as the app means a single Cloudflare Access policy on this hostname
// gates both the app and the API, and the browser never makes a cross-origin
// request (so the backend no longer needs CORS).

interface Env {
  // Static-assets binding (the built Vite SPA). Wired by wrangler `assets`.
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  // Backend origin, e.g. https://backend.example.com (prod) or
  // http://localhost:8000 (dev, via .dev.vars).
  BACKEND_ORIGIN: string;
  // Cloudflare Access service-token credentials. When set, they let this Worker
  // pass the backend's own Access policy while direct human hits on the tunnel
  // hostname are blocked. Unset in local dev (no Access in front of the backend).
  CF_ACCESS_CLIENT_ID?: string;
  CF_ACCESS_CLIENT_SECRET?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      const backend = new URL(env.BACKEND_ORIGIN);
      backend.pathname = url.pathname.replace(/^\/api/, "") || "/";
      backend.search = url.search;

      const headers = new Headers(request.headers);
      if (env.CF_ACCESS_CLIENT_ID && env.CF_ACCESS_CLIENT_SECRET) {
        headers.set("CF-Access-Client-Id", env.CF_ACCESS_CLIENT_ID);
        headers.set("CF-Access-Client-Secret", env.CF_ACCESS_CLIENT_SECRET);
      }

      // Forwarding the request as-is passes the WebSocket upgrade (the
      // /games/{id}/ws endpoint) through unchanged.
      const upstream = await fetch(
        new Request(backend, {
          method: request.method,
          headers,
          body: request.body,
          redirect: "manual",
        }),
      );

      // A 101 carries a live socket that cannot survive being copied.
      if (upstream.status === 101) return upstream;

      // Access answers the service-token headers above with a CF_Authorization
      // cookie meant for this Worker; its JWT names the backend host and is a
      // replayable session for the backend's Access app, so it must not reach
      // the browser. The backend itself sets no cookies.
      //
      // Anything else naming the backend origin is rewritten to this Worker's
      // own /api prefix: FastAPI's trailing-slash redirects put the tunnel
      // hostname in Location, and a browser following one would leave the
      // proxy and hit the backend's Access policy head-on.
      const responseHeaders = new Headers();
      for (const [name, value] of upstream.headers) {
        if (name.toLowerCase() === "set-cookie") continue;
        responseHeaders.set(
          name,
          value.split(env.BACKEND_ORIGIN).join(`${url.origin}/api`),
        );
      }

      return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: responseHeaders,
      });
    }

    return env.ASSETS.fetch(request);
  },
};
