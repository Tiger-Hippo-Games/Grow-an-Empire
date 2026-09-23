import * as THREE from "three";
import type { ArmyReport, TrainedUnits } from "../game/settlementSimulation";
import { civicGround, getBuildingPosition, getRoadRoute, getServiceRoute } from "./cityLayout";
import { CITY_ANIMATION } from "./animationDesign";
import { roleForArmyUnitAtIndex, roleForBuilding, type CharacterAssets, type CharacterRole } from "./characterAssets";

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
  profession: CharacterRole;
  points: THREE.Vector2[];
  speed: number;
}

interface Villager {
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
  profession: CharacterRole;
  frame: number;
  baseSize: number;
  phase: number;
  speedVariation: number;
}

const SUPPLY_LINKS: Array<[string, string]> = [
  ["woodcutter", "sawmill"], ["farm", "bakery"], ["farm", "granary"],
  ["swine-farm", "butchery"], ["fruit-orchard", "winery"],
  ["quarry", "blacksmith"], ["blacksmith", "weapons-workshop"], ["blacksmith", "barracks"], ["weapons-workshop", "barracks"],
];

/**
 * Pure route plan for the current build order: the visible workforce only uses
 * roads that exist. With nothing built yet, the founder stays at the civic
 * clearing until a route is revealed. Villager N walks route `N % routes.length`.
 */
