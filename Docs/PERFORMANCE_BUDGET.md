# Performance budget

`common/MOBILE_PERFORMANCE.md` §5: "Every game must have an explicit budget." This is Grow an Empire's. Re-measure after any change to art, boot order or the render loop. The **how to measure** notes are below.

| Metric | Budget | Measured (2026-09-23) | Source of the target |
|---|---|---|---|
| Upload ZIP | ≤ 50 MB (hard limit) | **7.4 MB** | SUBMISSION_GUIDE §1 |
| Time to playable at 10 Mbps | ≤ 5 s (hard requirement) | **1.3 s** | DEVELOPER_GUIDE §8 |
| Time to playable on Slow 4G (1.6 Mbps) | ≤ 10 s | **6.9 s** | QA_CHECKLIST §9 "startup works on slow networks" |
| Download before playable | ≤ 3 MB | **1.24 MB**, 21 requests | DEVELOPER_GUIDE §3.5 ("initial bundle under 5 MB") |
| JavaScript (gzip) | ≤ 250 KB | 156 KB | MOBILE_PERFORMANCE §34 |
| Frame rate | 60 fps target, 30 fps floor on a mid-range phone | Not yet measured on a device | MOBILE_PERFORMANCE §6 |
| Draw calls | ≤ 250 | 22 at move 1 · 75 at move 6 · 190 at move 12 · 203 during the muster | MOBILE_PERFORMANCE §17 |
| Live textures | ≤ 100 | 77 at the muster | MOBILE_PERFORMANCE §20 |
| Decoded texture memory | ≤ 200 MB | Estimated 120 MB worst case (all 15 buildings × 4 stages, which one run never reaches) | MOBILE_PERFORMANCE §45 |
| Particles | 0 | 0 | MOBILE_PERFORMANCE §24 |
| Cloud save size | ≤ 16 KB (portal limit 64 KB) | about 2 KB | SUBMISSION_GUIDE §5.1 |
| Rendering while paused | None | None (verified: no frames drawn while paused) | MOBILE_PERFORMANCE §48 |

## What the game does to stay inside it

- **WebP runtime art** (`Assets/Runtime/`, exported by `Tools/ArtPipeline/export_runtime_webp.py`): 48.6 MB of PNG becomes 7.2 MB, with no visible loss.
- **Only the first screen blocks boot**: terrain, tree, the level-0 civic center and the villager walk sheets. The rest loads after the game is playable: the offered cards' construction stages, the woodcutter's animation, and each next civic level.
- **Rendering stops** while paused, behind the tutorial, and when nothing has changed.
- **No per-frame DOM writes** unless the text actually changes, and no per-frame material re-uploads.
- **No backdrop blur** on the always-visible panels.
- **Quality tiers**:
  - MSAA only on 1x screens.
  - Pixel ratio capped at 2.
  - If the first seconds of play average under about 36 fps, the game drops once to the low tier (1x pixels) and stays there.
  - `?quality=low` forces the low tier.

## How to measure

- **Frame rate, draw calls, textures**: open the game with `?perf`. A readout appears top-left, showing FPS, frame time, draw calls, textures, geometries, quality tier and pixel ratio. Dev tool only; players never see it.
- **Time to playable**: the game sets the performance mark `gae-playable` when the first move can be chosen. In Chrome DevTools, open Performance, then Timings; or in the console run `performance.getEntriesByName("gae-playable")[0].startTime`. Compare resource `responseEnd` times against it to see what blocked boot.
- **Network**: in DevTools, open Network and set throttling to "Fast 4G" / "Slow 4G".
- **ZIP size**: `pnpm package` prints it and runs the bundle validator.

## Known risks

- **Draw calls grow with population**: each villager is a sprite, and population reaches 79 by move 12. The next lever, if a low-end device struggles, is instancing the villagers (one draw call per profession) or merging the static road meshes. This isn't needed at the current counts.
- **The frame-rate numbers here come from a headless software renderer** and say nothing about real devices. Measure on a mid-range Android phone and an iPhone before release (QA_CHECKLIST §7), and record the results in `Docs/QA_RESULTS.md`.
