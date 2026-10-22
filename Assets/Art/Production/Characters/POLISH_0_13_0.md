# Character polish — 0.13.0

Date: 22 October 2026. Tool: built-in OpenAI image generation, with transparent-background editing. Project-owned existing masters were the references. No new third-party source images were used. This record keeps the selected output IDs and production prompts; provider/plan terms follow the project's existing provenance policy.

The tool automatically stores its originals in Codex's tool-managed `C:\Users\LENOVO\.codex\generated_images\01a13914-f00d-7a40-aabf-e2de168c2b2b` directory. Selected masters, backups, runtime exports and development scratch are on D:. The tool-managed originals were left intact.

## Selected assets

All names below are under `Production/Characters/`, relative to `Assets/Art/`. The seven selected PNGs are exported with the normal runtime WebP pipeline. Original replaced masters are in `Assets/Art/Archives/CharacterPolish-0.13.0/`; that archive is not shipped.

| Production master | Selected generated original |
|---|---|
| `DirectionalWalk/builder-walk32-master-v1.png` | `exec-15741fd0-ddd2-42bd-9f27-46a41d9c9e96.png` |
| `CombatLoops/swordsman-combat-south8-master-v1.png` | `exec-21b232cc-16e6-4357-b110-8a85bcaabee1.png` |
| `CombatLoops/archer-combat-south8-master-v1.png` | `exec-0c65e1b0-8c22-4e08-9050-26ce1932bd92.png` |
| `CombatLoops/horseman-combat-south8-master-v1.png` | `exec-6bc92b9e-4614-4a14-bf17-240830fd8cb9.png` |
| `CombatLoops/enemy-combat-north8-master-v1.png` | `exec-5642e496-fc93-4282-ae6b-5521e3237b72.png` |
| `CombatLoops/enemy-archer-combat-north8-master-v1.png` | `exec-244d84ec-c5e3-4e65-906b-145360b2e7b5.png` |
| `CombatLoops/enemy-horseman-combat-north8-master-v1.png` | `exec-c5d8433f-9911-4446-99f1-ac57ebd9299b.png` |

The existing elephant and specialist villager art is retained. This pass improves their animation treatment rather than claiming to repaint every specialist. The new founder has smaller head proportions, cleaner hands, cloth and tools; military silhouettes use cream cloth, saffron/teal player colors, indigo rivals and bronze armor. Rivals now retain actual archer/cavalry identities instead of sharing one infantry icon.

## Builder prompt chain

Initial edit reference: archived `builder-walk32-master-v1.png`.

```text
Edit the attached game sprite atlas into a more polished, readable Bharatvarsha village builder. Production sprite sheet, NOT concept art. Preserve EXACTLY the reference layout: 8 equal columns x 4 equal rows, exactly 32 full-body sprites, one same character in all cells, directions columns left to right NORTH (back), NORTHEAST, EAST, SOUTHEAST, SOUTH (front), SOUTHWEST, WEST, NORTHWEST, four visibly distinct walking poses down rows (right foot contact, passing, left foot contact, passing). Keep identical center and foot baseline inside each equal cell, generous clear margin, no clipping. Warm Indian brown skin, cream dhoti and sleeveless tunic, muted saffron-red sash and turban, compact tool belt, small wooden mallet at waist. Charming clean hand-painted isometric strategy game sprite, clear face, tidy silhouette, bright cloth highlights, readable hands and feet, slightly less oversized head than reference, consistent upper-left lighting. Match existing world scale and identity. Actual transparent alpha background throughout, no colored background, no floor, no cast shadows, no cell borders, no writing or labels. Landscape sheet with the SAME 8x4 cell organization as the reference, 1536x1024 preferred. Do not merge frames or create extra characters.
```

Margin correction, referenced first output `exec-2897f3e1-97a3-4152-a777-7a99533c41b2.png`, produced `exec-bd1db352-98af-470c-83d0-946a67619200.png`:

