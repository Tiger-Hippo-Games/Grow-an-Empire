"""Build the GoLive store images (key art) from an in-game capture and the game's own sprites.

Outputs
  Upload (Developer Console, GOLIVE_DEVELOPER_REFERENCE):
    Assets/Art/Store/upload/thumbnail-480x270.jpg   16:9, under 200 KB
    Assets/Art/Store/upload/banner-1280x720.jpg     16:9, under 500 KB
  Inside the ZIP (SUBMISSION_GUIDE §4, §9; the validator looks for these):
    public/assets/thumbnail.jpg                     400 x 300 (4:3)
    public/assets/banner.jpg                        1280 x 360

Composition (v2, 0.10.2): the finished city at the muster (a real capture, UI
hidden) under a warm dusk grade; the title in the game's display face, Yatra
One, on a dark panel; the city's defenders (swordsman, archer, horseman) in the
foreground and the raiders marching in from the bottom-right, all cut from the
game's combat sheets. Nothing here is drawn that isn't in the game.

Usage:
    python Tools/ArtPipeline/make_store_art.py [capture.png]
The default capture is Assets/Art/Store/store-art-source-1920x1080-v2.png: the
1920x1080 portal frame at the muster of a 12-move city, interface hidden
(Playwright: play Campaign 1 to the muster, hide everything in #app but the
viewport, screenshot).

Fonts: Yatra One and Cinzel, both SIL Open Font License 1.1 (fonts/OFL-*.txt).
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
FONTS = Path(__file__).resolve().parent / "fonts"
TITLE_FONT = FONTS / "YatraOne-Regular.ttf"
SMALL_FONT = FONTS / "Cinzel-Black.ttf"
SOURCE = ROOT / "Assets" / "Art" / "Store" / "store-art-source-1920x1080-v2.png"
RUNTIME = ROOT / "Assets" / "Runtime"
TITLE = "Grow an Empire"
TAGLINE = "Build a kingdom. Raise an army. Hold the realm."
FACTS = "25 CAMPAIGNS  ·  1,008 RIVAL RAJAS"
GOLD = (246, 205, 108)
GOLD_DEEP = (176, 112, 28)
IVORY = (255, 244, 220)
INK = (20, 14, 30)


# --- Sprites -----------------------------------------------------------------

def frame(sheet: str, index: int) -> Image.Image:
    """One 256x256 frame (4 x 2 grid) of a combat sheet, trimmed to its pixels."""
    image = Image.open(RUNTIME / sheet).convert("RGBA")
    width, height = image.size[0] // 4, image.size[1] // 2
    col, row = index % 4, index // 4
    cell = image.crop((col * width, row * height, (col + 1) * width, (row + 1) * height))
    box = cell.getbbox()
    return cell.crop(box) if box else cell


def place(canvas: Image.Image, sprite: Image.Image, foot_xy: tuple[int, int], height: int, tint: tuple[int, int, int] | None = None, mirror: bool = False) -> None:
    """Pastes a sprite standing on `foot_xy`, `height` px tall, with a soft ground shadow and rim light."""
    scale = height / sprite.height
    sprite = sprite.resize((max(1, round(sprite.width * scale)), height), Image.LANCZOS)
    if mirror:
        sprite = sprite.transpose(Image.FLIP_LEFT_RIGHT)
    if tint:
        overlay = Image.new("RGBA", sprite.size, tint + (0,))
        overlay.putalpha(sprite.getchannel("A").point(lambda a: a * 0.28))
        sprite = Image.alpha_composite(sprite, overlay)
    x, y = foot_xy[0] - sprite.width // 2, foot_xy[1] - sprite.height
    # Ground shadow.
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).ellipse((foot_xy[0] - sprite.width * 0.42, foot_xy[1] - height * 0.06, foot_xy[0] + sprite.width * 0.42, foot_xy[1] + height * 0.05), fill=(10, 6, 2, 150))
    canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(max(2, height // 30))))
    # Warm rim light: the sprite's own outline, offset up-right, in gold.
    rim = Image.new("RGBA", sprite.size, GOLD + (0,))
    rim.putalpha(ImageChops.subtract(sprite.getchannel("A"), ImageChops.offset(sprite.getchannel("A"), -2, 2)).point(lambda a: min(255, a) * 0.55))
    canvas.alpha_composite(sprite, (x, y))
    canvas.alpha_composite(rim, (x, y))


# --- Grading and type --------------------------------------------------------

def grade(image: Image.Image) -> Image.Image:
    """Late-afternoon light: warmer, a little more contrast, a golden glow top-right, a vignette."""
    image = ImageEnhance.Color(image).enhance(1.12)
    image = ImageEnhance.Contrast(image).enhance(1.08)
    warm = Image.new("RGB", image.size, (255, 196, 120))
    image = Image.blend(image, ImageChops.multiply(image, warm), 0.22)
    width, height = image.size
    glow = Image.new("L", image.size, 0)
    ImageDraw.Draw(glow).ellipse((width * 0.45, -height * 0.7, width * 1.4, height * 0.55), fill=120)
    glow = glow.filter(ImageFilter.GaussianBlur(width // 8))
    image = Image.composite(ImageChops.screen(image, Image.new("RGB", image.size, (255, 214, 150))), image, glow)
    vignette = Image.new("L", image.size, 0)
    ImageDraw.Draw(vignette).ellipse((-width * 0.25, -height * 0.3, width * 1.25, height * 1.3), fill=255)
    vignette = vignette.filter(ImageFilter.GaussianBlur(width // 7))
    return Image.composite(image, Image.new("RGB", image.size, INK), vignette)


def panel(image: Image.Image, side: str, reach: float, strength: float) -> Image.Image:
    """A dark gradient panel from one side (or the bottom) so the title reads over the city."""
    width, height = image.size
    mask = Image.new("L", image.size, 0)
    draw = ImageDraw.Draw(mask)
    span = width if side == "left" else height
    for offset in range(span):
        t = max(0.0, 1 - offset / (span * reach))
        alpha = int(255 * strength * (t ** 1.6))
        if side == "left":
            draw.line([(offset, 0), (offset, height)], fill=alpha)
        else:
            draw.line([(0, height - 1 - offset), (width, height - 1 - offset)], fill=alpha)
    return Image.composite(Image.new("RGB", image.size, (14, 10, 26)), image, mask)


def gold_text(canvas: Image.Image, xy: tuple[float, float], text: str, font: ImageFont.FreeTypeFont, anchor: str) -> tuple[int, int, int, int]:
    """Gold lettering with a vertical gradient, a dark stroke and a soft glow. Returns its box."""
    stroke = max(2, font.size // 22)
    glow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(glow).text(xy, text, font=font, anchor=anchor, fill=(0, 0, 0, 200), stroke_width=stroke * 2, stroke_fill=(0, 0, 0, 200))
    canvas.alpha_composite(glow.filter(ImageFilter.GaussianBlur(max(2, font.size // 12))))
    mask = Image.new("L", canvas.size, 0)
    ImageDraw.Draw(mask).text(xy, text, font=font, anchor=anchor, fill=255)
    box = mask.getbbox() or (0, 0, 0, 0)
    gradient = Image.new("RGBA", canvas.size, GOLD + (255,))
    draw = ImageDraw.Draw(gradient)
    top, bottom = box[1], max(box[1] + 1, box[3])
    for y in range(top, bottom + 1):
        t = (y - top) / (bottom - top)
        colour = tuple(int(IVORY[i] * (1 - t) * 0.55 + GOLD[i] * (1 - abs(t - 0.45)) * 0.75 + GOLD_DEEP[i] * t * 0.6) for i in range(3))
        draw.line([(0, y), (canvas.size[0], y)], fill=tuple(min(255, c) for c in colour) + (255,))
    outline = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(outline).text(xy, text, font=font, anchor=anchor, fill=(0, 0, 0, 0), stroke_width=stroke, stroke_fill=(60, 30, 8, 255))
    canvas.alpha_composite(outline)
    letters = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    letters.paste(gradient, (0, 0), mask)
    canvas.alpha_composite(letters)
    return box


def plain_text(canvas: Image.Image, xy: tuple[float, float], text: str, font: ImageFont.FreeTypeFont, anchor: str, fill: tuple[int, int, int]) -> tuple[int, int, int, int]:
    draw = ImageDraw.Draw(canvas)
    draw.text(xy, text, font=font, anchor=anchor, fill=fill + (255,), stroke_width=max(1, font.size // 14), stroke_fill=(10, 8, 18, 255))
    return draw.textbbox(xy, text, font=font, anchor=anchor)


def ornament(canvas: Image.Image, x0: float, x1: float, y: float, size: int) -> None:
    """A thin gold rule with a diamond in the middle (a toran motif)."""
    draw = ImageDraw.Draw(canvas)
    mid = (x0 + x1) / 2
    draw.line([(x0, y), (mid - size * 1.6, y)], fill=GOLD + (220,), width=max(1, size // 5))
    draw.line([(mid + size * 1.6, y), (x1, y)], fill=GOLD + (220,), width=max(1, size // 5))
    draw.polygon([(mid, y - size), (mid + size, y), (mid, y + size), (mid - size, y)], fill=GOLD + (255,), outline=(60, 30, 8, 255))


def backdrop(canvas: Image.Image, box: tuple[float, float, float, float], alpha: int = 205) -> None:
    """A soft dark cloud behind a block of type, so it reads over the busy city."""
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    x0, y0, x1, y1 = box
    pad_x, pad_y = (x1 - x0) * 0.12, (y1 - y0) * 0.35
    ImageDraw.Draw(layer).rounded_rectangle((x0 - pad_x, y0 - pad_y, x1 + pad_x, y1 + pad_y), radius=int((y1 - y0) * 0.5), fill=(12, 8, 24, alpha))
    canvas.alpha_composite(layer.filter(ImageFilter.GaussianBlur(int((y1 - y0) * 0.28))))


def crop_to(image: Image.Image, box: tuple[int, int, int, int], size: tuple[int, int]) -> Image.Image:
    return image.crop(box).resize(size, Image.LANCZOS)


def save_jpeg(image: Image.Image, path: Path, max_bytes: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image = image.convert("RGB")
    quality = 92
    while True:
        image.save(path, "JPEG", quality=quality, optimize=True, progressive=True, subsampling=0 if quality >= 88 else 2)
        if path.stat().st_size <= max_bytes or quality <= 60:
            break
        quality -= 3
    print(f"{path.relative_to(ROOT)}  {image.size[0]}x{image.size[1]}  {path.stat().st_size / 1024:.0f} KB (q{quality})")


# --- Layouts -----------------------------------------------------------------

def defenders(canvas: Image.Image, base_x: int, base_y: int, height: int) -> None:
    """Horseman behind, archer and swordsman in front: the city's army, facing the viewer."""
    place(canvas, frame("horseman-combat-south8-master-v1.webp", 1), (base_x + int(height * 0.62), base_y - int(height * 0.1)), int(height * 1.02))
    place(canvas, frame("archer-combat-south8-master-v1.webp", 2), (base_x - int(height * 0.46), base_y - int(height * 0.03)), int(height * 0.86))
    place(canvas, frame("swordsman-combat-south8-master-v1.webp", 1), (base_x, base_y), height)


