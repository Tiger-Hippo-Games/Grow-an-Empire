import * as THREE from "three";
import { loadCroppedSprite, loadTexture } from "./spriteAssets";

/**
 * The static, building-identity-keyed world: plot positions, districts, the
 * isometric grid, and the road network that reveals itself district by
 * district as the player builds. Nothing here reads simulation state beyond
 * being told which building or district just became active.
 */

/** Pixel-to-world mapping for the approved 1920 × 1080 plan at a 40-unit camera height. */
const planPoint = (x: number, y: number): THREE.Vector2 => new THREE.Vector2((x - 960) / 27, (540 - y) / 27);

/** Ground point of the Town Hall; the hub every cross-district route passes through. */
export const civicGround = planPoint(938, 548);
/** Ground point of the tree the Woodcutter harvests. */
export const treeGround = planPoint(1760, 263);
/** Vertical offset from a ground point to the worker sprite's center, so its feet sit on the point. */
export const workerFootOffset = 0.95;

/** The 16:9 painted ground is drawn below every road, prop, sprite, and optional grid line. */
export async function loadEmptyTerrain(scene: THREE.Scene): Promise<void> {
  const texture = await loadTexture("village-empty-terrain-16x9-v2.png");
  const terrain = new THREE.Mesh(
    new THREE.PlaneGeometry(40 * (16 / 9), 40),
    new THREE.MeshBasicMaterial({ map: texture, depthTest: false, depthWrite: false }),
  );
  terrain.position.z = -1;
  terrain.renderOrder = -100;
  scene.add(terrain);
}

/**
 * Fixed ground position of every building. Positions are keyed by building
 * (not by move), so a Farm always sits in the farm district whichever move it's built on.
 * These vectors are shared: treat them as read-only (clone before mutating).
 */
const BUILDING_POSITIONS: Record<string, THREE.Vector2> = {
  marketplace: planPoint(1124, 580),
  house: planPoint(788, 587),
  woodcutter: planPoint(1639, 292),
  sawmill: planPoint(1466, 454),
  farm: planPoint(208, 294),
  bakery: planPoint(499, 476),
  granary: planPoint(398, 374),
  "fruit-orchard": planPoint(221, 609),
  winery: planPoint(424, 657),
  "swine-farm": planPoint(206, 767),
  butchery: planPoint(441, 820),
  quarry: planPoint(1634, 611),
  blacksmith: planPoint(1433, 657),
  "weapons-workshop": planPoint(1447, 797),
  barracks: planPoint(1693, 820),
};

export type CityDistrict = "civic" | "forest" | "farms" | "provisions" | "industry";

const BUILDING_DISTRICTS: Record<string, CityDistrict> = {
  marketplace: "civic", house: "civic",
  woodcutter: "forest", sawmill: "forest",
  farm: "farms", bakery: "farms", granary: "farms",
  "fruit-orchard": "provisions", winery: "provisions", "swine-farm": "provisions", butchery: "provisions",
  quarry: "industry", blacksmith: "industry", "weapons-workshop": "industry", barracks: "industry",
};

/** Ground position of a building (falls back to the civic center for unknown ids). Read-only. */
export function getBuildingPosition(buildingId: string): THREE.Vector2 {
  return BUILDING_POSITIONS[buildingId] ?? civicGround;
}

/** Which district a building belongs to (unknown ids count as civic). */
export function getBuildingDistrict(buildingId: string): CityDistrict {
  return BUILDING_DISTRICTS[buildingId] ?? "civic";
}

/** Where each district's road meets its buildings' connector paths. */
export const DISTRICT_JUNCTIONS: Record<CityDistrict, THREE.Vector2> = {
  civic: civicGround,
  forest: planPoint(1350, 350),
  farms: planPoint(572, 365),
  provisions: planPoint(560, 663),
  industry: planPoint(1361, 661),
};

const DISTRICT_PATHS: Record<CityDistrict, THREE.Vector2[]> = {
  civic: [civicGround],
  forest: [civicGround, planPoint(1140, 455), DISTRICT_JUNCTIONS.forest],
  farms: [civicGround, planPoint(754, 455), DISTRICT_JUNCTIONS.farms],
  provisions: [civicGround, planPoint(749, 581), DISTRICT_JUNCTIONS.provisions],
  industry: [civicGround, planPoint(1159, 576), DISTRICT_JUNCTIONS.industry],
};

