# Animation commission brief: smoother worker walks and work loops

Ravi, 2026-10-10: "add a few more frames for each animation, making animations smoother." 0.10.3 already smooths the motion in code (poses timed to distance walked, a gentle step bob, a calmer crowd clock at high speed, lanes and spread stops around the Town Hall). Real extra frames need new painted art; this brief is what to commission. **The code is ready: export the new sheets and the game uses them, no code change.**

## What exists today

| Sheet | Layout | Runtime size | Cell | Used for |
|---|---|---|---|---|
| `<role>-walk32-master-v1.png` | 8 directions (columns, clockwise from north) × **4** stride poses (rows) | 1024 × 680 | 128 × 170 | Commuting, marching to the garrison |
| `<role>-work8-master-v1.png` | 4 × 2 frames, one work loop | 1024 × 584 | 256 × 292 | The action at a building (chop, hoe, hammer…) |

Four poses per stride is why the walk reads choppy: each pose is held for a quarter of a stride.

## What to deliver

| Sheet | Layout | Master size (any multiple) | Runtime | Notes |
|---|---|---|---|---|
| `<role>-walk64-master-v1.png` | 8 directions (same column order) × **8** stride poses (rows) | 2048 × 2720 (256 × 340 cells) | 1024 × 1360 | Pose 0 = right foot contact; 1 = down; 2 = passing; 3 = up; 4 = left foot contact; 5–7 mirror 1–3. Two steps per cycle. Feet stay on a fixed ground line in every cell. |
| `<role>-work16-master-v1.png` | 4 × 4 frames, one work loop, left to right then down | 2048 × 2336 (512 × 584 cells) | 1024 × 1168 | Same action as the work8 loop, twice the in-betweens; first and last frames loop seamlessly. |

**Match the existing art exactly:** same character identity, palette, light from the upper left, the same scale in the cell, transparent background, no shadow baked in (the game draws none for walkers). Anchor the feet at the same height as today's sheets so nothing jumps when a role switches over.

## Roles, in priority order

The crowd in a typical campaign is mostly these, so they give the biggest win:

1. builder (also the founder and House residents)
2. farmer (Farm, Goshala, Mango Grove, Granary)
3. woodcutter (Woodcutter's Hut, Carpenter's Yard)
4. quarry (Quarry)
5. merchant (Bazaar, Soma Press, trade routes)
6. blacksmith (Lohar Forge, Bow Hall)
7. baker (Royal Kitchen, Ghee House)
8. miner, spearman (supply routes to the forge and Akhara)
9. archer, swordsman, horseman (marching to the garrison; their walks show briefly)

A role can be upgraded on its own; others keep their current sheets.

## Dropping them in

1. Save the masters in `Assets/Art/Production/Characters/DirectionalWalk/` (walk64) and `Assets/Art/Production/Characters/WorkLoops/` (work16).
2. Move that role's old `walk32` / `work8` master out of those folders (for example to `Assets/Art/Masters/Retired/`). The art test fails while both are bundled, so nothing unused ships.
3. Run `pnpm art:export`, then `pnpm check`.
4. Play a campaign at 1× and 8×; the role's walk now uses all 8 poses (`getWalkFrame`) and its work loop 16 frames in the same time.

## Budget

A walk64 sheet is about twice a walk32 (roughly 600 KB WebP instead of 300 KB). Only the builder sheet loads before the first screen; upgrading it adds about 0.15 s on Slow 4G (now 9.1 s against the 10 s budget), so check `Tools/qa/load_time.py` after the builder. Everything else loads on demand.

## Provenance

Add a row per delivered sheet to `Assets/Art/PROVENANCE.md` (artist or tool, licence, date) before shipping.
