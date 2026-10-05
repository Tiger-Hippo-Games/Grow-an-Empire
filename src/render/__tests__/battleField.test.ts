import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createBattleField } from "../battleField";
import type { CharacterAssets } from "../characterAssets";
import { resolveBattle } from "../../game/battle";

/**
 * The battle is fought in the city and the game always runs in a 1920×1080
 * portal frame (the fixed 16:9 layout: the camera shows y −24.5…19.5 and
 * x ±39), so every fighter of the biggest armies must stay inside that view
 * and clear of the battle HUD bar along the top, from the march to the end.
 */
const characters = {
  getFrame: () => new THREE.Texture(),
  getWorkFrame: () => null,
  ensureRole: () => Promise.resolve(),
} as unknown as CharacterAssets;

describe("the battle in the city", () => {
  it("keeps the biggest armies on screen in the 1920×1080 frame", () => {
    const scene = new THREE.Scene();
    const field = createBattleField(scene, characters);
    const player = { archers: 40, swordsmen: 40, horsemen: 20, militia: 10 };
    const enemy = { archers: 30, swordsmen: 37, horsemen: 15, veterancy: 1 };
    const { rounds } = resolveBattle(player, enemy, { two: 0.1, three: 0.2 });
    let done = false;
    field.play(player, enemy, rounds, { onDone: () => { done = true; } }, 0);
    // The battle HUD bar covers about the top 7% of the frame (y above ~16.5).
    for (const t of [1400, 2000, 3000, 4500, 6000]) {
      field.update(t);
      for (const sprite of scene.children as THREE.Sprite[]) {
        if (!sprite.visible) continue;
        const top = sprite.position.y + sprite.scale.y / 2;
        const bottom = sprite.position.y - sprite.scale.y / 2;
        expect(bottom, `t=${t}`).toBeGreaterThan(-24.5);
        expect(top, `t=${t}`).toBeLessThan(16.5);
        expect(Math.abs(sprite.position.x)).toBeLessThan(36);
      }
    }
    field.update(20000);
    expect(done).toBe(true);
  });
});
