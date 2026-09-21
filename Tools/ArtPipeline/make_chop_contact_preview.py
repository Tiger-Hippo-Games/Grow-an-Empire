from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


PROJECT = Path(__file__).resolve().parents[2]
ART = PROJECT / "Assets/Art/Production"
CHARACTER = ART / "Characters/WoodcutterMale01/Runtime2x/Chop"
TREE = ART / "Environment/Trees/Deciduous01/Runtime2x/deciduous-01-notched-2x-v1.png"
OUTPUT = ART / "InteractionPreviews/woodcutter-chop-four-directions-contact-preview-v1.png"

DIRECTIONS = (
    ("SOUTHEAST", "Southeast", "southeast", (130, 110)),
    ("SOUTHWEST", "Southwest", "southwest", (265, 105)),
    ("NORTHEAST", "Northeast", "northeast", (110, 105)),
    ("NORTHWEST", "Northwest", "northwest", (265, 125)),
)


def font(size: int, bold: bool = False) -> ImageFont.ImageFont:
    name = "segoeuib.ttf" if bold else "segoeui.ttf"
    path = Path("C:/Windows/Fonts") / name
    return ImageFont.truetype(str(path), size) if path.exists() else ImageFont.load_default()


tree_source = Image.open(TREE).convert("RGBA")
tree_bbox = tree_source.getchannel("A").getbbox()
if tree_bbox is None:
    raise ValueError("Notched tree contains no visible pixels")
tree = tree_source.crop(tree_bbox)
tree = tree.resize((220, 310), Image.Resampling.LANCZOS)

panel_width = 500
panel_height = 410
header_height = 82
board = Image.new("RGBA", (1040, 930), (44, 76, 48, 255))
draw = ImageDraw.Draw(board)
draw.rounded_rectangle((20, 18, 1020, 72), radius=15, fill=(25, 39, 29, 255))
draw.text(
    (42, 32),
    "CHOP IMPACT — SCALE, FOOT ANCHOR, AND TREE CONTACT",
    font=font(23, True),
    fill=(255, 255, 255, 255),
)

for index, (label, folder, slug, character_position) in enumerate(DIRECTIONS):
    column = index % 2
    row = index // 2
    panel_x = 20 + column * 510
    panel_y = header_height + row * 420
    draw.rounded_rectangle(
        (panel_x, panel_y, panel_x + panel_width, panel_y + panel_height),
        radius=18,
        fill=(126, 151, 92, 255),
    )
    draw.text(
        (panel_x + 18, panel_y + 14),
        f"{label} — IMPACT FRAME 4",
        font=font(18, True),
        fill=(255, 238, 174, 255),
    )

    tree_position = (panel_x + 195, panel_y + 58)
    board.alpha_composite(tree, tree_position)

    character_path = (
        CHARACTER
        / folder
        / f"woodcutter-male-01-chop-{slug}-frame-04-2x-v1.png"
    )
    character = Image.open(character_path).convert("RGBA")
    board.alpha_composite(
        character,
        (panel_x + character_position[0], panel_y + character_position[1]),
    )

    # Shared notched-trunk target after cropping and resizing the tree.
    contact = (panel_x + 316, panel_y + 319)
    draw.ellipse(
        (contact[0] - 6, contact[1] - 6, contact[0] + 6, contact[1] + 6),
        outline=(255, 196, 72, 255),
        width=2,
    )
    ground_y = panel_y + character_position[1] + 236
    draw.line(
        (panel_x + 24, ground_y, panel_x + panel_width - 24, ground_y),
        fill=(75, 103, 54, 255),
        width=2,
    )

draw.text(
    (30, 912),
    "Gold ring = intended trunk contact • ground line = runtime character foot anchor",
    font=font(15),
    fill=(238, 238, 225, 255),
)

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
board.save(OUTPUT, optimize=True)
print(OUTPUT)
