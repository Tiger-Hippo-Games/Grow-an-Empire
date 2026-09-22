# Farm asset generation notes

- Mode: built-in image generation, followed by deterministic quadrant extraction.
- Master: `../../../Masters/Buildings/Farm/farm-progression-master-v1.png`
- Runtime stages: `Runtime2x/farm-construction-01-foundation-2x-v1.png` through `Runtime2x/farm-level-1-2x-v1.png`

## Prompt

> Create a production-ready 2D game asset progression sheet for a cozy medieval settlement-building game, matching polished hand-painted storybook concept art. Subject: a compact FARM made of a small timber-and-thatch farm shed, a few neat golden crop rows, a tiny water barrel, and simple low wattle fencing. Show EXACTLY FOUR isolated construction stages of the SAME farm in a clean 2x2 grid: top-left bare prepared earth and stone foundation; top-right half-built timber frame and partial crop beds; bottom-left nearly finished shed, fence, and growing crops; bottom-right fully completed thriving Level 1 farm with warm golden crops. Consistent isometric three-quarter camera from the southeast, consistent footprint and lighting in every panel, readable at small city-map scale. Transparent background, generous clear spacing between panels, no shared ground slab, no text, no labels, no UI, no border, no people, no scenery beyond the farm footprint. Soft warm daylight, earthy colors, crisp silhouette, subtle painted texture, no cast shadow outside each footprint.

The selected master received a built-in image edit pass to preserve the four designs and remove the backdrop. The runtime images retain genuine alpha and are extracted at 768×512 per stage.
