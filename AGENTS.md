# Grow an Empire: notes for coding agents

A short, single-player city builder in Three.js + TypeScript, built for the GoLive web portal (iframe hosting). The player makes 12 build choices; the city then runs by itself and musters an army against the Ashfang Raiders. `CLAUDE.md` points here.

## Commands

| Command | What it does |
|---|---|
| `pnpm start` / `start-game.cmd` | Dev server at http://127.0.0.1:4173 (opens the browser) |
| `pnpm check` | `tsc --noEmit`, ESLint and vitest. **Run before you hand work back.** |
| `pnpm test` | vitest only (includes the exhaustive 12-move offer-path proof) |
| `pnpm lint` | ESLint only (`eslint.config.js`) |
| `pnpm package` | Production build → `release/grow-an-empire-<version>.zip`, then runs the portal bundle validator |
| `pnpm art:export` | Re-export `Assets/Runtime/*.webp` from the PNG masters (Python 3 + Pillow) |

Useful URLs on the dev server: `?reset` (discard the save), `?platform=mock` (fake portal SDK with a localStorage "cloud"), `?perf` (FPS and draw-call readout), `?quality=low`, and `/Tools/dev/iframe-test.html` (portal iframe simulator: pause, resume, session end).

## Where things live

- `src/main.ts`: the entry point. Boot order, the render loop (`renderer.setAnimationLoop`), autosave, platform wiring and portal messages.
- `src/game/`: pure rules, no DOM or Three.js.
  - `settlementSimulation.ts` owns all game state (`SettlementState`). **It is the only state owner**: rendering and UI read it and react to its events, and never change resources or moves themselves.
  - `content.ts` is the building catalog; `campaigns.ts` has the move limit and objective.
  - `saveGame.ts` is the local autosave.
- `src/platform/`: the GoLive SDK behind one `PlatformAdapter` (golive, local or mock), the cloud+local `progressStore`, and session/portal messages. See `Docs/adr/0001` and `0002`.
- `src/render/`: Three.js scene, sprites, city layout, civic center, villagers, construction views. Art is loaded lazily through `assetCatalog.ts` (`assetUrl("x.png")` resolves to the bundled `.webp`).
- `src/ui/`: the DOM HUD, cards and tutorial (`hud.ts`).
- `Tools/dev/`: bundle packaging, validator, iframe simulator. `Tools/ArtPipeline/`: art export scripts.
- `common/`: **the portal's rules** (submission, SDK, coding, performance, QA). Read-only reference; don't edit.
- `Docs/`: the design and portal docs (`PORTAL_IMPLEMENTATION_PLAN.md`, `PERFORMANCE_BUDGET.md`, `STORE_LISTING.md`, `QA_RESULTS.md`, `SUBMISSION_CHECKLIST.md`, `adr/`). `TECHNICAL_IMPLEMENTATION.md` is partly out of date; its header says which parts.

## Rules that are easy to break

- **Saves:** `SAVE_SCHEMA_VERSION` is 4. Changing the snapshot shape needs a new version *and* a migration, and must keep `src/game/__tests__/fixtures/save-v4-mid-construction.json` loading. Never edit that fixture.
- **Portal:** asset paths must stay relative (`base: "./"`). No `alert`, `confirm` or `prompt`. No top-level navigation. The SDK script tag in `index.html` must stay. `GAME_ID` in `src/platform/adapters.ts` must equal the portal slug.
- **Art:** add new runtime art as a PNG under `Assets/Art/…`, then run `pnpm art:export`. A test fails if a referenced file isn't bundled, or if the WebP is stale.
- **Performance:** only the first screen may block boot (`Docs/PERFORMANCE_BUDGET.md`). Call `requestRender()` after changing anything visible while paused, because the loop skips frames when nothing changed.
- **Layout:** the HUD publishes its measured size as CSS variables (`--hud-bottom`, `--settlement-bottom`, `--build-panel-reach`). Position panels with those, not fixed pixel offsets. Tap targets stay at least 44 px, and text at least 11 px.
- **Errors:** don't swallow failures silently. Log once with context (`console.warn("[Grow an Empire] …")`) and carry on where the game can.
