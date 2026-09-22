# Grow an Empire

An HTML5/Three.js vertical slice for the woodcutter harvesting loop. The current prototype bundles the production sprite sheets and demonstrates:

- walking to a resource node;
- chopping and tree-state transitions;
- log pickup and carrying;
- delivery into a three-step stockpile;
- pause, restart, speed, and isometric-grid controls.

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

The Three.js integration lives in `src/main.ts`. Runtime clip and state metadata is recorded in `Assets/Art/Production/Integration/woodcutter-harvest-loop-v1.json`.

## Asset workflow

See `Assets/Art/ART_DIRECTION.md` for visual rules and `Assets/Art/ART_PIPELINE.md` for export, naming, and validation conventions.
