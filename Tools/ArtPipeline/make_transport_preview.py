from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


PROJECT = Path(__file__).resolve().parents[2]
RUNTIME = PROJECT / "Assets/Art/Production/Characters/WoodcutterMale01/Runtime2x"
OUTPUT = PROJECT / "Assets/Art/Production/InteractionPreviews"

DIRECTIONS = (
    ("SOUTHEAST", "Southeast", "southeast"),
    ("SOUTHWEST", "Southwest", "southwest"),
    ("NORTHEAST", "Northeast", "northeast"),
    ("NORTHWEST", "Northwest", "northwest"),
)


def font(size: int, bold: bool = False) -> ImageFont.ImageFont:
    name = "segoeuib.ttf" if bold else "segoeui.ttf"
    path = Path("C:/Windows/Fonts") / name
    return ImageFont.truetype(str(path), size) if path.exists() else ImageFont.load_default()


def make_parallel_preview(
    *,
    action_folder: str,
    filename_pattern: str,
    title: str,
    output_name: str,
    duration: int,
) -> None:
    frames = []
    for frame_number in range(1, 9):
        board = Image.new("RGBA", (900, 760), (44, 76, 48, 255))
        draw = ImageDraw.Draw(board)
        draw.rounded_rectangle((20, 18, 880, 82), radius=16, fill=(25, 39, 29, 255))
        draw.text((48, 35), title, font=font(25, True), fill=(255, 255, 255, 255))

        for index, (label, folder, slug) in enumerate(DIRECTIONS):
            column = index % 2
            row = index // 2
            x = 35 + column * 430
            y = 105 + row * 315
            draw.rounded_rectangle((x, y, x + 400, y + 285), radius=18, fill=(76, 104, 47, 255))
            draw.text((x + 18, y + 14), label, font=font(20, True), fill=(255, 220, 132, 255))
            path = (
                RUNTIME
                / action_folder
                / folder
                / filename_pattern.format(slug=slug, frame=frame_number)
            )
            sprite = Image.open(path).convert("RGBA").resize((230, 230), Image.Resampling.LANCZOS)
            board.alpha_composite(sprite, (x + 85, y + 48))

        draw.text(
            (35, 723),
            f"FRAME {frame_number}/8   •   {duration} ms per frame",
            font=font(16),
            fill=(238, 238, 225, 255),
        )
        frames.append(board.convert("P", palette=Image.Palette.ADAPTIVE, colors=255))

    destination = OUTPUT / output_name
    destination.parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(
        destination,
        save_all=True,
        append_images=frames[1:],
        duration=duration,
        loop=0,
        disposal=2,
        optimize=False,
    )
    print(destination)


make_parallel_preview(
    action_folder="Walk",
    filename_pattern="woodcutter-male-01-walk-{slug}-frame-{frame:02d}-2x-v1.png",
    title="UNLOADED WALK — FOUR DIRECTIONS IN PARALLEL",
    output_name="woodcutter-walk-four-directions-parallel-v1.gif",
    duration=110,
)

make_parallel_preview(
    action_folder="Carry",
    filename_pattern="woodcutter-male-01-carry-log-{slug}-{frame:02d}-2x-v1.png",
    title="LOADED WALK — FOUR DIRECTIONS IN PARALLEL",
    output_name="woodcutter-carry-four-directions-parallel-v1.gif",
    duration=110,
)

make_parallel_preview(
    action_folder="Pickup",
    filename_pattern="woodcutter-male-01-pickup-log-{slug}-{frame:02d}-2x-v1.png",
    title="PICKUP / DELIVERY — FOUR DIRECTIONS IN PARALLEL",
    output_name="woodcutter-pickup-four-directions-parallel-v1.gif",
    duration=125,
)

make_parallel_preview(
    action_folder="Chop",
    filename_pattern="woodcutter-male-01-chop-{slug}-frame-{frame:02d}-2x-v1.png",
    title="TREE CHOP — FOUR DIRECTIONS IN PARALLEL",
    output_name="woodcutter-chop-four-directions-parallel-v1.gif",
    duration=105,
)
