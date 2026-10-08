import { defineConfig, type Plugin } from "vite";

import { readFileSync } from "node:fs";

/**
 * Locally there is no portal backend, so /sdk/platform-sdk.js would
 * otherwise fall through to index.html and fail as a script. Serve an empty
 * stub instead; the game then runs offline (or with ?platform=mock).
 */
function goLiveSdkStub(): Plugin {
  const handler = (req: { url?: string }, res: { setHeader(k: string, v: string): void; end(body: string): void }, next: () => void) => {
    if (!req.url?.startsWith("/sdk/platform-sdk.js")) return next();
    res.setHeader("Content-Type", "application/javascript");
    res.end("/* GoLive SDK stub: the real SDK is served by the portal. */\n");
  };
  return {
    name: "golive-sdk-stub",
    apply: "serve",
    transformIndexHtml(html) {
      return html.replace("https://golive-platform.netlify.app/sdk/platform-sdk.js", "/sdk/platform-sdk.js");
    },
    configureServer(server) { server.middlewares.use(handler); },
    configurePreviewServer(server) { server.middlewares.use(handler); },
  };
}

/** Adds ?v=<version> to the game.js and style.css links in the built index.html. */
function versionedEntryLinks(): Plugin {
  return {
    name: "versioned-entry-links",
    apply: "build",
    transformIndexHtml(html) {
      return html.replace(/(\.\/(?:game\.js|style\.css))"/g, `$1?v=${version}"`);
    },
  };
}

const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

export default defineConfig({
  // Relative paths: the portal serves the game from /api/v1/games/<slug>/play/,
  // so absolute "/assets/..." URLs would 404 there (GAME_SUBMISSION_GUIDE §4).
  base: "./",
  plugins: [goLiveSdkStub(), versionedEntryLinks()],
  // Exposed to the game as __APP_VERSION__ and sent with analytics events.
  define: { __APP_VERSION__: JSON.stringify(version) },
  build: {
    outDir: "dist",
    assetsDir: "assets",
    emptyOutDir: true,
    // Plain names at the bundle root, as in GAME_SUBMISSION_GUIDE §4:
    // index.html, game.js, style.css, and the art under assets/.
    // index.html links them with ?v=<version> (below), so an update is never
    // served from a stale browser cache.
    chunkSizeWarningLimit: 800,
    rolldownOptions: {
      output: {
        entryFileNames: "game.js",
        chunkFileNames: "game-[name].js",
        assetFileNames: (asset) => (asset.names.some((name) => name.endsWith(".css")) ? "style.css" : "assets/[name]-[hash][extname]"),
      },
    },
  },
  // Dev server (`pnpm dev` / `pnpm start` / start-game.cmd). strictPort makes a
  // second copy fail loudly instead of silently moving to another port.
  server: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
    // PNG masters are never imported by the app. Watching large art copies on
    // Windows can raise EBUSY and terminate the dev server during an export.
    watch: { ignored: ["**/Assets/Art/**", "**/release/**"] },
  },
  // `pnpm preview` serves the production build (`pnpm build` first) on its own
  // port, so it can run alongside the dev server for side-by-side checks.
  preview: {
    host: "127.0.0.1",
    port: 4174,
    strictPort: true,
  },
});
