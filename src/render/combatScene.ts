import * as THREE from "three";
import { defenseStrategy, type DefenseStrategy } from "../game/combatRules";
import type { ArmyReport } from "../game/settlementSimulation";
import { directionFromVector, WALK_CELL_ASPECT, type CharacterAssets } from "./characterAssets";
import { civicGround } from "./cityLayout";
import { loadTexture } from "./spriteAssets";

type CombatRole = "archer" | "swordsman" | "horseman" | "enemy";
type Fighter = { sprite: THREE.Sprite; material: THREE.SpriteMaterial; role: CombatRole; lane: number; startX: number; startY: number; targetX: number; targetY: number };
const DURATION = 16;
const SIZE = 2.7;
const DISPLAYED_PER_ROLE = 5;
const LANE_SPACING = 2.15;
const ACTION_FILES: Record<CombatRole, string> = {
  swordsman: "swordsman-combat-south8-master-v1.png",
  archer: "archer-combat-south8-master-v1.png",
  horseman: "horseman-combat-south8-master-v1.png",
  enemy: "enemy-combat-north8-master-v1.png",
};

/** Matching lanes approach along the town's north-south axis. */
export function battleRoute(role: CombatRole, lane: number, southernEdge: number) {
  const x = civicGround.x + (lane - 2) * LANE_SPACING;
  return {
    startX: x,
    targetX: x,
    startY: role === "enemy" ? Math.min(southernEdge - SIZE - lane * 0.2, -15.5)
      : civicGround.y - (role === "horseman" ? 3.1 : role === "archer" ? 1.9 : 2.5),
    targetY: role === "enemy" ? -11.3 : role === "horseman" ? -10.0 : role === "archer" ? -6.2 : -9.2,
  };
}

