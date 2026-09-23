# Twelve-move branching build order

The settlement begins at civic Level 0 with one visible villager. Each completed move upgrades the civic center, adds the level number in new villagers, and presents the next rolling choice. Base population reaches 79 at Level 12. Building a House adds two more people per level from its construction onward.

## Offer contract

- Move 1 always offers Woodcutter's Hut, Farm, and Quarry.
- The selected card is built and leaves the pool; the two unselected cards persist.
- One eligible new card is added before the next move when the catalog permits it. Late moves can have two choices if the remaining buildings are locked behind prerequisites.
- A newly unlocked follow-up is prioritized, so choosing Farm can introduce the Swine Farm or Orchard.
- The run stops after the twelfth completed choice and musters the army. Three of the fifteen possible district buildings remain unbuilt.

## Dependency graph

| Building | Eligibility | What it enables |
| --- | --- | --- |
| Woodcutter's Hut | Opening choice | Sawmill |
| Farm | Opening choice | Swine Farm, Fruit Orchard |
| Quarry | Opening choice | Stone construction |
| Sawmill | Woodcutter built | Plank synergy |
| Swine Farm | Farm built | Butchery |
| Fruit Orchard | Farm built | Fruit production |
| House | Sawmill and Quarry built | +2 people at every level after building |
| Blacksmith | Sawmill and Quarry built | +1 swordsman each completed move |
| Weapons Workshop | Sawmill and Quarry built | +1 archer each completed move |
| Barracks | Sawmill and Quarry built | Training, defense, and a home for the visible garrison |
| Bakery | Farm, Sawmill, and Quarry built | Rations |
| Granary | Farm, Sawmill, and Quarry built | Grain storage |
| Winery | Farm, Sawmill, and Quarry built | Wine production |
| Butchery | Swine Farm and Sawmill built | Rations |
| Marketplace | Farm and Butchery built | Wealth production |

The catalog order breaks ties between equally eligible buildings, keeping runs deterministic while the player's prior choices determine which branches can enter the pool.

Completed Blacksmith and Weapons Workshop buildings each train exactly one of their respective units at the end of every move, including the move when built. Those units stand outside the Barracks plot and are counted in the final muster. All building sprites, including the civic center, display at twice their former size; character and terrain scales are unchanged.
