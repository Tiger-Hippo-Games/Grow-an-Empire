# Art brief: eight new buildings and the war elephant (0.10.4–0.10.5)

Ravi, 2026-10-11: add the Baoli, the Prakara watchtower, the Gajashala and the Dharma Stambha ("stand-ins now + briefs"), then the Burj, Sarai, Koshagar and Dharmashala ("I will finish their art later - for now just have placeholders"). 0.10.4 and 0.10.5 ship with procedural stand-ins drawn by `Tools/ArtPipeline/make_standin_buildings.py`. **Painted art replaces them with no code change:** same filenames, same canvas.

## Every building: four images

| File (in `Assets/Art/Production/Buildings/<Dir>/Runtime2x/`) | Shows |
|---|---|
| `<id>-construction-01-foundation-2x-v1.png` | Plot marked out, footings, materials stacked |
| `<id>-construction-02-frame-2x-v1.png` | Walls or shaft rising, bamboo scaffolding |
| `<id>-construction-03-late-2x-v1.png` | Nearly complete, scaffolding on one side, a pile of the last materials |
| `<id>-level-1-2x-v1.png` | Finished and in use |

**Canvas:** 1536 × 1024 px RGBA, transparent background, no baked shadow outside the plot. The plot's **front corner touches about y = 985** (the image bottom is the building's ground point). Same isometric angle, scale and light (upper left) as the Ashvashala (`Stable/`), the closest reference. Tall buildings may use a smaller footprint, but keep the whole building inside the canvas: the game scales every image to a fixed height (6.5 world units when complete), so empty space above makes the building look smaller.

**Style:** the painted Bharatvarsha look of the existing buildings (`Assets/Art/ART_DIRECTION.md`): warm sandstone and red stone, timber, terracotta tiles, grass-edged plots with a dirt yard.

## The eight buildings

| Id / folder | Name | What it must read as at 120 px wide | Notes |
|---|---|---|---|
| `baoli` / `Baoli/` | Baoli (stepwell) | A square sunken well with stepped terraces down to water | Sandstone; two small chhatris (domed kiosks) on the corners; water pots on the rim when complete; dry terraces in early stages, water appears at "late". |
| `prakara` / `Prakara/` | Prakara (watchtower) | A tall stone tower on a short stretch of city wall | Red stone, crenellations, arrow slits, a small canopy and a plain saffron pennant on top; an archer silhouette at the top is welcome. No religious symbols. |
| `gajashala` / `Gajashala/` | Gajashala (elephant stables) | A long hall with tall arched bays sized for elephants, one elephant in the yard | Stone plinth, sandstone walls, terracotta roof; fodder bales; the elephant only on the finished image (with a red and gold saddle cloth). |
| `dharma-stambha` / `DharmaStambha/` | Dharma Stambha | A tall polished sandstone pillar on a stepped plinth, crowned with a wheel | Inspired by the Mauryan pillars: smooth tapering shaft, an inverted-lotus bell capital, then a **24-spoke wheel**. **Do not use the four-lion capital** (the national emblem of India is protected) and no inscriptions. Marigold garlands at the foot when complete. |

| `burj` / `Burj/` | Burj (bastion) | A round stone bastion with a crenellated top and a drill yard | Spear rack, a training post with a straw dummy, round shields; villagers drilling is welcome. |
| `sarai` / `Sarai/` | Sarai (caravanserai) | A walled courtyard with rooms round it and a big arched gate | Bales and sacks in the yard, a resting camel, a plain pennant over the gate. |
| `koshagar` / `Koshagar/` | Koshagar (treasury) | A squat stone strongroom with an iron-banded door and a small gilded dome | Chests of coin by the door, a guard's spear; heavy, secure, not a palace. |
| `dharmashala` / `Dharmashala/` | Dharmashala (rest house) | A two-storey rest house with a pillared veranda and a tiled roof | A charpai (rope cot) and water pots outside; travellers resting on the veranda. No religious symbols. |

## War elephant (battle and dialogs)

Today the elephant is an inline SVG (`ELEPHANT_SVG` in `src/render/combatScene.ts`, icon `elephants` in `src/ui/icons.ts`). Deliver:

1. `elephant-combat-south8-master-v1.png`: a combat sheet like `horseman-combat-south8-master-v1.png` (4 × 2 frames, ready pose first), a war elephant with a mahout and a howdah, facing the viewer. Add it to `SHEETS` in `combatScene.ts` and drop the `background-size` override for `.unit-elephants` in `styles.css` (a two-line change).
2. Optionally `icon-elephants-v1.png` and `icon-tower-v1.png` for the painted icon set (`Docs/ICON_COMMISSION_BRIEF.md`); `icon()` picks them up automatically once exported.

## Dropping them in

1. Save the PNGs over the stand-ins (same paths and names).
2. Run `python Tools/ArtPipeline/export_runtime_webp.py`, then `pnpm check` (the art test fails on a stale or missing WebP).
3. Play a campaign to the Gajashala and the Dharma Stambha (`Tools/qa/gameplay.py` screenshots the city).
4. Add a provenance row to `Assets/Art/PROVENANCE.md` (artist or tool, licence, date) and remove the stand-in row.

## Budget

The painted buildings of the same size are about 250–300 KB each as WebP (the stand-ins are 20–50 KB). Thirty-two images add about 8 MB to the ZIP (0.10.5 is 16.5 MB, portal limit 50 MB). They load only when a building is built, so the first screen is unaffected.
