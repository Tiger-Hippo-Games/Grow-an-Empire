"""Export an RGBA animation master grid to anchored runtime sprites.

The art generators sometimes leave a nearly transparent colored backdrop in
otherwise valid RGBA output.  This exporter normalizes that residue, extracts
each grid cell, fits the visible sprite into a fixed canvas, and emits both
individual frames and a packed sheet.
"""

from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path, help="RGBA master sheet")
    parser.add_argument("frames_dir", type=Path, help="Directory for frame PNGs")
    parser.add_argument("sheet", type=Path, help="Packed runtime sheet PNG")
    parser.add_argument("--name", required=True, help="Frame filename stem")
    parser.add_argument("--columns", type=int, default=4)
    parser.add_argument("--rows", type=int, default=2)
    parser.add_argument("--canvas", type=int, default=256)
    parser.add_argument("--fit", type=int, default=224)
    parser.add_argument(
        "--scale",
        type=float,
        help="Optional uniform source-to-runtime scale; overrides per-frame --fit",
    )
    parser.add_argument("--anchor-y", type=int, default=236)
    parser.add_argument("--alpha-floor", type=int, default=128)
    parser.add_argument("--alpha-solid", type=int, default=220)
    parser.add_argument("--component-alpha", type=int, default=180)
    parser.add_argument("--component-padding", type=int, default=6)
    return parser.parse_args()


def normalize_alpha(image: Image.Image, floor: int, solid: int) -> Image.Image:
    if image.mode != "RGBA":
        raise ValueError(
            f"{image.mode} input has no transparency. Run a background-extraction "
            "pass first; the exporter intentionally refuses destructive RGB keying."
        )
    if not 0 <= floor < solid <= 255:
        raise ValueError("Expected 0 <= alpha-floor < alpha-solid <= 255")

    rgba = image.copy()
    alpha = rgba.getchannel("A")
    scale = 255.0 / (solid - floor)
    alpha = alpha.point(
        lambda value: 0
        if value <= floor
        else 255
        if value >= solid
        else round((value - floor) * scale)
    )
    rgba.putalpha(alpha)
    return rgba


def fit_frame(
    cell: Image.Image,
    canvas: int,
    fit: int,
    anchor_y: int,
    source_scale: float | None,
) -> Image.Image:
    alpha = cell.getchannel("A")
    bbox = alpha.point(lambda value: 255 if value >= 8 else 0).getbbox()
    if bbox is None:
        raise ValueError("A grid cell contains no visible sprite pixels")

    sprite = cell.crop(bbox)
    if source_scale is not None and source_scale <= 0:
        raise ValueError("--scale must be greater than zero")
    ratio = source_scale if source_scale is not None else min(fit / sprite.width, fit / sprite.height)
    size = (
        max(1, round(sprite.width * ratio)),
        max(1, round(sprite.height * ratio)),
    )
    sprite = sprite.resize(size, Image.Resampling.LANCZOS)

    frame = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    x = (canvas - sprite.width) // 2
    y = anchor_y - sprite.height
    if x < 0 or y < 0 or x + sprite.width > canvas or y + sprite.height > canvas:
        raise ValueError("Sprite does not fit the requested runtime canvas")
    frame.alpha_composite(sprite, (x, y))
    return frame


def foreground_components(
    image: Image.Image, expected: int, threshold: int
) -> list[tuple[tuple[int, int, int, int], list[int]]]:
    """Find the expected large connected sprites across the complete sheet.

    Generated figures may cross an ideal grid boundary. Discovering components
    globally avoids clipping those pixels or pulling a neighbor into a frame.
    """

    width, height = image.size
    alpha = image.getchannel("A")
    mask = bytearray(1 if value >= threshold else 0 for value in alpha.tobytes())
    seen = bytearray(width * height)
    components: list[tuple[int, tuple[int, int, int, int], list[int]]] = []

    for start, visible in enumerate(mask):
        if not visible or seen[start]:
            continue
        queue = deque([start])
        seen[start] = 1
        points: list[int] = []
        count = 0
        min_x = max_x = start % width
        min_y = max_y = start // width

        while queue:
            point = queue.pop()
            points.append(point)
            x = point % width
            y = point // width
            count += 1
            min_x = min(min_x, x)
            max_x = max(max_x, x)
            min_y = min(min_y, y)
            max_y = max(max_y, y)

            if x:
                neighbors = (point - 1,)
            else:
                neighbors = ()
            if x + 1 < width:
                neighbors += (point + 1,)
            if y:
                neighbors += (point - width,)
            if y + 1 < height:
                neighbors += (point + width,)

            for neighbor in neighbors:
                if mask[neighbor] and not seen[neighbor]:
                    seen[neighbor] = 1
                    queue.append(neighbor)

        if count >= 1_000:
            components.append(
                (count, (min_x, min_y, max_x + 1, max_y + 1), points)
            )

    if len(components) != expected:
        raise ValueError(
            f"Expected {expected} large foreground components at alpha "
            f">= {threshold}, found {len(components)}"
        )

    result = [(box, points) for _, box, points in components]
    result.sort(
        key=lambda component: (
            (component[0][1] + component[0][3]) // 2,
            (component[0][0] + component[0][2]) // 2,
        )
    )
    return result


