import * as THREE from "three";
import { defenseStrategy, ENEMY_SWORDSMEN, type DefenseStrategy } from "../game/combatRules";
import type { ArmyReport } from "../game/settlementSimulation";
import type { CharacterAssets } from "./characterAssets";
import { loadTexture } from "./spriteAssets";

type Fighter = { sprite: THREE.Sprite; material: THREE.SpriteMaterial; role: "archer" | "swordsman" | "enemy"; lane: number; baseX: number; baseY: number };
const DURATION = 16;
const SIZE = 2.25;

/** The finale uses the same ground coordinates as the city, between Butchery and Barracks. */
export function createCombatScene(scene: THREE.Scene, characters: CharacterAssets) {
  const fighters: Fighter[] = [];
  const arrows: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[] = [];
  const sparks: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>[] = [];
  let enemyWalk: THREE.Texture[] = [];
  let enemyAttack: THREE.Texture[] = [];
  let swordAttack: THREE.Texture[] = [];
  let archerAttack: THREE.Texture[] = [];
  let loaded: Promise<void> | null = null;
  let active = false;
  let finished = false;
  let startTime = 0;
  let strategy: DefenseStrategy | null = null;
  let swordsCount = 0;
  let archersCount = 0;

  function frames(sheet: THREE.Texture): THREE.Texture[] {
    const result = Array.from({ length: 4 }, (_, index) => {
      const frame = sheet.clone();
      frame.repeat.set(0.5, 0.5);
      frame.offset.set((index % 2) * 0.5, index < 2 ? 0.5 : 0);
      frame.needsUpdate = true;
      return frame;
    });
    sheet.dispose();
    return result;
  }

  function load(): Promise<void> {
    if (!loaded) loaded = Promise.all([
      loadTexture("enemy-swordsman-walk4.png"), loadTexture("enemy-swordsman-attack4.png"),
      loadTexture("swordsman-attack4.png"), loadTexture("archer-attack4.png"),
    ]).then(([walk, enemy, sword, bow]) => {
      enemyWalk = frames(walk); enemyAttack = frames(enemy); swordAttack = frames(sword); archerAttack = frames(bow);
    }).catch((error: unknown) => { loaded = null; throw error; });
    return loaded;
  }

  function makeFighter(role: Fighter["role"], index: number): void {
    const lane = index % 5;
    const row = Math.floor(index / 5);
    const baseY = -8.8 - lane * 1.28;
    const baseX = role === "enemy" ? 11.5 + row * 0.85 : role === "archer" ? -12 - row * 1.35 : -7.8 - row * 1.35;
    const material = new THREE.SpriteMaterial({ map: role === "enemy" ? enemyWalk[0] : characters.getFrame(role, 0), transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(role === "enemy" ? -SIZE : SIZE, SIZE, 1);
    sprite.position.set(baseX, baseY + SIZE / 2, 2.8);
    sprite.renderOrder = 75 + lane + row;
    scene.add(sprite);
    fighters.push({ sprite, material, role, lane, baseX, baseY });
  }

  function createEffects(): void {
    const arrowGeometry = new THREE.PlaneGeometry(1.05, 0.09);
    const arrowMaterial = new THREE.MeshBasicMaterial({ color: 0xffdf83, transparent: true, opacity: 0.96, depthTest: false });
    for (let index = 0; index < 10; index += 1) {
      const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
      arrow.renderOrder = 95;
      arrow.visible = false;
      scene.add(arrow);
      arrows.push(arrow);
    }
    const sparkGeometry = new THREE.CircleGeometry(0.28, 8);
    const sparkMaterial = new THREE.MeshBasicMaterial({ color: 0xffe4a1, transparent: true, opacity: 0.9, depthTest: false });
    for (let index = 0; index < 5; index += 1) {
      const spark = new THREE.Mesh(sparkGeometry, sparkMaterial);
      spark.renderOrder = 96;
      spark.visible = false;
      scene.add(spark);
      sparks.push(spark);
    }
  }

  function clear(): void {
    active = false;
    finished = false;
    for (const fighter of fighters) { scene.remove(fighter.sprite); fighter.material.dispose(); }
    fighters.length = 0;
    arrows[0]?.geometry.dispose();
    arrows[0]?.material.dispose();
    sparks[0]?.geometry.dispose();
    sparks[0]?.material.dispose();
    for (const effect of [...arrows, ...sparks]) scene.remove(effect);
    arrows.length = 0;
    sparks.length = 0;
  }

  function start(report: ArmyReport, elapsed: number): void {
    clear();
    strategy = defenseStrategy(report.units);
    swordsCount = Math.min(report.units.swordsmen, 10);
    archersCount = Math.min(report.units.archers, 10);
    // Keep each side legible at the city's normal zoom. Extra trained units
    // remain represented in the report; the clearing displays up to ten of each.
    for (let index = 0; index < swordsCount; index += 1) makeFighter("swordsman", index);
    for (let index = 0; index < archersCount; index += 1) makeFighter("archer", index);
    for (let index = 0; index < ENEMY_SWORDSMEN; index += 1) makeFighter("enemy", index);
    createEffects();
    startTime = elapsed;
    active = true;
  }

  /** Updates all four attack poses, projectiles, impacts, and final retreats. */
  function update(elapsed: number): boolean {
    if (!active || finished) return false;
    const t = elapsed - startTime;
    const win = strategy !== null;
    const combat = Math.max(0, t - 4.5);
    for (let index = 0; index < fighters.length; index += 1) {
      const fighter = fighters[index];
      const enemy = fighter.role === "enemy";
      const approach = Math.min(1, t / 4.2);
      const meleeX = enemy ? 2.3 + fighter.lane * 0.12 : -1.3 - fighter.lane * 0.12;
      let x = fighter.baseX;
      if (enemy) x += (meleeX - fighter.baseX) * approach;
      else if (fighter.role === "swordsman") x += (meleeX - fighter.baseX) * approach;
      else x += 1.4 * approach;
      const attacking = t >= 4.5 && t < 12.2;
      const beat = Math.floor(combat / 1.4 + fighter.lane * 0.3);
      const pose = attacking ? Math.floor((combat + fighter.lane * 0.19) * 5) % 4 : Math.floor(t * 6 + fighter.lane) % 4;
      const texture = enemy ? (attacking ? enemyAttack[pose] : enemyWalk[pose])
        : fighter.role === "archer" ? (attacking ? archerAttack[pose] : characters.getFrame("archer", pose))
          : (attacking ? swordAttack[pose] : characters.getFrame("swordsman", pose));
      if (fighter.material.map !== texture) { fighter.material.map = texture; fighter.material.needsUpdate = true; }
      if (attacking && fighter.role !== "archer") x += Math.sin(combat * 9 + fighter.lane) * 0.22;
      if (t >= 12.2) {
        const retreat = Math.min(1, (t - 12.2) / 3.3);
        if (enemy && win) x += 6 * retreat;
        if (!enemy && !win) x -= 5 * retreat;
        fighter.material.opacity = enemy === win ? 1 - retreat * 0.88 : 1;
      }
      fighter.sprite.position.set(x, fighter.baseY + SIZE / 2 + (attacking && beat % 2 ? 0.06 : 0), 2.8);
      fighter.sprite.scale.x = enemy ? -SIZE : SIZE;
    }
    // Staggered arrow volleys visibly mark the pure archer and mixed defenses.
    const arrowsFiring = t > 4.7 && t < 12.1 && archersCount > 0;
    arrows.forEach((arrow, index) => {
      const phase = (combat + index * 0.23) % 1.65;
      arrow.visible = arrowsFiring && index < archersCount && phase < 0.72;
      if (arrow.visible) {
        const lane = index % 5;
        const fraction = phase / 0.72;
        arrow.position.set(-8.8 + fraction * 10.5, -8.0 - lane * 1.28 + Math.sin(fraction * Math.PI) * 0.8, 3.2);
        arrow.rotation.z = -0.1 + fraction * 0.18;
      }
    });
    sparks.forEach((spark, index) => {
      const phase = (combat + index * 0.31) % 1.4;
      spark.visible = t > 4.5 && t < 12.2 && phase < 0.2;
      if (spark.visible) {
        spark.position.set(0.4 + index * 0.15, -8.0 - index * 1.28, 3.4);
        spark.scale.setScalar(0.7 + phase * 4);
      }
    });
    if (t >= DURATION) { finished = true; return true; }
    return false;
  }

  function status(elapsed: number): string | null {
    if (!active || finished) return null;
    const t = elapsed - startTime;
    if (t < 4.5) return "Five Ashfang swordsmen charge into the clearing!";
    if (t < 12.2) return strategy === "mixed" ? "Archers fire over the swordsmen holding the line!"
      : strategy === "archers" ? "A volley of arrows rains on the raiders!"
        : strategy === "swordsmen" ? "The city's swordsmen meet the raider charge!"
          : "The defenders struggle to hold the line!";
    return strategy ? "The raiders are retreating!" : "The defenders are falling back!";
  }

  return { load, start, update, status, clear, get active() { return active; } };
}
