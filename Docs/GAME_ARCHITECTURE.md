# Grow an Empire architecture

## Product contract

The player is the settlement's strategic authority. They choose one building on each of eight moves; villagers execute it autonomously. The two unchosen cards carry forward and one prerequisite-valid card enters the pool. Direct unit control is outside the core loop.

The central civic site has nine states: the Level 0 Founding Campsite and eight incremental upgrades. Move 8 produces the Grand Town Hall and ends further decisions. The resulting city contains eight of the fifteen possible districts.

## Runtime layers

- `src/game/content.ts`: building catalog, prerequisites, offer priority, production rules, civic names, population curve, and pacing.
- `src/game/settlementSimulation.ts`: deterministic construction, rolling offers, resources, synergies, population, and completion.
- `src/main.ts`: Three.js scene, building stages, worker and crowd animation, civic sprites, HUD, cards, and milestones.
- `src/render/assetCatalog.ts`: Vite asset discovery and runtime URL resolution.

## Invariants

- Simulation time is authoritative; rendering never awards resources.
- A move accepts exactly one currently available card.
- Unchosen cards persist and one eligible new option restores the next pool to three cards.
- Prerequisite chains cannot be offered before their dependency is built.
- Population at civic level `n` is `1 + n(n+1)/2`.
- Civic level equals completed moves and reaches Level 8 on the final move.
- The final state stops new decisions; selected buildings, villagers, and production remain active.

## Spatial layout

Building placement is keyed by building identity rather than move order. The Town Hall and Marketplace occupy the civic core; Woodcutter and Sawmill share the forest edge; Farm, Bakery, and Granary share the northwest agricultural quarter; Orchard, Winery, Swine Farm, and Butchery occupy the southwest; Quarry, Blacksmith, Weapons Workshop, and Barracks form the southeast industrial quarter.

Five main road corridors radiate from the civic plaza. A district road and its short building connector become visible only when that district is occupied, allowing the road network to grow with the player's chosen city instead of revealing routes to unbuilt sites.

## Next production work

1. Add save-state serialization and deterministic automated simulation tests.
2. Add building-specific jobs and worker animation beyond the Woodcutter.
3. Balance offer priority, production rates, and dependency bonuses through playtesting.
4. Add camera navigation, sound, accessibility settings, and performance budgets.