def raiders(canvas: Image.Image, positions: list[tuple[int, int, int]]) -> None:
    """The enemy column, backs to the viewer, marching on the city."""
    for i, (x, y, h) in enumerate(positions):
        place(canvas, frame("enemy-combat-north8-master-v1.webp", (i * 3) % 8), (x, y), h, mirror=i % 2 == 1)


def banner_16x9(shot: Image.Image) -> Image.Image:
    # The town hall and the mustered army at about 62% across; the mirrored terrain edge cropped away.
    city = grade(crop_to(shot, (40, 30, 1520, 862), (1280, 720)))
    city = panel(panel(city, "left", 0.58, 1.0), "bottom", 0.3, 0.75)
    canvas = city.convert("RGBA")
    raiders(canvas, [(1236, 640, 104), (1150, 676, 124), (1262, 724, 150), (1068, 712, 140), (1170, 760, 168)])
    defenders(canvas, 250, 712, 290)
    backdrop(canvas, (40, 46, 560, 330))
    first = gold_text(canvas, (60, 128), "Grow an", ImageFont.truetype(str(TITLE_FONT), 86), "ls")
    box = gold_text(canvas, (56, 250), "Empire", ImageFont.truetype(str(TITLE_FONT), 132), "ls")
    right = max(first[2], box[2])
    ornament(canvas, 64, right, box[3] + 22, 8)
    tag = ImageFont.truetype(str(SMALL_FONT), 19)
    plain_text(canvas, (64, box[3] + 44), TAGLINE.upper(), tag, "lt", IVORY)
    facts = ImageFont.truetype(str(SMALL_FONT), 17)
    plain_text(canvas, (64, box[3] + 76), FACTS, facts, "lt", GOLD)
    return canvas


