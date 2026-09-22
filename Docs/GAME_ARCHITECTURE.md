# Grow an Empire architecture

## Product contract

The player is the settlement’s strategic authority. Every 30–90 seconds the game presents a build-order decision; after the player chooses, villagers execute the decision autonomously. Direct unit control is not part of the core loop.

Opening progression:

1. Move 0: the campsite already exists.
2. Move 1: build the Woodcutter.
3. Moves 2–7: reserved for decisions approved by the creative authority.
4. Move 8: upgrade the original campsite in place into the Town Hall.

## Runtime layers

### Content — `src/game/content.ts`

Owns declarative building definitions, move assignments, unlocks, construction timings, and production phase definitions. New buildings should enter the game through content data rather than new conditionals in the renderer.

### Simulation — `src/game/settlementSimulation.ts`

Owns authoritative settlement state and deterministic time advancement. It has no DOM, Three.js, or asset dependencies. Given the same initial state and elapsed time it must produce the same resources, phases, and events.

### Presentation — `src/main.ts`

Currently owns Three.js scene setup and translates simulation state into sprites, construction stages, animation frames, HUD values, and milestone panels. This layer must not award resources or advance moves on its own.

### Asset catalog — `src/render/assetCatalog.ts`

Owns Vite asset discovery and filename-to-runtime-URL resolution. Art paths remain separate from simulation rules.

## Invariants

- Simulation time is authoritative; rendering never changes the economy.
- A building choice is accepted once for its intended move.
- Construction completion emits the move transition.
- Wood is produced only when the stockpile phase begins.
- The campsite remains present through Moves 0–7 and is replaced in place on Move 8.
- Development speed changes elapsed simulation time, not game rules.

## Production roadmap

1. Extract the remaining Three.js presentation code into scene systems.
2. Add automated simulation tests and save-state serialization.
3. Approve the mechanics and identities of Moves 2–7.
4. Implement an eight-move playthrough using placeholder presentation assets.
5. Replace placeholders with final art one approved building at a time.
6. Add camera navigation, sound, balancing tools, performance budgets, and release packaging.