/** Center-to-entrance route using the same points that draw the main road and building spur. */
export function getServiceRoute(buildingId: string): THREE.Vector2[] {
  return [...DISTRICT_PATHS[getBuildingDistrict(buildingId)], getBuildingPosition(buildingId)];
}

/**
 * Road-following waypoints from one building to another, used by delivery
 * villagers as well as the visible road mesh. Buildings in the same district
 * connect through their junction; otherwise the route goes through the Town Hall.
 */
export function getRoadRoute(fromBuildingId: string, toBuildingId: string): THREE.Vector2[] {
  const from = getBuildingPosition(fromBuildingId);
  const to = getBuildingPosition(toBuildingId);
  const fromDistrict = getBuildingDistrict(fromBuildingId);
  const toDistrict = getBuildingDistrict(toBuildingId);
  if (fromDistrict === toDistrict) return [from, DISTRICT_JUNCTIONS[fromDistrict], to];
  return [...getServiceRoute(fromBuildingId).reverse(), ...getServiceRoute(toBuildingId).slice(1)];
}

/** The physical path segments visible after these buildings have been constructed. */
export function getVisibleRoadSegments(builtBuildingIds: string[]): Array<[THREE.Vector2, THREE.Vector2]> {
  const built = new Set(builtBuildingIds);
  const segments: Array<[THREE.Vector2, THREE.Vector2]> = [];
  for (const district of Object.keys(DISTRICT_PATHS) as CityDistrict[]) {
    if (![...built].some((id) => getBuildingDistrict(id) === district)) continue;
    const path = DISTRICT_PATHS[district];
    for (let index = 1; index < path.length; index += 1) segments.push([path[index - 1], path[index]]);
  }
  for (const buildingId of built) {
    segments.push([DISTRICT_JUNCTIONS[getBuildingDistrict(buildingId)], getBuildingPosition(buildingId)]);
  }
  return segments;
}

/** The faint diagonal grid lines on the ground (toggled by the Grid button). */
export function createIsoGrid(): THREE.Group {
  const group = new THREE.Group();
  const positions: number[] = [];
  const width = 42;
  for (let row = -32; row <= 32; row += 1) {
    const y = row * 1.27;
    positions.push(-width, y - width * 0.5, 0, width, y + width * 0.5, 0);
    positions.push(-width, y + width * 0.5, 0, width, y - width * 0.5, 0);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  group.add(new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0x526e43, transparent: true, opacity: 0.3 })));
  group.scale.y = 0.52;
  group.renderOrder = -10;
  return group;
}

function createRoadSegment(from: THREE.Vector2, to: THREE.Vector2, width: number, color: number, order: number): THREE.Mesh {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(length, width),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.72, depthTest: false }),
  );
  road.position.set((from.x + to.x) / 2, (from.y + to.y) / 2, 0.08);
  road.rotation.z = Math.atan2(dy, dx);
  road.renderOrder = order;
  return road;
}

function addRoadPath(group: THREE.Group, points: THREE.Vector2[], width: number, color: number, order: number): void {
  for (let index = 0; index < points.length - 1; index += 1) {
    group.add(createRoadSegment(points[index], points[index + 1], width, color, order));
  }
}

/** Loads the single tree master sprite and scatters a static forest cluster around it. */
export async function loadForest(scene: THREE.Scene): Promise<void> {
  const treeSprite = await loadCroppedSprite("deciduous-01-healthy-2x-v1.png", {
    image: [640, 512],
    bbox: [0, 49, 325, 504],
    height: 4.25,
  });
  treeSprite.position.set(treeGround.x, treeGround.y + treeSprite.scale.y / 2, 1);
  treeSprite.renderOrder = 5;
  scene.add(treeSprite);

  const forestTreePositions = [
    planPoint(1520, 170), planPoint(1605, 196), planPoint(1695, 150),
    planPoint(1790, 183), planPoint(1850, 323), planPoint(1730, 376),
    planPoint(1510, 327), planPoint(1840, 434),
  ];
  forestTreePositions.forEach((position, index) => {
    const forestTree = treeSprite.clone();
    forestTree.material = (treeSprite.material as THREE.SpriteMaterial).clone();
    const scale = 0.5 + (index % 3) * 0.09;
    forestTree.scale.multiplyScalar(scale);
    forestTree.position.set(position.x, position.y + forestTree.scale.y / 2, 0.9);
    forestTree.renderOrder = 4 + (index % 2);
    scene.add(forestTree);
  });
}