```text
Correct this production sprite atlas for clean animation playback. 8 columns and 4 rows, equal cells 192x256. Inside EVERY cell the whole character including tools MUST fit in a SMALL centered 130x180 rectangle. TOP ROW bodies must be between y=45 and y=220, second row y=301..476, third row y=557..732, fourth row y=813..988. Feet at y220,476,732,988 respectively. Do not change poses or directions. Keep transparent space 30 pixels to each side and 35 pixels above/below in EVERY CELL. Shrink EVERY sprite considerably. Maintain exact equal rectangular grid, no frame overlap, no cropping, no extra characters. TRANSPARENT alpha background. No grid lines, no labels, no backdrop or shadows. Quality unchanged.
```

Final margin correction referenced that second output:

```text
Correct this sprite sheet. SHRINK ALL 32 CHARACTERS TO SIXTY PERCENT OF THEIR CURRENT SIZE. Keep the full canvas 1536x1024, and the exact 8 column by 4 row layout. Center each tiny full character inside its own 192x256 cell. Place ALL feet exactly 200 pixels down within each cell (y200,456,712,968). Huge empty transparent margins around each figure. IMPORTANT the first row must NOT extend below y220. No cropping, no overlap across cells. Preserve character appearance, directions and walking poses. No shadows, no labels, no lines. Transparent alpha background.
```

The generator's final row spacing was inspected rather than assumed. `characterAssets.ts` uses authored 128×170 source windows at x = column×192 + 48 and y = 80 / 330 / 574 / 818 in the 1536×1024 master. These windows remove blank margins and align feet without modifying the master. Runtime UVs use normalized coordinates, including the existing half-pixel inset. Eight-pose future builder sheets continue through the standard atlas path.

## Combat generation prompts

Each initial reference was the matching archived atlas. Four equal columns × two equal rows, eight frames; player faces south and rival faces north. All edits used `transparent_background: true`.

Swordsman initial prompt:

```text
Production game sprite atlas edit. Replace the European knight in this reference with a heroic ancient Indian Bharatvarsha swordsman, warm brown skin, saffron turban, cream cotton dhoti, red sash, bronze lamellar chest armor, round bronze shield and curved talwar. Charming clean painted isometric strategy-game style, sharp silhouette, detailed readable hands/face, consistent upper-left light. Preserve EXACT reference atlas format: 4 equal columns by 2 equal rows = EXACTLY 8 full-body frames, same character, feet at identical baseline within each cell, consistent scale and pivot, generous transparent margin, NO clipping weapons. Character faces SOUTH toward viewer, slight three-quarter stance. Ordered poses left to right across top then bottom: guarded idle, wind-up, blade raised, decisive forward slash, shield brace, slash follow-through, recover, guarded idle. Distinct readable fluid motion, feet planted, shield stays attached, no ghosted duplicate limbs. Whole atlas landscape 2:1 aspect ratio. TRANSPARENT background with actual alpha, no solid backdrop, no ground, NO shadows, no text, no labels, no borders. Keep character contained in its own cell. This must be a usable sprite sheet rather than concept art.
```

Swordsman selected correction referenced `exec-50403988-16e7-4d8e-a429-686884ca4d4c.png`:

```text
Correct this production sprite atlas for clean animation playback. 4 columns by 2 rows, equal cells. Scale EVERY entire character and weapon down to 65% of current size, inside its own grid cell. All feet must share exactly the SAME baseline within their cell. Each full character INCLUDING raised sword must have a large transparent border on EVERY side. At least 40 transparent pixels between any painted pixel and a cell edge. Top row feet must stay ABOVE the horizontal halfway line, with a 40 pixel margin. Bottom row feet 40 pixels above bottom edge. Preserve the same 8 poses and character identity. Maintain exact equal rectangular grid, no frame overlap, no cropping, no extra characters. TRANSPARENT alpha background. No grid lines, no labels, no backdrop or shadows. Quality unchanged.
```

For archer, horseman and rival infantry, concatenate the following prefix, the role sentence from the table, and the suffix. This preserves the complete parameterized prompt set.

