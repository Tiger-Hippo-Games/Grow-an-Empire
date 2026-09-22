import * as THREE from "three";
import { loadSheet, setSheetFrame, type SheetClip } from "./spriteAssets";
import { workerFootOffset } from "./cityLayout";

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
 * The single roaming "active builder" sprite used for both the construction
 * animation and the Woodcutter's dedicated harvest loop, plus the sprite-sheet
 * clips it plays. Only one of these is ever on screen at a time, standing in
 * for whichever crew is currently doing visible work.
 */
export function createWorkerAnimation(scene: THREE.Scene) {
  const clips = new Map<string, SheetClip>();
  const workerMaterial = new THREE.SpriteMaterial({ transparent: true, depthTest: false });
  const worker = new THREE.Sprite(workerMaterial);
  worker.scale.set(2.25, 2.25, 1);
  worker.renderOrder = 100;
  scene.add(worker);

  async function loadClips(): Promise<void> {
    await Promise.all(CLIP_DEFINITIONS.flatMap(([name, fps]) => DIRECTIONS.map(async (direction) => {
      const action = name === "pickup" || name === "carry" ? `${name}-log` : name;
      clips.set(`${name}:${direction}`, await loadSheet(`woodcutter-male-01-${action}-${direction}-sheet-2x-v1.png`, fps));
    })));
  }

  function useClip(name: AnimatedClipName, direction: Direction, frame: number): void {
    const clip = clips.get(`${name}:${direction}`);
    if (!clip) return;
    setSheetFrame(clip, frame);
    workerMaterial.map = clip.texture;
    workerMaterial.needsUpdate = true;
  }

  function frameFor(name: AnimatedClipName, direction: Direction, elapsed: number): number {
    const clip = clips.get(`${name}:${direction}`);
    return clip ? Math.floor(elapsed * clip.fps) % clip.frames : 0;
  }

  function placeWorker(position: THREE.Vector2): void {
    worker.position.set(position.x, position.y + workerFootOffset, 3);
  }

  function moveWorker(from: THREE.Vector2, to: THREE.Vector2, progress: number): void {
    worker.position.set(
      THREE.MathUtils.lerp(from.x, to.x, progress),
      THREE.MathUtils.lerp(from.y, to.y, progress) + workerFootOffset,
      3,
    );
  }

  /** The walk cycle clip, shared as the base texture villagers clone from. */
  function getWalkClip(): SheetClip {
    return clips.get("walk:southeast")!;
  }

  return { worker, loadClips, useClip, frameFor, placeWorker, moveWorker, getWalkClip };
}

export type WorkerAnimation = ReturnType<typeof createWorkerAnimation>;
