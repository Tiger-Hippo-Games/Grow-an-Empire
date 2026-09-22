import * as THREE from "three";
import {
  BUILDINGS,
  CIVIC_LEVEL_NAMES,
  HARVEST_PHASES,
  RESOURCE_LABELS,
  TOTAL_MOVES,
  TOTAL_SETTLEMENT_LEVELS,
  type ResourceName,
} from "./game/content";
import { SettlementSimulation, type SimulationEvent } from "./game/settlementSimulation";
import { assetUrl } from "./render/assetCatalog";
import "./styles.css";

type Direction = "southeast" | "southwest";
type AnimatedClipName = "walk" | "chop" | "pickup" | "carry";
type ConstructionStage = "foundation" | "frame" | "late" | "complete";

interface SheetClip { texture: THREE.Texture; fps: number; frames: number; }
interface SpriteAsset { texture: THREE.Texture; aspect: number; }
interface CropSpec { image: [number, number]; bbox: [number, number, number, number]; height: number; }
interface Villager { sprite: THREE.Sprite; texture: THREE.Texture; phase: number; speed: number; }

function requireElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Required interface element is missing: ${selector}`);
  return element;
}

const viewport = requireElement<HTMLElement>("#viewport");
const loading = requireElement<HTMLElement>("#loading");
const phaseLabel = requireElement<HTMLElement>("#phase");
const progressFill = requireElement<HTMLElement>("#phase-progress");
const moveLabel = requireElement<HTMLElement>("#move");
const civicLabel = requireElement<HTMLElement>("#civic-level");
const populationLabel = requireElement<HTMLElement>("#population");
const buildPanel = requireElement<HTMLElement>("#build-panel");
const buildOptions = requireElement<HTMLElement>("#build-options");
const moveChip = requireElement<HTMLElement>("#move-chip");
const resourceLedger = requireElement<HTMLElement>("#resource-ledger");
const milestone = requireElement<HTMLElement>("#milestone");
const milestoneKicker = requireElement<HTMLElement>("#milestone-kicker");
const milestoneTitle = requireElement<HTMLElement>("#milestone-title");
const milestoneCopy = requireElement<HTMLElement>("#milestone-copy");
const levelTrackLabel = requireElement<HTMLElement>("#level-track-label");
const levelPips = requireElement<HTMLElement>("#level-pips");
const playToggle = requireElement<HTMLButtonElement>("#play-toggle");
const restartButton = requireElement<HTMLButtonElement>("#restart");
const speedInput = requireElement<HTMLInputElement>("#speed");
const speedValue = requireElement<HTMLOutputElement>("#speed-value");
const gridToggle = requireElement<HTMLInputElement>("#grid-toggle");

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x78945a, 1);
viewport.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-7, 7, 4, -4, 0.1, 100);
camera.position.set(0, 0, 10);
const textureLoader = new THREE.TextureLoader();

function configureTexture(texture: THREE.Texture): THREE.Texture {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

async function loadSpriteAsset(filename: string): Promise<SpriteAsset> {
  const texture = configureTexture(await textureLoader.loadAsync(assetUrl(filename)));
  const image = texture.image as HTMLImageElement;
  return { texture, aspect: image.naturalWidth / image.naturalHeight };
}

async function loadSheet(filename: string, fps: number): Promise<SheetClip> {
  const texture = configureTexture(await textureLoader.loadAsync(assetUrl(filename)));
  texture.repeat.set(0.25, 0.5);
  return { texture, fps, frames: 8 };
}

async function loadCroppedSprite(filename: string, crop: CropSpec): Promise<THREE.Sprite> {
  const texture = configureTexture(await textureLoader.loadAsync(assetUrl(filename)));
  const [imageWidth, imageHeight] = crop.image;
  const [left, top, right, bottom] = crop.bbox;
  texture.repeat.set((right - left) / imageWidth, (bottom - top) / imageHeight);
  texture.offset.set(left / imageWidth, (imageHeight - bottom) / imageHeight);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  const aspect = (right - left) / (bottom - top);
  sprite.scale.set(crop.height * aspect, crop.height, 1);
  return sprite;
}

function spriteFromAsset(asset: SpriteAsset, height: number): THREE.Sprite {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: asset.texture, transparent: true, depthTest: false }));
  sprite.scale.set(height * asset.aspect, height, 1);
  sprite.userData.baseScale = sprite.scale.clone();
  return sprite;
}

function setSheetFrame(clip: SheetClip, frame: number): void {
  const normalized = ((frame % clip.frames) + clip.frames) % clip.frames;
  clip.texture.offset.set((normalized % 4) * 0.25, Math.floor(normalized / 4) === 0 ? 0.5 : 0);
}

function setTextureFrame(texture: THREE.Texture, frame: number): void {
  const normalized = ((frame % 8) + 8) % 8;
  texture.offset.set((normalized % 4) * 0.25, Math.floor(normalized / 4) === 0 ? 0.5 : 0);
}

function createIsoGrid(): THREE.Group {
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

const civicGround = new THREE.Vector2(-0.8, -0.3);
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
const treeGround = new THREE.Vector2(10.1, 5.6);
const workerFootOffset = 0.95;

function getBuildingPosition(buildingId: string): THREE.Vector2 {
  return BUILDING_POSITIONS[buildingId] ?? civicGround;
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

const districtRoads = new Map<string, THREE.Group>();
const buildingRoads = new Map<string, THREE.Group>();
const BUILDING_DISTRICTS: Record<string, string> = {
  marketplace: "civic", house: "civic",
  woodcutter: "forest", sawmill: "forest",
  farm: "farms", bakery: "farms", granary: "farms",
  "fruit-orchard": "southwest", winery: "southwest", "swine-farm": "southwest", butchery: "southwest",
  quarry: "industry", blacksmith: "industry", "weapons-workshop": "industry", barracks: "industry",
};

function addRoadPath(group: THREE.Group, points: THREE.Vector2[], width: number, color: number, order: number): void {
  for (let index = 0; index < points.length - 1; index += 1) {
    group.add(createRoadSegment(points[index], points[index + 1], width, color, order));
  }
}

function showRoadForBuilding(buildingId: string): void {
  const district = BUILDING_DISTRICTS[buildingId];
  if (district) districtRoads.get(district)!.visible = true;
  const connector = buildingRoads.get(buildingId);
  if (connector) connector.visible = true;
}

function createCityBackground(): THREE.Group {
  const group = new THREE.Group();
  const plaza = new THREE.Mesh(
    new THREE.CircleGeometry(3.4, 48),
    new THREE.MeshBasicMaterial({ color: 0xc7ae79, transparent: true, opacity: 0.42, depthTest: false }),
  );
  plaza.position.set(civicGround.x + 0.75, civicGround.y, 0.06);
  plaza.scale.y = 0.58;
  plaza.renderOrder = -7;
  group.add(plaza);

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
    group.add(roadGroup);
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
    group.add(connector);
  }

  const forestFloor = new THREE.Mesh(
    new THREE.CircleGeometry(5.0, 48),
    new THREE.MeshBasicMaterial({ color: 0x486d3e, transparent: true, opacity: 0.2, depthTest: false }),
  );
  forestFloor.position.set(8.2, 5.0, 0.04);
  forestFloor.scale.y = 0.56;
  forestFloor.renderOrder = -8;
  group.add(forestFloor);

  const fieldMaterial = new THREE.LineBasicMaterial({ color: 0xb99855, transparent: true, opacity: 0.58, depthTest: false });
  for (let row = 0; row < 7; row += 1) {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-11.2, 2.9 + row * 0.5, 0.07),
      new THREE.Vector3(-7.3, 4.8 + row * 0.22, 0.07),
    ]);
    const line = new THREE.Line(geometry, fieldMaterial);
    line.renderOrder = -3;
    group.add(line);
  }
  return group;
}

const grid = createIsoGrid();
scene.add(grid);
scene.add(createCityBackground());
const placementMaterial = new THREE.MeshBasicMaterial({ color: 0xe6bd63, transparent: true, opacity: 0.18, depthTest: false });
const placementPad = new THREE.Mesh(new THREE.CircleGeometry(1.65, 48), placementMaterial);
placementPad.scale.y = 0.42;
placementPad.visible = false;
scene.add(placementPad);

const clips = new Map<string, SheetClip>();
const buildingAssets = new Map<string, Record<ConstructionStage, SpriteAsset>>();
const civicSprites: THREE.Sprite[] = [];
const plotSprites = new Map<number, Record<ConstructionStage, THREE.Sprite>>();
const plotBuildingIds = new Map<number, string>();
const productionPulseUntil = new Map<string, number>();
const villagers: Villager[] = [];
let treeSprite: THREE.Sprite;

const workerMaterial = new THREE.SpriteMaterial({ transparent: true, depthTest: false });
const worker = new THREE.Sprite(workerMaterial);
worker.scale.set(2.25, 2.25, 1);
worker.renderOrder = 100;
scene.add(worker);

const simulation = new SettlementSimulation();
let playing = true;
let speed = 1;
let animationElapsed = 0;
let milestoneUntil = 0;

const resourceElements = new Map<ResourceName, HTMLElement>();
for (const resource of Object.keys(RESOURCE_LABELS) as ResourceName[]) {
  const item = document.createElement("div");
  item.innerHTML = `<span>${RESOURCE_LABELS[resource]}</span><strong>0</strong>`;
  resourceLedger.appendChild(item);
  resourceElements.set(resource, item.querySelector("strong")!);
}
for (let level = 0; level < TOTAL_SETTLEMENT_LEVELS; level += 1) {
  const pip = document.createElement("i");
  pip.title = `Level ${level}: ${CIVIC_LEVEL_NAMES[level]}`;
  levelPips.appendChild(pip);
}

function buildingFilename(buildingId: string, stage: ConstructionStage): string {
  const prefix = BUILDINGS[buildingId].artKey;
  if (stage === "complete") return `${prefix}-level-1-2x-v1.png`;
  const suffix = stage === "foundation" ? "01-foundation" : stage === "frame" ? "02-frame" : "03-late";
  return `${prefix}-construction-${suffix}-2x-v1.png`;
}

function setStatus(label: string, progress: number): void {
  phaseLabel.textContent = label;
  progressFill.style.width = `${THREE.MathUtils.clamp(progress, 0, 1) * 100}%`;
}

function placeWorker(position: THREE.Vector2): void {
  worker.position.set(position.x, position.y + workerFootOffset, 3);
}

function moveWorker(from: THREE.Vector2, to: THREE.Vector2, progress: number): void {
  worker.position.set(THREE.MathUtils.lerp(from.x, to.x, progress), THREE.MathUtils.lerp(from.y, to.y, progress) + workerFootOffset, 3);
}

function useClip(name: AnimatedClipName, direction: Direction, frame: number): void {
  const clip = clips.get(`${name}:${direction}`);
  if (!clip) return;
  setSheetFrame(clip, frame);
  workerMaterial.map = clip.texture;
  workerMaterial.needsUpdate = true;
}

function frameFor(name: AnimatedClipName, direction: Direction, elapsed: number): number {
  const clip = clips.get(`${name}:${direction}`);
  return clip ? Math.floor(elapsed * clip.fps) % clip.frames : 0;
}

function createVillager(index: number): Villager {
  const walk = clips.get("walk:southeast")!;
  const texture = walk.texture.clone();
  texture.needsUpdate = true;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  const scale = 1.05 + (index % 4) * 0.045;
  sprite.scale.set(scale, scale, 1);
  sprite.renderOrder = 40 + index;
  scene.add(sprite);
  return { sprite, texture, phase: (index * 0.61803398875) % 1, speed: 0.055 + (index % 7) * 0.006 };
}

function syncVillagers(targetPopulation: number): void {
  while (villagers.length < targetPopulation) villagers.push(createVillager(villagers.length));
  villagers.forEach((villager, index) => { villager.sprite.visible = index < targetPopulation; });
}

function renderVillagers(): void {
  const activityHubs = [civicGround, ...simulation.state.builtBuildingIds.map(getBuildingPosition)];
  for (let index = 0; index < villagers.length; index += 1) {
    const villager = villagers[index];
    if (!villager.sprite.visible) continue;
    const openingRoute = activityHubs.length === 1;
    const hub = openingRoute ? new THREE.Vector2(6, 0.1) : activityHubs[index % activityHubs.length];
    const orbitBand = Math.floor(index / activityHubs.length);
    const orbitRadius = 1.05 + (orbitBand % 4) * 0.28;
    const angle = animationElapsed * (0.72 + villager.speed * 3) + villager.phase * Math.PI * 2;
    const x = hub.x + Math.cos(angle) * orbitRadius * (openingRoute ? 1.35 : 1.1);
    const y = hub.y + Math.sin(angle) * orbitRadius * (openingRoute ? 0.8 : 0.58);
    villager.sprite.position.set(x, y + 0.55, 2.4);
    const movingRight = -Math.sin(angle) >= 0;
    villager.sprite.scale.x = Math.abs(villager.sprite.scale.x) * (movingRight ? 1 : -1);
    setTextureFrame(villager.texture, Math.floor(animationElapsed * (7.5 + (index % 4)) + index));
  }
}

function setCivicLevel(level: number): void {
  civicSprites.forEach((sprite, index) => { sprite.visible = index === level; });
  civicLabel.textContent = `${level} / ${TOTAL_SETTLEMENT_LEVELS - 1}`;
  levelTrackLabel.textContent = `LEVEL ${level} · ${CIVIC_LEVEL_NAMES[level].toUpperCase()}`;
  [...levelPips.children].forEach((pip, index) => pip.classList.toggle("active", index <= level));
}

function updateHud(): void {
  moveLabel.textContent = `${Math.min(simulation.state.move, TOTAL_MOVES)} / ${TOTAL_MOVES}`;
  populationLabel.textContent = String(simulation.state.population);
  for (const resource of Object.keys(RESOURCE_LABELS) as ResourceName[]) {
    resourceElements.get(resource)!.textContent = String(simulation.state.resources[resource]);
  }
}

function showPlotStage(plotIndex: number, stage: ConstructionStage): void {
  const sprites = plotSprites.get(plotIndex);
  if (!sprites) return;
  for (const [key, sprite] of Object.entries(sprites)) sprite.visible = key === stage;
}

function createPlotSprites(buildingId: string, plotIndex: number): void {
  const assets = buildingAssets.get(buildingId)!;
  const sprites = {} as Record<ConstructionStage, THREE.Sprite>;
  const heights: Record<ConstructionStage, number> = { foundation: 2.7, frame: 3.0, late: 3.15, complete: 3.25 };
  for (const stage of ["foundation", "frame", "late", "complete"] as ConstructionStage[]) {
    const sprite = spriteFromAsset(assets[stage], heights[stage]);
    const plot = getBuildingPosition(buildingId);
    sprite.position.set(plot.x, plot.y + sprite.scale.y / 2, 1.5);
    sprite.renderOrder = 20 + plotIndex;
    sprite.visible = false;
    sprites[stage] = sprite;
    scene.add(sprite);
  }
  plotSprites.set(plotIndex, sprites);
  plotBuildingIds.set(plotIndex, buildingId);
}

function showMilestone(title: string, copy: string, final = false): void {
  milestoneKicker.textContent = final ? "EIGHT MOVES COMPLETE" : "CIVIC UPGRADE";
  milestoneTitle.textContent = title;
  milestoneCopy.textContent = copy;
  milestone.classList.add("visible");
  milestoneUntil = animationElapsed + (final ? 6 : 3.5);
}

function renderBuildPanel(): void {
  if (simulation.state.mode !== "awaiting-choice") return;
  buildOptions.replaceChildren();
  moveChip.textContent = `MOVE ${simulation.state.move} OF ${TOTAL_MOVES}`;
  for (const buildingId of simulation.state.availableBuildingIds) {
    const building = BUILDINGS[buildingId];
    const button = document.createElement("button");
    button.className = "build-card";
    button.type = "button";
    button.innerHTML = `<img src="${assetUrl(buildingFilename(buildingId, "complete"))}" alt="${building.name}" /><span class="build-copy"><span class="build-name">${building.name}</span><span class="build-description">${building.description}</span><span class="build-benefit"><b>Role</b> ${building.benefit} · ${building.unlocks}</span></span><span class="build-cta">Build</span>`;
    button.addEventListener("click", () => beginConstruction(buildingId));
    buildOptions.appendChild(button);
  }
  buildPanel.classList.remove("hidden");
  const optionCount = simulation.state.availableBuildingIds.length;
  const choiceCopy = optionCount === 1 ? "build the final remaining district" : `choose one of ${optionCount} buildings`;
  setStatus(`Move ${simulation.state.move} ready — ${choiceCopy}`, 0);
}

function beginConstruction(buildingId: string): void {
  const events = simulation.chooseBuilding(buildingId);
  const event = events.find((item) => item.type === "construction-started");
  if (!event || event.type !== "construction-started") return;
  createPlotSprites(buildingId, event.plotIndex);
  showRoadForBuilding(buildingId);
  showPlotStage(event.plotIndex, "foundation");
  const plot = getBuildingPosition(buildingId);
  placementPad.position.set(plot.x, plot.y + 0.12, 0.5);
  placementPad.visible = true;
  buildPanel.classList.add("hidden");
  milestone.classList.remove("visible");
  worker.visible = true;
  placeWorker(civicGround);
  useClip("walk", "southeast", 0);
  setStatus(`${BUILDINGS[buildingId].name} approved — builders mobilizing`, 0);
}

function renderConstruction(): void {
  const buildingId = simulation.state.selectedBuildingId!;
  const plotIndex = simulation.state.activePlotIndex!;
  const plot = getBuildingPosition(buildingId);
  const progress = simulation.constructionProgress;
  const elapsed = simulation.state.constructionElapsed;
  const name = BUILDINGS[buildingId].name;
  placementMaterial.opacity = 0.13 + Math.sin(animationElapsed * 5) * 0.05;
  worker.visible = true;

  if (progress < 0.22) {
    setStatus(`Surveying the ${name} site`, progress);
    moveWorker(civicGround, plot, progress / 0.22);
    useClip("walk", "southeast", frameFor("walk", "southeast", elapsed));
    showPlotStage(plotIndex, "foundation");
  } else if (progress < 0.5) {
    setStatus(`Laying the ${name} foundation`, progress);
    placeWorker(plot);
    useClip("chop", "southwest", frameFor("chop", "southwest", elapsed));
    showPlotStage(plotIndex, "foundation");
  } else if (progress < 0.76) {
    setStatus(`Raising the ${name} frame`, progress);
    placeWorker(plot);
    useClip("chop", "southwest", frameFor("chop", "southwest", elapsed));
    showPlotStage(plotIndex, "frame");
  } else if (progress < 0.94) {
    setStatus(`Finishing the ${name}`, progress);
    placeWorker(plot);
    useClip("chop", "southwest", frameFor("chop", "southwest", elapsed));
    showPlotStage(plotIndex, "late");
  } else {
    setStatus(`Opening the new ${name}`, progress);
    showPlotStage(plotIndex, "complete");
  }
}

function renderWoodcutterActivity(): void {
  const plotIndex = simulation.state.builtBuildingIds.indexOf("woodcutter");
  if (plotIndex < 0) { worker.visible = false; return; }
  const home = getBuildingPosition("woodcutter");
  const cycleDuration = HARVEST_PHASES.reduce((sum, phase) => sum + phase.duration, 0);
  let cursor = animationElapsed % cycleDuration;
  let phase: (typeof HARVEST_PHASES)[number] = HARVEST_PHASES[0];
  for (const candidate of HARVEST_PHASES) {
    if (cursor <= candidate.duration) { phase = candidate; break; }
    cursor -= candidate.duration;
  }
  const progress = cursor / phase.duration;
  worker.visible = true;
  if (phase.name === "travel") {
    moveWorker(home, treeGround, progress);
    useClip("walk", "southeast", frameFor("walk", "southeast", cursor));
  } else if (phase.name === "chop" || phase.name === "fall") {
    placeWorker(treeGround);
    useClip("chop", "southeast", frameFor("chop", "southeast", cursor));
  } else if (phase.name === "pickup") {
    placeWorker(treeGround);
    useClip("pickup", "southeast", Math.min(7, Math.floor(progress * 8)));
  } else if (phase.name === "carry") {
    moveWorker(treeGround, home, progress);
    useClip("carry", "southwest", frameFor("carry", "southwest", cursor));
  } else {
    placeWorker(home);
    useClip("pickup", "southwest", 7 - Math.min(7, Math.floor(progress * 8)));
  }
}

function handleSimulationEvents(events: SimulationEvent[]): void {
  for (const event of events) {
    if (event.type === "construction-complete") {
      placementPad.visible = false;
      showPlotStage(event.plotIndex, "complete");
      const completedMove = event.plotIndex + 1;
      const copy = completedMove <= 8
        ? `Completed on Move ${completedMove}. The civic center also advanced.`
        : `Completed on Move ${completedMove}. The Grand Town Hall now anchors the expanding city.`;
      showMilestone(BUILDINGS[event.buildingId].name, copy);
    } else if (event.type === "civic-upgraded") {
      setCivicLevel(event.level);
    } else if (event.type === "choices-ready") {
      renderBuildPanel();
    } else if (event.type === "resource-produced") {
      resourceElements.get(event.resource)!.textContent = String(event.total);
      productionPulseUntil.set(event.buildingId, animationElapsed + 0.8);
    } else if (event.type === "population-changed") {
      populationLabel.textContent = String(event.total);
      syncVillagers(event.total);
    } else if (event.type === "game-complete") {
      worker.visible = false;
      buildPanel.classList.add("hidden");
      showMilestone("Opening city established", "Eight chosen districts surround the Grand Town Hall. The seven unbuilt districts remain possibilities for another city.", true);
      setStatus("Eight chosen city buildings are operating", 1);
    }
  }
  updateHud();
}

function renderProductionPulses(): void {
  for (const [plotIndex, buildingId] of plotBuildingIds) {
    const sprite = plotSprites.get(plotIndex)?.complete;
    if (!sprite?.visible) continue;
    const base = sprite.userData.baseScale as THREE.Vector3;
    const active = (productionPulseUntil.get(buildingId) ?? 0) > animationElapsed;
    const bump = active ? 1 + Math.sin((productionPulseUntil.get(buildingId)! - animationElapsed) * Math.PI * 4) * 0.025 : 1;
    sprite.scale.set(base.x * bump, base.y * bump, 1);
  }
}

function resetSettlement(): void {
  simulation.reset();
  for (const sprites of plotSprites.values()) {
    for (const sprite of Object.values(sprites)) scene.remove(sprite);
  }
  plotSprites.clear();
  plotBuildingIds.clear();
  productionPulseUntil.clear();
  districtRoads.forEach((road) => { road.visible = false; });
  buildingRoads.forEach((road) => { road.visible = false; });
  animationElapsed = 0;
  milestoneUntil = 0;
  playing = true;
  playToggle.textContent = "Pause";
  placementPad.visible = false;
  milestone.classList.remove("visible");
  setCivicLevel(0);
  updateHud();
  syncVillagers(simulation.state.population);
  worker.visible = true;
  placeWorker(civicGround);
  useClip("walk", "southeast", 0);
  renderBuildPanel();
}

function resize(): void {
  const width = viewport.clientWidth;
  const height = viewport.clientHeight;
  renderer.setSize(width, height, false);
  const aspect = width / Math.max(height, 1);
  const viewHeight = 40;
  camera.left = (-viewHeight * aspect) / 2;
  camera.right = (viewHeight * aspect) / 2;
  camera.top = viewHeight / 2;
  camera.bottom = -viewHeight / 2;
  camera.updateProjectionMatrix();
}

async function initialize(): Promise<void> {
  const clipDefinitions: Array<[AnimatedClipName, number]> = [["walk", 9.0909], ["chop", 9.5238], ["pickup", 8], ["carry", 9.0909]];
  const directions: Direction[] = ["southeast", "southwest"];
  await Promise.all(clipDefinitions.flatMap(([name, fps]) => directions.map(async (direction) => {
    const action = name === "pickup" || name === "carry" ? `${name}-log` : name;
    clips.set(`${name}:${direction}`, await loadSheet(`woodcutter-male-01-${action}-${direction}-sheet-2x-v1.png`, fps));
  })));

  await Promise.all(Object.keys(BUILDINGS).map(async (buildingId) => {
    const stages = {} as Record<ConstructionStage, SpriteAsset>;
    await Promise.all((["foundation", "frame", "late", "complete"] as ConstructionStage[]).map(async (stage) => {
      stages[stage] = await loadSpriteAsset(buildingFilename(buildingId, stage));
    }));
    buildingAssets.set(buildingId, stages);
  }));

  await Promise.all(Array.from({ length: TOTAL_SETTLEMENT_LEVELS }, async (_, level) => {
    const asset = await loadSpriteAsset(`settlement-level-${level}-2x-v1.png`);
    const sprite = spriteFromAsset(asset, 3.5 + level * 0.16);
    sprite.position.set(civicGround.x, civicGround.y + sprite.scale.y / 2, 1);
    sprite.renderOrder = 8;
    sprite.visible = false;
    civicSprites[level] = sprite;
    scene.add(sprite);
  }));

  treeSprite = await loadCroppedSprite("deciduous-01-healthy-2x-v1.png", { image: [640, 512], bbox: [0, 49, 325, 504], height: 4.25 });
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

  resetSettlement();
  resize();
  loading.classList.add("hidden");
}

playToggle.addEventListener("click", () => {
  playing = !playing;
  playToggle.textContent = playing ? "Pause" : "Play";
});
restartButton.addEventListener("click", resetSettlement);
speedInput.addEventListener("input", () => {
  speed = Number(speedInput.value);
  speedValue.value = `${speed}×`;
});
gridToggle.addEventListener("change", () => { grid.visible = gridToggle.checked; });
window.addEventListener("resize", resize);

const timer = new THREE.Timer();
timer.connect(document);
renderer.setAnimationLoop((timestamp) => {
  timer.update(timestamp);
  const delta = Math.min(timer.getDelta(), 0.05);
  if (playing && loading.classList.contains("hidden")) {
    animationElapsed += delta * speed;
    handleSimulationEvents(simulation.update(delta * speed));
    if (simulation.state.mode === "construction") renderConstruction();
    else if (simulation.state.mode !== "complete") renderWoodcutterActivity();
    renderVillagers();
    if (milestone.classList.contains("visible") && animationElapsed >= milestoneUntil) milestone.classList.remove("visible");
    renderProductionPulses();
  }
  renderer.render(scene, camera);
});

initialize().catch((error: unknown) => {
  console.error(error);
  loading.innerHTML = `<strong>Could not load the settlement.</strong><span>${String(error)}</span>`;
});
