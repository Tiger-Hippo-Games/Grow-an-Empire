# Eight-move building generation notes

Mode: built-in image generation. Each master was copied into `Assets/Art/Masters/Buildings/<Building>/` and deterministically split into four runtime PNGs in `Assets/Art/Production/Buildings/<Building>/Runtime2x/`. The civic master was split into nine runtime PNGs.

## Shared industry prompt

Each industry used this prompt wrapper, with the exact subject and stage sequence listed below:

> Use case: stylized-concept. Asset type: production 2D game building progression sheet for an HTML5 isometric settlement game. Create EXACTLY FOUR isolated construction stages of the SAME compact medieval {SUBJECT} in a clean 2x2 grid: {STAGES}. Cozy hand-painted storybook style, southeast isometric three-quarter camera, identical footprint and lighting, readable around 180 pixels wide. Genuine transparent PNG alpha everywhere outside each footprint, generous transparent separation. No shared ground slab, text, labels, UI, border, people, modern objects, backdrop, glow outside footprint, or cropped edges.

| Subject | Exact stage sequence |
| --- | --- |
| Bakery | stone foundation and clay oven base; timber wall frame and unfinished oven chimney; nearly finished plaster-and-timber bakery with partial thatched roof; completed bakery with oven glow, bread rack, flour sacks, and chimney |
| Quarry | surveyed rocky ground with stakes and first cut stones; shallow stepped excavation with timber braces; nearly finished quarry with hoist, ramps, and blocks; completed quarry with stepped stone face, crane, block stacks, tools, and cart |
| House | stone footing, hearth base, and marked garden; timber frame with floor and chimney base; nearly finished plaster-and-timber walls with partial thatched roof; completed house with warm windows, vegetable patch, laundry line, and fenced yard |
| Sawmill | stone footings, log skids, and marked channel; timber frame with waterwheel supports; nearly finished roof, channel, wheel, and saw bench; completed sawmill with waterwheel, covered saw, planks, log ramp, and timber racks |
| Granary | raised stone pads and timber floor posts; elevated timber frame with stairs; nearly finished plank walls and steep thatched roof; completed raised granary with sacks, loading platform, ladder, mouse guards, and wheat sheaves |
| Marketplace | paved square with post holes; stall frames and partial central awning; nearly finished three-stall cluster; completed market with muted canvas stalls, produce, pottery, cloth, signpost, and central well |
| Blacksmith | stone foundation with forge base; heavy frame, chimney base, and unfinished hearth; nearly finished roof, forge hood, and workbench; completed smithy with dark roof, glowing forge, chimney, anvil, barrel, tools, and rack |
| Butchery | stone footing and work-yard markers; timber frame and preparation tables; nearly finished plaster-and-timber shop with partial roof; completed butchery with covered counter, barrels, hooks, chopping block, and supply cart |
| Fruit Orchard | marked planting rows and young saplings; established saplings with paths and fence posts; maturing fruit trees with partial fencing and baskets; completed orchard with fruit-laden trees, neat paths, baskets, ladder, and small tool shelter |
| Winery | stone footing, press base, and barrel stands; timber frame around the press room; nearly finished plaster-and-timber winery with cellar entry; completed winery with grape press, casks, vine trellis, baskets, and delivery cart |
| Weapons Workshop | reinforced stone footing and forge bases; heavy timber frame with work benches; nearly finished tiled workshop with chimneys and racks; completed workshop with glowing forges, weapon racks, anvils, shields, and timber work yard |
| Barracks | stone footing and drill-yard markers; stout timber frame and palisade sections; nearly finished fortified longhouse with watch platform; completed barracks with training yard, weapon racks, banners, palisade, and guard tower |

Farm and Swine Farm prompts are stored in their local `GENERATION_NOTES.md` files.

## Civic progression prompt

> Use case: stylized-concept. Asset type: production 2D game civic-center level atlas for an HTML5 isometric settlement game. Create EXACTLY NINE isolated stages of ONE continuously evolving central settlement building in a perfectly ordered 3x3 grid, read left-to-right then top-to-bottom. Stage 0: humble campsite with canvas tent, campfire, crates, and central banner. Stage 1: improved campsite with low palisade, notice board, and timber platform. Stage 2: permanent timber foundation, meeting canopy, and larger banner. Stage 3: framed small village hall growing directly from the camp platform. Stage 4: completed modest timber village hall with bell frame. Stage 5: expanded hall with stone base, side wing, and paved forecourt. Stage 6: taller two-story civic hall with clock or bell tower under construction. Stage 7: substantial near-complete town hall with stone lower floor, timber upper floor, balcony, tower, and civic square. Stage 8: finished proud medieval TOWN HALL with stone base, warm timber upper stories, central clock/bell tower, red-gold settlement banner, balcony, stairs, and small paved civic forecourt. Each stage must visibly preserve recognizable parts of the previous stage and expand in place. Cozy polished hand-painted storybook style, southeast isometric three-quarter camera, identical center point and lighting, footprint grows gradually, readable at city-map scale. Genuine transparent PNG alpha everywhere outside each isolated footprint, generous transparent gutters between all nine cells. No shared background, no text, no labels, no UI, no border, no people, no modern objects, no cropped edges.
