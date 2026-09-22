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
  marketplace: new THREE.Vector2(2.1, 0.2),
  house: new THREE.Vector2(-3.5, 1.2),
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

const BUILDING_DISTRICTS: Record<string, string> = {
  marketplace: "civic", house: "civic",
  woodcutter: "forest", sawmill: "forest",
  farm: "farms", bakery: "farms", granary: "farms",
  "fruit-orchard": "southwest", winery: "southwest", "swine-farm": "southwest", butchery: "southwest",
  quarry: "industry", blacksmith: "industry", "weapons-workshop": "industry", barracks: "industry",
};

export function getBuildingPosition(buildingId: string): THREE.Vector2 {
  return BUILDING_POSITIONS[buildingId] ?? civicGround;
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

  const districtPaths: Record<string, THREE.Vector2[]> = {
    civic: [civicGround, new THREE.Vector2(3.8, 0.2)],
    forest: [civicGround, new THREE.Vector2(3.3, 1.8), new THREE.Vector2(7.0, 4.3)],
    farms: [civicGround, new THREE.Vector2(-3.8, 2.0), new THREE.Vector2(-7.1, 3.8)],
    southwest: [civicGround, new THREE.Vector2(-3.4, -2.1), new THREE.Vector2(-6.2, -4.6)],
    industry: [civicGround, new THREE.Vector2(3.1, -2.0), new THREE.Vector2(6.2, -5.1)],
  };
  for (const [district, points] of Object.entries(districtPaths)) {
    const roadGroup = new THREE.Group();
    addRoadPath(roadGroup, points, 0.78, 0xb28f5c, -6);
    addRoadPath(roadGroup, points, 0.22, 0xe1c78d, -5);
    roadGroup.visible = false;
    districtRoads.set(district, roadGroup);
    background.add(roadGroup);
  }

  const districtJunctions: Record<string, THREE.Vector2> = {
    civic: new THREE.Vector2(1.8, 0.1), forest: new THREE.Vector2(7.0, 4.3), farms: new THREE.Vector2(-7.1, 3.8),
    southwest: new THREE.Vector2(-6.2, -4.6), industry: new THREE.Vector2(6.2, -5.1),
  };
  for (const [buildingId, position] of Object.entries(BUILDING_POSITIONS)) {
    const connector = new THREE.Group();
    connector.add(createRoadSegment(districtJunctions[BUILDING_DISTRICTS[buildingId]], position, 0.28, 0xd2b57c, -4));
    connector.visible = false;
    buildingRoads.set(buildingId, connector);
    background.add(connector);
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
    background.add(line);
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
    },
  };
}
