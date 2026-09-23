"""Prepare the generated horseman attack poses as a 512px 2x2 runtime sheet."""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "Assets/Art/Production/Characters/Horseman/horseman-attack4-master-v1.png"
TARGET = ROOT / "Assets/Art/Generated 512/horseman-attack4.png"


def main() -> None:
    image = Image.open(SOURCE).convert("RGBA")
    if image.size != (1254, 1254):
        raise ValueError(f"Unexpected source size: {image.size}")
    sheet = Image.new("RGBA", (512, 512))
    # The charging lance crosses the lower panels' divider. Include its tip in
    # the strike pose, and start the recovery crop after it so poses stay clean.
    panels = [
        (0, 0, 627, 627),
        (627, 0, 1254, 627),
        (0, 627, 650, 1254),
        (650, 627, 1254, 1254),
    ]
    for index, bounds in enumerate(panels):
        pose = image.crop(bounds).resize((256, 256), Image.Resampling.LANCZOS)
        pose.putalpha(pose.getchannel("A").point(lambda alpha: alpha if alpha >= 32 else 0))
        sheet.paste(pose, ((index % 2) * 256, (index // 2) * 256))
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(TARGET)
    print(TARGET)


if __name__ == "__main__":
    main()
