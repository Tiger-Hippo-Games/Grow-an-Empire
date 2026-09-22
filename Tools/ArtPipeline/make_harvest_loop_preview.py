from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


PROJECT = Path(__file__).resolve().parents[2]
ART = PROJECT / "Assets/Art/Production"
WOODCUTTER = ART / "Characters/WoodcutterMale01/Runtime2x"
TREE_ROOT = ART / "Environment/Trees/Deciduous01/Runtime2x"
STOCKPILE_ROOT = ART / "Props/LogStockpile01/Runtime2x"
OUTPUT = ART / "InteractionPreviews/woodcutter-harvest-loop-integrated-preview-v1.gif"

CANVAS = (1000, 600)
GROUND_Y = 505
TREE_ANCHOR_X = 745
STOCKPILE_ANCHOR_X = 170


def font(size: int, bold: bool = False) -> ImageFont.ImageFont:
    name = "segoeuib.ttf" if bold else "segoeui.ttf"
    path = Path("C:/Windows/Fonts") / name
    return ImageFont.truetype(str(path), size) if path.exists() else ImageFont.load_default()


def crop_visible(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    bbox = rgba.getchannel("A").getbbox()
    if bbox is None:
        raise ValueError("Preview asset contains no visible pixels")
    return rgba.crop(bbox)


def fit_visible(path: Path, maximum: tuple[int, int]) -> Image.Image:
    image = crop_visible(Image.open(path))
    ratio = min(maximum[0] / image.width, maximum[1] / image.height)
    return image.resize(
        (max(1, round(image.width * ratio)), max(1, round(image.height * ratio))),
        Image.Resampling.LANCZOS,
    )


TREE_STATES = {
    "healthy": fit_visible(TREE_ROOT / "deciduous-01-healthy-2x-v1.png", (300, 340)),
    "notched": fit_visible(TREE_ROOT / "deciduous-01-notched-2x-v1.png", (300, 340)),
    "falling": fit_visible(TREE_ROOT / "deciduous-01-falling-southeast-2x-v1.png", (390, 310)),
    "felled": fit_visible(TREE_ROOT / "deciduous-01-felled-2x-v1.png", (390, 235)),
}
STOCKPILE_STATES = [
    fit_visible(STOCKPILE_ROOT / f"log-stockpile-01-state-{index:02d}-2x-v1.png", (220, 145))
    for index in range(1, 5)
]


def character(action: str, direction: str, frame: int | None = None) -> Image.Image:
    folder = direction.title()
    if action == "idle":
        name = f"woodcutter-male-01-idle-{direction}-2x-v1.png"
        return Image.open(WOODCUTTER / "Idle" / name).convert("RGBA")
    if action == "chop":
        name = f"woodcutter-male-01-chop-{direction}-frame-{frame:02d}-2x-v1.png"
        return Image.open(WOODCUTTER / "Chop" / folder / name).convert("RGBA")
    if action == "walk":
        name = f"woodcutter-male-01-walk-{direction}-frame-{frame:02d}-2x-v1.png"
        return Image.open(WOODCUTTER / "Walk" / folder / name).convert("RGBA")
    name = f"woodcutter-male-01-{action}-log-{direction}-{frame:02d}-2x-v1.png"
    action_folder = "Pickup" if action == "pickup" else "Carry"
    return Image.open(WOODCUTTER / action_folder / folder / name).convert("RGBA")


def compose(
    label: str,
    *,
    worker: Image.Image | None,
    worker_x: int = 0,
    tree_state: str = "healthy",
    stockpile_state: int = 1,
) -> Image.Image:
    board = Image.new("RGBA", CANVAS, (126, 151, 92, 255))
    draw = ImageDraw.Draw(board)
    draw.rectangle((0, 0, CANVAS[0], 72), fill=(25, 39, 29, 255))
    draw.text((32, 20), "WOODCUTTER HARVEST LOOP", font=font(26, True), fill="white")
    draw.text((650, 24), label, font=font(20, True), fill=(255, 216, 105, 255))
    draw.line((30, GROUND_Y, 970, GROUND_Y), fill=(82, 110, 59, 255), width=3)

    tree = TREE_STATES[tree_state]
    board.alpha_composite(tree, (TREE_ANCHOR_X - tree.width // 2, GROUND_Y - tree.height))
    stockpile = STOCKPILE_STATES[stockpile_state - 1]
    board.alpha_composite(
        stockpile,
        (STOCKPILE_ANCHOR_X - stockpile.width // 2, GROUND_Y - stockpile.height),
    )

    if worker is not None:
        anchor_x = worker.width // 2
        board.alpha_composite(worker, (worker_x - anchor_x, GROUND_Y - 236))
    return board


frames: list[Image.Image] = []

idle = character("idle", "southeast")
for index in range(1, 9):
    x = round(245 + (570 - 245) * (index - 1) / 7)
    frames.append(
        compose(
            "TRAVEL TO TREE",
            worker=character("walk", "southeast", index),
            worker_x=x,
        )
    )

for index in range(1, 9):
    tree_state = "healthy" if index < 4 else "notched"
    frames.append(
        compose(
            "CHOP",
            worker=character("chop", "southeast", index),
            worker_x=615,
            tree_state=tree_state,
        )
    )

for tree_state in ("notched", "falling", "felled"):
    frames.extend(
        [compose("TREE FALLING", worker=None, tree_state=tree_state)] * 2
    )

for index in range(1, 9):
    frames.append(
        compose(
            "PICK UP LOG",
            worker=character("pickup", "southeast", index),
            worker_x=620,
            tree_state="felled",
        )
    )

for index in range(1, 9):
    x = round(590 + (265 - 590) * (index - 1) / 7)
    frames.append(
        compose(
            "CARRY TO STOCKPILE",
            worker=character("carry", "southwest", index),
            worker_x=x,
            tree_state="felled",
        )
    )

for step, index in enumerate(range(8, 0, -1)):
    frames.append(
        compose(
            "DELIVER LOG",
            worker=character("pickup", "southwest", index),
            worker_x=255,
            tree_state="felled",
            stockpile_state=2 if step == 7 else 1,
        )
    )

for stockpile_state in range(1, 5):
    frames.extend(
        [
            compose(
                "STOCKPILE GROWTH",
                worker=idle,
                worker_x=260,
                tree_state="felled",
                stockpile_state=stockpile_state,
            )
        ]
        * 2
    )

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
palette_frames = [
    frame.convert("P", palette=Image.Palette.ADAPTIVE, colors=255) for frame in frames
]
palette_frames[0].save(
    OUTPUT,
    save_all=True,
    append_images=palette_frames[1:],
    duration=105,
    loop=0,
    disposal=2,
    optimize=False,
)
print(OUTPUT)
print(f"Frames: {len(frames)}")
