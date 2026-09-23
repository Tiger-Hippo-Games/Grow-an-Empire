# 1920 × 1080 village layout proposal

This is a composition target for the current fixed isometric camera, not a new build order. The Town Hall grows at the center; each of the fifteen optional building types keeps one known plot. An eight-move run still constructs only eight of them. The 75–100 person village is a possible later population target, so extra homes and population rules need a separate design decision.

The integrated empty base map is [`village-empty-terrain-16x9-v2.png`](../Assets/Art/Production/Environment/Terrain/village-empty-terrain-16x9-v2.png), a 1920 × 1080 painted terrain image. It contains no buildings or roads. The civic campsite, permanent harvestable trees, and all later construction remain separate scene layers.

See [the screen plan](../Assets/Art/Concepts/village-1920-layout-plan.svg) for the proposed on-screen placement. The labels, plot rings, and dashed roads are planning marks only. They should never appear on bare land in the game.

## Screen composition

| Screen area | Approximate pixels | Purpose |
| --- | --- | --- |
| Top status strip | y 0–72 | Slim population, level, and activity HUD |
| Main world | x 80–1840, y 90–840 | Whole village, routes, and villagers visible at once |
| Choice dock | y 885–1080 | Three building choices and small controls |
| Civic focus | x 790–1120, y 360–600 | Town Hall, well, and later market square |

Keep the far west and east plots inside x 150–1770 so edge sprites and trees have room. Leave the lower central strip above the choice dock open enough for villagers and the final army muster.

## Districts and building plots

| Zone | Screen area | Permanent empty-land character | Built plots |
| --- | --- | --- | --- |
| Civic core | center | Sparse grass, a trampled clearing, founding fire | Town Hall; Marketplace east; House west |
| Farm quarter | upper left | Open earth, a few wild grasses, no pre-ploughed fields | Farm on outer edge; Granary and Bakery closer to center |
| Forest quarter | upper right | Existing tree line and rough grass | Woodcutter at forest edge; Sawmill on road toward town |
| Provision quarter | lower left | Meadow, shrubs, a few wild fruit trees; no cultivated orchard or livestock pens | Fruit Orchard and Winery toward upper side; Swine Farm and Butchery toward lower side |
| Industry quarter | lower right | Stone outcrops and scrub; no active mine or forge | Quarry on outer edge; Blacksmith, Weapons Workshop, Barracks toward road and perimeter |

The forest and rocks are landmarks that remain before construction. Fields, fences, pig pens, stockpiles, workshop clutter, banners, and smoke belong to the corresponding built state.

## Reveal behavior

1. **Before a building:** show natural terrain only. Reserve its footprint in data, but draw no pad, outline, label, empty foundation, or road spur.
2. **On selection:** grow a narrow footpath from the nearest active road to the chosen footprint. Villagers carry materials along that same path. The foundation and worksite then appear.
3. **On completion:** replace the worksite with the building and add local props. Widen or wear the path according to traffic. If this is the first building in a district, reveal its main route from the civic clearing.
4. **When a dependency pair exists:** add a short supply connection and delivery traffic between producer and processor. Every visible walker must use the same shared road graph that draws the paths.
5. **Unchosen plots:** remain natural land throughout the run. This preserves the branching build-order silhouette.

## Movement contract

Use one graph of nodes and edges for both visual paths and villager navigation: civic junction, four outer district junctions, building entrances, and optional supply links. A route is a sequence of graph edges, with a short entrance/exit segment on the building parcel. A villager may start or stop inside a building, but never cut across a field or travel through an empty plot. Walkers yield at tight junctions and dwell briefly at loading and unloading points. Only constructed buildings contribute destinations.

The existing `cityLayout.ts` and `villagers.ts` use fixed plots and conditional routes. The visible road and movement polyline now use the same district waypoints. Camera framing in `sceneSetup.ts` uses a world height of 40 units; this keeps the approved screen-anchor mapping stable at 1920 × 1080.

## Integrated plot anchors

The runtime now maps the plan's 1920 × 1080 ground-anchor pixels to world coordinates using the 40-unit orthographic camera. The forest and quarry plots sit near the map's painted terrain transitions, and the other plots follow the five diagrammed zones. The road mesh, builder survey, service traffic, supply traffic, and trade traffic share the same district waypoints and building spurs. The first villager waits at the civic clearing until a path has been revealed.

The exhaustive route check walks every reachable build order and verifies every unique built-building set at every move. Each villager route segment must belong to a road segment revealed by that set; unbuilt plots therefore cannot attract traffic.

Two existing environmental details also need to follow building state: field rows currently appear at civic Level 3 even if Farm was never chosen, and market awnings appear at Level 5 even if Marketplace was never chosen. Civic upgrades can still add public details such as the well and banners, while productive details should wait for their building.
