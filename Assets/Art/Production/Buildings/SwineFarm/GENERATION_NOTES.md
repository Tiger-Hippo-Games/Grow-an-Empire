# Swine Farm asset generation notes

- Mode: built-in image generation, followed by deterministic quadrant extraction.
- Master: `../../../Masters/Buildings/SwineFarm/swine-farm-progression-master-v1.png`
- Runtime stages: `Runtime2x/swine-farm-construction-01-foundation-2x-v1.png` through `Runtime2x/swine-farm-level-1-2x-v1.png`

## Prompt

> Create a production-ready 2D game asset progression sheet for a cozy medieval settlement-building game, matching polished hand-painted storybook concept art. Subject: a compact SWINE FARM with a sturdy timber-and-thatch pig shelter, a fenced muddy pen, wooden feeding trough, small water barrel, and two friendly pink-and-brown pigs in the completed stage. Show EXACTLY FOUR isolated construction stages of the SAME swine farm in a clean 2x2 grid: top-left bare prepared earth, fence posts and stone footings; top-right half-built timber shelter frame and partial pen; bottom-left nearly finished roof, fencing and trough; bottom-right fully completed thriving Level 1 swine farm with the two pigs. Consistent isometric three-quarter camera from the southeast, consistent footprint and lighting in every panel, readable at small city-map scale. Genuine transparent PNG alpha background everywhere outside each footprint, generous transparent spacing between panels, no shared ground slab, no text, no labels, no UI, no border, no people, no scenery beyond the farm footprint. Soft warm daylight, earthy colors, crisp silhouette, subtle painted texture, no cast shadow outside each footprint.

The runtime images retain genuine alpha and are extracted from the 2×2 master at 768×512 per stage.
