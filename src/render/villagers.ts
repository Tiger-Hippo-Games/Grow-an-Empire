import * as THREE from "three";
import { createCityTraffic } from "./cityTraffic";
import { routeLength, sampleRoute } from "./routeSampler";
import type { TrainedUnits } from "../game/settlementSimulation";
import { civicGround, getBuildingPosition, getRoadRoute, getServiceRoute } from "./cityLayout";
import { CITY_ANIMATION } from "./animationDesign";
import { directionFromVector, roleForBuilding, WALK_CELL_ASPECT, WORK_CELL_ASPECT, type CharacterAssets, type CharacterRole, type WalkDirection } from "./characterAssets";

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
}

interface GarrisonSoldier {
  sprite: THREE.Sprite;
  role: "swordsman" | "archer" | "horseman";
  bornAt: number | null;
  frame: number;
  route: THREE.Vector2[];
  routeLength: number;
}

const SUPPLY_LINKS: Array<[string, string]> = [
  ["woodcutter", "sawmill"], ["farm", "bakery"], ["farm", "granary"],
  ["swine-farm", "butchery"], ["fruit-orchard", "winery"],
  ["quarry", "blacksmith"], ["blacksmith", "weapons-workshop"], ["blacksmith", "barracks"], ["weapons-workshop", "barracks"],
  ["blacksmith", "stable"], ["weapons-workshop", "stable"],
  ["baoli", "farm"], ["stable", "gajashala"], ["quarry", "prakara"],
  ["sawmill", "burj"], ["marketplace", "sarai"], ["marketplace", "koshagar"], ["house", "dharmashala"],
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

/** Shared cached sampling for troops as well as the civilian traffic model. */
const sampledTangent = new THREE.Vector2();
function samplePolyline(points: THREE.Vector2[], total: number, progress: number, out: THREE.Vector2): WalkDirection {
  sampleRoute(points, total * progress, out, sampledTangent);
  return directionFromVector(sampledTangent.x, sampledTangent.y);
}

/**
 * Crowd spacing (0.10.3). Everyone's service route starts at the Town Hall, so
 * without these the whole workforce met and dwelt on one spot. Each villager
 * gets its own lane beside the road centre line, and stops short of the hall
 * at its own distance, so the crowd spreads into short queues along the
 * approaches instead of piling up on the hall.
 */
export const CROWD = {
  /** Lane offsets beside the road's centre line, in world units (scaled by road width). */
  lanes: [-0.3, 0.15, -0.08, 0.3, -0.2, 0.06, 0.22, -0.34] as const,
  /** How far before the Town Hall a villager stops: base + slot × step (world units). */
  hallStopBase: 1.5,
  hallStopStep: 0.42,
  hallStopSlots: 6,
  /** World units walked per full 4-pose stride cycle, for a villager of size 2.15. */
  strideLength: 1.25,
  /** Peak of the walking bob, in world units. */
  bobHeight: 0.045,
  /** Work loop speed (frames per crowd-clock second). */
  workFps: 7,
} as const;

/** Lane offset for villager `index`. */
export function laneOffset(index: number): number {
  return CROWD.lanes[index % CROWD.lanes.length];
}

/** Distance short of the Town Hall where villager `index` waits (never more than 40% of the route). */
export function hallStop(index: number, routeLength: number): number {
  const wanted = CROWD.hallStopBase + ((index * 5) % CROWD.hallStopSlots) * CROWD.hallStopStep;
  return Math.min(wanted, routeLength * 0.4);
}

/**
 * Walk pose and bob from the distance walked along the current leg, so feet
 * keep pace with the ground at every speed (no sliding, no frantic flicker).
 * Two steps per 4-pose cycle; the bob peaks mid-step.
 */
export function strideFrame(distance: number, size: number): { frame: number; cycle: number; bob: number } {
  const stride = CROWD.strideLength * (size / 2.15);
  const cycle = Math.max(0, distance) / stride;
  const frame = Math.floor(cycle * 4) % 4;
  const bob = CROWD.bobHeight * (size / 2.15) * (1 - Math.cos(cycle * Math.PI * 4)) * 0.5;
  return { frame, cycle, bob };
}

/**
 * Functional population renderer: citizens commute and deliver goods; trained soldiers
 * stand still in the garrison. (The battle itself is shown in the muster popup: render/popupBattle.ts.)
 *
 * Citizens share each profession's directional atlas frames but own materials, so
 * their walking phases can differ without cloning a texture per villager.
 */
export function createVillagerField(scene: THREE.Scene, characters: CharacterAssets) {
  const villagers: Villager[] = [];
  const garrison: GarrisonSoldier[] = [];
  let combatActive = false;
  let lastGarrisonElapsed: number | null = null;

  // Routes only change when a building completes, but used to be rebuilt (and
  // measured twice per villager) on every frame. They're now cached per build order.
  let routeKey = -1;
  let routes: WorkRoute[] = [];
  const traffic = createCityTraffic(hallStop);
  let targetCivilianCount = 0;
  let lastCrowdElapsed: number | null = null;
  let routesById = new Map<string, WorkRoute>();
  const sampled = new THREE.Vector2();

  // The build list only grows during a run and is a new array after a restart
  // or load, so (array, length) identifies it without joining a string every frame.
  let routeSource: string[] | null = null;
  function routesFor(builtBuildingIds: string[]): void {
    if (builtBuildingIds === routeSource && builtBuildingIds.length === routeKey) return;
    routeSource = builtBuildingIds;
    routeKey = builtBuildingIds.length;
    routes = buildFunctionalRoutes(builtBuildingIds);
    routesById = new Map(routes.map(route => [route.id, route]));
  }

  function createVillager(index: number): Villager {
    const material = new THREE.SpriteMaterial({ map: characters.getFrame("builder", 0), transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(material);
    const scale = 2.15 + (index % 4) * 0.08;
    sprite.scale.set(scale * WALK_CELL_ASPECT, scale, 1);
    sprite.renderOrder = 40 + (index % 4);
    scene.add(sprite);
    return { sprite, material, profession: "builder", frame: 0, baseSize: scale, phase: (index * 0.61803398875) % 1 };
  }

  function setProfession(villager: Villager, profession: CharacterRole): void {
    if (villager.profession === profession) return;
    villager.profession = profession;
    villager.frame = -1;
    const size = villager.baseSize * (profession === "horseman" ? 1.35 : 1);
    villager.sprite.scale.set(size * WALK_CELL_ASPECT, size, 1);
  }

  /** `frame`: a 4-pose step (or a work-loop step when `working`); `cycle`, when given, picks the walk pose by stride position. */
  function setFrame(villager: Villager, frame: number, direction: WalkDirection = 4, working = false, cycle?: number): void {
    const normalized = ((Math.floor(frame) % 4) + 4) % 4;
    villager.frame = normalized;
    const texture = working ? characters.getWorkFrame(villager.profession, frame) : null;
    const next = texture ?? (cycle === undefined
      ? characters.getFrame(villager.profession, normalized, direction)
      : characters.getWalkFrame(villager.profession, cycle, direction));
    villager.sprite.scale.x = villager.sprite.scale.y * (texture ? WORK_CELL_ASPECT : WALK_CELL_ASPECT);
    if (villager.material.map !== next) {
      villager.material.map = next;
      villager.material.needsUpdate = true;
    }
  }

  const residentialRoles: CharacterRole[] = ["builder", "farmer", "woodcutter", "quarry"];
  function routeProfession(route: WorkRoute, index: number): CharacterRole {
    return route.id === "service:house" ? residentialRoles[index % residentialRoles.length] : route.profession;
  }

  /** Grows the crowd to `targetPopulation` (creating sprites as needed) and hides any extras. */
  function syncVillagers(targetPopulation: number): void {
    // Longer campaigns can have hundreds of citizens. A representative crowd
    // keeps rendering bounded; the simulation and HUD retain the full totals.
    targetPopulation = Math.min(targetPopulation, 80);
    targetCivilianCount = targetPopulation;
    while (villagers.length < targetPopulation) villagers.push(createVillager(villagers.length));
    villagers.forEach((villager, index) => { villager.sprite.visible = index < targetPopulation; });
  }

  function garrisonTarget(role: GarrisonSoldier["role"], index: number, swordsmen: number, archers: number, out = new THREE.Vector2()): THREE.Vector2 {
    const precedingRows = role === "archer" ? Math.ceil(Math.min(swordsmen, 14) / 7) : role === "horseman" ? Math.ceil(Math.min(swordsmen, 14) / 7) + Math.ceil(Math.min(archers, 14) / 7) : 0;
    const row = Math.floor(index / 7) + precedingRows;
    const column = index % 7;
    const tower = getBuildingPosition("prakara");
    return out.set(tower.x + 5 + column * (role === "horseman" ? 1.85 : 1.35), tower.y + 1.5 + row * 1.2);
  }
  const garrisonSpot = new THREE.Vector2();

  /** Each trained soldier travels to the formation beside the Prakara watchtower. */
  function syncGarrison(units: TrainedUnits, animationElapsed?: number, builtBuildingIds: string[] = []): void {
    if (["swordsman", "archer", "horseman"].some((role) => garrison.filter((soldier) => soldier.role === role).length > units[role === "swordsman" ? "swordsmen" : role === "archer" ? "archers" : "horsemen"])) {
      for (const soldier of garrison) { scene.remove(soldier.sprite); soldier.sprite.material.dispose(); }
      garrison.length = 0;
    }
    for (const role of ["swordsman", "archer", "horseman"] as const) {
      const targetCount = Math.min(14, units[role === "swordsman" ? "swordsmen" : role === "archer" ? "archers" : "horsemen"]);
      let currentCount = garrison.filter((soldier) => soldier.role === role).length;
      while (currentCount < targetCount) {
        const size = role === "horseman" ? 2.95 : 2.15;
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: characters.getFrame(role, 0), transparent: true, depthTest: false }));
        const destination = garrisonTarget(role, currentCount, units.swordsmen, units.archers);
        const source = role === "horseman" ? "stable" : builtBuildingIds.includes("barracks") ? "barracks" : role === "archer" ? "weapons-workshop" : "blacksmith";
        const route = [...getServiceRoute(source).reverse(), ...getServiceRoute("prakara").slice(1), destination];
        const origin = animationElapsed === undefined ? destination : getBuildingPosition(source);
        sprite.scale.set(size * WALK_CELL_ASPECT, size, 1);
        sprite.position.set(origin.x, origin.y + size / 2, 2.6);
        sprite.renderOrder = 60 + Math.floor(currentCount / 5);
        sprite.visible = !combatActive;
        scene.add(sprite);
        garrison.push({ sprite, role, bornAt: animationElapsed ?? null, frame: 0, route, routeLength: routeLength(route) });
        currentCount += 1;
      }
    }
    if (animationElapsed === undefined) {
      lastGarrisonElapsed = null;
      let swordIndex = 0;
      let archerIndex = 0;
      let horseIndex = 0;
      for (const soldier of garrison) {
        const index = soldier.role === "swordsman" ? swordIndex++ : soldier.role === "archer" ? archerIndex++ : horseIndex++;
        const target = garrisonTarget(soldier.role, index, units.swordsmen, units.archers);
        soldier.bornAt = null;
        soldier.sprite.position.set(target.x, target.y + soldier.sprite.scale.y / 2, 2.6);
        soldier.sprite.material.map = characters.getFrame(soldier.role, 0, 4);
        soldier.sprite.scale.x = soldier.sprite.scale.y * WALK_CELL_ASPECT;
        soldier.sprite.material.needsUpdate = true;
        soldier.frame = 0;
      }
    }
  }

  function renderGarrison(animationElapsed: number): void {
    const delta = lastGarrisonElapsed === null ? 1 / 60 : Math.max(0, animationElapsed - lastGarrisonElapsed);
    lastGarrisonElapsed = animationElapsed;
    const blend = 1 - Math.pow(0.84, delta * 60);
    let swordsmen = 0;
    let archers = 0;
    for (const soldier of garrison) {
      if (soldier.role === "swordsman") swordsmen += 1;
      else if (soldier.role === "archer") archers += 1;
    }
    let swordIndex = 0;
    let archerIndex = 0;
    let horseIndex = 0;
    for (const soldier of garrison) {
      if (!soldier.sprite.visible) continue;
      const index = soldier.role === "swordsman" ? swordIndex++ : soldier.role === "archer" ? archerIndex++ : horseIndex++;
      const target = garrisonTarget(soldier.role, index, swordsmen, archers, garrisonSpot);
      if (soldier.bornAt !== null) {
        const travel = (animationElapsed - soldier.bornAt) / (soldier.routeLength / 5.5);
        if (travel < 1) {
          const direction = samplePolyline(soldier.route, soldier.routeLength, Math.max(0, travel), sampled);
          soldier.sprite.position.set(sampled.x, sampled.y + soldier.sprite.scale.y / 2, 2.6);
          const stride = strideFrame(Math.max(0, travel) * soldier.routeLength, soldier.sprite.scale.y);
          const frame = stride.frame;
          const texture = characters.getWalkFrame(soldier.role, stride.cycle, direction);
          soldier.sprite.position.y += stride.bob;
          soldier.sprite.material.rotation = Math.sin(stride.cycle * Math.PI * 2) * .018;
          soldier.sprite.scale.x = soldier.sprite.scale.y * WALK_CELL_ASPECT;
          if (soldier.sprite.material.map !== texture) {
            soldier.frame = frame;
            soldier.sprite.material.map = texture;
            soldier.sprite.material.needsUpdate = true;
          }
          continue;
        }
        soldier.bornAt = null;
        soldier.sprite.position.set(target.x, target.y + soldier.sprite.scale.y / 2, 2.6);
        soldier.sprite.material.map = characters.getFrame(soldier.role, 0, 4);
        soldier.sprite.scale.x = soldier.sprite.scale.y * WALK_CELL_ASPECT;
        soldier.sprite.material.needsUpdate = true;
        soldier.frame = 0;
      }
      soldier.sprite.position.x = THREE.MathUtils.lerp(soldier.sprite.position.x, target.x, blend);
      soldier.sprite.position.y = THREE.MathUtils.lerp(soldier.sprite.position.y, target.y + soldier.sprite.scale.y / 2, blend);
      const nearLine = Math.hypot(target.x - soldier.sprite.position.x, target.y + soldier.sprite.scale.y / 2 - soldier.sprite.position.y) < 0.2;
      soldier.sprite.material.rotation = nearLine ? Math.sin(animationElapsed * 1.7 + index * 2.4) * .004 : 0;
      // In formation the army stands at ease (still, facing the viewer); it only strikes in the battle.
      const texture = nearLine
        ? characters.getFrame(soldier.role, 0, 4)
        : characters.getFrame(soldier.role, Math.floor(animationElapsed * 7 + index), directionFromVector(target.x - soldier.sprite.position.x, target.y + soldier.sprite.scale.y / 2 - soldier.sprite.position.y));
      soldier.sprite.scale.x = soldier.sprite.scale.y * WALK_CELL_ASPECT;
      if (soldier.sprite.material.map !== texture) {
        soldier.sprite.material.map = texture;
        soldier.sprite.material.needsUpdate = true;
      }
    }
  }

  /** Back to commuting (a new run, or after the battle): everyone visible, untinted. */
  function clearArmyMuster(): void {
    combatActive = false;
    traffic.reset(); lastCrowdElapsed = null; routeSource = null; routeKey = -1;
    for (const soldier of garrison) soldier.sprite.visible = true;
    villagers.forEach((villager, index) => { villager.sprite.visible = index < targetCivilianCount; villager.material.color.setHex(0xffffff); });
  }

  function setCombatActive(value: boolean): void {
    combatActive = value;
    for (const villager of villagers) villager.sprite.visible = !value;
    for (const soldier of garrison) soldier.sprite.visible = false;
  }

  /** Passing lanes widen with the same eased road scale as the painted paths. */
  function setRoadScale(scale: number): void { traffic.setLaneScale(scale); }

  /**
   * Per-frame: positions, flips, tints, and animates every visible villager.
   * `crowdElapsed` is the commuters' own clock (main.ts advances it more gently
   * than game speed, so 8× doesn't make the crowd frantic); it defaults to the
   * animation clock.
   */
  function renderVillagers(animationElapsed: number, builtBuildingIds: string[], crowdElapsed: number = animationElapsed): void {
    if (combatActive) return;
    renderGarrison(crowdElapsed);
    routesFor(builtBuildingIds);
    traffic.sync(routes, targetCivilianCount);
    traffic.advance(lastCrowdElapsed === null ? 0 : Math.max(0, crowdElapsed - lastCrowdElapsed));
    lastCrowdElapsed = crowdElapsed;
    for (const actor of traffic.actors) {
      const villager = villagers[actor.id];
      if (!villager.sprite.visible) continue;
      const route = routesById.get(actor.route.id)!;
      setProfession(villager, routeProfession(route, actor.id));
      const direction = directionFromVector(actor.dx, actor.dy);
      const size = villager.baseSize * (villager.profession === "horseman" ? 1.35 : 1);
      const stride = strideFrame(actor.stride, size);
      villager.sprite.scale.y = size * (1 + Math.sin(crowdElapsed * 1.8 + villager.phase * Math.PI * 2) * .006);
      villager.material.rotation = Math.sin(crowdElapsed * 1.7 + villager.phase * Math.PI * 2) * .006;
      if (actor.working) setFrame(villager, Math.floor(crowdElapsed * CROWD.workFps + villager.phase * 8), direction, true);
      else if (actor.moving || actor.waiting) setFrame(villager, stride.frame, direction, false, stride.cycle);
      else setFrame(villager, 0, direction, false);
      if (actor.moving) villager.material.rotation = Math.sin(stride.cycle * Math.PI * 2) * .022;
      villager.sprite.position.set(actor.x, actor.y + size / 2 + (actor.moving ? stride.bob : 0), 2.4);
      villager.sprite.renderOrder = 40 + Math.max(0, Math.min(19, Math.round(10 - actor.y * .45)));
      villager.material.color.setHex(0xffffff);
    }
  }

  return { syncVillagers, syncGarrison, renderVillagers, clearArmyMuster, setCombatActive, setRoadScale };
}
