"""Procedural stand-in art for the eight new buildings (0.10.4: Baoli, Prakara, Gajashala,
Dharma Stambha; 0.10.5: Burj, Sarai, Koshagar, Dharmashala).

Why: Ravi chose "stand-ins now + briefs" (2026-10-11). The rules ship with these
drawings; painted art from Docs/BUILDING_ART_BRIEF.md replaces them later with no
code change (same filenames, same canvas).

What it writes, per building, into Assets/Art/Production/Buildings/<Dir>/Runtime2x/:
    <id>-construction-01-foundation-2x-v1.png
    <id>-construction-02-frame-2x-v1.png
    <id>-construction-03-late-2x-v1.png
    <id>-level-1-2x-v1.png
1536 x 1024 RGBA, transparent background, plot diamond on the bottom edge like
the painted buildings, light from the upper left.

Then export to WebP as usual:
    python Tools/ArtPipeline/make_standin_buildings.py
    python Tools/ArtPipeline/export_runtime_webp.py

Deterministic (fixed noise seed), so re-running gives identical files.
Requires Pillow.
"""

from __future__ import annotations

import math
import random
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
W, H = 1536, 1024
S = 2  # supersampling
K = 300 * S  # pixels per ground unit along an iso axis (set per building in main)
CX, BASE_Y = W * S // 2, int(675 * S)  # screen point of ground (0, 0, 0)
FRONT_Y = 968  # the plot's front corner sits here, like the painted buildings (sprite anchor = image bottom)
# Per building: (pixels per unit, plot half-size). Tall buildings use a smaller scale so they fit the canvas.
SCALES = {"baoli": (300, 1.05), "prakara": (240, 1.05), "gajashala": (300, 1.05), "dharma-stambha": (220, 0.85),
          "burj": (270, 1.0), "sarai": (300, 1.05), "koshagar": (280, 0.95), "dharmashala": (300, 1.05)}

STAGES = ["foundation", "frame", "late", "complete"]
FILES = {
    "foundation": "{id}-construction-01-foundation-2x-v1.png",
    "frame": "{id}-construction-02-frame-2x-v1.png",
    "late": "{id}-construction-03-late-2x-v1.png",
    "complete": "{id}-level-1-2x-v1.png",
}
DIRS = {"baoli": "Baoli", "prakara": "Prakara", "gajashala": "Gajashala", "dharma-stambha": "DharmaStambha",
        "burj": "Burj", "sarai": "Sarai", "koshagar": "Koshagar", "dharmashala": "Dharmashala"}

SANDSTONE = (196, 146, 98)
RED_STONE = (168, 92, 64)
GREY_STONE = (150, 142, 128)
TIMBER = (122, 82, 48)
BAMBOO = (186, 160, 92)
ROOF = (184, 74, 48)
WATER = (64, 120, 132)
GRASS = (112, 138, 62)
DIRT = (188, 154, 104)


def iso(gx: float, gy: float, gz: float = 0.0) -> tuple[float, float]:
    """Ground x runs to the lower right, ground y to the lower left, z up."""
    return CX + (gx - gy) * K, BASE_Y + (gx + gy) * K * 0.5 - gz * K


def shade(color, factor):
    return tuple(max(0, min(255, int(c * factor))) for c in color[:3]) + ((color[3],) if len(color) > 3 else (255,))


