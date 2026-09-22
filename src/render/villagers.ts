import * as THREE from "three";
import { setTextureFrame } from "./spriteAssets";
import { civicGround, getBuildingPosition } from "./cityLayout";
import type { WorkerAnimation } from "./workerAnimation";

interface Villager {
  sprite: THREE.Sprite;
  texture: THREE.Texture;
  phase: number;
  speed: number;
}

/**
 * The crowd of small, independently animated villagers that visually
 * distributes the population across the civic center and every constructed
 * building. Population count is authoritative in the simulation; this module
 * only ever grows its pool to match and toggles visibility, so villagers
 * created for a higher population that later isn't reached (never happens
 * today, but harmless) simply stay hidden rather than being recreated.
 */
export function createVillagerField(scene: THREE.Scene, workerAnimation: WorkerAnimation) {
  const villagers: Villager[] = [];

  function createVillager(index: number): Villager {
    const walk = workerAnimation.getWalkClip();
    const texture = walk.texture.clone();
    texture.needsUpdate = true;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
    const scale = 1.05 + (index % 4) * 0.045;
    sprite.scale.set(scale, scale, 1);
    sprite.renderOrder = 40 + index;
    scene.add(sprite);
    return { sprite, texture, phase: (index * 0.61803398875) % 1, speed: 0.055 + (index % 7) * 0.006 };
  }

  function syncVillagers(targetPopulation: number): void {
    while (villagers.length < targetPopulation) villagers.push(createVillager(villagers.length));
    villagers.forEach((villager, index) => { villager.sprite.visible = index < targetPopulation; });
  }

  function renderVillagers(animationElapsed: number, builtBuildingIds: string[]): void {
    const activityHubs = [civicGround, ...builtBuildingIds.map(getBuildingPosition)];
    for (let index = 0; index < villagers.length; index += 1) {
      const villager = villagers[index];
      if (!villager.sprite.visible) continue;
      const openingRoute = activityHubs.length === 1;
      const hub = openingRoute ? new THREE.Vector2(6, 0.1) : activityHubs[index % activityHubs.length];
      const orbitBand = Math.floor(index / activityHubs.length);
      const orbitRadius = 1.05 + (orbitBand % 4) * 0.28;
      const angle = animationElapsed * (0.72 + villager.speed * 3) + villager.phase * Math.PI * 2;
      const x = hub.x + Math.cos(angle) * orbitRadius * (openingRoute ? 1.35 : 1.1);
      const y = hub.y + Math.sin(angle) * orbitRadius * (openingRoute ? 0.8 : 0.58);
      villager.sprite.position.set(x, y + 0.55, 2.4);
      const movingRight = -Math.sin(angle) >= 0;
      villager.sprite.scale.x = Math.abs(villager.sprite.scale.x) * (movingRight ? 1 : -1);
      setTextureFrame(villager.texture, Math.floor(animationElapsed * (7.5 + (index % 4)) + index));
    }
  }

  return { syncVillagers, renderVillagers };
}
