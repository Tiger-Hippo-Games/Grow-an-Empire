import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "dist",
    assetsDir: "assets",
    emptyOutDir: true,
  },
  // Dev server (`pnpm dev` / `pnpm start` / start-game.cmd). strictPort makes a
  // second copy fail loudly instead of silently moving to another port.
  server: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
  },
  // `pnpm preview` serves the production build (`pnpm build` first) on its own
  // port, so it can run alongside the dev server for side-by-side checks.
  preview: {
    host: "127.0.0.1",
    port: 4174,
    strictPort: true,
  },
});
