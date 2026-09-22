# Grow an Empire — Technical Implementation Handoff

This document describes the current working HTML5/Three.js vertical slice as implemented in the repository. It is intended to be self-contained context for an external architecture or code review.

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
  main.ts                         Three.js scene, UI, animation, spatial layout
  styles.css                      HUD, build cards, controls, responsive layout
  game/
    content.ts                    Building catalog and gameplay constants
    settlementSimulation.ts      Deterministic simulation/state machine
  render/
    assetCatalog.ts              Vite asset discovery and URL resolution
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
  mode: "awaiting-choice" | "construction" | "complete";
  move: number;
  civicLevel: number;
  population: number;
  resources: ResourceLedger;
  builtBuildingIds: string[];
  availableBuildingIds: string[];
  selectedBuildingId: string | null;
  activePlotIndex: number | null;
  constructionElapsed: number;
  productionElapsed: Record<string, number>;
}
```

Rendering observes state and reacts to emitted simulation events. Rendering never awards resources or advances gameplay.

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
  productionSeconds?: number;
  productionAmount?: number;
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

Each producing building accumulates elapsed simulation time independently. Whole production cycles are calculated with `Math.floor(elapsed / productionSeconds)`, making production stable across different render frame rates.

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

Missing art fails fast with `Bundled asset not found`, which is surfaced in the loading overlay.

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

The implementation has been manually exercised through complete eight-move browser runs.

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

## 20. Known limitations and technical debt

1. There are no automated simulation unit tests yet.
2. Save/load and deterministic replay are not implemented.
3. The simulation is deterministic but has no explicit seeded random system because offers are currently priority-driven.
4. Only the Woodcutter has a profession-specific work loop.
5. Generic villagers all reuse one walking appearance.
6. Roads are simple procedural rectangles, not textured or curved paths.
7. Buildings do not currently consume resources to construct.
8. Economy balance is prototype-grade.
9. There is no audio, localization, tutorial system, analytics, or accessibility settings panel.
10. Camera pan/zoom and responsive mobile interaction are not implemented.
11. Asset lookup scans eager glob entries by filename on every request; a precomputed filename map would scale better.
12. `src/main.ts` currently owns several responsibilities and should eventually be split into scene, UI, animation, and layout modules.
13. The bundled JavaScript exceeds Vite's default 500 kB warning threshold, primarily because of Three.js and eager asset inclusion.

## 21. Recommended next implementation sequence

1. Add deterministic unit tests for all possible eight-move offer paths.
2. Add save-state serialization and a replayable build-order summary.
3. Split `main.ts` into `scene`, `cityLayout`, `villagers`, `constructionView`, and `ui` modules.
4. Create profession-specific activity contracts for Farm, Sawmill, Quarry, Market, and military buildings.
5. Replace straight road planes with reusable isometric path tiles or a small road-mesh generator.
6. Add construction costs and explicit resource-chain balance.
7. Add player-facing result scoring so different eight-building cities can be compared.
8. Add sound, camera controls, onboarding, and accessibility options.
9. Introduce lazy asset loading or route-specific bundles if startup size becomes a problem.

## 22. Suggested Claude review questions

Please review the implementation with particular attention to:

1. Is the simulation/rendering boundary sufficiently deterministic and testable?
2. Can the rolling-card algorithm ever produce fewer than three valid choices before Move 8?
3. What is the cleanest modular decomposition of `src/main.ts` without adding unnecessary framework complexity?
4. Should civic progression and population remain tied directly to completed move number?
5. How should construction costs and resource prerequisites integrate without weakening the simple *GROW*-style choice loop?
6. What save-state schema would remain forward-compatible as buildings and eras are added?
7. Are the current texture-cloning and eager-loading strategies acceptable for approximately 37 animated villagers and fifteen building sets?
8. What road representation will preserve the hand-painted isometric look while supporting future branching layouts?
9. What automated test matrix should cover all dependency and offer-order edge cases?
10. Which performance and accessibility risks should be addressed before expanding beyond the vertical slice?

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
