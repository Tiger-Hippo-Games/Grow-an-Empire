import * as THREE from "three";
import { TOTAL_SETTLEMENT_LEVELS } from "../game/content";
import { loadSpriteAsset, spriteFromAsset } from "./spriteAssets";
import { civicGround } from "./cityLayout";

/** Civic-center art exists for levels 0–8; later levels keep showing level 8. */
const ART_LEVELS = Math.min(9, TOTAL_SETTLEMENT_LEVELS);

/**
 * The stacked civic-center appearances (Level 0 campsite upward); exactly one
 * is visible at a time.
 *
 * Levels load on demand rather than all at boot: level N is only needed after
 * move N, so boot loads just the current level and each level preloads the
 * next one in the background (MOBILE_PERFORMANCE §36: don't preload what
 * isn't needed yet). Until a requested level arrives, the highest loaded level
 * below it stays on screen, so the center never disappears.
 */
export function createCivicCenter(scene: THREE.Scene) {
  const sprites: Array<THREE.Sprite | undefined> = [];
  const loading = new Map<number, Promise<void>>();
  let wantedLevel = 0;

  const artLevel = (level: number): number => Math.max(0, Math.min(ART_LEVELS - 1, Math.floor(level)));

  /** Loads one level's sprite (once). Failed loads can be retried. */
  function ensureLevel(level: number): Promise<void> {
    level = artLevel(level);
    if (sprites[level]) return Promise.resolve();
    const inFlight = loading.get(level);
    if (inFlight) return inFlight;
    const promise = loadSpriteAsset(`settlement-level-${level}-2x-v1.png`).then((asset) => {
      const sprite = spriteFromAsset(asset, 2 * (3.5 + level * 0.16));
      sprite.position.set(civicGround.x, civicGround.y + sprite.scale.y / 2, 1);
      sprite.renderOrder = 8;
      sprite.visible = false;
      sprites[level] = sprite;
      scene.add(sprite);
      applyVisibility();
    });
    loading.set(level, promise);
    promise.then(() => loading.delete(level), () => loading.delete(level));
    return promise;
  }

  /** Shows the wanted level, or the closest loaded level below it while it loads. */
  function applyVisibility(): void {
    let shown = -1;
    for (let level = artLevel(wantedLevel); level >= 0; level -= 1) {
      if (sprites[level]) { shown = level; break; }
    }
    sprites.forEach((sprite, index) => { if (sprite) sprite.visible = index === shown; });
  }

  /** Loads (and waits for) the sprite for `level`, then preloads the next level. */
  async function load(level = 0): Promise<void> {
    await ensureLevel(level);
    ensureLevel(level + 1).catch(() => { /* Retried when that level is reached. */ });
  }

  /** Shows `level` (clamped to the available art) and preloads the level after it. */
  function setLevel(level: number): void {
    wantedLevel = artLevel(level);
    applyVisibility();
    ensureLevel(wantedLevel).catch((error: unknown) => console.warn("[Grow an Empire] Civic art failed to load", error));
    ensureLevel(wantedLevel + 1).catch(() => { /* Retried when that level is reached. */ });
  }

  return { load, setLevel };
}
