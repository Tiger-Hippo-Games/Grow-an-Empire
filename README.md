# Grow an Empire

An HTML5/Three.js vertical slice of a branching eight-move city. The player makes one strategic building choice per move while the settlement constructs, produces, upgrades, and populates itself automatically.

The playable slice includes:

- a rolling three-card build pool across eight moves;
- fifteen possible district buildings, with eight selected in any one city;
- nine civic states: Level 0 campsite plus one upgrade per move, ending at the Grand Town Hall;
- prerequisite-driven offers such as Farm → Bakery, Orchard → Winery, and Blacksmith → Weapons Workshop → Barracks;
- visible autonomous population growth from 1 villager at Level 0 to 37 villagers at Level 8;
- autonomous resource production and complementary-building bonuses;
- a 30-second default construction cadence with pause, restart, 0.5–8× speed, and grid controls;
- a hard decision stop after Move 8, with the chosen buildings continuing to operate.

See `Docs/BUILD_ORDER_CONTENT.md` for the offer rules and `Docs/GAME_ARCHITECTURE.md` for runtime boundaries.

## Run locally

```powershell
pnpm install
pnpm dev
```

Open `http://127.0.0.1:4173/`.

## Verify

```powershell
pnpm run build
python Tools/ArtPipeline/validate_harvest_loop.py
```

## Asset workflow

See `Assets/Art/ART_DIRECTION.md`, `Assets/Art/ART_PIPELINE.md`, and `Assets/Art/Production/Buildings/EIGHT_MOVE_GENERATION_NOTES.md`.
