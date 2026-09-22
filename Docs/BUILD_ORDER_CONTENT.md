# Eight-move branching build order

The settlement begins at civic Level 0 with one visible villager. Each completed move upgrades the civic center, adds the level number in new villagers, and presents the next rolling three-card choice. The population sequence is therefore 1, 2, 4, 7, 11, 16, 22, 29, and 37.

## Offer contract

- Move 1 always offers Woodcutter's Hut, Farm, and Swine Farm.
- The selected card is built and leaves the pool; the two unselected cards persist.
- Exactly one eligible new card is added before the next move.
- A newly unlocked follow-up is prioritized, so choosing Farm immediately introduces Bakery, for example.
- The run stops after the eighth completed choice. Seven of the fifteen possible district buildings remain unbuilt, making the resulting city a record of the player's decisions.

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
| House | Move 3 onward | Residential identity |
| Granary | Farm or Orchard built; Move 4 onward | Grain storage |
| Marketplace | Move 4 onward | Wealth production |
| Blacksmith | Quarry built; Move 4 onward | Weapons Workshop |
| Weapons Workshop | Blacksmith built; Move 5 onward | Barracks |
| Barracks | Weapons Workshop built; Move 6 onward | Defense production |

The catalog order breaks ties between equally eligible buildings, keeping runs deterministic while the player's prior choices determine which branches can enter the pool.
