import * as THREE from "three";
import type { ArmyReport } from "../game/settlementSimulation";
import { civicGround, DISTRICT_JUNCTIONS, getBuildingDistrict, getBuildingPosition, getRoadRoute } from "./cityLayout";
import { setTextureFrame } from "./spriteAssets";
import type { WorkerAnimation } from "./workerAnimation";
import { CITY_ANIMATION } from "./animationDesign";

/**
 * Kinds of commute a villager can walk:
 * - `service`: Town Hall ↔ a building (every completed building gets one);
 * - `supply`: producer ↔ processor (e.g. Farm → Bakery), once both exist;
 * - `civic`: trade to the Marketplace and House ↔ Marketplace traffic.
 */
export type WorkRouteKind = "service" | "supply" | "civic";

/** A polyline a villager walks back and forth along. `speed` is in world units per second. */
export interface WorkRoute {
  id: string;
  kind: WorkRouteKind;
  points: THREE.Vector2[];
  speed: number;
}

interface Villager {
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
  texture: THREE.Texture;
  phase: number;
  speedVariation: number;
}

const SUPPLY_LINKS: Array<[string, string]> = [
  ["woodcutter", "sawmill"], ["farm", "bakery"], ["farm", "granary"],
  ["swine-farm", "butchery"], ["fruit-orchard", "winery"],
  ["quarry", "blacksmith"], ["blacksmith", "weapons-workshop"], ["weapons-workshop", "barracks"],
];

/**
 * Pure route plan for the current build order: the visible workforce only uses
 * roads that exist. With nothing built yet, a single "founders" route keeps the
 * first villager moving. Villager N walks route `N % routes.length`.
 */
export function buildFunctionalRoutes(builtBuildingIds: string[]): WorkRoute[] {
  const built = new Set(builtBuildingIds);
  const routes: WorkRoute[] = [];

  for (const buildingId of builtBuildingIds) {
    const district = getBuildingDistrict(buildingId);
    routes.push({
      id: `service:${buildingId}`,
      kind: "service",
      points: [civicGround, DISTRICT_JUNCTIONS[district], getBuildingPosition(buildingId)],
      speed: CITY_ANIMATION.routes.serviceSpeed,
    });
  }
  for (const [fromId, toId] of SUPPLY_LINKS) {
    if (!built.has(fromId) || !built.has(toId)) continue;
    routes.push({ id: `supply:${fromId}:${toId}`, kind: "supply", points: getRoadRoute(fromId, toId), speed: CITY_ANIMATION.routes.supplySpeed });
  }
  if (built.has("marketplace")) {
    for (const supplierId of ["sawmill", "bakery", "butchery", "winery"]) {
      if (built.has(supplierId)) routes.push({
        id: `trade:${supplierId}`,
        kind: "civic",
        points: getRoadRoute(supplierId, "marketplace"),
        speed: CITY_ANIMATION.routes.tradeSpeed,
      });
    }
  }
  if (built.has("house") && built.has("marketplace")) routes.push({
    id: "civic:house:marketplace",
    kind: "civic",
    points: getRoadRoute("house", "marketplace"),
    speed: CITY_ANIMATION.routes.civicSpeed,
  });

  if (routes.length === 0) routes.push({
    id: "founders",
    kind: "civic",
    points: [new THREE.Vector2(5.2, 0.1), new THREE.Vector2(2.2, 0.05), civicGround],
    speed: CITY_ANIMATION.routes.serviceSpeed,
  });
  return routes;
}

/** Total length of a polyline in world units. */
function routeLength(points: THREE.Vector2[]): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) total += points[index - 1].distanceTo(points[index]);
  return total;
}

/**
 * Writes the point `progress` (0–1) of the way along a polyline into `out`,
 * and returns the x-direction of the segment it lies on (for sprite flipping).
 * `total` is the precomputed `routeLength(points)`; `out` is reused to avoid a
 * per-villager, per-frame allocation.
 */
function samplePolyline(points: THREE.Vector2[], total: number, progress: number, out: THREE.Vector2): number {
  let remaining = progress * total;
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1];
    const to = points[index];
    const segmentLength = from.distanceTo(to);
    if (remaining <= segmentLength || index === points.length - 1) {
      const segmentProgress = segmentLength > 0 ? Math.min(1, remaining / segmentLength) : 1;
      out.copy(from).lerp(to, segmentProgress);
      return to.x - from.x;
    }
    remaining -= segmentLength;
  }
  out.copy(points[points.length - 1]);
  return 1;
}

/**
 * Converts a looping clock into an out-and-back trip with a short pause at
 * each end (`endpointDwellFraction` of the cycle). `progress` is 0 at the
 * route start and 1 at its end; `outbound` says which way the villager faces.
 */
function pingPongProgress(elapsed: number, duration: number): { progress: number; moving: boolean; outbound: boolean } {
  const phase = (elapsed % duration) / duration;
  const dwell = CITY_ANIMATION.routes.endpointDwellFraction;
  const travel = 0.5 - dwell;
  if (phase < dwell) return { progress: 0, moving: false, outbound: true };
  if (phase < 0.5) return { progress: (phase - dwell) / travel, moving: true, outbound: true };
  if (phase < 0.5 + dwell) return { progress: 1, moving: false, outbound: false };
  return { progress: 1 - (phase - 0.5 - dwell) / travel, moving: true, outbound: false };
}

/**
 * Functional population renderer: citizens commute, deliver goods, then form the final army.
 *
 * Each villager owns a *clone* of the walk-sheet texture. Sharing one texture
 * would be cheaper, but Three.js stores the frame offset on the texture itself,
 * so every villager would show whichever frame was set last.
 */
