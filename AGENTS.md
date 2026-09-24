# Grow an Empire: notes for coding agents

A short, single-player city builder in Three.js + TypeScript, built for the GoLive web portal (iframe hosting). The player makes 12 build choices, paying for each from the stockpile; the city runs its economy and trains soldiers by itself, then fights one of 25 enemy armies. Wins earn 1–3 stars, and stars unlock the next campaign. `CLAUDE.md` points here.

## Commands

| Command | What it does |
|---|---|
| `pnpm start` / `start-game.cmd` | Dev server at http://127.0.0.1:4173 (opens the browser) |
| `pnpm check` | `tsc --noEmit`, ESLint and vitest. **Run before you hand work back.** |
| `pnpm test` | vitest only (includes the exhaustive 12-move offer-path proof and the balance search over every build order) |
| `pnpm lint` | ESLint only (`eslint.config.js`) |
| `pnpm package` | Production build → `release/grow-an-empire-<version>.zip`, then runs the portal bundle validator |
| `pnpm art:export` | Re-export `Assets/Runtime/*.webp` from the PNG masters (Python 3 + Pillow) |

Useful URLs on the dev server: `?reset` (discard the save), `?platform=mock` (fake portal SDK with a localStorage "cloud"), `?perf` (FPS and draw-call readout), `?quality=low`, and `/Tools/dev/iframe-test.html` (portal iframe simulator: pause, resume, session end).

## Where things live

- `src/main.ts`: the entry point. Boot order, the render loop (`renderer.setAnimationLoop`), autosave, platform wiring and portal messages.
- `src/game/`: pure rules, no DOM or Three.js.
  - `settlementSimulation.ts` owns all game state (`SettlementState`). **It is the only state owner**: rendering and UI read it and react to its events, and never change resources or moves themselves.
  - `economy.ts` holds every number (costs, output, soldier costs, market prices); `content.ts` is the building catalog, with card text generated from `economy.ts`.
  - `battle.ts` is the strength rule, battle rounds and stars; `campaigns.ts` has the 25 campaigns and the star unlock rule.
  - `balance.ts` plays every reachable game (used by `balance.test.ts` and `Tools/balance/calibrate.ts`; not in the bundle). **Change a number in `economy.ts` and `pnpm test` tells you what it did to every campaign**; rerun `npx tsx Tools/balance/calibrate.ts` to recalibrate the enemies.
  - `saveGame.ts` is the local autosave.
- `src/platform/`: the GoLive SDK behind one `PlatformAdapter` (golive, local or mock), the cloud+local `progressStore`, and session/portal messages. See `Docs/adr/0001` and `0002`.
- `src/render/`: Three.js scene, sprites, city layout, civic center, villagers, construction views. Art is loaded lazily through `assetCatalog.ts` (`assetUrl("x.png")` resolves to the bundled `.webp`).
- `src/ui/`: the DOM HUD, cards, move summary, keyboard shortcuts and tutorial (`hud.ts`); the briefing, muster/market, battle strip and result dialogs (`campaignFlow.ts`); the 25-stop map (`campaignMap.ts`); synthesized sound (`sound.ts`). `render/combatScene.ts` is the battle strip's unit icons.
- `Tools/dev/`: bundle packaging, validator, iframe simulator. `Tools/ArtPipeline/`: art export scripts.
- `common/`: **the portal's rules** (submission, SDK, coding, performance, QA). Read-only reference; don't edit.
- `Docs/`: the design and portal docs (`PORTAL_IMPLEMENTATION_PLAN.md`, `PERFORMANCE_BUDGET.md`, `STORE_LISTING.md`, `QA_RESULTS.md`, `SUBMISSION_CHECKLIST.md`, `adr/`). `TECHNICAL_IMPLEMENTATION.md` is partly out of date; its header says which parts.

## Rules that are easy to break

- **Saves:** `SAVE_SCHEMA_VERSION` is 6 (`migrateSnapshot` converts v4 and v5). Changing the snapshot shape needs a new version *and* a migration, and must keep `src/game/__tests__/fixtures/save-v4-mid-construction.json` loading. Never edit that fixture. Stars live beside the snapshot in `SavedGame.campaignStars` (merged with the best of local and cloud).
- **Portal:** asset paths must stay relative (`base: "./"`). No `alert`, `confirm` or `prompt`. No top-level navigation. The SDK script tag in `index.html` must stay. `GAME_ID` in `src/platform/adapters.ts` must equal the portal slug.
- **Art:** add new runtime art as a PNG under `Assets/Art/…`, then run `pnpm art:export`. A test fails if a referenced file isn't bundled, or if the WebP is stale.
- **Performance:** only the first screen may block boot (`Docs/PERFORMANCE_BUDGET.md`). Call `requestRender()` after changing anything visible while paused, because the loop skips frames when nothing changed.
- **Layout:** the game is a fixed 1280×720 stage (16:9, landscape only), scaled as a whole to fit the window or portal frame and centred, with bars on the long side; a 1920×1080 frame shows it at exactly 1.5×. The fit runs in an inline script in `index.html` (`--stage-scale`, `window.__gaeStageScale`); `sceneSetup.ts` includes the scale in the pixel ratio. Lay things out in stage pixels and don't add viewport media queries or `vw`/`vh` units. The HUD publishes its measured size in stage pixels as CSS variables (`--hud-bottom`, `--settlement-bottom`, `--build-panel-reach`). Position panels with those, not fixed pixel offsets. Tap targets stay at least 44 px, and text at least 0.78rem (12.5 stage px).
- **Build output:** `dist/` is `index.html`, `game.js`, `style.css` and `assets/` (art). It only runs over HTTP: opened straight from a folder, browsers block its scripts and styles. Check a build with `pnpm preview`.
- **Errors:** don't swallow failures silently. Log once with context (`console.warn("[Grow an Empire] …")`) and carry on where the game can.
- **Browser QA:** `Tools/qa/*.py` share `Tools/qa/flow.py` (map → briefing → city, play a move, play to the muster, fight). Update it, not each script, when the flow changes.
