# City plan (0.16.0)

Plot positions are in the 1920 × 1080 plan (`planPoint` in `src/render/cityLayout.ts`). The Town Hall stands at (938, 548). Each quarter sits where its work happens on the painted terrain, and the road network follows the quarters.

| Quarter | Where | Buildings | Why |
|---|---|---|---|
| Fields | north-west meadow | Farm (220,300), Granary (410,300), Baoli (330,480), Royal Kitchen (545,465) | Grain is stored and cooked beside the paddy; the stepwell sits between the fields, grove and herd it waters. |
| Orchards and pasture | west, among the fruit trees | Mango Grove (190,640), Soma Press (410,660), Goshala (200,830), Ghee House (420,850) | Each processor stands next to its producer. |
| Civic core | around the Town Hall | House (690,620), Dharmashala (720,330), Koshagar (1000,270), Dharma Stambha (960,720), Bazaar (1200,640) | Homes together; treasury guarded behind the hall; the pillar on the square before the hall steps, above the parade ground. |
| Forest road | north-east tree line | Woodcutter (1650,290), Carpenter's Yard (1440,300), Sarai (1420,490) | Timber is cut and sawn at the forest edge; caravans arrive on the east road beside the Bazaar. |
| Stone and iron | eastern rocks | Quarry (1660,600), Lohar Forge (1460,700), Bow Hall (1700,830) | Stone and metal work on the rocky ground. |
| Southern frontier | facing the enemy road | Burj (500,1000), Prakara (700,920), Akhara (1300,900), Ashvashala (1500,990), Gajashala (1740,1010) | Bastion and gate tower on the wall; soldiers drill on the parade ground right of the Prakara; stables beside it. |

District roads (`DISTRICT_PATHS`) run from the hall to each quarter's junction; the `frontier` road runs south past the Dharma Stambha through the parade ground to the gate. Tests: `src/render/__tests__/functionalCity.test.ts`.