export function createVillagerField(scene: THREE.Scene, workerAnimation: WorkerAnimation) {
  const villagers: Villager[] = [];
  let muster: { report: ArmyReport; startedAt: number } | null = null;

  // Routes only change when a building completes, but used to be rebuilt (and
  // measured twice per villager) on every frame. They're now cached per build order.
  let routeKey: string | null = null;
  let routes: WorkRoute[] = [];
  let routeLengths: number[] = [];
  const sampled = new THREE.Vector2();

  function routesFor(builtBuildingIds: string[]): void {
    const key = builtBuildingIds.join("|");
    if (key === routeKey) return;
    routeKey = key;
    routes = buildFunctionalRoutes(builtBuildingIds);
    routeLengths = routes.map((route) => routeLength(route.points));
  }

  function createVillager(index: number): Villager {
    const walk = workerAnimation.getWalkClip();
    const texture = walk.texture.clone();
    texture.needsUpdate = true;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(material);
    const scale = 0.9 + (index % 4) * 0.035;
    sprite.scale.set(scale, scale, 1);
    sprite.renderOrder = 40 + index;
    scene.add(sprite);
    return { sprite, material, texture, phase: (index * 0.61803398875) % 1, speedVariation: 0.92 + (index % 7) * 0.025 };
  }

  /** Grows the crowd to `targetPopulation` (creating sprites as needed) and hides any extras. */
  function syncVillagers(targetPopulation: number): void {
    while (villagers.length < targetPopulation) villagers.push(createVillager(villagers.length));
    villagers.forEach((villager, index) => { villager.sprite.visible = index < targetPopulation; });
  }

  /** Switches from commuting to the end-of-campaign formation. */
  function beginArmyMuster(report: ArmyReport, animationElapsed: number): void {
    muster = { report, startedAt: animationElapsed };
  }

  /** Returns to commuting (on restart) and clears army tinting. */
  function clearArmyMuster(): void {
    muster = null;
    for (const villager of villagers) villager.material.color.setHex(0xffffff);
  }

  /**
   * Army formation: the first `totalUnits` visible villagers glide into a block
   * in front of the Town Hall (veterans gold, archers green), and the rest orbit as civilians.
   */
  function renderMuster(animationElapsed: number): void {
    if (!muster) return;
    const armyCount = Math.min(muster.report.totalUnits, villagers.filter((villager) => villager.sprite.visible).length);
    const assembly = THREE.MathUtils.smoothstep(Math.min(1, (animationElapsed - muster.startedAt) / CITY_ANIMATION.muster.assemblySeconds), 0, 1);
    const origin = new THREE.Vector2(civicGround.x + 0.2, civicGround.y - 2.0);
    const columns = Math.min(6, Math.max(3, Math.ceil(Math.sqrt(Math.max(armyCount, 1)))));
    for (let index = 0; index < villagers.length; index += 1) {
      const villager = villagers[index];
      if (!villager.sprite.visible) continue;
      if (index < armyCount) {
        const row = Math.floor(index / columns);
        const column = index % columns;
        const targetX = origin.x + (column - (Math.min(columns, armyCount - row * columns) - 1) / 2) * CITY_ANIMATION.muster.formationSpacingX;
        const targetY = origin.y - row * CITY_ANIMATION.muster.formationSpacingY;
        villager.sprite.position.x = THREE.MathUtils.lerp(villager.sprite.position.x, targetX, 0.04 + assembly * 0.08);
        villager.sprite.position.y = THREE.MathUtils.lerp(villager.sprite.position.y, targetY + 0.5, 0.04 + assembly * 0.08);
        villager.material.color.setHex(index < muster.report.units.veterans ? 0xd9b15e : index < muster.report.units.veterans + muster.report.units.archers ? 0x8faf75 : 0xd8d2bd);
        villager.sprite.scale.x = Math.abs(villager.sprite.scale.x);
        setTextureFrame(villager.texture, Math.floor(animationElapsed * 3 + index));
      } else {
        const angle = animationElapsed * CITY_ANIMATION.muster.civilianOrbitSpeed + villager.phase * Math.PI * 2;
        villager.sprite.position.set(civicGround.x + Math.cos(angle) * 4.2, civicGround.y + Math.sin(angle) * 1.9 + 0.5, 2.4);
      }
    }
  }

  /** Per-frame: positions, flips, tints, and animates every visible villager. */
  function renderVillagers(animationElapsed: number, builtBuildingIds: string[]): void {
    if (muster) {
      renderMuster(animationElapsed);
      return;
    }
    routesFor(builtBuildingIds);
    for (let index = 0; index < villagers.length; index += 1) {
      const villager = villagers[index];
      if (!villager.sprite.visible) continue;
      const routeIndex = index % routes.length;
      const route = routes[routeIndex];
      const length = routeLengths[routeIndex];
      const staggered = animationElapsed + villager.phase * Math.max(4, length / route.speed);
      const duration = Math.max(4.5, (length * 2) / (route.speed * villager.speedVariation));
      const journey = pingPongProgress(staggered, duration);
      const direction = samplePolyline(route.points, length, journey.progress, sampled);
      villager.sprite.position.set(sampled.x, sampled.y + 0.5, 2.4);
      villager.sprite.scale.x = Math.abs(villager.sprite.scale.x) * ((direction >= 0) === journey.outbound ? 1 : -1);
      villager.material.color.setHex(route.kind === "supply" ? 0xe4d2a0 : route.kind === "civic" ? 0xc9d9b0 : 0xffffff);
      const fps = journey.moving ? CITY_ANIMATION.routes.walkingFps + (index % 3) : CITY_ANIMATION.routes.workingFps;
      setTextureFrame(villager.texture, Math.floor(animationElapsed * fps + index));
    }
  }

  return { syncVillagers, renderVillagers, beginArmyMuster, clearArmyMuster };
}
