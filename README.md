# Grow an Empire

An HTML5/Three.js city defense game. The player makes one strategic building choice per move while the settlement constructs, produces, upgrades, and populates itself automatically.

The playable slice includes:

- a rolling build pool across twelve moves, with three cards offered whenever eligible choices remain;
- fifteen possible district buildings, with twelve selected in any one city;
- thirteen civic states: Level 0 campsite plus one upgrade per move, ending at the Grand Muster Hall;
- prerequisite-driven offers such as Farm → Bakery, Orchard → Winery, and Blacksmith → Barracks or Weapons Workshop;
- population growth from 1 villager at Level 0 to 79 at Level 12, with an early House adding 2 people per subsequent level;
- semantic city districts with five roads that grow toward occupied civic, forest, farm, southwest, and industrial quarters;
- autonomous resource production and complementary-building bonuses;
- a 30-second default construction cadence with pause, restart, 1–8× speed, and grid controls;
- a final army muster after Move 12, scored against the approaching raiders.

See `Docs/BUILD_ORDER_CONTENT.md` for the offer rules and `Docs/GAME_ARCHITECTURE.md` for runtime boundaries.

## Run locally

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

Requirements: Node 20.19+ or 22.12+ (Vite 8), and pnpm (the launcher falls
back to `npx pnpm@11.19.0` if pnpm isn't installed).

### Testing tips

| Want to… | Do this |
|---|---|
| Start over as a first-time player (no save, tutorial shown) | Open `http://127.0.0.1:4173/?reset` (the flag clears itself, so later reloads resume normally) |
| Get through the twelve moves quickly | Click **Speed** until it shows 8× |
| Re-read the tutorial without losing your game | Click **How to play** |
| Check the production build | `pnpm build` then `pnpm preview` (serves on port 4174, so it can run beside the dev server) |
| Run type-checks and tests | `pnpm check` (or `pnpm test:watch` while editing game logic) |

### Troubleshooting

- **"Port 4173 is already in use"**: a dev server is already running (maybe in another window). Use that one, or close it first.
- **The page says "The game didn't start"**: the code failed before the game could load. The dev server's terminal window shows the actual error (often a typo in a file you just edited). Fix it, then click Reload.
- **"Could not load the settlement. Failed to load image …"**: that art file is missing from `Assets/Art/Production/…` or was renamed. The filename in the message says which one.
- **Game looks stuck on an old state**: open `?reset` as above.

## Verify

```powershell
pnpm check                 # tsc --noEmit + vitest
pnpm build                 # production build into dist/
python Tools/ArtPipeline/validate_harvest_loop.py
```

## Asset workflow

See `Assets/Art/ART_DIRECTION.md`, `Assets/Art/ART_PIPELINE.md`, and `Assets/Art/Production/Buildings/EIGHT_MOVE_GENERATION_NOTES.md`.
