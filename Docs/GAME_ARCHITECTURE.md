# Grow an Empire architecture

## Product contract

The player is the settlement's strategic authority. They choose one building on each of eight moves; villagers execute it autonomously. The two unchosen cards carry forward and one prerequisite-valid card enters the pool. Direct unit control is outside the core loop.

The central civic site has nine states: the Level 0 Founding Campsite and eight incremental upgrades. Move 8 produces the Grand Town Hall and ends further decisions. The resulting city contains eight of the fifteen possible districts.

## Runtime layers

- `src/game/content.ts`: building catalog, prerequisites, offer priority, production rules, civic names, population curve, and pacing.
- `src/game/settlementSimulation.ts`: deterministic construction, rolling offers, resources, synergies, population, completion, and save-state serialization (`serialize`/`loadSnapshot`/`isValidSnapshot`, plus `buildOrderSummary`).
- `src/game/saveGame.ts`: localStorage read/write around the simulation's snapshot format; safe to fail (private browsing, storage disabled) without crashing the game.
- `src/main.ts`: the orchestrator. Owns `playing`/`speed`/`animationElapsed`, wires simulation events to the render/UI modules below, drives the animation loop, and decides reset vs. resume-from-save on startup. It does not know how to draw a building or animate a villager.
- `src/render/sceneSetup.ts`: renderer, scene, camera, and viewport resize.
- `src/render/spriteAssets.ts`: texture loading/configuration and sprite-sheet frame addressing, independent of any specific building or character.
- `src/render/cityLayout.ts`: building plot positions, districts, the isometric grid, the road network and its reveal-on-build behavior, the placement indicator, and the static forest.
- `src/render/civicCenter.ts`: the nine stacked civic-center appearances.
- `src/render/workerAnimation.ts`: the single roaming "active builder" sprite and its sprite-sheet clips, shared by the construction animation and the Woodcutter's harvest loop.
- `src/render/constructionView.ts`: per-plot construction-stage sprites, the construction phase presentation, the Woodcutter harvest loop, and production pulses.
- `src/render/villagers.ts`: the population's crowd sprites and their orbit animation around civic/building hubs.
- `src/render/assetCatalog.ts`: Vite asset discovery and filename → URL resolution (precomputed once at load, not rescanned per lookup).
- `src/ui/hud.ts`: every DOM element and on-screen string — HUD, build-choice cards, resource ledger, milestone toast, and transport controls — driven by callbacks and plain-value snapshots, with no Three.js or simulation dependency.

## Invariants

- Simulation time is authoritative; rendering never awards resources.
- A move accepts exactly one currently available card.
- Unchosen cards persist and one eligible new option restores the next pool to three cards. Exhaustively verified across all 3^8 = 6,561 possible eight-move build orders in `src/game/__tests__/eightMoveOfferPaths.test.ts`: the pool never drops below three choices before Move 8, for the current building catalog.
- Prerequisite chains cannot be offered before their dependency is built.
- Population at civic level `n` is `1 + n(n+1)/2`.
- Civic level equals completed moves and reaches Level 8 on the final move.
- The final state stops new decisions; selected buildings, villagers, and production remain active.
- A save snapshot is a versioned (`SAVE_SCHEMA_VERSION`), JSON-safe copy of `SettlementState` only — it carries no render objects. Resuming rebuilds every plot sprite, road, and civic/HUD display from that state rather than replaying construction; loading rejects any snapshot whose schema version doesn't match.

## Spatial layout

Building placement is keyed by building identity rather than move order. The Town Hall and Marketplace occupy the civic core; Woodcutter and Sawmill share the forest edge; Farm, Bakery, and Granary share the northwest agricultural quarter; Orchard, Winery, Swine Farm, and Butchery occupy the southwest; Quarry, Blacksmith, Weapons Workshop, and Barracks form the southeast industrial quarter.

Five main road corridors radiate from the civic plaza. A district road and its short building connector become visible only when that district is occupied, allowing the road network to grow with the player's chosen city instead of revealing routes to unbuilt sites.

## Testing

`pnpm test` (vitest) runs three suites under `src/game/__tests__/`:

- `content.test.ts` — catalog integrity (no dangling/self prerequisites, unique offer priorities) and `isBuildingEligible`/`nextBuildingOffer` unit behavior.
- `settlementSimulation.test.ts` — construction/move progression, resource production math (cycle flooring, remainder carry, tool boost, synergy doubling), `reset`, `buildOrderSummary`, and the save/load round trip (including a real JSON round trip, as it will see via localStorage).
- `eightMoveOfferPaths.test.ts` — the exhaustive all-paths proof described above.

These are pure-logic tests with no Three.js or DOM dependency, so they run in milliseconds and belong in CI once one exists.

## Next production work

1. ~~Add save-state serialization and deterministic automated simulation tests.~~ Done: see Testing above and `saveGame.ts`.
2. Add building-specific jobs and worker animation beyond the Woodcutter.
3. Balance offer priority, production rates, and dependency bonuses through playtesting.
4. Add construction costs and an explicit resource-chain balance (buildings currently cost nothing to build).
5. Add camera navigation, sound, accessibility settings, and performance budgets.
6. Replace the straight-line road planes with reusable path tiles or a small road-mesh generator if the hand-painted look needs to extend to branching layouts.