def thumbnail_16x9(shot: Image.Image) -> Image.Image:
    # Small: one strong read. Tighter on the town hall and army; title across the bottom.
    city = grade(crop_to(shot, (340, 120, 1540, 795), (480, 270)))
    city = panel(city, "bottom", 0.62, 0.95)
    canvas = city.convert("RGBA")
    raiders(canvas, [(452, 276, 52), (418, 284, 58), (470, 262, 42)])
    place(canvas, frame("swordsman-combat-south8-master-v1.webp", 1), (52, 272), 118)
    backdrop(canvas, (104, 150, 330, 262), 185)
    gold_text(canvas, (116, 180), "Grow an", ImageFont.truetype(str(TITLE_FONT), 34), "ls")
    box = gold_text(canvas, (112, 232), "Empire", ImageFont.truetype(str(TITLE_FONT), 62), "ls")
    small = ImageFont.truetype(str(SMALL_FONT), 11)
    plain_text(canvas, (116, box[3] + 5), "BUILD · MUSTER · DEFEND", small, "lt", IVORY)
    return canvas


def thumbnail_4x3(shot: Image.Image) -> Image.Image:
    city = grade(crop_to(shot, (430, 60, 1470, 840), (400, 300)))
    city = panel(city, "bottom", 0.6, 0.95)
    canvas = city.convert("RGBA")
    raiders(canvas, [(372, 302, 54), (340, 310, 60)])
    place(canvas, frame("swordsman-combat-south8-master-v1.webp", 1), (48, 300), 112)
    backdrop(canvas, (100, 180, 312, 292), 185)
    gold_text(canvas, (110, 208), "Grow an", ImageFont.truetype(str(TITLE_FONT), 32), "ls")
    box = gold_text(canvas, (106, 258), "Empire", ImageFont.truetype(str(TITLE_FONT), 60), "ls")
    small = ImageFont.truetype(str(SMALL_FONT), 11)
    plain_text(canvas, (110, box[3] + 4), "BUILD · MUSTER · DEFEND", small, "lt", IVORY)
    return canvas


