import * as THREE from "three";
import { loadCroppedSprite } from "./spriteAssets";

/**
 * The static, building-identity-keyed world: plot positions, districts, the
 * isometric grid, and the road network that reveals itself district by
 * district as the player builds. Nothing here reads simulation state beyond
 * being told which building or district just became active.
 */

export const civicGround = new THREE.Vector2(-0.8, -0.3);
export const treeGround = new THREE.Vector2(10.1, 5.6);
export const workerFootOffset = 0.95;

const BUILDING_POSITIONS: Record<string, THREE.Vector2> = {
  marketplace: new THREE.Vector2(2.4, 0.25),
  house: new THREE.Vector2(-3.4, 1.15),
  woodcutter: new THREE.Vector2(8.1, 5.0),
  sawmill: new THREE.Vector2(5.8, 3.6),
  farm: new THREE.Vector2(-8.4, 4.7),
  bakery: new THREE.Vector2(-5.5, 3.0),
  granary: new THREE.Vector2(-8.2, 1.7),
  "fruit-orchard": new THREE.Vector2(-8.2, -3.1),
  winery: new THREE.Vector2(-5.2, -2.5),
  "swine-farm": new THREE.Vector2(-7.5, -6.0),
  butchery: new THREE.Vector2(-4.5, -5.3),
  quarry: new THREE.Vector2(8.2, -4.5),
  blacksmith: new THREE.Vector2(5.5, -3.2),
  "weapons-workshop": new THREE.Vector2(4.2, -6.0),
  barracks: new THREE.Vector2(7.5, -7.1),
};

export type CityDistrict = "civic" | "forest" | "farms" | "provisions" | "industry";

const BUILDING_DISTRICTS: Record<string, CityDistrict> = {
  marketplace: "civic", house: "civic",
  woodcutter: "forest", sawmill: "forest",
  farm: "farms", bakery: "farms", granary: "farms",
  "fruit-orchard": "provisions", winery: "provisions", "swine-farm": "provisions", butchery: "provisions",
  quarry: "industry", blacksmith: "industry", "weapons-workshop": "industry", barracks: "industry",
};

export function getBuildingPosition(buildingId: string): THREE.Vector2 {
  return BUILDING_POSITIONS[buildingId] ?? civicGround;
}

export function getBuildingDistrict(buildingId: string): CityDistrict {
  return BUILDING_DISTRICTS[buildingId] ?? "civic";
}

export const DISTRICT_JUNCTIONS: Record<CityDistrict, THREE.Vector2> = {
  civic: new THREE.Vector2(1.75, 0.05),
  forest: new THREE.Vector2(6.9, 4.15),
  farms: new THREE.Vector2(-7.0, 3.75),
  provisions: new THREE.Vector2(-6.1, -4.45),
  industry: new THREE.Vector2(6.15, -5.0),
};

const DISTRICT_PATHS: Record<CityDistrict, THREE.Vector2[]> = {
  civic: [civicGround, new THREE.Vector2(1.75, 0.05), new THREE.Vector2(3.7, 0.2)],
  forest: [civicGround, new THREE.Vector2(3.25, 1.75), DISTRICT_JUNCTIONS.forest],
  farms: [civicGround, new THREE.Vector2(-3.75, 1.95), DISTRICT_JUNCTIONS.farms],
  provisions: [civicGround, new THREE.Vector2(-3.35, -2.05), DISTRICT_JUNCTIONS.provisions],
  industry: [civicGround, new THREE.Vector2(3.05, -1.95), DISTRICT_JUNCTIONS.industry],
};