class Canvas:
    def __init__(self) -> None:
        self.image = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
        self.draw = ImageDraw.Draw(self.image)
        self.rng = random.Random(1004)

    def poly(self, points, color, outline=None, width=0):
        self.draw.polygon([iso(*p) for p in points], fill=shade(color, 1), outline=outline, width=width)

    def box(self, x, y, z, dx, dy, dz, color, top=None, courses=None):
        """Axis-aligned box; draws the visible faces (top, front-left, front-right).
        `courses`: height of a stone course, to draw block joints on the walls."""
        x1, y1, z1 = x + dx, y + dy, z + dz
        edge = shade(color, 0.45)
        # Front-left face (y = y1), lit.
        self.poly([(x, y1, z), (x1, y1, z), (x1, y1, z1), (x, y1, z1)], shade(color, 0.92), outline=edge, width=S)
        # Front-right face (x = x1), shadowed.
        self.poly([(x1, y, z), (x1, y1, z), (x1, y1, z1), (x1, y, z1)], shade(color, 0.68), outline=edge, width=S)
        if courses and dz > courses:
            joint = shade(color, 0.6)
            row = 0
            zc = z + courses
            while zc < z1 - 1e-6:
                self.draw.line([iso(x, y1, zc), iso(x1, y1, zc)], fill=joint, width=S)
                self.draw.line([iso(x1, y1, zc), iso(x1, y, zc)], fill=shade(color, 0.45), width=S)
                step = courses * 1.6
                offset = (row % 2) * step / 2
                gx = x + offset + step
                while gx < x1 - 0.02:
                    self.draw.line([iso(gx, y1, zc - courses), iso(gx, y1, zc)], fill=joint, width=S)
                    gx += step
                gy = y + offset + step
                while gy < y1 - 0.02:
                    self.draw.line([iso(x1, gy, zc - courses), iso(x1, gy, zc)], fill=shade(color, 0.45), width=S)
                    gy += step
                zc += courses
                row += 1
        self.poly([(x, y, z1), (x1, y, z1), (x1, y1, z1), (x, y1, z1)], shade(top or color, 1.12), outline=edge, width=S)

    def cylinder(self, x, y, z, radius, height, color, segments=28):
        """Vertical cylinder centred on (x, y): side shaded left to right, elliptical top."""
        cx0, cy0 = iso(x, y, z)
        cx1, cy1 = iso(x, y, z + height)
        rx, ry = radius * K * 1.41, radius * K * 0.705
        for i in range(segments):
            a0 = math.pi * i / segments
            a1 = math.pi * (i + 1) / segments
            light = 0.62 + 0.5 * (1 - i / segments) ** 1.4
            xa, xb = cx0 - rx * math.cos(a0), cx0 - rx * math.cos(a1)
            ya, yb = ry * math.sin(a0), ry * math.sin(a1)
            self.draw.polygon([(xa, cy0 + ya), (xb, cy0 + yb), (xb, cy1 + yb), (xa, cy1 + ya)], fill=shade(color, light))
        self.draw.ellipse((cx1 - rx, cy1 - ry, cx1 + rx, cy1 + ry), fill=shade(color, 1.15), outline=shade(color, 0.5), width=S)

    def ellipse_at(self, x, y, z, rx, ry, color, outline=None):
        px, py = iso(x, y, z)
        self.draw.ellipse((px - rx * K, py - ry * K, px + rx * K, py + ry * K), fill=shade(color, 1), outline=outline, width=S)

    def pole(self, a, b, color=BAMBOO, width=7):
        self.draw.line([iso(*a), iso(*b)], fill=shade(color, 1), width=width * S)

    def plot(self, half=1.05, dirt=0.86):
        """Grass plot with a dirt yard, like the painted buildings' bases."""
        self.poly([(-half, -half, 0), (half, -half, 0), (half, half, 0), (-half, half, 0)], GRASS)
        self.poly([(-half, half, 0), (half, half, 0), (half, half, -0.05), (-half, half, -0.05)], shade(GRASS, 0.6))
        self.poly([(half, -half, 0), (half, half, 0), (half, half, -0.05), (half, -half, -0.05)], shade(GRASS, 0.5))
        self.poly([(-dirt, -dirt, 0), (dirt, -dirt, 0), (dirt, dirt, 0), (-dirt, dirt, 0)], DIRT)
        for _ in range(140):
            gx, gy = self.rng.uniform(-half, half), self.rng.uniform(-half, half)
            if abs(gx) < dirt and abs(gy) < dirt:
                continue
            px, py = iso(gx, gy)
            self.draw.line([(px, py), (px + self.rng.uniform(-4, 4) * S, py - self.rng.uniform(6, 14) * S)], fill=(84, 112, 44, 255), width=2 * S)

    def stones(self, x, y, count=6, color=SANDSTONE):
        for i in range(count):
            self.box(x + (i % 3) * 0.13, y + (i // 3) * 0.1, (i // 6) * 0.08, 0.12, 0.09, 0.08, color)

    def scaffold(self, x0, y0, x1, y1, height):
        for gx, gy in [(x0, y1), (x1, y1), (x1, y0)]:
            self.pole((gx, gy, 0), (gx, gy, height))
        for z in [height * 0.33, height * 0.66, height]:
            self.pole((x0, y1, z), (x1, y1, z), width=5)
            self.pole((x1, y1, z), (x1, y0, z), width=5)
        self.pole((x0, y1, 0), (x1, y1, height * 0.66), width=4)

    def texture(self):
        """Light grain noise on painted pixels, so faces read as stone and wood."""
        noise = Image.effect_noise(self.image.size, 18).convert("L")
        alpha = self.image.getchannel("A")
        rgb = self.image.convert("RGB")
        grain = Image.merge("RGB", [noise] * 3)
        rgb = Image.blend(rgb, Image.composite(grain, rgb, Image.new("L", rgb.size, 90)), 0.22)
        out = rgb.convert("RGBA")
        out.putalpha(alpha)
        self.image = out

    def save(self, path: Path):
        self.texture()
        shadow = self.image.getchannel("A").filter(ImageFilter.GaussianBlur(6 * S))
        final = Image.new("RGBA", self.image.size, (0, 0, 0, 0))
        final.alpha_composite(self.image)
        final = final.resize((W, H), Image.Resampling.LANCZOS)
        del shadow
        path.parent.mkdir(parents=True, exist_ok=True)
        final.save(path, optimize=True)


# --- Buildings ---------------------------------------------------------------

def baoli(c: Canvas, stage: str):
    """A square stepwell: sandstone rim, stepped terraces down to water, two corner chhatris."""
    c.plot()
    levels = {"foundation": 1, "frame": 3, "late": 4, "complete": 5}[stage]
    # Sunken terraces: each a slightly smaller, darker square.
    for i in range(5):
        half = 0.72 - i * 0.12
        z = -0.0 - i * 0.02
        color = shade(SANDSTONE, 0.95 - i * 0.1) if i < levels else shade(DIRT, 0.8 - i * 0.06)
        c.poly([(-half, -half, z), (half, -half, z), (half, half, z), (-half, half, z)], color, outline=shade(SANDSTONE, 0.5), width=S)
        if i < levels:  # step risers on the two far walls
            c.poly([(-half, -half, z), (half, -half, z), (half, -half, z - 0.05), (-half, -half, z - 0.05)], shade(color, 0.7))
            c.poly([(-half, -half, z), (-half, half, z), (-half, half, z - 0.05), (-half, -half, z - 0.05)], shade(color, 0.8))
    if stage in ("late", "complete"):
        c.poly([(-0.2, -0.2, -0.1), (0.2, -0.2, -0.1), (0.2, 0.2, -0.1), (-0.2, 0.2, -0.1)], WATER, outline=shade(WATER, 0.6), width=S)
        c.ellipse_at(-0.05, -0.05, -0.1, 0.06, 0.02, (140, 190, 196))
    # Rim walls on the near sides.
    rim = {"foundation": 0.04, "frame": 0.1, "late": 0.14, "complete": 0.14}[stage]
    c.box(-0.78, 0.72, 0, 1.56, 0.08, rim, SANDSTONE, courses=0.05)
    c.box(0.72, -0.78, 0, 0.08, 1.5, rim, SANDSTONE, courses=0.05)
    if stage == "foundation":
        c.stones(-0.95, -0.6)
        c.stones(0.55, 0.55, 3)
        return
    # Chhatris (small domed kiosks) on the far corners.
    for (x, y) in [(-0.82, -0.82), (0.62, -0.82)]:
        built = stage != "frame"
        for dx, dy in [(0, 0), (0.18, 0), (0, 0.18), (0.18, 0.18)]:
            c.box(x + dx, y + dy, 0, 0.04, 0.04, 0.55 if built else 0.3, SANDSTONE)
        if built:
            c.box(x - 0.02, y - 0.02, 0.55, 0.26, 0.26, 0.05, shade(SANDSTONE, 1.05))
            px, py = iso(x + 0.11, y + 0.11, 0.6)
            r = 0.13 * K
            c.draw.pieslice((px - r, py - r * 1.1, px + r, py + r * 0.9), 180, 360, fill=shade(SANDSTONE, 1.1), outline=shade(SANDSTONE, 0.5), width=S)
            c.draw.line([(px, py - r * 1.1), (px, py - r * 1.5)], fill=(150, 110, 60, 255), width=3 * S)
    if stage == "frame":
        c.scaffold(-0.3, -0.9, 0.9, -0.6, 0.6)
    if stage == "late":
        c.stones(0.5, 0.75, 3)
    if stage == "complete":
        # Water pots on the rim.
        for gx in (-0.5, -0.32):
            c.ellipse_at(gx, 0.86, 0.22, 0.05, 0.05, (176, 96, 60))


def prakara(c: Canvas, stage: str):
    """A stone watchtower on a stretch of wall, with crenellations and a lookout canopy."""
    c.plot()
    wall_h = {"foundation": 0.08, "frame": 0.3, "late": 0.45, "complete": 0.45}[stage]
    tower_h = {"foundation": 0.12, "frame": 0.9, "late": 1.55, "complete": 1.7}[stage]
    c.box(-0.95, -0.15, 0, 1.9, 0.3, wall_h, RED_STONE, courses=0.09)
    c.box(-0.32, -0.32, 0, 0.64, 0.64, tower_h, RED_STONE, top=shade(RED_STONE, 1.05), courses=0.11)
    if stage == "foundation":
        c.stones(0.45, 0.4)
        c.stones(-0.85, 0.4, 3, RED_STONE)
        return
    # Arrow slits on the lit face.
    for z in [0.35, 0.8, 1.25]:
        if z < tower_h - 0.15:
            a, b = iso(-0.02, 0.32, z), iso(-0.02, 0.32, z + 0.16)
            c.draw.rectangle((a[0] - 4 * S, b[1], a[0] + 4 * S, a[1]), fill=(40, 24, 18, 255))
    if stage == "frame":
        c.scaffold(-0.4, -0.4, 0.42, 0.42, 1.0)
        return
    # Crenellations along the tower top and the wall.
    for i in range(4):
        c.box(-0.32 + i * 0.18, 0.26, tower_h, 0.1, 0.06, 0.12, RED_STONE)
        c.box(0.26, -0.32 + i * 0.18, tower_h, 0.06, 0.1, 0.12, RED_STONE)
    for i in range(9):
        if abs(-0.95 + i * 0.22) > 0.35:
            c.box(-0.95 + i * 0.22, 0.09, wall_h, 0.1, 0.06, 0.1, RED_STONE)
    if stage == "late":
        c.scaffold(0.0, -0.45, 0.45, 0.45, 1.75)
        return
    # Lookout canopy on four posts, and a plain saffron pennant.
    for dx, dy in [(-0.2, -0.2), (0.16, -0.2), (-0.2, 0.16), (0.16, 0.16)]:
        c.box(dx, dy, tower_h, 0.04, 0.04, 0.32, TIMBER)
    top = tower_h + 0.32
    c.poly([(-0.3, -0.3, top), (0.3, -0.3, top), (0.3, 0.3, top), (-0.3, 0.3, top)], shade(ROOF, 0.9))
    apex = iso(0, 0, top + 0.28)
    for corners in [((-0.3, 0.3), (0.3, 0.3)), ((0.3, -0.3), (0.3, 0.3))]:
        pts = [iso(corners[0][0], corners[0][1], top), iso(corners[1][0], corners[1][1], top), apex]
        c.draw.polygon(pts, fill=shade(ROOF, 1.0 if corners[0][0] < 0 else 0.75), outline=shade(ROOF, 0.45), width=S)
    c.draw.line([apex, (apex[0], apex[1] - 0.35 * K)], fill=(90, 60, 40, 255), width=4 * S)
    c.draw.polygon([(apex[0], apex[1] - 0.35 * K), (apex[0] + 0.28 * K, apex[1] - 0.29 * K), (apex[0], apex[1] - 0.22 * K)], fill=(232, 136, 40, 255))


def elephant(c: Canvas, x: float, y: float, scale: float = 1.0):
    """A side-on grey elephant standing on ground point (x, y), facing left."""
    px, py = iso(x, y)
    u = 0.1 * K * scale
    grey, dark = (128, 124, 122, 255), (88, 84, 84, 255)
    for lx in (-1.3, -0.5, 0.6, 1.3):  # legs
        c.draw.rectangle((px + lx * u - 0.32 * u, py - 1.6 * u, px + lx * u + 0.32 * u, py), fill=dark if lx > 0 else grey)
    c.draw.ellipse((px - 2.0 * u, py - 3.4 * u, px + 2.0 * u, py - 1.2 * u), fill=grey, outline=dark, width=S)  # body
    c.draw.ellipse((px - 2.9 * u, py - 3.7 * u, px - 1.3 * u, py - 2.1 * u), fill=grey, outline=dark, width=S)  # head
    c.draw.ellipse((px - 2.2 * u, py - 3.5 * u, px - 1.3 * u, py - 2.3 * u), fill=(112, 106, 106, 255))  # ear
    c.draw.line([(px - 2.75 * u, py - 2.6 * u), (px - 3.05 * u, py - 1.4 * u), (px - 2.8 * u, py - 0.6 * u)], fill=grey, width=int(0.42 * u))  # trunk
    c.draw.line([(px - 2.5 * u, py - 2.3 * u), (px - 3.0 * u, py - 2.0 * u)], fill=(238, 230, 210, 255), width=int(0.16 * u))  # tusk
    c.draw.rectangle((px - 1.2 * u, py - 3.6 * u, px + 0.9 * u, py - 3.0 * u), fill=(176, 46, 40, 255))  # saddle cloth
    c.draw.rectangle((px - 1.2 * u, py - 3.05 * u, px + 0.9 * u, py - 2.9 * u), fill=(220, 170, 60, 255))


def gajashala(c: Canvas, stage: str):
    """A long elephant hall: stone plinth, tall arched bays, a tiled roof, an elephant in the yard."""
    c.plot()
    plinth = 0.1
    wall_h = {"foundation": 0.0, "frame": 0.55, "late": 0.75, "complete": 0.75}[stage]
    c.box(-0.9, -0.85, 0, 1.6, 0.8, plinth, GREY_STONE)
    if stage == "foundation":
        for i in range(4):
            c.box(-0.86 + i * 0.5, -0.1, plinth, 0.08, 0.08, 0.12, SANDSTONE)
        c.stones(0.3, 0.35)
        c.box(-0.7, 0.4, 0, 0.5, 0.12, 0.08, TIMBER)
        return
    c.box(-0.9, -0.85, plinth, 1.6, 0.8, wall_h, SANDSTONE, courses=0.1)
    # Arched bays on the lit face (y = -0.05).
    for i in range(4):
        x0 = -0.82 + i * 0.4
        a = iso(x0, -0.05, plinth)
        b = iso(x0 + 0.26, -0.05, plinth + wall_h * 0.8)
        left, right = min(a[0], b[0]), max(a[0], b[0])
        top_y = b[1] + (a[1] - iso(x0 + 0.26, -0.05, plinth)[1])
        c.draw.rectangle((left, top_y + 0.06 * K, right, a[1] - 0.02 * K), fill=(46, 32, 24, 255))
        c.draw.ellipse((left, top_y - 0.04 * K, right, top_y + 0.16 * K), fill=(46, 32, 24, 255))
    if stage == "frame":
        c.scaffold(-0.95, -0.9, 0.75, 0.0, 1.1)
        return
    top = plinth + wall_h
    ridge = top + 0.38
    roof_done = stage == "complete"
    c.poly([(-0.95, -0.02, top), (0.75, -0.02, top), (0.75, -0.45, ridge), (-0.95, -0.45, ridge)], ROOF if roof_done else TIMBER, outline=shade(ROOF, 0.45), width=S)
    c.poly([(0.75, -0.02, top), (0.75, -0.88, top), (0.75, -0.45, ridge)], shade(SANDSTONE, 0.7), outline=shade(SANDSTONE, 0.4), width=S)
    if roof_done:
        for i in range(1, 9):
            gx = -0.95 + i * 0.19
            c.pole((gx, -0.02, top), (gx, -0.45, ridge), color=shade(ROOF, 0.7), width=2)
        c.box(-0.95, -0.47, ridge, 1.7, 0.04, 0.04, shade(ROOF, 0.6))
        elephant(c, 0.3, 0.6, 1.7)
        c.box(-0.75, 0.45, 0, 0.35, 0.18, 0.12, (196, 168, 96))  # fodder
    else:
        c.scaffold(0.1, -0.9, 0.8, 0.0, 1.25)
        c.stones(-0.6, 0.45, 3, ROOF)


def dharma_stambha(c: Canvas, stage: str):
    """A polished sandstone pillar on a stepped plinth, with a lotus bell and a wheel of dharma on top."""
    c.plot(half=0.85, dirt=0.7)
    c.box(-0.5, -0.5, 0, 1.0, 1.0, 0.08, GREY_STONE)
    c.box(-0.36, -0.36, 0.08, 0.72, 0.72, 0.08, shade(GREY_STONE, 1.05))
    shaft = {"foundation": 0.0, "frame": 0.9, "late": 1.95, "complete": 1.95}[stage]
    if stage == "foundation":
        c.box(-0.6, 0.45, 0, 0.9, 0.18, 0.14, SANDSTONE)  # the shaft, still lying on rollers
        c.stones(0.35, 0.35, 3)
        return
    c.cylinder(0, 0, 0.16, 0.11, shaft, (214, 170, 112))
    if stage == "frame":
        c.scaffold(-0.25, -0.25, 0.25, 0.25, 1.1)
        return
    top = 0.16 + shaft
    # Inverted-lotus bell capital, an abacus, then the wheel.
    px, py = iso(0, 0, top)
    bell_w, bell_h = 0.2 * K, 0.22 * K
    c.draw.polygon([(px - 0.08 * K, py), (px + 0.08 * K, py), (px + bell_w, py - bell_h), (px - bell_w, py - bell_h)], fill=shade(SANDSTONE, 1.1), outline=shade(SANDSTONE, 0.5))
    for i in range(-3, 4):
        c.draw.line([(px + i * 0.025 * K, py), (px + i * 0.06 * K, py - bell_h)], fill=shade(SANDSTONE, 0.75), width=2 * S)
    c.draw.rectangle((px - 0.22 * K, py - bell_h - 0.08 * K, px + 0.22 * K, py - bell_h), fill=shade(SANDSTONE, 0.95), outline=shade(SANDSTONE, 0.5))
    if stage == "late":
        c.scaffold(-0.25, -0.25, 0.25, 0.25, 2.3)
        return
    cx, cy = px, py - bell_h - 0.08 * K - 0.33 * K
    r = 0.31 * K
    gold, dark = (214, 168, 72, 255), (120, 84, 36, 255)
    c.draw.ellipse((cx - r, cy - r, cx + r, cy + r), outline=gold, width=int(0.05 * K))
    for spoke in range(24):
        angle = spoke * math.pi / 12
        c.draw.line([(cx, cy), (cx + math.cos(angle) * r * 0.9, cy + math.sin(angle) * r * 0.9)], fill=gold, width=2 * S)
    c.draw.ellipse((cx - 0.05 * K, cy - 0.05 * K, cx + 0.05 * K, cy + 0.05 * K), fill=dark)
    c.draw.ellipse((cx - r - 0.025 * K, cy - r - 0.025 * K, cx + r + 0.025 * K, cy + r + 0.025 * K), outline=dark, width=S)
    # Marigold garlands at the foot.
    for i in range(10):
        a = i * math.pi / 5
        c.ellipse_at(math.cos(a) * 0.22, math.sin(a) * 0.22, 0.17, 0.025, 0.025, (236, 150, 30))


def burj(c: Canvas, stage: str):
    """A round stone bastion with a crenellated top, a drill yard with a spear rack and a training post."""
    c.plot(half=1.0, dirt=0.82)
    c.box(-0.55, -0.55, 0, 0.9, 0.9, 0.08, GREY_STONE)
    height = {"foundation": 0.12, "frame": 0.5, "late": 0.95, "complete": 1.0}[stage]
    c.cylinder(-0.1, -0.1, 0.08, 0.4, height, SANDSTONE)
    if stage == "foundation":
        c.stones(0.35, 0.4)
        c.stones(-0.85, 0.45, 3)
        return
    top = 0.08 + height
    door = iso(-0.1, 0.3, 0.08)
    c.draw.rectangle((door[0] - 0.06 * K, door[1] - 0.28 * K, door[0] + 0.06 * K, door[1] - 0.02 * K), fill=(46, 32, 24, 255))
    c.draw.ellipse((door[0] - 0.06 * K, door[1] - 0.34 * K, door[0] + 0.06 * K, door[1] - 0.22 * K), fill=(46, 32, 24, 255))
    if stage == "frame":
        c.scaffold(-0.55, -0.55, 0.35, 0.35, 0.7)
        return
    ring = [(-0.1 + math.cos(2 * math.pi * i / 12) * 0.34, -0.1 + math.sin(2 * math.pi * i / 12) * 0.34) for i in range(12)]
    for gx, gy in sorted(ring, key=lambda p: p[0] + p[1]):  # merlons all round the top, back to front
        c.box(gx - 0.045, gy - 0.045, top, 0.09, 0.09, 0.1, SANDSTONE)
    if stage == "late":
        c.scaffold(0.0, -0.6, 0.4, 0.4, 1.1)
        return
    # Drill yard: a spear rack and a training post with a straw dummy.
    for i in range(4):
        c.pole((0.45 + i * 0.08, 0.55, 0), (0.45 + i * 0.08, 0.55, 0.55), color=TIMBER, width=4)
        tip = iso(0.45 + i * 0.08, 0.55, 0.55)
        c.draw.polygon([(tip[0], tip[1] - 0.06 * K), (tip[0] - 0.015 * K, tip[1]), (tip[0] + 0.015 * K, tip[1])], fill=(200, 200, 205, 255))
    c.pole((0.4, 0.5, 0.25), (0.75, 0.5, 0.25), color=TIMBER, width=5)
    c.pole((-0.6, 0.55, 0), (-0.6, 0.55, 0.5), color=TIMBER, width=5)
    c.pole((-0.72, 0.55, 0.38), (-0.48, 0.55, 0.38), color=TIMBER, width=4)
    c.ellipse_at(-0.6, 0.55, 0.48, 0.07, 0.09, (210, 180, 100))
    c.ellipse_at(-0.25, 0.62, 0.0, 0.11, 0.06, (176, 46, 40))  # a round shield on the ground


def sarai(c: Canvas, stage: str):
    """A caravanserai: a walled courtyard with rooms along the back, an arched gate, bales and a camel."""
    c.plot()
    wall = {"foundation": 0.05, "frame": 0.25, "late": 0.35, "complete": 0.35}[stage]
    rooms = {"foundation": 0.0, "frame": 0.3, "late": 0.45, "complete": 0.45}[stage]
    if rooms:
        c.box(-0.85, -0.85, 0, 1.6, 0.35, rooms, SANDSTONE, courses=0.09)
        c.box(-0.85, -0.5, 0, 0.35, 1.15, rooms, SANDSTONE, courses=0.09)
        for i in range(4):  # room doors along the back
            d = iso(-0.42 + i * 0.32, -0.5, 0)
            c.draw.rectangle((d[0] - 0.04 * K, d[1] - 0.22 * K, d[0] + 0.04 * K, d[1]), fill=(52, 36, 26, 255))
    c.box(-0.85, 0.7, 0, 0.6, 0.1, wall, SANDSTONE, courses=0.08)
    c.box(0.25, 0.7, 0, 0.5, 0.1, wall, SANDSTONE, courses=0.08)
    c.box(0.75, -0.85, 0, 0.1, 1.65, wall, SANDSTONE, courses=0.08)
    if stage == "foundation":
        c.stones(-0.2, 0.0)
        c.stones(0.3, 0.3, 3, TIMBER)
        return
    # Gatehouse with a pointed arch.
    gate_h = wall + (0.35 if stage != "frame" else 0.1)
    c.box(-0.25, 0.66, 0, 0.5, 0.18, gate_h, RED_STONE, courses=0.1)
    g = iso(0.0, 0.84, 0)
    c.draw.polygon([(g[0] - 0.1 * K, g[1]), (g[0] - 0.1 * K, g[1] - 0.25 * K), (g[0], g[1] - 0.36 * K), (g[0] + 0.1 * K, g[1] - 0.25 * K), (g[0] + 0.1 * K, g[1])], fill=(46, 32, 24, 255))
    if stage == "frame":
        c.scaffold(-0.9, -0.9, 0.8, -0.45, 0.6)
        return
    for x, y in [(0.2, -0.2), (0.35, -0.05), (0.1, 0.05)]:
        c.box(x, y, 0, 0.14, 0.1, 0.1, (200, 170, 100))  # bales of goods
    if stage == "late":
        c.scaffold(-0.25, 0.6, 0.3, 0.9, 0.9)
        return
    # A resting camel in the yard.
    px, py = iso(-0.15, 0.25)
    u = 0.07 * K
    tan, dark = (196, 150, 92, 255), (140, 100, 60, 255)
    c.draw.ellipse((px - 1.6 * u, py - 1.6 * u, px + 1.6 * u, py), fill=tan, outline=dark, width=S)
    c.draw.ellipse((px - 0.6 * u, py - 2.4 * u, px + 0.6 * u, py - 1.2 * u), fill=tan)
    c.draw.line([(px - 1.4 * u, py - 1.0 * u), (px - 2.2 * u, py - 2.6 * u)], fill=tan, width=int(0.5 * u))
    c.draw.ellipse((px - 2.7 * u, py - 3.0 * u, px - 1.9 * u, py - 2.4 * u), fill=tan, outline=dark, width=S)
    flag = iso(0.0, 0.75, gate_h)
    c.draw.line([flag, (flag[0], flag[1] - 0.3 * K)], fill=(90, 60, 40, 255), width=3 * S)
    c.draw.polygon([(flag[0], flag[1] - 0.3 * K), (flag[0] + 0.2 * K, flag[1] - 0.25 * K), (flag[0], flag[1] - 0.2 * K)], fill=(40, 110, 160, 255))


def koshagar(c: Canvas, stage: str):
    """The treasury: a squat stone strongroom with an iron door, a gilded dome and chests by the door."""
    c.plot(half=0.95, dirt=0.78)
    c.box(-0.55, -0.55, 0, 1.0, 1.0, 0.08, GREY_STONE)
    height = {"foundation": 0.1, "frame": 0.4, "late": 0.7, "complete": 0.7}[stage]
    c.box(-0.45, -0.45, 0.08, 0.8, 0.8, height, GREY_STONE, courses=0.1)
    if stage == "foundation":
        c.stones(0.45, 0.35, 6, GREY_STONE)
        return
    d = iso(-0.05, 0.35, 0.08)
    c.draw.rectangle((d[0] - 0.08 * K, d[1] - 0.32 * K, d[0] + 0.08 * K, d[1]), fill=(58, 58, 64, 255), outline=(30, 30, 34, 255), width=S)
    for r in range(3):
        c.draw.line([(d[0] - 0.08 * K, d[1] - (0.08 + r * 0.1) * K), (d[0] + 0.08 * K, d[1] - (0.08 + r * 0.1) * K)], fill=(30, 30, 34, 255), width=2 * S)
    if stage == "frame":
        c.scaffold(-0.5, -0.5, 0.4, 0.4, 0.6)
        return
    top = 0.08 + height
    c.box(-0.5, -0.5, top, 0.9, 0.9, 0.05, shade(GREY_STONE, 1.08))
    px, py = iso(-0.05, -0.05, top + 0.05)
    r = 0.3 * K
    gold = (222, 176, 64)
    if stage == "complete":
        c.draw.pieslice((px - r, py - r * 1.1, px + r, py + r * 0.9), 180, 360, fill=gold + (255,), outline=(130, 96, 30, 255), width=S)
        c.draw.ellipse((px - 0.1 * r, py - 1.25 * r, px + 0.1 * r, py - 1.05 * r), fill=gold + (255,))
        for x, y in [(0.45, 0.45), (0.6, 0.3)]:
            c.box(x, y, 0, 0.16, 0.11, 0.1, (150, 92, 44), top=(200, 150, 70))
            c.box(x, y, 0.1, 0.16, 0.11, 0.02, gold)
    else:
        c.scaffold(-0.55, -0.55, 0.45, 0.45, 1.0)


def dharmashala(c: Canvas, stage: str):
    """A two-storey rest house with a pillared veranda, a tiled roof, a charpai and water pots outside."""
    c.plot()
    lower = {"foundation": 0.0, "frame": 0.35, "late": 0.4, "complete": 0.4}[stage]
    c.box(-0.9, -0.8, 0, 1.6, 0.75, 0.08, GREY_STONE)
    if stage == "foundation":
        for i in range(5):
            c.box(-0.85 + i * 0.36, -0.1, 0.08, 0.06, 0.06, 0.12, TIMBER)
        c.stones(0.25, 0.35)
        c.box(-0.7, 0.4, 0, 0.5, 0.12, 0.08, TIMBER)
        return
    c.box(-0.9, -0.8, 0.08, 1.6, 0.55, lower, (226, 206, 170), courses=None)
    for i in range(6):  # veranda pillars
        c.box(-0.88 + i * 0.3, -0.18, 0.08, 0.05, 0.05, lower, (232, 220, 196))
    c.box(-0.92, -0.25, 0.08 + lower, 1.64, 0.18, 0.03, TIMBER)
    if stage == "frame":
        c.scaffold(-0.95, -0.85, 0.75, -0.05, 0.9)
        return
    upper = 0.08 + lower + 0.03
    c.box(-0.8, -0.75, upper, 1.4, 0.45, 0.32, (226, 206, 170))
    for i in range(5):
        w = iso(-0.65 + i * 0.28, -0.3, upper + 0.12)
        c.draw.rectangle((w[0] - 0.035 * K, w[1] - 0.12 * K, w[0] + 0.035 * K, w[1]), fill=(70, 50, 36, 255))
    top = upper + 0.32
    ridge = top + 0.28
    roof_done = stage == "complete"
    c.poly([(-0.85, -0.27, top), (0.65, -0.27, top), (0.65, -0.52, ridge), (-0.85, -0.52, ridge)], ROOF if roof_done else TIMBER, outline=shade(ROOF, 0.45), width=S)
    c.poly([(0.65, -0.27, top), (0.65, -0.78, top), (0.65, -0.52, ridge)], shade((226, 206, 170), 0.7), outline=shade(SANDSTONE, 0.4), width=S)
    if not roof_done:
        c.scaffold(0.1, -0.85, 0.75, -0.1, 1.2)
        return
    for i in range(1, 8):
        gx = -0.85 + i * 0.19
        c.pole((gx, -0.27, top), (gx, -0.52, ridge), color=shade(ROOF, 0.7), width=2)
    # A charpai (rope cot) and water pots in the yard.
    c.box(-0.4, 0.35, 0.1, 0.45, 0.22, 0.03, (214, 190, 140))
    for gx, gy in [(-0.38, 0.37), (0.02, 0.37), (-0.38, 0.55), (0.02, 0.55)]:
        c.box(gx, gy, 0, 0.03, 0.03, 0.1, TIMBER)
    for gx in (0.35, 0.47):
        c.ellipse_at(gx, 0.45, 0.06, 0.06, 0.06, (176, 96, 60))


BUILDERS = {"baoli": baoli, "prakara": prakara, "gajashala": gajashala, "dharma-stambha": dharma_stambha,
            "burj": burj, "sarai": sarai, "koshagar": koshagar, "dharmashala": dharmashala}


def main() -> None:
    """Draws every stand-in, or only the ids given on the command line (e.g. `burj sarai`)."""
    global K, BASE_Y
    only = set(sys.argv[1:])
    for building_id, draw in BUILDERS.items():
        if only and building_id not in only:
            continue
        scale, half = SCALES[building_id]
        K = scale * S
        BASE_Y = int((FRONT_Y - half * scale) * S)
        out_dir = ROOT / "Assets" / "Art" / "Production" / "Buildings" / DIRS[building_id] / "Runtime2x"
        for stage in STAGES:
            canvas = Canvas()
            draw(canvas, stage)
            path = out_dir / FILES[stage].format(id=building_id)
            canvas.save(path)
            print(path.relative_to(ROOT).as_posix())


if __name__ == "__main__":
    main()