def banner_strip(shot: Image.Image) -> Image.Image:
    city = grade(crop_to(shot, (0, 190, 1700, 668), (1280, 360)))
    city = panel(city, "left", 0.6, 0.94)
    canvas = city.convert("RGBA")
    raiders(canvas, [(1200, 372, 110), (1120, 390, 124), (1256, 352, 84), (1050, 388, 100)])
    backdrop(canvas, (36, 90, 640, 250))
    title_font = ImageFont.truetype(str(TITLE_FONT), 78)
    box = gold_text(canvas, (52, 170), TITLE, title_font, "ls")
    ornament(canvas, 56, box[2], box[3] + 18, 7)
    tag = ImageFont.truetype(str(SMALL_FONT), 19)
    plain_text(canvas, (56, box[3] + 38), TAGLINE.upper(), tag, "lt", IVORY)
    return canvas


def main() -> int:
    source = Path(sys.argv[1]) if len(sys.argv) > 1 else SOURCE
    shot = Image.open(source).convert("RGB")
    if shot.size != (1920, 1080):
        shot = shot.resize((1920, 1080), Image.LANCZOS)
    save_jpeg(banner_16x9(shot), ROOT / "Assets/Art/Store/upload/banner-1280x720.jpg", 500 * 1024)
    save_jpeg(thumbnail_16x9(shot), ROOT / "Assets/Art/Store/upload/thumbnail-480x270.jpg", 200 * 1024)
    save_jpeg(thumbnail_4x3(shot), ROOT / "public/assets/thumbnail.jpg", 200 * 1024)
    save_jpeg(banner_strip(shot), ROOT / "public/assets/banner.jpg", 500 * 1024)
    return 0


if __name__ == "__main__":
    sys.exit(main())
