import json
from pathlib import Path

from PIL import Image


PROJECT = Path(__file__).resolve().parents[2]
MANIFEST = PROJECT / "Assets/Art/Production/Integration/woodcutter-harvest-loop-v1.json"
DIRECTIONS = {"southeast", "southwest", "northeast", "northwest"}


def validate_image(relative_path: str, expected_size: tuple[int, int] | None = None) -> None:
    path = PROJECT / relative_path
    if not path.is_file():
        raise ValueError(f"Missing asset: {relative_path}")
    with Image.open(path) as image:
        if expected_size is not None and image.size != expected_size:
            raise ValueError(f"{relative_path}: expected {expected_size}, found {image.size}")
        if image.mode != "RGBA":
            raise ValueError(f"{relative_path}: expected RGBA, found {image.mode}")


manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
clips = manifest["clips"]

runtime = manifest["runtimeBinding"]
if runtime.get("status") != "integrated":
    raise ValueError("Harvest loop is not marked as runtime-integrated")
if runtime.get("engine") != "three.js":
    raise ValueError("Runtime binding must target three.js")
entry_point = PROJECT / runtime["entryPoint"]
if not entry_point.is_file():
    raise ValueError(f"Missing runtime entry point: {runtime['entryPoint']}")

for clip_name in ("idle", "walk", "chop", "pickup", "carry"):
    clip = clips[clip_name]
    mapping_key = "files" if clip_name == "idle" else "sheets"
    mapping = clip[mapping_key]
    if set(mapping) != DIRECTIONS:
        raise ValueError(f"{clip_name}: incomplete direction mapping")
    expected_size = (192, 256) if clip_name == "idle" else (1024, 512)
    for path in mapping.values():
        validate_image(path, expected_size)

deliver = clips["deliver"]
if deliver["sourceClip"] != "pickup" or not deliver["reverse"]:
    raise ValueError("Delivery must reuse the pickup clip in reverse")

for path in manifest["worldAssets"]["treeStates"]:
    validate_image(path)
validate_image(manifest["worldAssets"]["portableLog"])
for path in manifest["worldAssets"]["stockpileStates"]:
    validate_image(path)

machine = manifest["stateMachine"]
states = machine["states"]
if machine["initial"] not in states:
    raise ValueError("Initial state is missing")
for state_name, state in states.items():
    target = state.get("next")
    if target is not None and target not in states:
        raise ValueError(f"{state_name}: transition target {target!r} is missing")
    clip = state.get("clip")
    if clip is not None and clip not in clips:
        raise ValueError(f"{state_name}: clip {clip!r} is missing")

visited = set()
current = machine["initial"]
while current not in visited:
    visited.add(current)
    current = states[current]["next"]
if current != machine["initial"] or visited != set(states):
    raise ValueError("State graph must be one closed loop containing every state")

print(f"PASS: {manifest['id']}")
print(f"Validated {len(clips)} clips, {len(states)} states, and all referenced assets")
print(f"Runtime binding: {runtime['engine']} via {runtime['entryPoint']}")