def isolate_component(
    master: Image.Image,
    box: tuple[int, int, int, int],
    points: list[int],
    padding: int,
) -> Image.Image:
    """Crop one sprite and suppress unrelated components inside its rectangle."""

    left, top, right, bottom = box
    crop_box = (
        max(0, left - padding),
        max(0, top - padding),
        min(master.width, right + padding),
        min(master.height, bottom + padding),
    )
    cell = master.crop(crop_box)
    mask_data = bytearray(cell.width * cell.height)
    crop_left, crop_top = crop_box[0], crop_box[1]
    for point in points:
        x = point % master.width - crop_left
        y = point // master.width - crop_top
        if 0 <= x < cell.width and 0 <= y < cell.height:
            mask_data[y * cell.width + x] = 255

    # Restore a narrow antialiased fringe around the high-alpha component while
    # excluding disconnected pixels from neighboring animation frames.
    component_mask = Image.frombytes("L", cell.size, bytes(mask_data)).filter(
        ImageFilter.MaxFilter(7)
    )
    alpha = ImageChops.multiply(cell.getchannel("A"), component_mask)
    cell.putalpha(alpha)
    return cell


def main() -> None:
    args = parse_args()
    source = Image.open(args.source)
    master = normalize_alpha(source, args.alpha_floor, args.alpha_solid)

    if master.width % args.columns or master.height % args.rows:
        raise ValueError(
            f"Master size {master.size} is not divisible by "
            f"{args.columns} columns x {args.rows} rows"
        )

    frame_count = args.columns * args.rows
    components = foreground_components(master, frame_count, args.component_alpha)

    # Sort within each visual row. This is more stable than a global y/x sort
    # when adjacent animation poses have different heights.
    components.sort(key=lambda component: (component[0][1] + component[0][3]) / 2)
    ordered_components: list[tuple[tuple[int, int, int, int], list[int]]] = []
    for row in range(args.rows):
        row_components = components[row * args.columns : (row + 1) * args.columns]
        ordered_components.extend(
            sorted(
                row_components,
                key=lambda component: (component[0][0] + component[0][2]) / 2,
            )
        )

    frames: list[Image.Image] = []

    args.frames_dir.mkdir(parents=True, exist_ok=True)
    args.sheet.parent.mkdir(parents=True, exist_ok=True)

    for index in range(frame_count):
        box, points = ordered_components[index]
        cell = isolate_component(
            master,
            box,
            points,
            args.component_padding,
        )
        frame = fit_frame(cell, args.canvas, args.fit, args.anchor_y, args.scale)
        frame_path = args.frames_dir / f"{args.name}-{index + 1:02d}-2x-v1.png"
        frame.save(frame_path, optimize=True)
        frames.append(frame)

    sheet = Image.new(
        "RGBA",
        (args.columns * args.canvas, args.rows * args.canvas),
        (0, 0, 0, 0),
    )
    for index, frame in enumerate(frames):
        sheet.alpha_composite(
            frame,
            ((index % args.columns) * args.canvas, (index // args.columns) * args.canvas),
        )
    sheet.save(args.sheet, optimize=True)

    print(f"Exported {frame_count} frames to {args.frames_dir}")
    print(f"Packed sheet: {args.sheet}")


if __name__ == "__main__":
    main()
