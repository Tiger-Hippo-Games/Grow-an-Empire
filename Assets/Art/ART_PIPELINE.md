# Grow an Empire — Art Pipeline

## Runtime sprite contract

- Character runtime frames are transparent RGBA PNGs on a 256 x 256 canvas.
- The visible sprite fits within 224 x 224 pixels and uses a shared foot anchor at y = 236.
- Four-direction civilian actions use southeast, southwest, northeast, and northwest.
- Eight-frame sheets are packed as four columns by two rows, producing a 1024 x 512 PNG.
- Pickup animation plays forward at the resource and backward at the stockpile for delivery.

## Master-sheet contract

- Animation masters use a four-column by two-row layout with exactly eight poses.
- Use a genuinely transparent RGBA background before runtime export.
- Low-alpha generator residue is acceptable; the exporter removes it.
- Fully flattened RGB masters must receive a background-extraction pass first. The exporter refuses RGB input to avoid destructive color keying.
- Poses may cross ideal cell boundaries. The exporter discovers the eight large foreground components globally, preventing clipped limbs or neighboring-frame contamination.

## Export command

The project does not currently have Python on `PATH`. Use the Codex bundled Python runtime or any Python 3 installation with Pillow 12+.

```powershell
$python = "C:\Users\LENOVO\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"

& $python Tools\ArtPipeline\export_sprite_grid.py `
  <master.png> `
  <runtime-frame-directory> `
  <runtime-sheet.png> `
  --name <frame-filename-stem>
```

For masters with an unusually strong low-opacity matte, raise the alpha thresholds explicitly. The northwest pickup master uses:

```powershell
--alpha-floor 220 --alpha-solid 248 --component-alpha 235
```

## Preview command

```powershell
& $python Tools\ArtPipeline\make_transport_preview.py
```

This regenerates the parallel four-direction carry and pickup/delivery GIFs in `Production/InteractionPreviews`.

Additional interaction QA:

```powershell
& $python Tools\ArtPipeline\make_chop_contact_preview.py
& $python Tools\ArtPipeline\make_harvest_loop_preview.py
& $python Tools\ArtPipeline\validate_harvest_loop.py
```

These commands generate the four-direction blade/contact board, the complete 54-step harvesting-loop preview, and validate the engine-neutral state contract plus every referenced runtime asset.

## Current woodcutter coverage

| Action | SE | SW | NE | NW |
|---|---:|---:|---:|---:|
| Idle | yes | yes | yes | yes |
| Carry log | 8 | 8 | 8 | 8 |
| Pickup / delivery | 8 | 8 | 8 | 8 |
| Chop | 8 | 8 | 8 | 8 |

Directional chopping is complete and validated against the notched tree. Chop exports use a uniform `--scale 0.45` so character and axe scale remain stable across the swing and match the established southeast contact benchmark.

The engine-neutral harvesting-loop contract is stored at `Production/Integration/woodcutter-harvest-loop-v1.json`. Run `Tools/ArtPipeline/validate_harvest_loop.py` before importing it into an engine.

The remaining animation polish gap is an unloaded woodcutter walk. Until it is produced, the integration contract uses the directional idle pose during movement to the tree; loaded travel uses the completed carry cycle.