```text
PREFIX: Edit this production game atlas to replace European fantasy clothing with a polished Bharatvarsha epic design.

SUFFIX: 4 equal columns by 2 equal rows, EXACTLY 8 frames. Draw each whole sprite SMALL at 65% cell size, centered horizontally, feet fixed at 85% cell height. CRITICAL: every weapon, limb and horse fits entirely INSIDE its own equal cell with broad transparent margin on all sides, never touching edges. No sprite overlap. Same scale and foot pivot across ALL eight poses. Clear charming hand-painted strategy game style, readable silhouettes, cohesive cream/saffron/bronze palette, upper left lighting. Transparent alpha background, no ground, NO shadows, no text, no borders. Landscape atlas aspect 2:1.
```

| Role | Role sentence |
|---|---|
| Archer | An ancient Indian woman archer, brown skin, cream dhoti trousers, teal-blue tunic, saffron headcloth, leather bracers, wooden bow and quiver. SOUTH/front facing. Eight poses: idle, nock, lift bow, draw, aim, release, relax, idle. |
| Horseman | An ancient Indian cavalry rider, brown skin, saffron turban, bronze armor and teal saddle cloth on a chestnut horse, short spear. NO European plate helmet or heraldry. SOUTH/front facing. Eight poses: idle, gather stride, raise spear, forward thrust, follow through, recover spear, settle horse, idle. |
| Rival infantry | An ancient Indian rival foot soldier, brown skin, dark indigo turban, bronze scale cuirass, indigo dhoti trousers, round shield and short curved sword. NORTH/BACK facing, back visible. Eight poses: idle, wind up, raise sword, forward slash, brace shield, follow through, recover, idle. |

Selected correction prompt for those three, referenced initial outputs `exec-2c15830d-45c0-4818-9d9d-b86035957157.png`, `exec-8d19117c-621b-4452-b57a-30e29a25cc8a.png`, and `exec-8614aa6d-5c0e-4923-b376-4c8f4eff9336.png`, respectively:

```text
Fix the sprite atlas for production. Scale EVERY character and all weapons to only 65 percent of current size. Keep 4 equal columns and 2 equal rows, exactly 8 sprites, each sprite centered within its own cell. Each sprite has a WIDE transparent margin on all four sides. Every foot is on a consistent baseline at 85 percent of its cell height. NO object touches or crosses a cell edge. Top-row sprites must be entirely above the halfway line, bottom-row sprites entirely below. No clipping any bow tip or lance. Keep the current character design and eight poses exactly. Transparent alpha background, no ground or shadow, no labels or lines.
```

North-facing rival archer/cavalry used the selected player archer/cavalry output as reference, respectively. Replace `{ROLE}` with `archer with bow and quiver` or `cavalry rider and chestnut horse with spear`:

```text
Edit this game sprite atlas into the opposing army's {ROLE}. Turn EVERY character around to face NORTH (away from camera), show their BACK, back of head and shoulders. Same ancient Indian Bharatvarsha design. Change saffron clothing to dark indigo blue with bronze details; preserve cream trousers. Keep EXACT existing sprite positions, sprite scale and 4 equal columns by 2 equal rows, exactly eight full-body animation poses. All sprites and every weapon fit within the same cells with wide transparent margins, no overlap. Do not enlarge the sprites or crop anything. One attack cycle viewed FROM THE BACK with guard, wind up, attack and recovery. Transparent alpha, no backdrop or shadows, no lines or labels.
```

## Playback and verification

- Source sheets preserve transparent alpha. Existing WebP export resizes/re-encodes the selected masters; no Python image editing was used to repair generated art.
- Population stays bounded at 80 citizens, garrison at 14 per trained kind, battle at six sprites per unit kind and side. Exact counts remain in simulation and popup chips.
- Walking uses stride distance; new recruits use the calmer crowd clock. Breathing and lean do not modify economy, population, casualties or move timing.
- Battle movement separates melee wind-up/strike/recovery, bow recoil, cavalry surge and elephant weight. A bounded volley is recreated once per battle round while archers remain. Banners identify sides.
- Existing Skip, exact survivor counts, zero-army ending, hidden-tab/portal pause and reduced-motion tests continue to run. Art references and PNG/WebP freshness are checked by the runtime asset tests.
- `Tools/qa/tutorial_polish.py` checks all three real lessons, first-action Gather, keyboard choice, replay, skip, clear text and guide/card separation on desktop and phones.