export interface CityLayout {
  grid: THREE.Group;
  placementPad: THREE.Mesh;
  placementMaterial: THREE.MeshBasicMaterial;
  /** Reveals the district road (and its short building connector) for a chosen building. Idempotent. */
  showRoadForBuilding(buildingId: string): void;
  /** Hides every road again, for a full settlement restart. */
  hideAllRoads(): void;
  /** Reconciles every supply-chain connector with the buildings currently present. */
  syncBuiltBuildings(buildingIds: string[]): void;
  /** Reveals cumulative civic infrastructure for settlement levels 0–8. */
  setCivicLevel(level: number): void;
}

/** Builds the static ground, forest, fields, roads, and placement indicator, and adds them all to `scene`. */
export function createCityLayout(scene: THREE.Scene): CityLayout {
  const grid = createIsoGrid();
  grid.visible = false;
  scene.add(grid);

  const background = new THREE.Group();
  const districtRoads = new Map<string, THREE.Group>();
  const buildingRoads = new Map<string, THREE.Group>();
  const workflowRoads = new Map<string, THREE.Group>();
  const environmentStages = Array.from({ length: 9 }, () => new THREE.Group());
  environmentStages.forEach((stage) => background.add(stage));

  const addGroundDisc = (stage: number, x: number, y: number, radius: number, color: number, opacity = 0.75): void => {
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 20),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthTest: false }),
    );
    disc.position.set(x, y, 0.1);
    disc.scale.y = 0.6;
    disc.renderOrder = -2;
    environmentStages[stage].add(disc);
  };

  // Level 0: the first fire and trampled campsite clearing.
  addGroundDisc(0, civicGround.x + 0.7, civicGround.y - 0.75, 0.32, 0xd77a31, 0.8);
  addGroundDisc(0, civicGround.x + 0.7, civicGround.y - 0.75, 0.16, 0xffd26a, 0.95);

  // Level 1: a ring of boundary stones makes the founding claim legible.
  for (let index = 0; index < 10; index += 1) {
    const angle = (index / 10) * Math.PI * 2;
    addGroundDisc(1, civicGround.x + Math.cos(angle) * 2.6, civicGround.y + Math.sin(angle) * 1.45, 0.13, 0x9a9078, 0.85);
  }

  // Level 2: timber fences establish the first civic enclosure.
  [[-3.2, -1.5, -1.1, -2.1], [1.0, 2.1, 2.7, 1.4], [-3.6, 1.2, -2.5, 2.1]].forEach(([x1, y1, x2, y2]) => {
    const segment = createRoadSegment(new THREE.Vector2(x1, y1), new THREE.Vector2(x2, y2), 0.11, 0x765233, -2);
    (segment.material as THREE.MeshBasicMaterial).opacity = 0.8;
    environmentStages[2].add(segment);
  });

  // Level 4: a public well and meeting ring appear beside the council lodge.
  const well = new THREE.Mesh(
    new THREE.RingGeometry(0.32, 0.48, 24),
    new THREE.MeshBasicMaterial({ color: 0xb8aa8d, transparent: true, opacity: 0.9, depthTest: false }),
  );
  well.position.set(civicGround.x + 1.45, civicGround.y - 0.65, 0.12);
  well.scale.y = 0.58;
  well.renderOrder = -1;
  environmentStages[4].add(well);

  // Level 6: warm road lamps mark the five district approaches.
  [[2.3, 1.15], [-2.7, 1.35], [-2.45, -1.45], [2.25, -1.35], [0.8, 0.15]].forEach(([x, y]) => {
    addGroundDisc(6, x, y, 0.16, 0xf0c55f, 0.9);
    addGroundDisc(6, x, y, 0.32, 0xf0c55f, 0.16);
  });

  // Level 7: council banners announce a defended town.
  for (const side of [-1, 1]) {
    const pole = createRoadSegment(
      new THREE.Vector2(civicGround.x + side * 2.15, civicGround.y - 0.2),
      new THREE.Vector2(civicGround.x + side * 2.15, civicGround.y + 1.2),
      0.07, 0x5c4530, 3,
    );
    const banner = new THREE.Mesh(
      new THREE.PlaneGeometry(0.42, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xa54436, transparent: true, opacity: 0.95, depthTest: false }),
    );
    banner.position.set(civicGround.x + side * 1.98, civicGround.y + 0.82, 0.2);
    banner.renderOrder = 4;
    environmentStages[7].add(pole, banner);
  }

  // Level 8: paired stone gateposts finish every main approach to the Grand Town Hall.
  for (const point of [new THREE.Vector2(3.05, -1.95), new THREE.Vector2(-3.35, -2.05), new THREE.Vector2(3.25, 1.75), new THREE.Vector2(-3.75, 1.95)]) {
    addGroundDisc(8, point.x - 0.28, point.y, 0.24, 0x77736a, 0.95);
    addGroundDisc(8, point.x + 0.28, point.y, 0.24, 0x77736a, 0.95);
  }

  for (const [district, points] of Object.entries(DISTRICT_PATHS)) {
    const roadGroup = new THREE.Group();
    addRoadPath(roadGroup, points, 0.78, 0xb28f5c, -6);
    addRoadPath(roadGroup, points, 0.22, 0xe1c78d, -5);
    roadGroup.visible = false;
    districtRoads.set(district, roadGroup);
    background.add(roadGroup);
  }

  for (const [buildingId, position] of Object.entries(BUILDING_POSITIONS)) {
    const connector = new THREE.Group();
    connector.add(createRoadSegment(DISTRICT_JUNCTIONS[BUILDING_DISTRICTS[buildingId]], position, 0.28, 0xd2b57c, -4));
    connector.visible = false;
    buildingRoads.set(buildingId, connector);
    background.add(connector);
  }

  const workflowLinks: Array<[string, string]> = [
    ["woodcutter", "sawmill"], ["farm", "bakery"], ["farm", "granary"],
    ["fruit-orchard", "winery"], ["swine-farm", "butchery"],
    ["quarry", "blacksmith"], ["blacksmith", "weapons-workshop"], ["weapons-workshop", "barracks"],
    ["marketplace", "house"],
  ];
  for (const [fromId, toId] of workflowLinks) {
    const group = new THREE.Group();
    addRoadPath(group, getRoadRoute(fromId, toId), 0.16, 0xe0ca99, -3);
    group.visible = false;
    workflowRoads.set(`${fromId}:${toId}`, group);
    background.add(group);
  }

  scene.add(background);

  const placementMaterial = new THREE.MeshBasicMaterial({ color: 0xe6bd63, transparent: true, opacity: 0.18, depthTest: false });
  const placementPad = new THREE.Mesh(new THREE.CircleGeometry(1.65, 48), placementMaterial);
  placementPad.scale.y = 0.42;
  placementPad.visible = false;
  scene.add(placementPad);

  return {
    grid,
    placementPad,
    placementMaterial,
    showRoadForBuilding(buildingId: string): void {
      const district = BUILDING_DISTRICTS[buildingId];
      if (district) districtRoads.get(district)!.visible = true;
      const connector = buildingRoads.get(buildingId);
      if (connector) connector.visible = true;
    },
    hideAllRoads(): void {
      districtRoads.forEach((road) => { road.visible = false; });
      buildingRoads.forEach((road) => { road.visible = false; });
      workflowRoads.forEach((road) => { road.visible = false; });
    },
    syncBuiltBuildings(buildingIds: string[]): void {
      const built = new Set(buildingIds);
      districtRoads.forEach((road, district) => {
        road.visible = buildingIds.some((id) => BUILDING_DISTRICTS[id] === district);
      });
      buildingRoads.forEach((road, id) => { road.visible = built.has(id); });
      workflowRoads.forEach((road, key) => {
        const [fromId, toId] = key.split(":");
        road.visible = built.has(fromId) && built.has(toId);
      });
    },
    setCivicLevel(level: number): void {
      environmentStages.forEach((stage, index) => { stage.visible = index <= level; });
    },
  };
}