export function buildFunctionalRoutes(builtBuildingIds: string[]): WorkRoute[] {
  const built = new Set(builtBuildingIds);
  const routes: WorkRoute[] = [];

  for (const buildingId of builtBuildingIds) {
    routes.push({
      id: `service:${buildingId}`,
      kind: "service",
      profession: roleForBuilding(buildingId),
      points: getServiceRoute(buildingId),
      speed: CITY_ANIMATION.routes.serviceSpeed,
    });
  }
  for (const [fromId, toId] of SUPPLY_LINKS) {
    if (!built.has(fromId) || !built.has(toId)) continue;
    routes.push({
      id: `supply:${fromId}:${toId}`,
      kind: "supply",
      profession: fromId === "quarry" ? "miner" : toId === "barracks" ? "spearman" : roleForBuilding(fromId),
      points: getRoadRoute(fromId, toId),
      speed: CITY_ANIMATION.routes.supplySpeed,
    });
  }
  if (built.has("marketplace")) {
    for (const supplierId of ["sawmill", "bakery", "butchery", "winery"]) {
      if (built.has(supplierId)) routes.push({
        id: `trade:${supplierId}`,
        kind: "civic",
        profession: "merchant",
        points: getRoadRoute(supplierId, "marketplace"),
        speed: CITY_ANIMATION.routes.tradeSpeed,
      });
    }
  }
  if (built.has("house") && built.has("marketplace")) routes.push({
    id: "civic:house:marketplace",
    kind: "civic",
    profession: "merchant",
    points: getRoadRoute("house", "marketplace"),
    speed: CITY_ANIMATION.routes.civicSpeed,
  });

  if (routes.length === 0) routes.push({
    id: "founders",
    kind: "civic",
    profession: "builder",
    points: [civicGround],
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
  if (points.length === 1) {
    out.copy(points[0]);
    return 1;
  }
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
 * Citizens share each profession's four frame textures but own materials, so
 * their walking phases can differ without cloning a texture per villager.
 */
export function createVillagerField(scene: THREE.Scene, characters: CharacterAssets) {
  const villagers: Villager[] = [];
  const garrison: THREE.Sprite[] = [];
  let muster: { report: ArmyReport; startedAt: number } | null = null;
  let combatActive = false;
  const musterOrigin = new THREE.Vector2(civicGround.x + 0.2, civicGround.y - 2.0);
  let lastMusterElapsed: number | null = null;

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
    const material = new THREE.SpriteMaterial({ map: characters.getFrame("builder", 0), transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(material);
    const scale = 2.15 + (index % 4) * 0.08;
    sprite.scale.set(scale, scale, 1);
    sprite.renderOrder = 40 + (index % 4);
    scene.add(sprite);
    return { sprite, material, profession: "builder", frame: 0, baseSize: scale, phase: (index * 0.61803398875) % 1, speedVariation: 0.92 + (index % 7) * 0.025 };
  }

  function setProfession(villager: Villager, profession: CharacterRole): void {
    if (villager.profession === profession) return;
    villager.profession = profession;
    villager.frame = -1;
    const size = villager.baseSize * (profession === "horseman" ? 1.35 : 1);
    villager.sprite.scale.set(size, size, 1);
  }

  function setFrame(villager: Villager, frame: number): void {
    const normalized = ((Math.floor(frame) % 4) + 4) % 4;
    if (villager.frame === normalized) return;
    villager.frame = normalized;
    villager.material.map = characters.getFrame(villager.profession, normalized);
    villager.material.needsUpdate = true;
  }

  const residentialRoles: CharacterRole[] = ["builder", "farmer", "woodcutter", "quarry"];
  function routeProfession(route: WorkRoute, index: number): CharacterRole {
    return route.id === "service:house" ? residentialRoles[index % residentialRoles.length] : route.profession;
  }

  /** Grows the crowd to `targetPopulation` (creating sprites as needed) and hides any extras. */
  function syncVillagers(targetPopulation: number): void {
    while (villagers.length < targetPopulation) villagers.push(createVillager(villagers.length));
    villagers.forEach((villager, index) => { villager.sprite.visible = index < targetPopulation; });
  }

  /** Keep every earned archer and swordsman visible in the clearing outside the Barracks plot. */
  function syncGarrison(units: TrainedUnits): void {
    for (const sprite of garrison) {
      scene.remove(sprite);
      sprite.material.dispose();
    }
    garrison.length = 0;
    const barracks = getBuildingPosition("barracks");
    const roles: CharacterRole[] = [
      ...Array<CharacterRole>(units.swordsmen).fill("swordsman"),
      ...Array<CharacterRole>(units.archers).fill("archer"),
    ];
    roles.forEach((role, index) => {
      const size = 2.15;
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: characters.getFrame(role, 0), transparent: true, depthTest: false }));
      const column = index % 3;
      const row = Math.floor(index / 3);
      sprite.scale.set(size, size, 1);
      sprite.position.set(barracks.x + 3.4 + column * 1.1, barracks.y + 0.25 + row * 1.15 + size / 2, 2.6);
      sprite.renderOrder = 60 + row;
      sprite.visible = muster === null;
      scene.add(sprite);
      garrison.push(sprite);
    });
  }

  /** Switches from commuting to the end-of-campaign formation. */
  function beginArmyMuster(report: ArmyReport, animationElapsed: number): void {
    muster = { report, startedAt: animationElapsed };
    lastMusterElapsed = null;
    for (const soldier of garrison) soldier.visible = false;
  }

  /** Returns to commuting on restart. */
  function clearArmyMuster(): void {
    muster = null;
    combatActive = false;
    for (const soldier of garrison) soldier.visible = true;
    for (const villager of villagers) { villager.sprite.visible = true; villager.material.color.setHex(0xffffff); }
  }

  function setCombatActive(value: boolean): void {
    combatActive = value;
    for (const villager of villagers) villager.sprite.visible = !value;
    for (const soldier of garrison) soldier.visible = false;
  }

  /**
   * Army formation: the first `totalUnits` visible villagers glide into a block
   * in front of the Town Hall using each unit's own art.
   */
  function renderMuster(animationElapsed: number): void {
    if (!muster) return;
    let visibleCount = 0;
    for (const villager of villagers) if (villager.sprite.visible) visibleCount += 1;
    const armyCount = Math.min(muster.report.totalUnits, visibleCount);
    const assembly = THREE.MathUtils.smoothstep(Math.min(1, (animationElapsed - muster.startedAt) / CITY_ANIMATION.muster.assemblySeconds), 0, 1);
    const origin = musterOrigin;
    // Time-based easing (THREEJS_STANDARDS §15): the old per-frame factor
    // (0.04-0.12 at 60 fps) converted to a rate, so 120 Hz screens aren't faster.
    const dt = lastMusterElapsed === null ? 1 / 60 : Math.max(0, animationElapsed - lastMusterElapsed);
    lastMusterElapsed = animationElapsed;
    const perFrame = 0.04 + assembly * 0.08;
    const blend = 1 - Math.pow(1 - perFrame, dt * 60);
    const columns = Math.min(6, Math.max(3, Math.ceil(Math.sqrt(Math.max(armyCount, 1)))));
    for (let index = 0; index < villagers.length; index += 1) {
      const villager = villagers[index];
      if (!villager.sprite.visible) continue;
      if (index < armyCount) {
        const profession = roleForArmyUnitAtIndex(muster.report.units, index);
        setProfession(villager, profession);
        setFrame(villager, assembly < 0.96 ? Math.floor(animationElapsed * 7 + villager.phase * 4) : 0);
        const row = Math.floor(index / columns);
        const column = index % columns;
        const targetX = origin.x + (column - (Math.min(columns, armyCount - row * columns) - 1) / 2) * CITY_ANIMATION.muster.formationSpacingX;
        const targetY = origin.y - row * CITY_ANIMATION.muster.formationSpacingY;
        villager.sprite.position.x = THREE.MathUtils.lerp(villager.sprite.position.x, targetX, blend);
        villager.sprite.position.y = THREE.MathUtils.lerp(villager.sprite.position.y, targetY + Math.abs(villager.sprite.scale.y) / 2, blend);
        villager.material.color.setHex(0xffffff);
        villager.sprite.scale.x = Math.abs(villager.sprite.scale.x);
      } else {
        setProfession(villager, "builder");
        setFrame(villager, Math.floor(animationElapsed * 6 + villager.phase * 4));
        const angle = animationElapsed * CITY_ANIMATION.muster.civilianOrbitSpeed + villager.phase * Math.PI * 2;
        villager.sprite.position.set(civicGround.x + Math.cos(angle) * 4.2, civicGround.y + Math.sin(angle) * 1.9 + Math.abs(villager.sprite.scale.y) / 2, 2.4);
      }
    }
  }

  /** Per-frame: positions, flips, tints, and animates every visible villager. */
  function renderVillagers(animationElapsed: number, builtBuildingIds: string[]): void {
    if (combatActive) return;
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
      setProfession(villager, routeProfession(route, index));
      const length = routeLengths[routeIndex];
      const staggered = animationElapsed + villager.phase * Math.max(4, length / route.speed);
      const duration = Math.max(4.5, (length * 2) / (route.speed * villager.speedVariation));
      const journey = pingPongProgress(staggered, duration);
      setFrame(villager, journey.moving && length > 0 ? Math.floor(animationElapsed * 7 + villager.phase * 4) : 0);
      const direction = samplePolyline(route.points, length, journey.progress, sampled);
      const stepLift = journey.moving && length > 0 && villager.frame % 2 === 1 ? 0.055 : 0;
      villager.sprite.position.set(sampled.x, sampled.y + Math.abs(villager.sprite.scale.y) / 2 + stepLift, 2.4);
      villager.sprite.scale.x = Math.abs(villager.sprite.scale.x) * ((direction >= 0) === journey.outbound ? 1 : -1);
      villager.material.color.setHex(0xffffff);
    }
  }

  return { syncVillagers, syncGarrison, renderVillagers, beginArmyMuster, clearArmyMuster, setCombatActive };
}
