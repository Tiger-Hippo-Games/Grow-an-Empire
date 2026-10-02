import * as THREE from "three";
import { loadTexture } from "./spriteAssets";
import type { ArmyUnits } from "../game/settlementSimulation";

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

export function walkSheetFilename(role: CharacterRole): string { return `${role}-walk32-master-v1.png`; }
export function workSheetFilename(role: CharacterRole): string { return `${role}-work8-master-v1.png`; }
/** The 32-frame atlas stores directions in columns and stride poses in rows. */
export function walkAtlasIndex(direction: WalkDirection, frame: number): number {
  return (((Math.floor(frame) % 4) + 4) % 4) * 8 + direction;
}

const BUILDING_ROLES: Record<string, CharacterRole> = {
  house: "builder", woodcutter: "woodcutter", sawmill: "woodcutter", farm: "farmer", bakery: "baker",
  "swine-farm": "farmer", butchery: "baker", "fruit-orchard": "farmer", winery: "merchant",
  quarry: "quarry", granary: "farmer", marketplace: "merchant", blacksmith: "blacksmith",
  "weapons-workshop": "blacksmith", barracks: "spearman", stable: "horseman",
};

export function roleForBuilding(buildingId: string): CharacterRole { return BUILDING_ROLES[buildingId] ?? "builder"; }

export function roleForArmyUnitAtIndex(units: ArmyUnits, index: number): CharacterRole {
  if (index < units.swordsmen) return "swordsman";
  index -= units.swordsmen;
  if (index < units.horsemen) return "horseman";
  index -= units.horsemen;
  if (index < units.archers) return "archer";
  index -= units.archers;
  if (index < units.spearmen) return "spearman";
  index -= units.spearmen;
  if (index < units.militia) return "militia";
  return "horseman";
}

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
      walks.set(role, atlasFrames(sheet, 8, 4));
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
      works.set(role, atlasFrames(sheet, 4, 2));
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

  function getFrame(role: CharacterRole, frame: number, direction: WalkDirection = 4): THREE.Texture {
    const frames = walks.get(role);
    if (!frames) {
      if (mayRetry(`${role}:walk`)) void loadWalk(role).catch((error: unknown) => logFailure(role, "walk", error));
      const fallback = walks.get("builder");
      if (!fallback) throw new Error("Builder character art was requested before loading");
      return fallback[walkAtlasIndex(direction, frame)];
    }
    return frames[walkAtlasIndex(direction, frame)];
  }

  function getWorkFrame(role: CharacterRole, frame: number): THREE.Texture | null {
    const frames = works.get(role);
    if (!frames) {
      if (mayRetry(`${role}:work`)) void loadWork(role).catch((error: unknown) => logFailure(role, "work", error));
      return null;
    }
    return frames[((Math.floor(frame) % 8) + 8) % 8];
  }

  return { load, ensureRole, getFrame, getWorkFrame };
}

export type CharacterAssets = ReturnType<typeof createCharacterAssets>;
