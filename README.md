# Grow an Empire

A short HTML5/Three.js city-builder and defence game for the GoLive web portal, dressed as a mythic Bharatvarsha epic. Each move the player builds one building (or gathers); the city then works by itself (production, processing, training, upkeep) and, after the last move, defends itself against a named enemy army.

The game includes:

- 25 campaigns in five chapters, each a named enemy army of swordsmen, archers and horsemen, rated easy, medium or hard; each campaign reads its own move count (`campaign.moveLimit`, 8–12; 12 today) and starts from the same stockpile;
- an enemy briefing when a campaign starts, and the muster when the enemy arrives;
- 16 buildings with build costs and production chains (wood → planks, grain/livestock → rations, fruit → Soma), up to three prerequisite-valid cards per move; the Granary is offered right after a Farm or Mango Grove;
- soldiers trained from materials: archers (Weapons Workshop), swordsmen (Blacksmith) and horsemen (Stable); they eat rations every move, and a food shortage pauses recruitment (no one deserts);
- a safe economy: every move ends with at least 4 wood, 2 stone, 2 grain and 1 ration (camp supplies top up only a shortfall);
- Gather on every choice turn: build nothing this move, the city still works;
- a move report before every choice: each building's line (used → made, trained, or why it stood idle), each good before → after, and warnings;
- a Bazaar that swaps spare goods at twice the price on a stuck move and sells goods for sellswords at the muster (15 gold each, up to half the enemy's army);
- the battle played out in the muster popup (formations, four rounds, exact survivors, Skip), then a result with 1–3 stars and what would have done better;
- a scrolling campaign map with 25 stops; stars unlock the next campaign; any campaign can be replayed;
- the Rival Realm: 1,008 AI rajas to climb past, kept separate from the portal's real leaderboard (`campaign-progress`, signed-in players only);
- cloud saves for signed-in players (guests keep their progress in the browser);
- synthesized sound effects (mute button), a speed slider (1×/2×/4×/8×, default 4×), keyboard shortcuts (1–3 choose, Enter leaves the report, G gather, Space or P pause, S speed, M mute, F full screen) and full screen;
- words and icons while learning, icons only afterwards, on every screen size (fixed 1280×720 stage scaled to the portal frame, fluid layouts for phones and small windows).

The design and the balance tables are in the "Grow an Empire: Economy & Army Design" doc (project docs); `src/game/economy.ts` holds the numbers.

See `Docs/BUILD_ORDER_CONTENT.md` for the offer rules and `Docs/GAME_ARCHITECTURE.md` for runtime boundaries.

Character cutouts and their `-walk4.png` sheets live in `Assets/Art/Generated 512`.
Each sheet packs four 256 × 256 poses into one 512 × 512 PNG. After replacing a
source cutout, regenerate the sheets with `pwsh -File art-tools/create-walk-sheets.ps1`.

## Run locally

**First time on a computer (Windows):** double-click `setup-tools.cmd`. It checks
Node.js (22.13 or newer, needed by pnpm 11), installs pnpm if it's missing, then
runs `pnpm install`, `pnpm check` and `pnpm package`, and offers to open the built
game. Batch files run even where PowerShell blocks scripts ("running scripts is
disabled on this system").

**Test the portal build:** double-click `test-build.cmd` (or run `pnpm preview`).
It serves `dist/` at http://127.0.0.1:4174/. Opening `dist/index.html` straight
from the folder doesn't work: browsers block a page's scripts and styles there.

**Easiest (Windows):** double-click `start-game.cmd`. It checks Node, installs
dependencies the first time (or whenever `package.json` / `pnpm-lock.yaml`
change), starts the dev server, and opens the game in your browser. Keep its
window open while you play; close it to stop the server. If the server is
already running, double-clicking again just opens another browser tab.

**From a terminal:**

```powershell
pnpm install
pnpm start        # dev server + opens http://127.0.0.1:4173/
```

`pnpm dev` does the same without opening a browser. Code changes reload the
page automatically; your in-progress game resumes from its autosave.

Requirements: Node 22.13+ (pnpm 11 needs it; Vite 8 alone would run on 20.19+),
and pnpm (the launcher falls back to `npx pnpm@11.19.0` if pnpm isn't installed).

### Testing tips

| Want to… | Do this |
|---|---|
| Start over as a first-time player (no save, tutorial shown) | Open `http://127.0.0.1:4173/?reset` (the flag clears itself, so later reloads resume normally). The testing switches (`?reset`, `?platform=mock`, `?perf`) only work in development and on localhost, never on the portal |
| Get through a campaign quickly | Drag the speed slider to 8× (or press S) |
| Re-read the tutorial without losing your game | Click **How to play** |
| Check the production build | `pnpm build` then `pnpm preview` (serves on port 4174, so it can run beside the dev server) |
| Run type-checks, lint and tests | `pnpm check` (or `pnpm test:watch` while editing game logic) |
| See FPS, draw calls and textures | Add `?perf` to the URL |
| Try the low-quality tier | Add `?quality=low` |
| Test cloud saves without the portal | Add `?platform=mock&auth=email` (a fake portal SDK, signed in, keeps its "cloud" in localStorage and logs every call to the console). Plain `?platform=mock` is a guest: no cloud save, as on the portal |
| Check art, fonts and sound loaded | Type `__gaeAssetHealth` in the browser console, or run `python Tools/qa/assets_audio.py` |
| Test inside a portal-like iframe | Open `http://127.0.0.1:4173/Tools/dev/iframe-test.html` (buttons send pause, resume and session end) |

### Troubleshooting

- **"Port 4173 is already in use"**: a dev server is already running (maybe in another window). Use that one, or close it first.
- **The page says "The game didn't start"**: the code failed before the game could load. The dev server's terminal window shows the actual error (often a typo in a file you just edited). Fix it, then click Reload.
- **"Could not load the settlement. Failed to load image …"** or **"Bundled asset not found: …"**: the runtime WebP for that art is missing. Run `pnpm art:export` after adding or renaming art in `Assets/Art/Production/…` (new art also needs adding to `SOURCES` in `Tools/ArtPipeline/export_runtime_webp.py`). The filename in the message says which one.
- **Game looks stuck on an old state**: open `?reset` as above.

## Verify

```powershell
pnpm check                 # tsc --noEmit + ESLint + vitest
pnpm build                 # production build into dist/
python Tools/ArtPipeline/validate_harvest_loop.py
```

## Build for the GoLive portal

```powershell
pnpm package               # build + release/grow-an-empire-<version>.zip + bundle validator
```

The validator checks the portal's rules: size (limit 200 MB, our target under 50 MB), `index.html` at the root, the SDK script tag, relative paths, every file the page, code and styles load present in the ZIP, no localhost URLs, no `alert()`, no top-level navigation, and the thumbnail and banner. It prints "Ready to upload" when the ZIP passes. Upload steps and the listing text are in `Docs/SUBMISSION_CHECKLIST.md` and `Docs/STORE_LISTING.md`. The portal's own rules are in `common/`.

- **Runtime art** is WebP, generated from the PNGs with `pnpm art:export` (Python 3 + Pillow). A test fails if it's out of date.
- **Store images** (key art: the finished city, its defenders and the raiders, title in Yatra One) are made with `python Tools/ArtPipeline/make_store_art.py` from `Assets/Art/Store/store-art-source-1920x1080-v2.png`.
- **Changes per version**: `CHANGELOG.md`.
- **Performance targets** and how to measure them: `Docs/PERFORMANCE_BUDGET.md`.
- **Design decisions**: `Docs/adr/`.
- **Notes for coding agents**: `AGENTS.md`.

## Asset workflow

See `Assets/Art/ART_DIRECTION.md`, `Assets/Art/ART_PIPELINE.md`, and `Assets/Art/Production/Buildings/EIGHT_MOVE_GENERATION_NOTES.md`.