/** Road-following waypoints used by delivery villagers as well as the visible road mesh. */
export function getRoadRoute(fromBuildingId: string, toBuildingId: string): THREE.Vector2[] {
  const from = getBuildingPosition(fromBuildingId);
  const to = getBuildingPosition(toBuildingId);
  const fromDistrict = getBuildingDistrict(fromBuildingId);
  const toDistrict = getBuildingDistrict(toBuildingId);
  if (fromDistrict === toDistrict) return [from, DISTRICT_JUNCTIONS[fromDistrict], to];
  return [from, DISTRICT_JUNCTIONS[fromDistrict], civicGround, DISTRICT_JUNCTIONS[toDistrict], to];
}

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
    new THREE.Vector2(6.3, 5.6), new THREE.Vector2(7.2, 6.8), new THREE.Vector2(8.8, 7.1),
    new THREE.Vector2(10.4, 6.9), new THREE.Vector2(11.1, 4.3), new THREE.Vector2(9.7, 3.7),
    new THREE.Vector2(6.9, 3.0), new THREE.Vector2(11.6, 5.7),
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
  scene.add(grid);

  const background = new THREE.Group();
  const plaza = new THREE.Mesh(
    new THREE.CircleGeometry(3.4, 48),
    new THREE.MeshBasicMaterial({ color: 0xc7ae79, transparent: true, opacity: 0.42, depthTest: false }),
  );
  plaza.position.set(civicGround.x + 0.75, civicGround.y, 0.06);
  plaza.scale.y = 0.58;
  plaza.renderOrder = -7;
  background.add(plaza);

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
  const fenceMaterial = new THREE.MeshBasicMaterial({ color: 0x765233, transparent: true, opacity: 0.8, depthTest: false });
  [[-3.2, -1.5, -1.1, -2.1], [1.0, 2.1, 2.7, 1.4], [-3.6, 1.2, -2.5, 2.1]].forEach(([x1, y1, x2, y2]) => {
    const segment = createRoadSegment(new THREE.Vector2(x1, y1), new THREE.Vector2(x2, y2), 0.11, 0x765233, -2);
    (segment.material as THREE.MeshBasicMaterial).copy(fenceMaterial);
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

  // Level 5: market awnings turn the central road into a recognisable square.
  [[1.0, 1.15, 0xb6543d], [1.75, 1.35, 0xd1a342], [2.45, 1.0, 0x587f54]].forEach(([x, y, color]) => {
    const stall = new THREE.Mesh(
      new THREE.PlaneGeometry(0.65, 0.34),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthTest: false }),
    );
    stall.position.set(x, y, 0.13);
    stall.rotation.z = -0.18;
    stall.renderOrder = 2;
    environmentStages[5].add(stall);
  });

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

  const districtGrounds: Array<[CityDistrict, THREE.Vector2, number, number]> = [
    ["civic", new THREE.Vector2(0.1, 0), 4.4, 0xbfa76e],
    ["forest", new THREE.Vector2(8, 5), 5.2, 0x456c3b],
    ["farms", new THREE.Vector2(-7.4, 3.4), 5.0, 0x9b8948],
    ["provisions", new THREE.Vector2(-6.2, -4.4), 5.0, 0x72834b],
    ["industry", new THREE.Vector2(6.2, -5.0), 5.2, 0x77746a],
  ];
  for (const [, center, radius, color] of districtGrounds) {
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 40),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.11, depthTest: false }),
    );
    ground.position.set(center.x, center.y, 0.025);
    ground.scale.y = 0.55;
    ground.renderOrder = -9;
    background.add(ground);
  }

  const forestFloor = new THREE.Mesh(
    new THREE.CircleGeometry(5.0, 48),
    new THREE.MeshBasicMaterial({ color: 0x486d3e, transparent: true, opacity: 0.2, depthTest: false }),
  );
  forestFloor.position.set(8.2, 5.0, 0.04);
  forestFloor.scale.y = 0.56;
  forestFloor.renderOrder = -8;
  background.add(forestFloor);

  const fieldMaterial = new THREE.LineBasicMaterial({ color: 0xb99855, transparent: true, opacity: 0.58, depthTest: false });
  for (let row = 0; row < 7; row += 1) {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-11.2, 2.9 + row * 0.5, 0.07),
      new THREE.Vector3(-7.3, 4.8 + row * 0.22, 0.07),
    ]);
    const line = new THREE.Line(geometry, fieldMaterial);
    line.renderOrder = -3;
    environmentStages[3].add(line);
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
