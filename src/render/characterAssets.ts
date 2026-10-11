import * as THREE from "three";
import { loadTexture } from "./spriteAssets";
import { bundledAssetNames } from "./assetCatalog";

/** Identity references for every civilian, defender, and raider role. */
export const CHARACTER_FILES = {
  builder: "villager-builder.png", farmer: "villager-farmer.png", woodcutter: "villager-woodcutter.png",
  quarry: "villager-quarry-worker.png", miner: "villager-iron-miner.png", baker: "villager-baker.png",
  blacksmith: "villager-blacksmith.png", merchant: "villager-merchant.png", militia: "militia.png",
  spearman: "spearman.png", archer: "archer.png", swordsman: "swordsman.png", horseman: "horseman.png",
  enemy: "enemy-swordsman.png",
} as const;

export type CharacterRole = keyof typeof CHARACTER_FILES;
/** Clockwise from north, matching the eight atlas columns. */
export type WalkDirection = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const WALK_DIRECTIONS = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"] as const;
/** Cell proportions of the downsampled runtime atlases. */
export const WALK_CELL_ASPECT = (1024 / 8) / (680 / 4);
export const WORK_CELL_ASPECT = (1024 / 4) / (584 / 2);

export function directionFromVector(dx: number, dy: number): WalkDirection {
  if (Math.abs(dx) + Math.abs(dy) < 1e-6) return 4;
  return ((Math.round(Math.atan2(dx, dy) / (Math.PI / 4)) + 8) % 8) as WalkDirection;
}

/**
 * Smoother sheets drop in without code changes (Docs/ANIMATION_COMMISSION_BRIEF.md):
 * a `<role>-walk64-master-v1` sheet (8 directions × 8 stride poses) replaces the
 * 4-pose `walk32` sheet, and a `<role>-work16-master-v1` sheet (4 × 4) replaces
 * the 8-frame `work8` loop, as soon as they are exported to Assets/Runtime.
 */
function bundled(filename: string): boolean {
  return bundledAssetNames().includes(filename.replace(/\.png$/i, ".webp"));
}
/** Stride poses per direction in this role's walk sheet: 8 with a walk64 sheet, else 4. */
export function walkPoseCount(role: CharacterRole): 4 | 8 {
  return bundled(`${role}-walk64-master-v1.png`) ? 8 : 4;
}
/** Frames in this role's work loop: 16 with a work16 sheet, else 8. */
export function workFrameCount(role: CharacterRole): 8 | 16 {
  return bundled(`${role}-work16-master-v1.png`) ? 16 : 8;
}
export function walkSheetFilename(role: CharacterRole): string {
  return walkPoseCount(role) === 8 ? `${role}-walk64-master-v1.png` : `${role}-walk32-master-v1.png`;
}
export function workSheetFilename(role: CharacterRole): string {
  return workFrameCount(role) === 16 ? `${role}-work16-master-v1.png` : `${role}-work8-master-v1.png`;
}
/** The walk atlas stores directions in columns and stride poses in rows (4 rows, or 8). */
export function walkAtlasIndex(direction: WalkDirection, pose: number, poses: number = 4): number {
  return (((Math.floor(pose) % poses) + poses) % poses) * 8 + direction;
}

const BUILDING_ROLES: Record<string, CharacterRole> = {
  house: "builder", woodcutter: "woodcutter", sawmill: "woodcutter", farm: "farmer", bakery: "baker",
  "swine-farm": "farmer", butchery: "baker", "fruit-orchard": "farmer", winery: "merchant",
  quarry: "quarry", granary: "farmer", marketplace: "merchant", blacksmith: "blacksmith",
  "weapons-workshop": "blacksmith", barracks: "spearman", stable: "horseman",
  baoli: "farmer", prakara: "archer", gajashala: "horseman", "dharma-stambha": "quarry",
};

export function roleForBuilding(buildingId: string): CharacterRole { return BUILDING_ROLES[buildingId] ?? "builder"; }

function atlasFrames(sheet: THREE.Texture, columns: number, rows: number): THREE.Texture[] {
  const image = sheet.image as HTMLImageElement;
  const insetX = 0.5 / image.naturalWidth;
  const insetY = 0.5 / image.naturalHeight;
  const frames = Array.from({ length: columns * rows }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const texture = sheet.clone();
    texture.repeat.set(1 / columns - 2 * insetX, 1 / rows - 2 * insetY);
    texture.offset.set(column / columns + insetX, 1 - (row + 1) / rows + insetY);
    texture.needsUpdate = true;
    return texture;
  });
  sheet.dispose();
  return frames;
}

