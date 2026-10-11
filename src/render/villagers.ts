import * as THREE from "three";
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
  speedVariation: number;
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
 * and returns the direction of the segment it lies on.
 * `total` is the precomputed `routeLength(points)`; `out` is reused to avoid a
 * per-villager, per-frame allocation.
 */
function samplePolyline(points: THREE.Vector2[], total: number, progress: number, out: THREE.Vector2, normal?: THREE.Vector2): WalkDirection {
  if (points.length === 1) {
    out.copy(points[0]);
    normal?.set(1, 0);
    return 4;
  }
  let remaining = progress * total;
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1];
    const to = points[index];
    const segmentLength = from.distanceTo(to);
    if (remaining <= segmentLength || index === points.length - 1) {
      const segmentProgress = segmentLength > 0 ? Math.min(1, remaining / segmentLength) : 1;
      out.copy(from).lerp(to, segmentProgress);
      if (normal && segmentLength > 0) normal.set(-(to.y - from.y) / segmentLength, (to.x - from.x) / segmentLength);
      return directionFromVector(to.x - from.x, to.y - from.y);
    }
    remaining -= segmentLength;
  }
  out.copy(points[points.length - 1]);
  return 4;
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
  let routeLengths: number[] = [];
  const sampled = new THREE.Vector2();

  // The build list only grows during a run and is a new array after a restart
  // or load, so (array, length) identifies it without joining a string every frame.
  let routeSource: string[] | null = null;
  function routesFor(builtBuildingIds: string[]): void {
    if (builtBuildingIds === routeSource && builtBuildingIds.length === routeKey) return;
    routeSource = builtBuildingIds;
    routeKey = builtBuildingIds.length;
    routes = buildFunctionalRoutes(builtBuildingIds);
    routeLengths = routes.map((route) => routeLength(route.points));
  }

  function createVillager(index: number): Villager {
    const material = new THREE.SpriteMaterial({ map: characters.getFrame("builder", 0), transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(material);
    const scale = 2.15 + (index % 4) * 0.08;
    sprite.scale.set(scale * WALK_CELL_ASPECT, scale, 1);
    sprite.renderOrder = 40 + (index % 4);
    scene.add(sprite);
    return { sprite, material, profession: "builder", frame: 0, baseSize: scale, phase: (index * 0.61803398875) % 1, speedVariation: 0.92 + (index % 7) * 0.025 };
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
    while (villagers.length < targetPopulation) villagers.push(createVillager(villagers.length));
    villagers.forEach((villager, index) => { villager.sprite.visible = index < targetPopulation; });
  }

  function garrisonTarget(role: GarrisonSoldier["role"], index: number, swordsmen: number, archers: number, out = new THREE.Vector2()): THREE.Vector2 {
    const precedingRows = role === "archer" ? Math.ceil(swordsmen / 5) : role === "horseman" ? Math.ceil(swordsmen / 5) + Math.ceil(archers / 5) : 0;
    const row = Math.floor(index / 5) + precedingRows;
    const column = index % 5;
    return out.set(civicGround.x + (column - 2) * (role === "horseman" ? 1.85 : 1.35), civicGround.y - 3.3 - row * 1.65);
  }
  const garrisonSpot = new THREE.Vector2();

  /** Each trained soldier travels from the training building to the town hall formation. */
  function syncGarrison(units: TrainedUnits, animationElapsed?: number, builtBuildingIds: string[] = []): void {
    if (["swordsman", "archer", "horseman"].some((role) => garrison.filter((soldier) => soldier.role === role).length > units[role === "swordsman" ? "swordsmen" : role === "archer" ? "archers" : "horsemen"])) {
      for (const soldier of garrison) { scene.remove(soldier.sprite); soldier.sprite.material.dispose(); }
      garrison.length = 0;
    }
    for (const role of ["swordsman", "archer", "horseman"] as const) {
      const targetCount = units[role === "swordsman" ? "swordsmen" : role === "archer" ? "archers" : "horsemen"];
      let currentCount = garrison.filter((soldier) => soldier.role === role).length;
      while (currentCount < targetCount) {
        const size = role === "horseman" ? 2.95 : 2.15;
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: characters.getFrame(role, 0), transparent: true, depthTest: false }));
        const destination = garrisonTarget(role, currentCount, units.swordsmen, units.archers);
        const source = role === "horseman" ? "stable" : builtBuildingIds.includes("barracks") ? "barracks" : role === "archer" ? "weapons-workshop" : "blacksmith";
        const route = getServiceRoute(source).reverse();
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
          const frame = Math.floor(animationElapsed * 7 + index) % 4;
          const texture = characters.getFrame(soldier.role, frame, direction);
          soldier.sprite.scale.x = soldier.sprite.scale.y * WALK_CELL_ASPECT;
          if (soldier.sprite.material.map !== texture) {
            soldier.frame = frame;
            soldier.sprite.material.map = texture;
            soldier.sprite.material.needsUpdate = true;
          }
          continue;
        }
        soldier.bornAt = null;
        soldier.sprite.position.set(civicGround.x, civicGround.y + soldier.sprite.scale.y / 2, 2.6);
        soldier.sprite.material.map = characters.getFrame(soldier.role, 0, 4);
        soldier.sprite.scale.x = soldier.sprite.scale.y * WALK_CELL_ASPECT;
        soldier.sprite.material.needsUpdate = true;
        soldier.frame = 0;
      }
      soldier.sprite.position.x = THREE.MathUtils.lerp(soldier.sprite.position.x, target.x, blend);
      soldier.sprite.position.y = THREE.MathUtils.lerp(soldier.sprite.position.y, target.y + soldier.sprite.scale.y / 2, blend);
      const nearLine = Math.hypot(target.x - soldier.sprite.position.x, target.y + soldier.sprite.scale.y / 2 - soldier.sprite.position.y) < 0.2;
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
    for (const soldier of garrison) soldier.sprite.visible = true;
    for (const villager of villagers) { villager.sprite.visible = true; villager.material.color.setHex(0xffffff); }
  }

  function setCombatActive(value: boolean): void {
    combatActive = value;
    for (const villager of villagers) villager.sprite.visible = !value;
    for (const soldier of garrison) soldier.sprite.visible = false;
  }

  const laneNormal = new THREE.Vector2();
  /** How wide the roads are drawn now (cityLayout grows them each move); lanes widen with them. */
  let laneScale = 1;
  function setRoadScale(scale: number): void { laneScale = Number.isFinite(scale) && scale > 0 ? scale : 1; }

  /**
   * Per-frame: positions, flips, tints, and animates every visible villager.
   * `crowdElapsed` is the commuters' own clock (main.ts advances it more gently
   * than game speed, so 8× doesn't make the crowd frantic); it defaults to the
   * animation clock.
   */
  function renderVillagers(animationElapsed: number, builtBuildingIds: string[], crowdElapsed: number = animationElapsed): void {
    if (combatActive) return;
    renderGarrison(animationElapsed);
    routesFor(builtBuildingIds);
    for (let index = 0; index < villagers.length; index += 1) {
      const villager = villagers[index];
      if (!villager.sprite.visible) continue;
      const routeIndex = index % routes.length;
      const route = routes[routeIndex];
      setProfession(villager, routeProfession(route, index));
      const length = routeLengths[routeIndex];
      // Service routes start at the Town Hall: stop short of it, each at its own distance.
      const startsAtHall = route.kind === "service" && length > 0;
      const trim = startsAtHall ? hallStop(index, length) : 0;
      const walked = Math.max(0, length - trim);
      const staggered = crowdElapsed + villager.phase * Math.max(4, walked / route.speed);
      const duration = Math.max(4.5, (walked * 2) / (route.speed * villager.speedVariation));
      const journey = pingPongProgress(staggered, duration);
      const along = trim + journey.progress * walked;
      const segmentDirection = samplePolyline(route.points, length, length > 0 ? along / length : 0, sampled, laneNormal);
      const direction = journey.outbound ? segmentDirection : ((segmentDirection + 4) % 8) as WalkDirection;
      const working = !journey.moving && journey.progress === 1 && route.kind === "service";
      const size = Math.abs(villager.sprite.scale.y);
      let bob = 0;
      if (working) setFrame(villager, Math.floor(crowdElapsed * CROWD.workFps + villager.phase * 8), direction, true);
      else if (journey.moving && walked > 0) {
        const legDistance = (journey.outbound ? journey.progress : 1 - journey.progress) * walked;
        const stride = strideFrame(legDistance + villager.phase * CROWD.strideLength, size);
        setFrame(villager, stride.frame, direction, false, stride.cycle);
        bob = stride.bob;
      } else setFrame(villager, 0, direction, false);
      // Walk on the right of the road centre line, each in its own lane.
      const lane = length > 0 ? laneOffset(index) * laneScale : 0;
      villager.sprite.position.set(sampled.x + laneNormal.x * lane, sampled.y + laneNormal.y * lane + size / 2 + bob, 2.4);
      // Nearer (lower on screen) villagers draw in front; kept within 40–59, above buildings and below the garrison.
      villager.sprite.renderOrder = 40 + Math.max(0, Math.min(19, Math.round(10 - sampled.y * 0.45)));
      villager.material.color.setHex(0xffffff);
    }
  }

  return { syncVillagers, syncGarrison, renderVillagers, clearArmyMuster, setCombatActive, setRoadScale };
}
