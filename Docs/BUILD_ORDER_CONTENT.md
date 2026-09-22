# Opening build-order content

The settlement uses a rolling three-card pool. A selected building leaves the pool; the two unchosen cards remain; one new building is introduced on the next move.

| Move | New card(s) | Strategic role | Production status |
| --- | --- | --- | --- |
| 1 | Woodcutter, Farm, Swine Farm | Wood vs grain vs food opening | Playable with construction art |
| 2 | Bakery | Converts grain into higher-value food | Content definition ready; art next |
| 3 | Quarry | Adds stone for durable construction | Proposed |
| 4 | House | Raises population capacity | Proposed |
| 5 | Sawmill | Multiplies timber value | Proposed |
| 6 | Granary | Protects and expands food storage | Proposed |
| 7 | Marketplace | Unlocks commerce and wealth | Proposed |
| 8 | Blacksmith | Improves the basic industries | Proposed |

On Move 8, the original Campsite also upgrades automatically into the Town Hall. This civic upgrade does not consume one of the three choice cards.

The Move 3–8 names are a coherent first-pass economy ladder, not locked creative decisions. Their definitions live in `src/game/content.ts` so they can be renamed or reordered without rewriting presentation code.
