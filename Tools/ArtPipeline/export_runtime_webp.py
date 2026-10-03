"""Export the game's runtime art as WebP into Assets/Runtime/.

Why: the portal caps the upload at 50 MB and expects a fast first load
(under 5 s on 10 Mbps). The current runtime set is around 15 MB as WebP;
PNG masters are not shipped.

How it works:
- SOURCES below lists exactly the PNGs the game loads (nothing else ships).
- Each one is written to Assets/Runtime/<same name>.webp. The game still asks
  for "farm-level-1-2x-v1.png"; render/assetCatalog.ts serves the .webp.
- Colour is lossy (quality 82); alpha is lossless, so sprite edges stay clean.
- Assets/Runtime/manifest.json records each source's SHA-256. A unit test
  fails if a source PNG changes without re-running this script, so stale
  art can't ship by accident.

Usage (from the project root):
    python Tools/ArtPipeline/export_runtime_webp.py          # export changed files
    python Tools/ArtPipeline/export_runtime_webp.py --all    # re-export everything
    python Tools/ArtPipeline/export_runtime_webp.py --check  # exit 1 if anything is stale

Requires Pillow (pip install pillow). The PNG masters are never modified.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "Assets" / "Runtime"
MANIFEST = OUT_DIR / "manifest.json"
QUALITY = 82
EXPORT_REVISION = 2  # Re-export when runtime resize rules change.

# Keep in sync with what the code loads. src/render/__tests__/runtimeAssets.test.ts
# checks that every file the code references is in the manifest.
SOURCES = [
    "Assets/Art/Production/Buildings/*/Runtime2x/*-construction-0[123]-*-2x-v1.png",
    "Assets/Art/Production/Buildings/*/Runtime2x/*-level-1-2x-v1.png",
    "Assets/Art/Production/Buildings/CivicCenter/Runtime2x/settlement-level-*-2x-v1.png",
    "Assets/Art/Production/Characters/WoodcutterMale01/Runtime2x/Sheets/*-south*-sheet-2x-v1.png",
    "Assets/Art/Production/Environment/Trees/Deciduous01/Runtime2x/deciduous-01-healthy-2x-v1.png",
    "Assets/Art/Production/Environment/Terrain/village-empty-terrain-16x9-v2.png",
    "Assets/Art/Production/Characters/DirectionalWalk/*-walk32-master-v1.png",
    "Assets/Art/Production/Characters/WorkLoops/*-work8-master-v1.png",
    "Assets/Art/Production/Characters/CombatLoops/*-combat-*8-master-v1.png",
    "Assets/Art/Production/Campaign/southern-road-map-v6.png",  # made by make_campaign_road_map.py
    # Commissioned painted icons (Docs/ICON_COMMISSION_BRIEF.md). src/ui/icons.ts
    # uses each one as soon as it is exported; until then it draws its SVG.
    "Assets/Art/Production/Icons/icon-*-v1.png",
]
# Glob matches that the game does not use.
EXCLUDE_NAMES = {"campsite-level-1-2x-v1.png"}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def collect_sources() -> list[Path]:
    found: dict[str, Path] = {}
    for pattern in SOURCES:
        for path in sorted(ROOT.glob(pattern)):
            if path.name in EXCLUDE_NAMES:
                continue
            if path.name in found and found[path.name] != path:
                sys.exit(f"Duplicate runtime filename {path.name}: {found[path.name]} and {path}")
            found[path.name] = path
    return sorted(found.values(), key=lambda p: p.name)


def export(source: Path, target: Path) -> None:
    image = Image.open(source)
    has_alpha = image.mode in ("RGBA", "LA") or (image.mode == "P" and "transparency" in image.info)
    image = image.convert("RGBA" if has_alpha else "RGB")
    # Keep the PNG masters at full resolution. Runtime sprites occupy only a
    # few screen pixels, so smaller atlases save decoded GPU memory and bandwidth.
    if source.name.endswith("-walk32-master-v1.png"):
        image = image.resize((1024, 680), Image.Resampling.LANCZOS)
    elif "-combat-" in source.name:
        image = image.resize((1024, 512), Image.Resampling.LANCZOS)
    elif source.name.endswith("-work8-master-v1.png"):
        image = image.resize((1024, 584), Image.Resampling.LANCZOS)
    elif source.name.startswith("icon-"):
        # Icons show at 18–28 stage px, up to 1.5× scale on a 2× screen: 96 px is enough.
        image = image.resize((96, 96), Image.Resampling.LANCZOS)
    quality = QUALITY
    if source.name.startswith("southern-road-map-"):
        # The campaign map is the first screen: 1440 px wide at quality 74
        # keeps it under 600 KB, and painted terrain hides the difference.
        image = image.resize((1440, round(image.height * 1440 / image.width)), Image.Resampling.LANCZOS)
        quality = 74
    image.save(target, "WEBP", quality=quality, method=4, exact=has_alpha)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--all", action="store_true", help="re-export every file")
    parser.add_argument("--check", action="store_true", help="only report stale files; exit 1 if any")
    args = parser.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}
    sources = collect_sources()
    expected = {source.name.removesuffix(".png") + ".webp" for source in sources}

    stale = []
    for source in sources:
        name = source.name.removesuffix(".png") + ".webp"
        digest = sha256(source)
        entry = manifest.get(name)
        if args.all or not entry or entry.get("sha256") != digest or entry.get("exportRevision") != EXPORT_REVISION or not (OUT_DIR / name).exists():
            stale.append((source, name, digest))

    removed = [name for name in manifest if name not in expected]
    if args.check:
        for _, name, _ in stale:
            print(f"stale: {name}")
        for name in removed:
            print(f"no longer used: {name}")
        return 1 if stale or removed else 0

    for index, (source, name, digest) in enumerate(stale, 1):
        export(source, OUT_DIR / name)
        manifest[name] = {
            "source": source.relative_to(ROOT).as_posix(),
            "sha256": digest,
            "exportRevision": EXPORT_REVISION,
            "sourceBytes": source.stat().st_size,
            "bytes": (OUT_DIR / name).stat().st_size,
        }
        print(f"[{index}/{len(stale)}] {name}")
    for name in removed:
        manifest.pop(name, None)
        (OUT_DIR / name).unlink(missing_ok=True)
        print(f"removed {name}")

    MANIFEST.write_text(json.dumps(dict(sorted(manifest.items())), indent=2) + "\n")
    total_src = sum(e["sourceBytes"] for e in manifest.values())
    total_out = sum(e["bytes"] for e in manifest.values())
    print(f"{len(manifest)} files: {total_src / 1e6:.1f} MB PNG -> {total_out / 1e6:.1f} MB WebP")
    return 0


if __name__ == "__main__":
    sys.exit(main())
