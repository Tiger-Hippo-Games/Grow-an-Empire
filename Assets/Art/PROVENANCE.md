# Art provenance

`common/ART_PIPELINE.md` §41–43 says every production asset needs a known provenance category, and third-party assets need a known licence. The portal's content policy (SUBMISSION_GUIDE §14) rejects unlicensed IP. This file records where each art family came from.

**Rows marked TODO need the owner's input before submission.** The repo points to AI generation but never names the tool: `Assets/Art/ART_PIPELINE.md` mentions "low-alpha generator residue" in the master sheets, and `Assets/Art/ART_DIRECTION.md` records the "generation prompt used for the benchmark" and one targeted edit. So the rows below say *likely AI-generated*; confirm the tool and its terms.

Categories (ART_PIPELINE §41): Human-created · AI-generated · Licensed asset · Studio-owned asset · Public-domain asset · Third-party asset · Procedurally generated · Mixed / modified.

| Art family | Files | Category | Tool / source | Licence and commercial-use terms checked | Human edits | Prompt kept? |
|---|---|---|---|---|---|---|
| Buildings (15 types × 4 construction stages) | `Assets/Art/Production/Buildings/*/Runtime2x/` | Likely AI-generated, then edited (confirm) | TODO: tool name | TODO | TODO | Benchmark prompt in `ART_DIRECTION.md`; others TODO |
| Civic center levels 0–8 | `Assets/Art/Production/Buildings/CivicCenter/` | Likely AI-generated, then edited (confirm) | TODO: tool name | TODO | TODO | TODO |
| Villagers and soldiers (walk sheets) | `Assets/Art/Generated 512/`, built into sheets by `Production/create-walk-sheets.ps1` | Likely AI-generated, then edited (confirm) | TODO: tool name | TODO | Walk sheets assembled by script | TODO |
| Terrain and trees | TODO (path) | Likely AI-generated, then edited (confirm) | TODO: tool name | TODO | TODO | TODO |
| Woodcutter animation clips | `Assets/Art/Masters/` → `Production/` via `Tools/ArtPipeline/export_sprite_grid.py` | Likely AI-generated masters, script-exported (confirm) | TODO: tool name | TODO | Background extraction, frame slicing, uniform scale | TODO |
| Runtime WebP copies | `Assets/Runtime/*.webp` | Mixed / modified (derived from the rows above) | `Tools/ArtPipeline/export_runtime_webp.py` (Pillow, quality 82) | Same as the source art | Lossy re-encode only | n/a |
| Store thumbnail and banner | `Assets/Art/Store/`, `public/assets/thumbnail.jpg`, `public/assets/banner.jpg` | Mixed / modified | In-game screenshot composed by `Tools/ArtPipeline/make_store_art.py` | Same as the source art, plus the Cinzel font below | Crop, edge shading, title text | n/a |
| Title font: Cinzel Black | `Tools/ArtPipeline/fonts/Cinzel-Black.ttf` | Third-party asset | Natanael Gama, via the `@fontsource/cinzel` npm package | **SIL Open Font License 1.1** (`fonts/OFL-Cinzel.txt`): commercial use, embedding in images and modification allowed; the font may not be sold on its own | None (converted WOFF2 → TTF) | n/a |

## Names and IP

- "Grow an Empire", "The Ashfang Raiders" and the building names are original to this project. **TODO:** confirm neither name copies an existing game or brand (SUBMISSION_GUIDE §14, "Misleading content").
- No third-party characters, logos or music are used. The game ships with no audio.

## If the art is AI-generated

ART_PIPELINE §41: "Do not assume that an AI-generated asset is automatically free of licensing or commercial-use considerations." Record the provider and plan, confirm its terms allow commercial use of outputs, and keep the prompts for the important assets (buildings, civic center) next to their source folders.
