# Grow an Empire — Technical Implementation Handoff

This document describes the current working HTML5/Three.js vertical slice as implemented in the repository. It is intended to be self-contained context for an external architecture or code review.

> **Status (2026-09-23): partly out of date.** Most of this was written for the eight-move version. The game now has **12 moves**, **13 civic levels** (art for levels 0–8), save schema **v4**, and opening choices Woodcutter / Farm / Quarry (Farm opens the Orchard and Swine Farm; there is no Bakery follow-up). Where this document and the code disagree, the code wins:
>
> - rules and catalog: `src/game/content.ts`, `src/game/campaigns.ts`;
> - the exhaustive path proof: `src/game/__tests__/twelveMoveOfferPaths.test.ts` (it replaces `eightMoveOfferPaths.test.ts`);
> - portal work (platform SDK, cloud saves, WebP art, performance, layout): `Docs/PORTAL_IMPLEMENTATION_PLAN.md`, `Docs/PERFORMANCE_BUDGET.md` and `Docs/adr/`.
>
> The state and catalog interfaces in sections 5 and 8 below are current.

## 1. Product definition

Grow an Empire is a passive, build-order-driven city simulation inspired by the *GROW* game format.

The player does not directly control units. On each move, the player selects one of three building cards. Construction, civic growth, population growth, resource production, worker activity, and city animation then run automatically.

The current vertical slice contains:

- one Level 0 campsite;
- eight player decisions;
- nine civic appearances, from campsite through Grand Town Hall;
- fifteen possible district buildings, of which eight are constructed per run;
- a rolling three-card choice system with prerequisites;
- autonomous construction and resource production;
- visible population growth from one to 37 villagers;
- semantic district placement and roads that grow with the chosen city;
- a fixed orthographic Three.js presentation;
- production-ready transparent PNG building stages and character sprite sheets.

The game stops presenting decisions after Move 8. Existing villagers, animations, and production continue so the player can observe the resulting city.

## 2. Technology stack

| Area | Implementation |
| --- | --- |
| Runtime | Browser / HTML5 |
| Language | TypeScript 5.9, strict mode |
| Renderer | Three.js 0.186 |
| Bundler/dev server | Vite 8.3 |
| UI | Semantic HTML and CSS overlays |
| Art | Transparent PNG sprites and sprite sheets |
| Art tooling | Python 3 and Pillow-based export/validation scripts |
| Package manager | pnpm |

There is no framework such as React. DOM UI and Three.js rendering are managed directly from `src/main.ts`.

## 3. Important files

```text
index.html
src/
  main.ts                         Orchestrator: wires simulation events to render/UI modules, animation loop
  styles.css                      HUD, build cards, controls, responsive layout
  game/
    content.ts                    Building catalog and gameplay constants
    settlementSimulation.ts      Deterministic simulation/state machine + save-state serialization
    saveGame.ts                  localStorage read/write around the simulation's snapshot format
    __tests__/                   Vitest suites (see section 24)
  render/
    sceneSetup.ts                 Renderer, scene, camera, resize
    spriteAssets.ts               Texture loading/configuration, sprite-sheet frame addressing
    cityLayout.ts                 Plot positions, districts, grid, roads, placement indicator, forest
    civicCenter.ts                Nine stacked civic-center appearances
    workerAnimation.ts            Shared "active builder" sprite + clips
    constructionView.ts           Per-plot construction sprites, phase presentation, Woodcutter loop, production pulses
    villagers.ts                  Population crowd sprites and orbit animation
    assetCatalog.ts              Vite asset discovery and filename -> URL resolution
  ui/
    dom.ts                        requireElement() helper
    hud.ts                        All DOM/HUD state; no Three.js or simulation dependency
Assets/Art/
  Masters/                        Source art masters
  Production/
    Buildings/*/Runtime2x/        Four runtime stages per building
    Characters/.../Runtime2x/     Directional character sprite sheets
    Environment/...               Tree states
    Integration/                  Engine-neutral animation contract
Tools/ArtPipeline/                Export, preview, and validation scripts
Docs/
  BUILD_ORDER_CONTENT.md          Offer/dependency design
  GAME_ARCHITECTURE.md            Concise runtime architecture
  TECHNICAL_IMPLEMENTATION.md     This handoff
```