/** The finale unfolds below the town hall as armies close from north and south. */
export function createCombatScene(scene: THREE.Scene, characters: CharacterAssets) {
  const fighters: Fighter[] = [];
  const arrows: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[] = [];
  const sparks: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>[] = [];
  const actionFrames = new Map<CombatRole, THREE.Texture[]>();
  let loaded: Promise<void> | null = null;
  let active = false;
  let finished = false;
  let startTime = 0;
  let strategy: DefenseStrategy | null = null;
  let swordsCount = 0;
  let archersCount = 0;
  let horsemenCount = 0;

  function frames(sheet: THREE.Texture): THREE.Texture[] {
    const image = sheet.image as HTMLImageElement;
    const insetX = 0.5 / image.naturalWidth;
    const insetY = 0.5 / image.naturalHeight;
    const result = Array.from({ length: 8 }, (_, index) => {
      const frame = sheet.clone();
      frame.repeat.set(0.25 - 2 * insetX, 0.5 - 2 * insetY);
      frame.offset.set((index % 4) * 0.25 + insetX, (index < 4 ? 0.5 : 0) + insetY);
      frame.needsUpdate = true;
      return frame;
    });
    sheet.dispose();
    return result;
  }

  function load(): Promise<void> {
    if (!loaded) loaded = Promise.all([
      ...(["enemy", "swordsman", "archer", "horseman"] as CombatRole[]).map(async (role) => {
        await characters.ensureRole(role);
        if (!actionFrames.has(role)) actionFrames.set(role, frames(await loadTexture(ACTION_FILES[role])));
      }),
    ]).then(() => undefined).catch((error: unknown) => { loaded = null; throw error; });
    return loaded;
  }

  function makeFighter(role: Fighter["role"], index: number, southernEdge: number): void {
    const lane = index % 5;
    const row = Math.floor(index / 5);
    const route = battleRoute(role, lane, southernEdge);
    const rearRank = role === "enemy" ? row : 0;
    const startX = route.startX + rearRank * 0.8;
    const targetX = route.targetX + rearRank * 0.8;
    const startY = route.startY - rearRank * 1.7;
    const targetY = route.targetY - rearRank * 1.7;
    const initialDirection = directionFromVector(targetX - startX, targetY - startY);
    const material = new THREE.SpriteMaterial({ map: characters.getFrame(role, 0, initialDirection), transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(material);
    const size = role === "horseman" ? SIZE * 1.32 : SIZE;
    sprite.scale.set(size * WALK_CELL_ASPECT, size, 1);
    sprite.position.set(startX, startY + size / 2, 2.8);
    sprite.renderOrder = (role === "enemy" ? 90 : role === "horseman" ? 85 : role === "swordsman" ? 80 : 75) + row;
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
    strategy = defenseStrategy(report.units, report.enemyStrength);
    swordsCount = Math.min(report.units.swordsmen, DISPLAYED_PER_ROLE);
    archersCount = Math.min(report.units.archers, DISPLAYED_PER_ROLE);
    horsemenCount = Math.min(report.units.horsemen, DISPLAYED_PER_ROLE);
    // A representative squad keeps the poses legible at the full-city zoom.
    // The report still counts the entire army.
    for (let index = 0; index < swordsCount; index += 1) makeFighter("swordsman", index, southernEdge);
    for (let index = 0; index < archersCount; index += 1) makeFighter("archer", index, southernEdge);
    for (let index = 0; index < horsemenCount; index += 1) makeFighter("horseman", index, southernEdge);
    for (let index = 0; index < report.enemyStrength; index += 1) makeFighter("enemy", index, southernEdge);
    createEffects();
    startTime = elapsed;
    active = true;
  }

  /** Updates the eight-frame defender actions, projectiles, impacts, and final retreats. */
  function update(elapsed: number): boolean {
    if (!active || finished) return false;
    const t = elapsed - startTime;
    const win = strategy !== null;
    const combat = Math.max(0, t - 4.5);
    for (let index = 0; index < fighters.length; index += 1) {
      const fighter = fighters[index];
      const enemy = fighter.role === "enemy";
      const approach = THREE.MathUtils.smoothstep(Math.min(1, t / (fighter.role === "horseman" ? 3.3 : 4.2)), 0, 1);
      const x = THREE.MathUtils.lerp(fighter.startX, fighter.targetX, approach);
      let y = THREE.MathUtils.lerp(fighter.startY, fighter.targetY, approach);
      const attacking = t >= 4.5 && t < 12.2;
      const phase = (combat + fighter.lane * 0.22 + (enemy ? 0.35 : 0)) % 1.5;
      const pose = attacking ? Math.min(7, Math.floor(phase / 1.5 * 8)) : Math.floor(t * 6 + fighter.lane) % 4;
      const retreating = t >= 12.2 && ((enemy && win) || (!enemy && !win));
      const facing = retreating
        ? directionFromVector(0, enemy ? -1 : 1)
        : directionFromVector(fighter.targetX - fighter.startX, fighter.targetY - fighter.startY);
      const texture = attacking ? actionFrames.get(fighter.role)![pose] : characters.getFrame(fighter.role, pose, facing);
      if (fighter.material.map !== texture) { fighter.material.map = texture; fighter.material.needsUpdate = true; }
      if (attacking && fighter.role !== "archer" && pose === 4) y += enemy ? 0.38 : -0.38;
      if (t >= 12.2) {
        const retreat = Math.min(1, (t - 12.2) / 3.3);
        if (enemy && win) y = THREE.MathUtils.lerp(fighter.targetY, fighter.startY, retreat);
        if (!enemy && !win) y += 7 * retreat;
        fighter.material.opacity = enemy === win ? 1 - retreat * 0.88 : 1;
      }
      const size = fighter.role === "horseman" ? SIZE * 1.32 : SIZE;
      fighter.sprite.position.set(x, y + size / 2 + (attacking && pose === 4 ? 0.09 : 0), 2.8);
      fighter.sprite.scale.x = size * (attacking ? 1 : WALK_CELL_ASPECT);
    }
    // Staggered arrow volleys visibly mark the pure archer and mixed defenses.
    const arrowsFiring = t > 4.7 && t < 12.1 && archersCount > 0;
    arrows.forEach((arrow, index) => {
      const phase = (combat + index * 0.22) % 1.5;
      arrow.visible = arrowsFiring && index < archersCount && phase >= 0.55 && phase < 1.2;
      if (arrow.visible) {
        const fraction = (phase - 0.55) / 0.65;
        arrow.position.set(civicGround.x + (index - 2) * LANE_SPACING, -7.0 - fraction * 4.2, 3.2);
        arrow.rotation.z = -Math.PI / 2;
      }
    });
    sparks.forEach((spark, index) => {
      const phase = (combat + index * 0.22 + 0.35) % 1.5;
      spark.visible = t > 4.5 && t < 12.2 && phase >= 0.7 && phase < 0.88;
      if (spark.visible) {
        spark.position.set(civicGround.x + (index - 2) * LANE_SPACING, -10.7, 3.4);
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
