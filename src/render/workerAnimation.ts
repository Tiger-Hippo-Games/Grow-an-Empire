import * as THREE from "three";
import { loadSheet, setSheetFrame, type SheetClip } from "./spriteAssets";
import { workerFootOffset } from "./cityLayout";
import type { CharacterAssets, CharacterRole } from "./characterAssets";

export type Direction = "southeast" | "southwest";
export type AnimatedClipName = "walk" | "chop" | "pickup" | "carry";

const CLIP_DEFINITIONS: Array<[AnimatedClipName, number]> = [
  ["walk", 9.0909],
  ["chop", 9.5238],
  ["pickup", 8],
  ["carry", 9.0909],
];
const DIRECTIONS: Direction[] = ["southeast", "southwest"];

/**
 * The focused worker sprite: specialists survey their building sites, the
 * builder constructs them, and an animated woodcutter tends the forest.
 */
export function createWorkerAnimation(scene: THREE.Scene, characters: CharacterAssets) {
  const clips = new Map<string, SheetClip>();
  const workerMaterial = new THREE.SpriteMaterial({ transparent: true, depthTest: false });
  const worker = new THREE.Sprite(workerMaterial);
  worker.scale.set(2.25, 2.25, 1);
  worker.renderOrder = 100;
  scene.add(worker);

  /** Loads the forest worker's frame animation sheets before the scene starts. */
  async function loadClips(): Promise<void> {
    await Promise.all(CLIP_DEFINITIONS.flatMap(([name, fps]) => DIRECTIONS.map(async (direction) => {
      const action = name === "pickup" || name === "carry" ? `${name}-log` : name;
      clips.set(`${name}:${direction}`, await loadSheet(`woodcutter-male-01-${action}-${direction}-sheet-2x-v1.png`, fps));
    })));
  }

  /** Switches the worker to `name`/`direction` and shows `frame`. A no-op if clips haven't loaded yet. */
  function useClip(name: AnimatedClipName, direction: Direction, frame: number): void {
    const clip = clips.get(`${name}:${direction}`);
    if (!clip) return;
    setSheetFrame(clip, frame);
    workerMaterial.map = clip.texture;
    workerMaterial.needsUpdate = true;
  }

  /** Shows one of a profession's four walking poses. */
  function useCharacter(role: CharacterRole, frame = 0): void {
    const texture = characters.getFrame(role, frame);
    if (workerMaterial.map === texture) return;
    workerMaterial.map = texture;
    workerMaterial.needsUpdate = true;
  }

  /** Which frame of a clip should show `elapsed` seconds into playback (loops). */
  function frameFor(name: AnimatedClipName, direction: Direction, elapsed: number): number {
    const clip = clips.get(`${name}:${direction}`);
    return clip ? Math.floor(elapsed * clip.fps) % clip.frames : 0;
  }

  /** Stands the worker at a ground position (feet on the point). */
  function placeWorker(position: THREE.Vector2): void {
    worker.position.set(position.x, position.y + workerFootOffset, 3);
  }

  /** Places the worker `progress` (0–1) of the way along a straight line from `from` to `to`. */
  function moveWorker(from: THREE.Vector2, to: THREE.Vector2, progress: number): void {
    worker.position.set(
      THREE.MathUtils.lerp(from.x, to.x, progress),
      THREE.MathUtils.lerp(from.y, to.y, progress) + workerFootOffset,
      3,
    );
  }

  /** Moves the construction crew along the same road polyline revealed for the chosen plot. */
  function moveWorkerAlong(points: THREE.Vector2[], progress: number): void {
    const lengths = points.slice(1).map((point, index) => point.distanceTo(points[index]));
    let remaining = THREE.MathUtils.clamp(progress, 0, 1) * lengths.reduce((sum, length) => sum + length, 0);
    for (let index = 1; index < points.length; index += 1) {
      if (remaining <= lengths[index - 1] || index === points.length - 1) {
        moveWorker(points[index - 1], points[index], lengths[index - 1] > 0 ? remaining / lengths[index - 1] : 1);
        return;
      }
      remaining -= lengths[index - 1];
    }
    placeWorker(points[0]);
  }

  return { worker, loadClips, useClip, useCharacter, frameFor, placeWorker, moveWorker, moveWorkerAlong };
}

export type WorkerAnimation = ReturnType<typeof createWorkerAnimation>;