`main.ts` was previously a single ~680-line file combining every concern above; it has been split into the cohesive modules listed here (section 21's item 3 from the prior revision of this document), with no intended runtime behavior change. See section 19 for how that was verified.

## 4. Runtime lifecycle

Startup is controlled by `initialize()` in `src/main.ts`.

1. Load southeast/southwest walk, chop, pickup, and carry sprite sheets.
2. Load foundation, frame, late, and complete art for all fifteen buildings.
3. Load all nine civic-center appearances.
4. Load the tree sprite and create a forest cluster.
5. Reset the deterministic simulation.
6. Show the first three building cards.
7. Start the Three.js animation loop.

The renderer uses a `THREE.OrthographicCamera` with a world-space view height of 40. The camera remains fixed; the whole planned city is visible simultaneously.

The game loop uses `THREE.Timer` and caps a single frame delta at 0.05 seconds. The selected speed multiplier changes elapsed simulation time, including construction, production, and animation.

## 5. Simulation state

The simulation is isolated in `SettlementSimulation` and does not depend on Three.js or the DOM.

```ts
interface SettlementState {
  mode: SimulationMode;            // "awaiting-choice" | "construction" | "complete"
  move: number;
  civicLevel: number;
  population: number;
  resources: ResourceLedger;
  builtBuildingIds: string[];
  availableBuildingIds: string[];
  selectedBuildingId: string | null;
  activePlotIndex: number | null;
  constructionElapsed: number;
  buildingMaturity: Record<string, number>;
  armyReport: ArmyReport | null;
  trainedUnits: TrainedUnits;
}
```

Rendering observes state and reacts to emitted simulation events. Rendering never awards resources or advances gameplay.

`SettlementSimulation` also exposes `serialize()` / `loadSnapshot()` / `isValidSnapshot()` for save-state, and `buildOrderSummary()` for a move-ordered list of completed buildings. See section 25.

### Simulation events

- `construction-started`
- `construction-complete`
- `civic-upgraded`
- `choices-ready`
- `resource-produced`
- `population-changed`
- `game-complete`

`main.ts` consumes these events to change sprites, update the HUD, synchronize villagers, reveal roads, and show milestone notices.

## 6. Core player loop

### Move 1

The opening options are always:

1. Woodcutter's Hut
2. Farm
3. Swine Farm

### Every subsequent move

1. The selected card is removed from the available pool.
2. The two unselected cards remain.
3. Construction runs for 30 simulation seconds.
4. The building becomes persistent and starts producing, when applicable.
5. The civic center upgrades once.
6. Population is recalculated.
7. One eligible new building is injected into the card pool.
8. The player receives three options again.

### Completion

After the eighth completed construction:

- simulation mode becomes `complete`;
- civic level is 8;
- population is 37;
- no further cards are offered;
- existing production and visual activity continue;
- the completion notice fades after six simulation seconds so the city remains unobstructed.

## 7. Conditional offer algorithm

Each `BuildingDefinition` has:

```ts
interface BuildingDefinition {
  id: string;
  name: string;
  description: string;
  benefit: string;
  unlocks: string;
  artKey: string;
  offerMove: number;
  offerPriority: number;
  requiresAll?: string[];
  requiresAny?: string[];
  resource?: ResourceName;
}
```

Eligibility requires:

- current move is at least `offerMove`;
- every `requiresAll` building has been constructed;
- at least one `requiresAny` building has been constructed.

Candidate selection excludes already-built and currently offered buildings. Eligible candidates are sorted by:

1. whether the candidate directly depends on the building just completed;
2. earliest `offerMove`;
3. lowest `offerPriority`.

This makes follow-up buildings appear immediately when possible. For example, selecting Farm introduces Bakery on the next move, while the two previous leftovers remain.

## 8. Building catalog and dependencies

| Building | Earliest move | Requirement | Production/role |
| --- | ---: | --- | --- |
| Woodcutter's Hut | 1 | none | Wood; unlocks Sawmill |
| Farm | 1 | none | Grain; unlocks Bakery and Granary |
| Swine Farm | 1 | none | Food; unlocks Butchery |
| Bakery | 2 | Farm | Food; doubled with Farm |
| Sawmill | 2 | Woodcutter | Planks; doubled with Woodcutter |
| Butchery | 2 | Swine Farm | Food; doubled with Swine Farm |
| Fruit Orchard | 3 | none | Fruit; unlocks Winery |
| Winery | 3 | Fruit Orchard | Wine; doubled with Orchard |
| Quarry | 3 | none | Stone; unlocks Blacksmith |
| House | 3 | none | Residential identity |
| Granary | 4 | Farm or Orchard | Grain storage/production |
| Marketplace | 4 | none | Wealth |
| Blacksmith | 4 | Quarry | Tools; unlocks Weapons Workshop |
| Weapons Workshop | 5 | Blacksmith | Arms; doubled with Blacksmith |
| Barracks | 6 | Weapons Workshop | Defense; doubled with Weapons Workshop |

## 9. Population model

Population is based on civic level, not on a specific residential building.

```text
population(level) = 1 + level × (level + 1) / 2
```

| Civic level | New villagers | Total population |
| ---: | ---: | ---: |
| 0 | starting villager | 1 |
| 1 | +1 | 2 |
| 2 | +2 | 4 |
| 3 | +3 | 7 |
| 4 | +4 | 11 |
| 5 | +5 | 16 |
| 6 | +6 | 22 |
| 7 | +7 | 29 |
| 8 | +8 | 37 |

Each visible villager owns a cloned walk texture, animation phase, and slightly varied speed/scale. Villagers are assigned round-robin to the civic center and constructed buildings. They follow small elliptical local routes around their assigned hub, which visually distributes activity across the city.

The first villager uses a special visible opening route while the large build-choice panel is displayed.

## 10. Resource production

The resource ledger contains:

```text
wood, grain, food, stone, planks, wealth,
tools, fruit, wine, arms, defense
```

**Current model (replaces the old per-second timers):** production runs once per move, in `SettlementSimulation.resolveMoveEconomy()`, not continuously. Each completed building matures by one per move. Raw producers yield 2, plus 1 for every 3 moves of maturity. Converters then run in a fixed order, each limited by its capacity (1, plus 1 per 3 moves of maturity) and by the inputs left at that point. Grain above 6 spoils without a Granary. Because none of this depends on frame time, the result is the same at any frame rate or speed setting. The ledger is `wood, grain, livestock, rations, stone, planks, wealth, tools, fruit, wine, arms, training, defense`. The resource list and bonuses below are from the eight-move version.

Current complementary bonuses:

- Bakery ×2 with Farm
- Sawmill ×2 with Woodcutter
- Butchery ×2 with Swine Farm
- Winery ×2 with Fruit Orchard
- Weapons Workshop ×2 with Blacksmith
- Barracks ×2 with Weapons Workshop

Existing tools apply a global production-time multiplier:

```text
toolBoost = 1 + tools × 0.04
```

Production events briefly pulse the completed building sprite.

## 11. Construction presentation

Every district building has four runtime sprites:

1. `construction-01-foundation`
2. `construction-02-frame`
3. `construction-03-late`
4. `level-1` completed building

The 30-second construction period is presented in phases:

| Progress | Presentation |
| --- | --- |
| 0–22% | Worker travels from civic center to the site |
| 22–50% | Foundation work |
| 50–76% | Frame construction |
| 76–94% | Late finishing work |
| 94–100% | Completed building opens |

The UI progress bar and status copy describe the current phase.

## 12. Character animation

The runtime currently uses eight-frame, four-column by two-row character sheets.

Loaded actions:

- walk;
- chop;
- pickup log;
- carry log.

The special Woodcutter loop is:

```text
travel → chop → tree fall timing → pickup → carry → deposit
```

The generic villagers currently reuse the southeast walk art and flip the sprite horizontally based on travel direction. Dedicated profession and idle animations are not yet implemented for the other buildings.

## 13. Semantic city layout

Building positions are keyed by building identity rather than construction order.

### Civic core

- Grand Town Hall
- Marketplace
- House

### Forest district

- Woodcutter's Hut
- Sawmill
- dense tree cluster and darker forest-floor patch

### Agricultural district

- Farm
- Bakery
- Granary
- procedural field-row marks

### Southwest food/luxury district

- Fruit Orchard
- Winery
- Swine Farm
- Butchery

### Southeast industrial/military district

- Quarry
- Blacksmith
- Weapons Workshop
- Barracks

### Roads

Five road corridors originate at the civic plaza:

1. civic core corridor;
2. forest corridor;
3. agricultural corridor;
4. southwest corridor;
5. industrial corridor.

Roads are generated as layered Three.js plane meshes: a wider packed-earth base and a narrower light center. Each district road is hidden until its first building is selected. A short connector to an individual building is revealed with that building's construction. This prevents empty roads from pointing toward unbuilt districts.

## 14. Three.js rendering architecture

The scene uses flat transparent sprites rather than 3D building geometry.

Important render layers:

- isometric grid: background;
- district patches, field rows, and roads;
- civic and building sprites;
- generic villagers;
- active construction/Woodcutter worker;
- DOM HUD and build-choice overlays.

Sprite materials use transparency with depth testing disabled. Explicit `renderOrder` values determine visual stacking.

Textures use sRGB color space, linear magnification, mipmapped minification, and clamped wrapping. Sprite-sheet animation changes `texture.offset` while `texture.repeat` remains at `0.25 × 0.5`.

## 15. Asset loading

`src/render/assetCatalog.ts` uses eager `import.meta.glob` calls so Vite includes matching art files in the production bundle.

Runtime lookup is filename-based:

```ts
export function assetUrl(filename: string): string
```

Missing art fails fast with `Bundled asset not found`, which is surfaced in the loading overlay. A duplicate filename across two different source folders also fails fast at module load, since lookups are by filename only.

The filename → URL map is built once when the module loads (`assetUrlByFilename`), not rescanned per `assetUrl()` call.

Asset groups currently bundled:

- Woodcutter character sheets;
- deciduous tree states;
- log stockpile states;
- every building `Runtime2x` directory.

## 16. Art pipeline

Character masters are authored/generated as transparent four-column by two-row sheets containing exactly eight poses. The exporter:

- discovers foreground components;
- normalizes each frame to a 256×256 canvas;
- preserves a common foot anchor;
- exports individual frames and a 1024×512 runtime sheet;
- can remove low-alpha generator residue;
- rejects flattened RGB inputs unless background extraction is explicitly performed.

Key scripts:

```text
Tools/ArtPipeline/export_sprite_grid.py
Tools/ArtPipeline/make_transport_preview.py
Tools/ArtPipeline/make_chop_contact_preview.py
Tools/ArtPipeline/make_harvest_loop_preview.py
Tools/ArtPipeline/validate_harvest_loop.py
```

Building masters are deterministically split into four isolated runtime construction stages. The civic master is split into nine levels.

## 17. HTML interface

The DOM interface contains:

- top HUD with settlement activity, move, civic level, and population;
- Three.js viewport;
- three-card build-choice panel;
- resource ledger;
- temporary civic/building milestone notice;
- pause/restart buttons;
- speed slider from 0.5× to 8×;
- optional isometric grid toggle;
- nine-level civic progress track.

The build cards show completed art, name, description, production role, and unlock information.

## 18. Run and build

From the repository root:

```powershell
pnpm install
pnpm dev
```

Open:

```text
http://127.0.0.1:4173/
```

Production validation:

```powershell
pnpm run build
python Tools/ArtPipeline/validate_harvest_loop.py
```

`pnpm run build` performs strict TypeScript checking followed by the Vite production build.

## 19. Current validation status

The implementation has been exercised through complete twelve-move browser runs (the Playwright regression suite, 2026-09-23).

Verified examples include:

- Farm introducing Bakery;
- Fruit Orchard introducing Winery;
- Woodcutter introducing Sawmill;
- Quarry → Blacksmith → Weapons Workshop → Barracks;
- civic progression reaching Level 8;
- population reaching 37;
- game stopping new choices after Move 8;
- roads appearing only in occupied districts;
- villagers distributed around all constructed buildings;
- resource production continuing after completion;
- production TypeScript/Vite build passing;
- Woodcutter art contract validation passing.

Additionally, as of the `main.ts` modularization and save-state work:

- `pnpm test` (vitest): 46 tests across three suites, including an exhaustive enumeration of all 3^8 = 6,561 possible eight-move build orders (see section 24) — all pass.
- `tsc --noEmit` (strict mode, `noUnusedLocals`/`noUnusedParameters`) passes against the fully modularized `src/`.
- A headless Playwright smoke test (not checked into the repo; synthetic placeholder art was substituted for the real Assets masters, which weren't available in the environment that ran it) drove a full eight-move playthrough end to end against a production `vite build`, including a mid-game page reload and a post-completion page reload, and confirmed: no console or page errors, correct HUD state at every move, save/resume producing byte-for-byte identical HUD state across a reload, and the completed-city visuals (roads, plots, HUD) rendering correctly. This is evidence the module split preserved behavior, but it used placeholder art, not the production sprites — a manual pass with real art in a real browser is still worth doing before shipping.

## 20. Known limitations and technical debt

1. ~~There are no automated simulation unit tests yet.~~ Resolved: 46 vitest tests, see section 24.
2. ~~Save/load and deterministic replay are not implemented.~~ Resolved for save/load: see section 25. `buildOrderSummary()` gives a move-ordered replay record; there is no UI to browse or share it yet.
3. The simulation is deterministic but has no explicit seeded random system because offers are currently priority-driven.
4. Only the Woodcutter has a profession-specific work loop.
5. Generic villagers all reuse one walking appearance.
6. Roads are simple procedural rectangles, not textured or curved paths.
7. Buildings do not currently consume resources to construct.
8. Economy balance is prototype-grade.
9. There is no audio, localization, tutorial system, analytics, or accessibility settings panel.
10. Camera pan/zoom and responsive mobile interaction are not implemented.
11. ~~Asset lookup scans eager glob entries by filename on every request; a precomputed filename map would scale better.~~ Resolved: `assetUrlByFilename` is built once at module load.
12. ~~`src/main.ts` currently owns several responsibilities and should eventually be split into scene, UI, animation, and layout modules.~~ Resolved: see the file tree in section 3.
13. The bundled JavaScript exceeds Vite's default 500 kB warning threshold, primarily because of Three.js and eager asset inclusion.
14. Autosave writes to localStorage on every "structural" simulation event (a move completing, choices refreshing, game completion) plus on `beforeunload`, but not on every resource-production tick, to avoid excessive synchronous storage writes at high speed multipliers. Worst case, a hard crash mid-construction loses at most a few seconds of `constructionElapsed`/resource accumulation, never a completed building.
15. There's no explicit save-schema migration path yet — `loadSnapshot()` throws on a `schemaVersion` mismatch and `saveGame.ts` treats that as "no save" (falls back to a fresh game) rather than attempting a migration. Fine for a single-schema vertical slice; worth revisiting once the state shape needs to change under players with existing saves.

## 21. Recommended next implementation sequence

1. ~~Add deterministic unit tests for all possible eight-move offer paths.~~ Done — `src/game/__tests__/eightMoveOfferPaths.test.ts`.
2. ~~Add save-state serialization and a replayable build-order summary.~~ Done — `serialize`/`loadSnapshot` plus `buildOrderSummary()` in `settlementSimulation.ts`, wired to localStorage autosave/resume in `main.ts`. Still open: a UI to actually show the build-order summary/replay to the player, and result scoring (item 7 below still applies).
3. ~~Split `main.ts` into `scene`, `cityLayout`, `villagers`, `constructionView`, and `ui` modules.~~ Done, with `sceneSetup`, `civicCenter`, and `workerAnimation` as additional modules beyond the original list (see section 3).
4. Create profession-specific activity contracts for Farm, Sawmill, Quarry, Market, and military buildings.
5. Replace straight road planes with reusable isometric path tiles or a small road-mesh generator.
6. Add construction costs and explicit resource-chain balance.
7. Add player-facing result scoring so different eight-building cities can be compared, likely building on `buildOrderSummary()`.
8. Add sound, camera controls, onboarding, and accessibility options.
9. Introduce lazy asset loading or route-specific bundles if startup size becomes a problem.
10. Add a save-schema migration path once the state shape needs to change (see known limitation 15).
11. Wire the vitest suite and `tsc --noEmit` into CI so both run on every change, not just locally on request.

## 22. Suggested Claude review questions

Please review the implementation with particular attention to:

1. Is the simulation/rendering boundary sufficiently deterministic and testable? — **Answered:** yes. The simulation has zero Three.js/DOM imports, and `src/game/__tests__/` exercises it in isolation in milliseconds.
2. Can the rolling-card algorithm ever produce fewer than three valid choices before Move 8? — **Answered, exhaustively:** no, not for the current 15-building catalog. `eightMoveOfferPaths.test.ts` walks all 3^8 = 6,561 reachable build orders and asserts the pool is exactly 3 before every move but the last. This is a proof for today's catalog, not a general guarantee — adding a building with narrow eligibility could reintroduce the risk, which is exactly what that test now guards against.
3. What is the cleanest modular decomposition of `src/main.ts` without adding unnecessary framework complexity? — **Answered:** see section 3's file tree. Each render/UI concern is a factory function returning a small API and owning its own state via closures (no DI container, no framework), and `main.ts` is now ~250 lines of pure orchestration.
4. Should civic progression and population remain tied directly to completed move number? — Still open; unchanged in this pass.
5. How should construction costs and resource prerequisites integrate without weakening the simple *GROW*-style choice loop? — Still open; unchanged in this pass.
6. What save-state schema would remain forward-compatible as buildings and eras are added? — **Partially answered:** see section 25. `SettlementSnapshot` wraps a versioned `schemaVersion` around a structural clone of `SettlementState`; a future incompatible change bumps `SAVE_SCHEMA_VERSION` and either migrates or rejects older saves in `loadSnapshot`/`isValidSnapshot`. No migration logic exists yet (known limitation 15).
7. Are the current texture-cloning and eager-loading strategies acceptable for approximately 37 animated villagers and fifteen building sets? — Still open; unchanged in this pass beyond the O(1) asset-filename lookup (known limitation 11, resolved).
8. What road representation will preserve the hand-painted isometric look while supporting future branching layouts? — Still open; unchanged in this pass.
9. What automated test matrix should cover all dependency and offer-order edge cases? — **Answered:** see section 24; the exhaustive all-paths suite plus targeted catalog/production/save unit tests.
10. Which performance and accessibility risks should be addressed before expanding beyond the vertical slice? — Still open; unchanged in this pass beyond item 7 above.

## 23. Design invariants to preserve

- The player's primary action is choosing build order.
- The settlement performs labor automatically.
- Exactly one building is selected per move.
- The first city contains eight selected buildings from a larger possibility space.
- Unchosen cards persist between moves.
- Prior choices control which specialist buildings can appear.
- Every move visibly improves the central settlement.
- The city remains alive and observable after the final decision.
- Building locations communicate their functional relationships at a glance.

## 24. Automated testing

`pnpm test` runs the vitest suite in `src/game/__tests__/`, three files, 46 tests, all pure logic (no Three.js, no DOM, no jsdom needed):

- `content.test.ts` — catalog integrity (every `requiresAll`/`requiresAny` id exists and isn't self-referential, every `offerPriority` is unique, `offerMove` is within range), plus focused unit tests for `isBuildingEligible` and `nextBuildingOffer`'s tie-breaking (direct dependent first, then earliest `offerMove`, then lowest `offerPriority`).
- `settlementSimulation.test.ts` — `chooseBuilding` guard conditions, construction/move progression (including the fractional-time carry across the completion boundary), resource production math (whole-cycle flooring via `Math.floor(elapsed / productionSeconds)`, remainder carry, the `tools` global speed boost, and synergy doubling verified in isolation), `reset()` returning to an identical fresh state, `buildOrderSummary()`, and the save/load round trip — including through a real `JSON.stringify`/`JSON.parse` cycle, since that's what `saveGame.ts` actually does via localStorage.
- `eightMoveOfferPaths.test.ts` — the exhaustive proof described in section 22, question 2. It also asserts every completed city has exactly 8 distinct buildings and that all 6,561 build orders are pairwise distinct (no two branches collapse to the same city).

These tests run in under two seconds and have no external dependencies, so they're a good candidate for a pre-commit hook or CI step even before a full CI pipeline exists (see section 21, item 11).

Everything under `src/render/` and `src/ui/` remains untested by an automated suite — that layer was instead verified once, manually, via the headless Playwright smoke test described in section 19, using synthetic placeholder art. It is not wired into `pnpm test` and doesn't run automatically; treat visual/rendering regressions as something a human (or a future Playwright suite checked into the repo, with real art) needs to catch.

## 25. Save-state schema

`SettlementSimulation.serialize()` returns:

```ts
interface SettlementSnapshot {
  schemaVersion: 1;       // SAVE_SCHEMA_VERSION
  savedAt: string;        // ISO timestamp, informational only
  state: SettlementState; // structuredClone of the full simulation state
}
```

`state` is exactly the `SettlementState` interface from section 5 — no derived or render-side data. `loadSnapshot()` throws if `schemaVersion` doesn't match; `isValidSnapshot()` is the safe runtime guard for data coming from outside the simulation (localStorage, a future uploaded save file) and simply rejects anything that doesn't shape-check, including a version mismatch, rather than partially trusting it.

`src/game/saveGame.ts` wraps this with localStorage under the key `grow-an-empire:save:v1`, wrapping every read/write in try/catch so a browser with storage disabled degrades to "no autosave" instead of crashing. `main.ts` autosaves after any simulation event batch other than a pure `resource-produced` tick (see known limitation 14), after a successful `chooseBuilding`, and on `beforeunload`; on startup it loads a save if present and calls `hydrateFromLoadedState()` instead of `resetSettlement()`, which rebuilds every plot sprite, road, civic sprite, and HUD element from the restored state without replaying construction animation. The restart button explicitly clears the save before resetting, so a manual restart is never overridden by a stale autosave on the next load.

If `SettlementState`'s shape needs to change in a way an old save can't satisfy, bump `SAVE_SCHEMA_VERSION` and add a branch in `loadSnapshot`/`isValidSnapshot` (and probably `saveGame.ts`) to either migrate the old shape or discard it as "no save" — there is no migration path implemented today (known limitation 15).
