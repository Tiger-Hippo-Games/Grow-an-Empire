# Grow an Empire

An HTML5/Three.js city defense game. The player makes one building choice per move while the settlement constructs, produces, upgrades, and populates itself, then defends it against an enemy army.

The game includes:

- 25 campaigns, each a named enemy army, all on the same rules: 12 moves and the same starting stockpile (14 wood, 8 stone, 4 grain, 6 rations);
- an enemy briefing when a campaign starts, and again when the enemy arrives;
- 16 buildings with build costs and production chains (wood → planks, grain/livestock → rations, fruit → wine), up to three prerequisite-valid cards per move;
- soldiers trained from materials and free villagers: archers (Weapons Workshop), swordsmen (Blacksmith) and horsemen (Stable), who eat rations every move and desert when there are none;
- a move summary before every choice: what was produced, used and trained, idle buildings, and warnings;
- stuck moves: swap spare goods at the Marketplace at twice the price, or Gather (build nothing, everything still works);
- a pre-battle market that sells goods for sellswords (15 gold each, up to half the enemy's army);
- a battle shown as two strips of unit icons greying out over four rounds, then a result with 1–3 stars and what would have done better;
- a campaign map with 25 stops; stars unlock the next campaign (win the previous one and hold 1.8 × campaigns-won stars); any campaign can be replayed;
- thirteen civic states, population growth, and semantic city districts with roads;
- sound effects (with a mute button), keyboard shortcuts (1-3 choose, G gather, Space pause, S speed, M mute, F full screen), and a full-screen button;
- a 30-second construction cadence with pause, restart, 1–8× speed, and grid controls.

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
| Start over as a first-time player (no save, tutorial shown) | Open `http://127.0.0.1:4173/?reset` (the flag clears itself, so later reloads resume normally) |
| Get through the twelve moves quickly | Click **Speed** until it shows 8× |
| Re-read the tutorial without losing your game | Click **How to play** |
| Check the production build | `pnpm build` then `pnpm preview` (serves on port 4174, so it can run beside the dev server) |
| Run type-checks, lint and tests | `pnpm check` (or `pnpm test:watch` while editing game logic) |
| See FPS, draw calls and textures | Add `?perf` to the URL |
| Try the low-quality tier | Add `?quality=low` |
| Test cloud saves without the portal | Add `?platform=mock` (a fake portal SDK keeps its "cloud" in localStorage and logs every call to the console) |
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

The validator checks the portal's rules: size under 50 MB, `index.html` at the root, the SDK script tag, relative paths, no localhost URLs, no `alert()`, and the thumbnail and banner. It prints "Ready to upload" when the ZIP passes. Upload steps and the listing text are in `Docs/SUBMISSION_CHECKLIST.md` and `Docs/STORE_LISTING.md`. The portal's own rules are in `common/`.

- **Runtime art** is WebP, generated from the PNGs with `pnpm art:export` (Python 3 + Pillow). A test fails if it's out of date.
- **Store images** are made with `python Tools/ArtPipeline/make_store_art.py`.
- **Performance targets** and how to measure them: `Docs/PERFORMANCE_BUDGET.md`.
- **Design decisions**: `Docs/adr/`.
- **Notes for coding agents**: `AGENTS.md`.

## Asset workflow

See `Assets/Art/ART_DIRECTION.md`, `Assets/Art/ART_PIPELINE.md`, and `Assets/Art/Production/Buildings/EIGHT_MOVE_GENERATION_NOTES.md`.
