import * as THREE from "three";
import { TOTAL_SETTLEMENT_LEVELS } from "../game/content";
import { loadSpriteAsset, spriteFromAsset } from "./spriteAssets";
import { civicGround } from "./cityLayout";

/** The nine stacked civic-center appearances (Level 0 campsite through the Grand Town Hall); exactly one is visible at a time. */
export function createCivicCenter(scene: THREE.Scene) {
  const sprites: THREE.Sprite[] = [];

  async function load(): Promise<void> {
    await Promise.all(Array.from({ length: TOTAL_SETTLEMENT_LEVELS }, async (_, level) => {
      const asset = await loadSpriteAsset(`settlement-level-${level}-2x-v1.png`);
      const sprite = spriteFromAsset(asset, 3.5 + level * 0.16);
      sprite.position.set(civicGround.x, civicGround.y + sprite.scale.y / 2, 1);
      sprite.renderOrder = 8;
      sprite.visible = false;
      sprites[level] = sprite;
      scene.add(sprite);
    }));
  }

  function setLevel(level: number): void {
    sprites.forEach((sprite, index) => { sprite.visible = index === level; });
  }

  return { load, setLevel };
}
