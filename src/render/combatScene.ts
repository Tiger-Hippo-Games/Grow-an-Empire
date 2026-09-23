import * as THREE from "three";
import { defenseStrategy, ENEMY_SWORDSMEN, type DefenseStrategy } from "../game/combatRules";
import type { ArmyReport } from "../game/settlementSimulation";
import type { CharacterAssets } from "./characterAssets";
import { civicGround } from "./cityLayout";
import { loadTexture } from "./spriteAssets";

type Fighter = { sprite: THREE.Sprite; material: THREE.SpriteMaterial; role: "archer" | "swordsman" | "horseman" | "enemy"; lane: number; startX: number; startY: number; targetX: number; targetY: number };
const DURATION = 16;
const SIZE = 2.7;
const DISPLAYED_PER_ROLE = 5;
const LANE_SPACING = 1.65;

/** The finale uses the same ground coordinates as the city, between Butchery and Barracks. */
export function createCombatScene(scene: THREE.Scene, characters: CharacterAssets) {
  const fighters: Fighter[] = [];
  const arrows: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[] = [];
  const sparks: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>[] = [];
  let enemyWalk: THREE.Texture[] = [];
  let enemyAttack: THREE.Texture[] = [];
  let swordAttack: THREE.Texture[] = [];
  let archerAttack: THREE.Texture[] = [];
  let horseAttack: THREE.Texture[] = [];
  let loaded: Promise<void> | null = null;
  let active = false;
  let finished = false;
  let startTime = 0;
  let strategy: DefenseStrategy | null = null;
  let swordsCount = 0;
  let archersCount = 0;
  let horsemenCount = 0;

  function frames(sheet: THREE.Texture): THREE.Texture[] {
    // Sample inside each quadrant so linear filtering cannot pull a pixel from
    // the neighbouring attack pose where a sword reaches the frame boundary.
    const uvInset = 0.5 / 512;
    const result = Array.from({ length: 4 }, (_, index) => {
      const frame = sheet.clone();
      frame.repeat.set(0.5 - uvInset * 2, 0.5 - uvInset * 2);
      frame.offset.set((index % 2) * 0.5 + uvInset, (index < 2 ? 0.5 : 0) + uvInset);
      frame.needsUpdate = true;
      return frame;
    });
    sheet.dispose();
    return result;
  }

  function load(): Promise<void> {
    if (!loaded) loaded = Promise.all([
      loadTexture("enemy-swordsman-walk4.png"), loadTexture("enemy-swordsman-attack4.png"),
      loadTexture("swordsman-attack4.png"), loadTexture("archer-attack4.png"), loadTexture("horseman-attack4.png"),
    ]).then(([walk, enemy, sword, bow, horse]) => {
      enemyWalk = frames(walk); enemyAttack = frames(enemy); swordAttack = frames(sword); archerAttack = frames(bow); horseAttack = frames(horse);
    }).catch((error: unknown) => { loaded = null; throw error; });
    return loaded;
  }

  function makeFighter(role: Fighter["role"], index: number, southernEdge: number): void {
    const lane = index % 5;
    const row = Math.floor(index / 5);
    const targetY = -7.8 - lane * LANE_SPACING - (role === "horseman" ? 0.45 : 0);
    const targetX = role === "enemy" ? 1.9 + lane * 0.12 : role === "archer" ? -9.2 - row * 1.35 : role === "horseman" ? -4.5 - lane * 0.1 : -1.5 - lane * 0.12;
    const startX = role === "enemy" ? -2.5 + lane * 1.3 : civicGround.x + (lane - 2) * 1.25;
    const startY = role === "enemy" ? southernEdge - SIZE - lane * 0.25 : civicGround.y - (role === "archer" ? 5.1 : role === "horseman" ? 7.0 : 3.4) - row * 1.35;
    const material = new THREE.SpriteMaterial({ map: role === "enemy" ? enemyWalk[0] : characters.getFrame(role, 0), transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(material);
    const size = role === "horseman" ? SIZE * 1.32 : SIZE;
    sprite.scale.set(role === "enemy" ? -size : size, size, 1);
    sprite.position.set(startX, startY + size / 2, 2.8);
    sprite.renderOrder = (role === "horseman" ? 86 : 75) + lane + row;
    scene.add(sprite);
    fighters.push({ sprite, material, role, lane, startX, startY, targetX, targetY });
  }

  function createEffects(): void {
    const arrowGeometry = new THREE.PlaneGeometry(1.2, 0.14);
    const arrowMaterial = new THREE.MeshBasicMaterial({ color: 0xffdf83, transparent: true, opacity: 0.96, depthTest: false });
    for (let index = 0; index < DISPLAYED_PER_ROLE; index += 1) {
      const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
      arrow.renderOrder = 95;
      arrow.visible = false;
      scene.add(arrow);
      arrows.push(arrow);
    }
    const sparkGeometry = new THREE.CircleGeometry(0.36, 8);
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

  function start(report: ArmyReport, elapsed: number, southernEdge: number): void {
    clear();
    strategy = defenseStrategy(report.units);
    swordsCount = Math.min(report.units.swordsmen, DISPLAYED_PER_ROLE);
    archersCount = Math.min(report.units.archers, DISPLAYED_PER_ROLE);
    horsemenCount = Math.min(report.units.horsemen, DISPLAYED_PER_ROLE);
    // A representative squad keeps the poses legible at the full-city zoom.
    // The report still counts the entire army.
    for (let index = 0; index < swordsCount; index += 1) makeFighter("swordsman", index, southernEdge);
    for (let index = 0; index < archersCount; index += 1) makeFighter("archer", index, southernEdge);
    for (let index = 0; index < horsemenCount; index += 1) makeFighter("horseman", index, southernEdge);
    for (let index = 0; index < ENEMY_SWORDSMEN; index += 1) makeFighter("enemy", index, southernEdge);
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
      const approach = THREE.MathUtils.smoothstep(Math.min(1, t / (fighter.role === "horseman" ? 3.3 : 4.2)), 0, 1);
      let x = THREE.MathUtils.lerp(fighter.startX, fighter.targetX, approach);
      let y = THREE.MathUtils.lerp(fighter.startY, fighter.targetY, approach);
      const attacking = t >= 4.5 && t < 12.2;
      const phase = (combat + fighter.lane * 0.22 + (enemy ? 0.35 : 0)) % 1.5;
      const pose = attacking ? Math.min(3, Math.floor(phase / 0.375)) : Math.floor(t * 6 + fighter.lane) % 4;
      const texture = enemy ? (attacking ? enemyAttack[pose] : enemyWalk[pose])
        : fighter.role === "archer" ? (attacking ? archerAttack[pose] : characters.getFrame("archer", pose))
          : fighter.role === "horseman" ? (attacking ? horseAttack[pose] : characters.getFrame("horseman", pose))
            : (attacking ? swordAttack[pose] : characters.getFrame("swordsman", pose));
      if (fighter.material.map !== texture) { fighter.material.map = texture; fighter.material.needsUpdate = true; }
      if (attacking && fighter.role !== "archer" && pose === 2) x += enemy ? -0.38 : 0.38;
      if (t >= 12.2) {
        const retreat = Math.min(1, (t - 12.2) / 3.3);
        if (enemy && win) y = THREE.MathUtils.lerp(fighter.targetY, fighter.startY, retreat);
        if (!enemy && !win) y += 7 * retreat;
        fighter.material.opacity = enemy === win ? 1 - retreat * 0.88 : 1;
      }
      const size = fighter.role === "horseman" ? SIZE * 1.32 : SIZE;
      fighter.sprite.position.set(x, y + size / 2 + (attacking && pose === 2 ? 0.09 : 0), 2.8);
      fighter.sprite.scale.x = enemy ? -size : size;
    }
    // Staggered arrow volleys visibly mark the pure archer and mixed defenses.
    const arrowsFiring = t > 4.7 && t < 12.1 && archersCount > 0;
    arrows.forEach((arrow, index) => {
      const phase = (combat + index * 0.22) % 1.5;
      arrow.visible = arrowsFiring && index < archersCount && phase >= 0.55 && phase < 1.2;
      if (arrow.visible) {
        const lane = index % 5;
        const fraction = (phase - 0.55) / 0.65;
        arrow.position.set(-8.8 + fraction * 10.5, -6.9 - lane * LANE_SPACING + Math.sin(fraction * Math.PI) * 0.35, 3.2);
        arrow.rotation.z = -0.1 + fraction * 0.18;
      }
    });
    sparks.forEach((spark, index) => {
      const phase = (combat + index * 0.22 + 0.35) % 1.5;
      spark.visible = t > 4.5 && t < 12.2 && phase >= 0.7 && phase < 0.88;
      if (spark.visible) {
        spark.position.set(0.2 + index * 0.12, -6.85 - index * LANE_SPACING, 3.4);
        spark.scale.setScalar(1.3 + (phase - 0.7) * 4);
      }
    });
    if (t >= DURATION) { finished = true; return true; }
    return false;
  }

  function status(elapsed: number): string | null {
    if (!active || finished) return null;
    const t = elapsed - startTime;
    if (t < 4.5) return "Raiders surge from the south as defenders leave the town center!";
    if (t < 12.2) return horsemenCount > 0 ? "Horsemen charge as the city defenders hold the line!"
      : strategy === "mixed" ? "Archers fire over the swordsmen holding the line!"
      : strategy === "horsemen" ? "The horsemen charge through the raider line!"
      : strategy === "archers" ? "A volley of arrows rains on the raiders!"
        : strategy === "swordsmen" ? "The city's swordsmen meet the raider charge!"
          : "The defenders struggle to hold the line!";
    return strategy ? "The raiders are retreating!" : "The defenders are falling back!";
  }

  return { load, start, update, status, clear, get active() { return active; } };
}