/** Loads only the founder for boot; each later role and its action load on demand. */
export function createCharacterAssets(onReady: () => void = () => undefined) {
  const walks = new Map<CharacterRole, THREE.Texture[]>();
  const works = new Map<CharacterRole, THREE.Texture[]>();
  const pendingWalks = new Map<CharacterRole, Promise<void>>();
  const pendingWorks = new Map<CharacterRole, Promise<void>>();
  const warned = new Set<string>();
  // Frame lookups run every frame. After a failed sheet they would start a new
  // request each frame (each one waiting out the image timeout), so on-demand
  // retries wait RETRY_AFTER_MS. ensureRole() still retries straight away.
  const RETRY_AFTER_MS = 30_000;
  const failedAt = new Map<string, number>();
  const mayRetry = (key: string): boolean => {
    const at = failedAt.get(key);
    return at === undefined || performance.now() - at >= RETRY_AFTER_MS;
  };

  function loadWalk(role: CharacterRole): Promise<void> {
    if (walks.has(role)) return Promise.resolve();
    const pending = pendingWalks.get(role);
    if (pending) return pending;
    const loading = loadTexture(walkSheetFilename(role)).then((sheet) => {
      walks.set(role, atlasFrames(sheet, 8, walkPoseCount(role)));
      onReady();
    }, (error: unknown) => {
      failedAt.set(`${role}:walk`, performance.now());
      throw error;
    }).finally(() => pendingWalks.delete(role));
    pendingWalks.set(role, loading);
    return loading;
  }

  function loadWork(role: CharacterRole): Promise<void> {
    if (works.has(role)) return Promise.resolve();
    const pending = pendingWorks.get(role);
    if (pending) return pending;
    const loading = loadTexture(workSheetFilename(role)).then((sheet) => {
      works.set(role, atlasFrames(sheet, 4, workFrameCount(role) / 4));
      onReady();
    }, (error: unknown) => {
      failedAt.set(`${role}:work`, performance.now());
      throw error;
    }).finally(() => pendingWorks.delete(role));
    pendingWorks.set(role, loading);
    return loading;
  }

  function logFailure(role: CharacterRole, kind: string, error: unknown): void {
    const key = `${role}:${kind}`;
    if (warned.has(key)) return;
    warned.add(key);
    console.warn(`[Grow an Empire] ${kind} animation failed for ${role}`, error);
  }

  function ensureRole(role: CharacterRole, includeWork = false): Promise<void> {
    return Promise.all([loadWalk(role), ...(includeWork ? [loadWork(role)] : [])]).then(() => undefined);
  }

  function load(): Promise<void> { return loadWalk("builder"); }

  /** The loaded walk frames for `role` (falling back to the builder's while it loads). */
  function walkFrames(role: CharacterRole): THREE.Texture[] {
    const frames = walks.get(role);
    if (frames) return frames;
    if (mayRetry(`${role}:walk`)) void loadWalk(role).catch((error: unknown) => logFailure(role, "walk", error));
    const fallback = walks.get("builder");
    if (!fallback) throw new Error("Builder character art was requested before loading");
    return fallback;
  }

  /** A walk frame by 4-pose step (0–3), for callers that count steps; works with 8-pose sheets too. */
  function getFrame(role: CharacterRole, frame: number, direction: WalkDirection = 4): THREE.Texture {
    const frames = walkFrames(role);
    const poses = frames.length / 8;
    return frames[walkAtlasIndex(direction, (((Math.floor(frame) % 4) + 4) % 4) * (poses / 4), poses)];
  }

  /** A walk frame by stride position (`cycle`: 0–1 is one full stride), using every pose the sheet has. */
  function getWalkFrame(role: CharacterRole, cycle: number, direction: WalkDirection = 4): THREE.Texture {
    const frames = walkFrames(role);
    const poses = frames.length / 8;
    const fraction = cycle - Math.floor(cycle);
    return frames[walkAtlasIndex(direction, Math.floor(fraction * poses), poses)];
  }

  /** A work-loop frame; `frame` counts in 8-frame-loop steps, so a 16-frame sheet plays twice as many in the same time. */
  function getWorkFrame(role: CharacterRole, frame: number): THREE.Texture | null {
    const frames = works.get(role);
    if (!frames) {
      if (mayRetry(`${role}:work`)) void loadWork(role).catch((error: unknown) => logFailure(role, "work", error));
      return null;
    }
    const count = frames.length;
    const step = Math.floor(frame * (count / 8));
    return frames[((step % count) + count) % count];
  }

  return { load, ensureRole, getFrame, getWalkFrame, getWorkFrame };
}

export type CharacterAssets = ReturnType<typeof createCharacterAssets>;
