# Grow an Empire

An HTML5/Three.js vertical slice for the opening settlement decision. The current prototype demonstrates:

- a persistent campsite as the Move 0 settlement core;
- the mandatory Move 1 Woodcutter build-order choice;
- automatic site selection and three visible construction stages;
- automatic worker assignment, harvesting, hauling, and storage;
- Move 2 unlocking once the first industry is operating;
- pause, restart, speed, and isometric-grid controls.

The intended player role is strategic: the player chooses one building every 30–90 seconds and watches the settlement execute that decision automatically. Development speed controls make the complete opening loop testable in seconds.

The default orthographic camera uses a 35-world-unit vertical view. This is a 3× zoom-in from the first city-overview experiment while remaining roughly 4× farther out than the original character showcase. The opening sites are distributed across the frame so the campsite, first industry, forest, and future expansion space remain visible together.

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

The Three.js settlement state machine lives in `src/main.ts`. Runtime clip and harvesting metadata is recorded in `Assets/Art/Production/Integration/woodcutter-harvest-loop-v1.json`.

Opening progression: `Campsite (Move 0) → Woodcutter (Move 1) → Move 2 unlocked`. The original campsite remains the civic core and is reserved for its Town Hall transformation on Move 8.

## Asset workflow

See `Assets/Art/ART_DIRECTION.md` for visual rules and `Assets/Art/ART_PIPELINE.md` for export, naming, and validation conventions.
