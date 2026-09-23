# Twelve-move branching build order

The settlement begins at civic Level 0 with one visible villager. Each completed move upgrades the civic center, adds the level number in new villagers, and presents the next rolling choice. Base population reaches 79 at Level 12. Building a House adds two more people per level from its construction onward.

## Offer contract

- Move 1 always offers Woodcutter's Hut, Farm, and House.
- The selected card is built and leaves the pool; the two unselected cards persist.
- One eligible new card is added before the next move when the catalog permits it. Late moves can have two choices if the remaining buildings are locked behind prerequisites.
- A newly unlocked follow-up is prioritized, so choosing Farm immediately introduces Bakery, for example.
- The run stops after the twelfth completed choice and musters the army. Three of the fifteen possible district buildings remain unbuilt.

## Dependency graph

| Building | Eligibility | What it enables |
| --- | --- | --- |
| Woodcutter's Hut | Opening choice | Sawmill |
| Farm | Opening choice | Bakery, Granary |
| Swine Farm | Opening choice | Butchery |
| Sawmill | Woodcutter built | Plank synergy |
| Bakery | Farm built | Food synergy |
| Butchery | Swine Farm built | Food synergy |
| Fruit Orchard | Move 3 onward | Winery, Granary |
| Winery | Orchard built | Wine synergy |
| Quarry | Move 3 onward | Blacksmith |
| House | Opening choice | +2 people at every level after building |
| Granary | Farm or Orchard built; Move 4 onward | Grain storage |
| Marketplace | Move 4 onward | Wealth production |
| Blacksmith | Quarry built; Move 4 onward | Weapons Workshop, Barracks |
| Weapons Workshop | Blacksmith built; Move 5 onward | Armed troops |
| Barracks | Blacksmith or Weapons Workshop built | Training and defense production |

The catalog order breaks ties between equally eligible buildings, keeping runs deterministic while the player's prior choices determine which branches can enter the pool.
