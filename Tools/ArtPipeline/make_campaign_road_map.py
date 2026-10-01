"""Compose the tall campaign road map from four of the campaign paintings.

Writes Assets/Art/Production/Campaign/southern-road-map-v6.png (1672 px wide).
The campaign map (src/ui/campaignMap.ts) scrolls up this picture: the camps
of campaign 1 at the bottom, the river villages, the mountain pass and the
royal castle, and the enemy's fortress at the top for campaign 25.

Each painting is cropped to drop its empty parchment label boxes, then they
are stacked bottom to top and blended over a wavy 120 px seam so no straight
join shows. Re-run after changing a source painting, then run
export_runtime_webp.py. If you replace the map with one painted as a single
picture, keep the file name (or update SOURCES and campaignMap.ts) and
re-place the stops in campaignMap.ts (STOPS), which are fractions of the
picture's width and height.

Usage (from the project root):
    python Tools/ArtPipeline/make_campaign_road_map.py

Requires Pillow and NumPy.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / "Assets" / "Art"
OUT = ART / "Production" / "Campaign" / "southern-road-map-v6.png"

# Bottom to top: (painting, crop top, crop bottom) as fractions of its height.
PARTS = [
    ("Concepts/Campaign/southern-provinces-map-v4.png", 0.18, 0.77),   # camps (campaigns 1-5)
    ("Concepts/Campaign/village-provinces-map-v3.png", 0.24, 0.72),    # river villages
    ("Production/Campaign/southern-pass-map-v5.png", 0.135, 0.80),     # riders and the pass
    ("Concepts/Campaign/kingdom-provinces-map-v2.png", 0.0, 0.70),     # castle and fortress
]
SEAM = 120  # px of overlap between two paintings


def main() -> None:
    crops = []
    for name, top, bottom in PARTS:
        image = np.asarray(Image.open(ART / name).convert("RGB")).astype(np.float32)
        height = image.shape[0]
        crops.append(image[int(top * height):int(bottom * height)])
    width = crops[0].shape[1]
    if any(crop.shape[1] != width for crop in crops):
        raise SystemExit("All paintings must have the same width")

    stack = crops[::-1]  # top to bottom
    total = sum(crop.shape[0] for crop in stack) - SEAM * (len(stack) - 1)
    out = np.zeros((total, width, 3), np.float32)
    columns = np.arange(width)
    y = 0
    for index, crop in enumerate(stack):
        height = crop.shape[0]
        if index == 0:
            out[:height] = crop
            y = height - SEAM
            continue
        # A wavy, eased blend line, so the join follows no straight row.
        wave = np.sin(columns / 97.0 + index) * 18 + np.sin(columns / 41.0 + 2 * index) * 9
        rows = np.arange(SEAM)[:, None]
        t = np.clip((rows - (SEAM / 2 + wave[None, :])) / (SEAM * 0.32) + 0.5, 0, 1)
        t = t * t * (3 - 2 * t)
        out[y:y + SEAM] = out[y:y + SEAM] * (1 - t[..., None]) + crop[:SEAM] * t[..., None]
        out[y + SEAM:y + height] = crop[SEAM:]
        y += height - SEAM

    OUT.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(out.clip(0, 255).astype(np.uint8)).save(OUT, optimize=True)
    print(f"{OUT.relative_to(ROOT)}: {width} x {total}")


if __name__ == "__main__":
    main()
