"""Build the GoLive store images from an in-game screenshot.

The portal docs ask for two different sets (they disagree), so both are made:
  Upload (DEVELOPER_GUIDE §8 / CONVERSION_GUIDE §13):
    Assets/Art/Store/upload/thumbnail-480x270.jpg   16:9, under 200 KB
    Assets/Art/Store/upload/banner-1280x720.jpg     16:9, under 500 KB
  Inside the ZIP (SUBMISSION_GUIDE §4, §9; the validator looks for these):
    public/assets/thumbnail.jpg                     400 x 300 (4:3)
    public/assets/banner.jpg                        1280 x 360

Usage:
    python Tools/ArtPipeline/make_store_art.py [screenshot.png]
The default source is Assets/Art/Store/store-art-source-1920x1080.png, a
1920x1080 capture of a 12-move city with the interface hidden.

Title font: Cinzel (SIL Open Font License 1.1, see fonts/OFL-Cinzel.txt).
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
FONT = Path(__file__).resolve().parent / "fonts" / "Cinzel-Black.ttf"
SOURCE = ROOT / "Assets" / "Art" / "Store" / "store-art-source-1920x1080.png"
TITLE = "GROW AN EMPIRE"
TAGLINE = "Twelve choices. One city. Hold the walls."
GOLD = (243, 202, 113)


def crop_to(image: Image.Image, box: tuple[int, int, int, int], size: tuple[int, int]) -> Image.Image:
    return image.crop(box).resize(size, Image.LANCZOS)


def shade(image: Image.Image, side: str, strength: float) -> Image.Image:
    """Darkens one side with a smooth gradient so the title stays readable."""
    width, height = image.size
    mask = Image.new("L", (width, height), 0)
    draw = ImageDraw.Draw(mask)
    span = width if side == "left" else height
    for offset in range(span):
        t = max(0.0, 1 - offset / (span * 0.62))
        alpha = int(255 * strength * t * t)
        if side == "left":
            draw.line([(offset, 0), (offset, height)], fill=alpha)
        else:
            draw.line([(0, height - 1 - offset), (width, height - 1 - offset)], fill=alpha)
    dark = Image.new("RGB", (width, height), (8, 20, 12))
    return Image.composite(dark, image, mask)


def title(image: Image.Image, font_size: int, anchor_xy: tuple[int, int], anchor: str, tagline_size: int = 0) -> Image.Image:
    """Draws the gold title (and optional tagline) with a soft dark glow behind it."""
    font = ImageFont.truetype(str(FONT), font_size)
    glow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    ImageDraw.Draw(glow).text(anchor_xy, TITLE, font=font, anchor=anchor, fill=(0, 0, 0, 220), stroke_width=max(2, font_size // 14), stroke_fill=(0, 0, 0, 220))
    glow = glow.filter(ImageFilter.GaussianBlur(max(2, font_size // 10)))
    out = Image.alpha_composite(image.convert("RGBA"), glow)
    draw = ImageDraw.Draw(out)
    draw.text(anchor_xy, TITLE, font=font, anchor=anchor, fill=GOLD, stroke_width=max(1, font_size // 28), stroke_fill=(52, 30, 8))
    if tagline_size:
        small = ImageFont.truetype(str(FONT), tagline_size)
        x, y = anchor_xy
        box = draw.textbbox(anchor_xy, TITLE, font=font, anchor=anchor)
        tag_anchor = "lt" if anchor.startswith("l") else "mt"
        tag_x = box[0] if anchor.startswith("l") else x
        draw.text((tag_x, box[3] + tagline_size // 2), TAGLINE, font=small, anchor=tag_anchor, fill=(255, 244, 216), stroke_width=1, stroke_fill=(10, 20, 12))
    return out.convert("RGB")


def save_jpeg(image: Image.Image, path: Path, max_bytes: int | None = None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    quality = 90
    while True:
        image.save(path, "JPEG", quality=quality, optimize=True, progressive=True)
        if not max_bytes or path.stat().st_size <= max_bytes or quality <= 60:
            break
        quality -= 4
    print(f"{path.relative_to(ROOT)}  {image.size[0]}x{image.size[1]}  {path.stat().st_size / 1024:.0f} KB (q{quality})")


def main() -> int:
    source = Path(sys.argv[1]) if len(sys.argv) > 1 else SOURCE
    shot = Image.open(source).convert("RGB")
    if shot.size != (1920, 1080):
        shot = shot.resize((1920, 1080), Image.LANCZOS)

    # 16:9 framing: the whole city, trimming the mirrored terrain at the edges.
    wide = crop_to(shot, (80, 20, 1840, 1010), (1280, 720))
    banner_16x9 = title(shade(wide, "bottom", 0.85), 92, (640, 610), "ms", tagline_size=30)
    save_jpeg(banner_16x9, ROOT / "Assets/Art/Store/upload/banner-1280x720.jpg", 500 * 1024)
    thumb_16x9 = title(shade(crop_to(shot, (260, 60, 1660, 848), (480, 270)), "bottom", 0.85), 40, (240, 252), "ms")
    save_jpeg(thumb_16x9, ROOT / "Assets/Art/Store/upload/thumbnail-480x270.jpg", 200 * 1024)

    # 4:3 catalog card (400x300): the Town Hall and its neighbours.
    thumb_4x3 = title(shade(crop_to(shot, (440, 90, 1480, 870), (400, 300)), "bottom", 0.85), 34, (200, 282), "ms")
    save_jpeg(thumb_4x3, ROOT / "public/assets/thumbnail.jpg", 200 * 1024)

    # 1280x360 hero strip: title on the left over the western farms, town hall to the right.
    strip = crop_to(shot, (0, 175, 1340, 552), (1280, 360))
    banner_strip = title(shade(strip, "left", 0.9), 64, (56, 168), "ls", tagline_size=24)
    save_jpeg(banner_strip, ROOT / "public/assets/banner.jpg", 500 * 1024)
    return 0


if __name__ == "__main__":
    sys.exit(main())
