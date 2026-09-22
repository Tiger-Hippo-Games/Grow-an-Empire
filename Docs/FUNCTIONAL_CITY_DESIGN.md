# Functional City Design — Campaign 1

The city is a readable consequence of the player's build order. Buildings are not decorative slots: placement, roads, population movement, production feedback, and the final army all visualize the same dependency graph used by the simulation.

## 1. District composition

- **Civic and trade:** Town Hall, Marketplace, House.
- **Timber:** Woodcutter's Hut beside the forest; Sawmill between forest and town.
- **Food:** Farm, Bakery, and Granary share the cultivated northwest approach.
- **Provisions:** Orchard/Winery and Swine Farm/Butchery form two southwest chains.
- **Military industry:** Quarry → Blacksmith → Weapons Workshop → Barracks progresses outward along the southeast road.

Five main roads join these districts to the Town Hall. Small building spurs appear when construction begins. A lighter supply lane appears only when both halves of a production relationship have been completed.

## 2. Population movement

Every completed building creates a service route to the Town Hall. Completed dependency pairs create dedicated supply routes. Citizens pause at route endpoints to imply loading, work, and unloading rather than orbiting buildings continuously. Marketplace trade routes appear only when both the market and an eligible supplier exist.

## 3. Timing language

- Civic service traffic moves faster than loaded supply traffic.
- Construction quickly establishes location, then spends most of its duration on visible foundation and frame work.
- Workers pause at buildings before returning.
- Economy resolution creates one readable pulse per active building per move.
- Army assembly is slower and more ceremonial than ordinary pedestrian movement.

All visual timings live in `src/render/animationDesign.ts` so later art iteration does not require changing gameplay rules.

## 4. Nine-level environmental story

| Level | Settlement change |
|---:|---|
| 0 | Founding fire and campsite clearing |
| 1 | Boundary-stone claim |
| 2 | Timber civic enclosure |
| 3 | Cultivated field boundaries |
| 4 | Public well and meeting place |
| 5 | Central market awnings |
| 6 | Lamps on the district approaches |
| 7 | Council banners and town identity |
| 8 | Stone gateposts and Grand Town Hall |

These details accumulate; they do not replace one another. The final city therefore preserves a visible history of all eight moves.

## 5. Army Muster

At Move 8, the calculated military units stop participating in work routes and assemble in ranks south of the Grand Town Hall. Veterans and archers receive distinct color treatment; remaining villagers circulate as spectators and support population. The formation size is driven by the actual `ArmyReport`, so a weak and a strong build order produce visibly different finales.
