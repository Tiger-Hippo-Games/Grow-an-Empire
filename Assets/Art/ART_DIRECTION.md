# Grow an Empire — Art Direction v1

## Visual target

- Fixed orthographic isometric view on a consistent 2:1 grid.
- Charming hand-painted 2D strategy-game art with subtly dimensional forms.
- Crisp silhouettes and readable building footprints at gameplay scale.
- Moderate environmental detail; avoid visual noise that hides units or interactable buildings.
- Warm, optimistic frontier mood that can become denser and more sophisticated as the city grows.

## Camera and lighting

- All architecture aligns to the same two isometric axes.
- Key light comes from the upper-left.
- Soft, short shadows fall toward the lower-right.
- Do not use cinematic perspective, depth-of-field blur, or camera tilt changes between assets.

## Palette and materials

- Core palette: warm earth, honey timber, muted forest green, soft cream canvas.
- Accent colors: restrained rust-red and desaturated blue for character readability.
- Primary materials: timber, thatch, canvas, packed dirt, grass, logs, and fieldstone.
- Surfaces should be readable without high-frequency texture.

## Initial settlement benchmark

- Population: exactly eight adult villagers.
- Settlement elements: communal fire, primitive shelters, footpaths, handcart, timber stockpile, forest edge.
- First developed building: Level 1 woodcutter hut beside harvestable trees.
- The settlement must retain open ground for future growth and clear visual separation between buildings.

Reference image: `Concepts/base-city-style-benchmark-v1.png`

## Production rules to validate next

- Define the pixel footprint and anchor point for a standard 1x1 isometric tile.
- Define standard character height relative to one tile.
- Produce the woodcutter hut as isolated transparent assets: foundation, frame, construction, Level 1, and upgraded form.
- Produce one villager anchor character before deriving occupational variants.
- Historical benchmark note: the shipped animation system now uses eight walking directions for every role.

## Current character art contract

- Each playable character role has a 32-frame walk atlas: eight compass directions across columns, four stride poses down rows. Keep feet anchored consistently in every cell.
- Each role has one role-specific 8-frame work loop, packed four columns by two rows. One facing direction is sufficient for this loop.
- Fighters also use 8-frame combat loops. Their facing in the final battle follows the road: defenders face down toward the raiders, and raiders face up toward the settlement.
- The runtime atlas names and frame order are defined in `src/render/characterAssets.ts`; add a PNG master and re-export the matching WebP when introducing a role.

## Generation prompt used for the benchmark

```text
Use case: stylized-concept
Asset type: game environment vertical-slice concept art and visual style benchmark
Primary request: A polished isometric medieval settlement at the very beginning of a city-to-empire strategy game. Show exactly eight distinct adult villagers gathered around a modest central camp and a newly completed Level 1 woodcutter hut beside a dense stand of harvestable trees on the settlement outskirts. Include a small timber stockpile, chopped stumps, a handcart, footpaths, a communal fire, and a few simple tents or primitive shelters. The scene must establish the scalable visual language for future farms, workshops, barracks, and a growing city.
Scene/backdrop: compact grassy settlement parcel with readable boundaries, sparse rocks and wildflowers, surrounded partly by trees; no distant dramatic landscape
Subject: the settlement, eight villagers, and the woodcutter hut are all clearly readable at game-camera scale
Style/medium: charming hand-painted 2D game art with subtly dimensional forms, crisp silhouettes, polished but not photorealistic, suitable for a strategy game; original visual design; not pixel art
Composition/framing: strict fixed orthographic isometric view using a consistent 2:1 isometric grid; wide landscape scene; full settlement visible; woodcutter hut near trees at the outskirts; unobstructed ground footprints; no cut-off objects; game-ready readability rather than cinematic perspective
Lighting/mood: warm clear morning light from the upper-left, soft short shadows cast consistently toward the lower-right; optimistic frontier atmosphere
Color palette: warm earth, honey timber, muted forest green, soft cream canvas, restrained rust-red and blue clothing accents
Materials/textures: readable wooden beams, thatch, canvas, grass, packed dirt, logs and stone; moderate detail with clean edges
Character direction: villagers share a consistent stylized proportion and scale; varied practical early-settlement clothing; include visible woodcutters and general settlers; no heroic oversized characters
Constraints: exactly eight villagers; no castle, city walls, large stone buildings, fantasy creatures, magic, UI, labels, text, logos, watermark, border, or floating icons; preserve a clean fixed isometric game camera; all architecture aligned to the same isometric axes; avoid visual clutter and excessive tiny detail
```

The generated benchmark received one targeted edit: the extra ninth villager and washing table at the lower-left were removed while the rest of the scene was preserved.
