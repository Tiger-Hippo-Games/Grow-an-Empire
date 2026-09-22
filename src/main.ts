import * as THREE from "three";
import { OPENING_BUILD_ID } from "./game/content";
import { SettlementSimulation, type SimulationEvent } from "./game/settlementSimulation";
import { assetUrl } from "./render/assetCatalog";
import "./styles.css";

type Direction = "southeast" | "southwest";
type AnimatedClipName = "walk" | "chop" | "pickup" | "carry";

interface SheetClip {
  texture: THREE.Texture;
  fps: number;
  frames: number;
}

interface CropSpec {
  image: [number, number];
  bbox: [number, number, number, number];
  height: number;
}

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
const woodLabel = requireElement<HTMLElement>("#wood");
const buildPanel = requireElement<HTMLElement>("#build-panel");
const buildButton = requireElement<HTMLButtonElement>("#build-woodcutter");
const buildArt = requireElement<HTMLImageElement>("#build-card-art");
const milestone = requireElement<HTMLElement>("#milestone");
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
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  const aspect = (right - left) / (bottom - top);
  sprite.scale.set(crop.height * aspect, crop.height, 1);
  return sprite;
}

function setSheetFrame(clip: SheetClip, frame: number): void {
  const normalized = ((frame % clip.frames) + clip.frames) % clip.frames;
  clip.texture.offset.set((normalized % 4) * 0.25, Math.floor(normalized / 4) === 0 ? 0.5 : 0);
}

function createIsoGrid(): THREE.Group {
  const group = new THREE.Group();
  const positions: number[] = [];
  const width = 40;
  for (let row = -30; row <= 30; row += 1) {
    const y = row * 1.27;
    positions.push(-width, y - width * 0.5, 0, width, y + width * 0.5, 0);
    positions.push(-width, y + width * 0.5, 0, width, y - width * 0.5, 0);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({ color: 0x526e43, transparent: true, opacity: 0.32 });
  group.add(new THREE.LineSegments(geometry, material));
  group.scale.y = 0.52;
  group.renderOrder = -10;
  return group;
}

const campsiteGround = new THREE.Vector2(-11.35, -4.65);
const buildingGround = new THREE.Vector2(-1, -1.35);
const treeGround = new THREE.Vector2(10.7, 4);
const stockpileGround = new THREE.Vector2(1.65, -2.35);
const workerHome = new THREE.Vector2(-9, -3.35);
const builderPosition = new THREE.Vector2(1.65, -0.65);
const treeWorkPosition = new THREE.Vector2(8.7, 3);
const workerFootOffset = 0.95;

const grid = createIsoGrid();
scene.add(grid);

const placementMaterial = new THREE.MeshBasicMaterial({ color: 0xe6bd63, transparent: true, opacity: 0.18, depthTest: false });
const placementPad = new THREE.Mesh(new THREE.CircleGeometry(1.55, 48), placementMaterial);
placementPad.position.set(buildingGround.x, buildingGround.y + 0.12, 0.5);
placementPad.scale.y = 0.42;
placementPad.visible = false;
scene.add(placementPad);

const clips = new Map<string, SheetClip>();
const treeSprites: Record<string, THREE.Sprite> = {};
const buildingSprites: Record<string, THREE.Sprite> = {};
const stockpileSprites: THREE.Sprite[] = [];
let campsiteSprite: THREE.Sprite;

const workerMaterial = new THREE.SpriteMaterial({ transparent: true, depthTest: false });
const worker = new THREE.Sprite(workerMaterial);
worker.scale.set(2.25, 2.25, 1);
worker.position.set(workerHome.x, workerHome.y + workerFootOffset, 3);
worker.renderOrder = 20;
scene.add(worker);

const simulation = new SettlementSimulation();
let renderedHarvestPhaseIndex = -1;
let playing = true;
let speed = 1;

function placeWorker(position: THREE.Vector2): void {
  worker.position.set(position.x, position.y + workerFootOffset, 3);
}

function moveWorker(from: THREE.Vector2, to: THREE.Vector2, progress: number): void {
  worker.position.set(
    THREE.MathUtils.lerp(from.x, to.x, progress),
    THREE.MathUtils.lerp(from.y, to.y, progress) + workerFootOffset,
    3,
  );
}

function setStatus(label: string, progress: number): void {
  phaseLabel.textContent = label;
  progressFill.style.width = `${THREE.MathUtils.clamp(progress, 0, 1) * 100}%`;
}

function showOnlyTree(name: string): void {
  for (const [key, sprite] of Object.entries(treeSprites)) sprite.visible = key === name;
}

function showWoodcutterBuilding(name: string | null): void {
  for (const [key, sprite] of Object.entries(buildingSprites)) sprite.visible = key === name;
}

function showStockpile(level: number | null): void {
  stockpileSprites.forEach((sprite, index) => { sprite.visible = level !== null && index === level - 1; });
}

function useClip(name: AnimatedClipName, direction: Direction, frame: number): void {
  const clip = clips.get(`${name}:${direction}`);
  if (!clip) throw new Error(`Clip not loaded: ${name}:${direction}`);
  setSheetFrame(clip, frame);
  workerMaterial.map = clip.texture;
  workerMaterial.needsUpdate = true;
}

function frameFor(name: AnimatedClipName, direction: Direction, elapsed: number): number {
  const clip = clips.get(`${name}:${direction}`);
  if (!clip) throw new Error(`Clip not loaded: ${name}:${direction}`);
  return Math.floor(elapsed * clip.fps) % clip.frames;
}

function beginConstruction(): void {
  if (simulation.chooseBuilding(OPENING_BUILD_ID).length === 0) return;
  buildPanel.classList.add("hidden");
  milestone.classList.remove("visible");
  placementPad.visible = true;
  worker.visible = true;
  placeWorker(workerHome);
  showWoodcutterBuilding("foundation");
  useClip("walk", "southeast", 0);
  setStatus("Woodcutter approved — builders mobilizing", 0);
}

function renderConstruction(): void {
  const elapsed = simulation.state.constructionElapsed;
  const progress = simulation.constructionProgress;
  placementMaterial.opacity = 0.13 + Math.sin(elapsed * 5) * 0.05;

  if (progress < 0.22) {
    setStatus("Surveying the Woodcutter site", progress);
    moveWorker(workerHome, builderPosition, progress / 0.22);
    useClip("walk", "southeast", frameFor("walk", "southeast", elapsed));
    showWoodcutterBuilding("foundation");
  } else if (progress < 0.48) {
    setStatus("Laying the Woodcutter foundation", progress);
    placeWorker(builderPosition);
    useClip("chop", "southwest", frameFor("chop", "southwest", elapsed));
    showWoodcutterBuilding("foundation");
  } else if (progress < 0.74) {
    setStatus("Raising the timber frame", progress);
    useClip("chop", "southwest", frameFor("chop", "southwest", elapsed));
    showWoodcutterBuilding("frame");
  } else if (progress < 0.92) {
    setStatus("Finishing the Woodcutter lodge", progress);
    useClip("chop", "southwest", frameFor("chop", "southwest", elapsed));
    showWoodcutterBuilding("late");
  } else {
    setStatus("Assigning the settlement’s first woodcutter", progress);
    showWoodcutterBuilding("complete");
  }

}

function enterHarvestPhase(): void {
  const phase = simulation.harvestPhase;
  renderedHarvestPhaseIndex = simulation.state.harvestPhaseIndex;
  phaseLabel.textContent = phase.label;
  if (phase.name === "travel") {
    showOnlyTree("healthy");
    worker.visible = true;
    placeWorker(builderPosition);
    useClip("walk", "southeast", 0);
  } else if (phase.name === "chop") {
    placeWorker(treeWorkPosition);
    useClip("chop", "southeast", 0);
  } else if (phase.name === "fall") {
    worker.visible = false;
    showOnlyTree("notched");
  } else if (phase.name === "pickup") {
    worker.visible = true;
    placeWorker(treeWorkPosition);
    showOnlyTree("felled");
    useClip("pickup", "southeast", 0);
  } else if (phase.name === "carry") {
    placeWorker(treeWorkPosition);
    useClip("carry", "southwest", 0);
  } else if (phase.name === "deliver") {
    placeWorker(builderPosition);
    useClip("pickup", "southwest", 7);
  } else {
    woodLabel.textContent = String(simulation.state.wood);
    showStockpile(Math.min(4, simulation.state.wood + 1));
    worker.visible = true;
  }
}

function renderHarvest(): void {
  const phase = simulation.harvestPhase;
  const elapsed = simulation.state.harvestElapsed;
  const progress = simulation.harvestProgress;
  setStatus(phase.label, progress);

  if (phase.name === "travel") {
    moveWorker(builderPosition, treeWorkPosition, progress);
    useClip("walk", "southeast", frameFor("walk", "southeast", elapsed));
  } else if (phase.name === "chop") {
    useClip("chop", "southeast", frameFor("chop", "southeast", elapsed));
    if (progress > 0.32) showOnlyTree("notched");
  } else if (phase.name === "fall") {
    if (progress < 0.34) showOnlyTree("notched");
    else if (progress < 0.76) showOnlyTree("falling");
    else showOnlyTree("felled");
  } else if (phase.name === "pickup") {
    useClip("pickup", "southeast", Math.min(7, Math.floor(progress * 8)));
  } else if (phase.name === "carry") {
    moveWorker(treeWorkPosition, builderPosition, progress);
    useClip("carry", "southwest", frameFor("carry", "southwest", elapsed));
  } else if (phase.name === "deliver") {
    useClip("pickup", "southwest", 7 - Math.min(7, Math.floor(progress * 8)));
  }

}

function finishConstruction(): void {
  moveLabel.textContent = String(simulation.state.move);
  placementPad.visible = false;
  showWoodcutterBuilding("complete");
  showStockpile(1);
  milestone.classList.add("visible");
  enterHarvestPhase();
}

function handleSimulationEvents(events: SimulationEvent[]): void {
  for (const event of events) {
    if (event.type === "construction-complete") finishConstruction();
    else if (event.type === "wood-produced") {
      woodLabel.textContent = String(event.total);
      showStockpile(Math.min(4, event.total + 1));
    }
  }
}

function resetSettlement(): void {
  simulation.reset();
  renderedHarvestPhaseIndex = -1;
  playing = true;
  playToggle.textContent = "Pause";
  moveLabel.textContent = String(simulation.state.move);
  woodLabel.textContent = String(simulation.state.wood);
  buildPanel.classList.remove("hidden");
  milestone.classList.remove("visible");
  placementPad.visible = false;
  showWoodcutterBuilding(null);
  showStockpile(null);
  showOnlyTree("healthy");
  worker.visible = true;
  placeWorker(workerHome);
  useClip("walk", "southeast", 0);
  setStatus("Campsite established — choose the first build", 0);
}

function resize(): void {
  const width = viewport.clientWidth;
  const height = viewport.clientHeight;
  renderer.setSize(width, height, false);
  const aspect = width / Math.max(height, 1);
  const viewHeight = 35;
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

  campsiteSprite = await loadCroppedSprite("campsite-level-1-2x-v1.png", { image: [1254, 1254], bbox: [39, 21, 1236, 1254], height: 3.25 });
  campsiteSprite.position.set(campsiteGround.x, campsiteGround.y + campsiteSprite.scale.y / 2, 1);
  campsiteSprite.renderOrder = 4;
  scene.add(campsiteSprite);

  const buildingSpecs: Record<string, [string, CropSpec]> = {
    foundation: ["woodcutter-construction-01-foundation-2x-v1.png", { image: [768, 640], bbox: [93, 165, 674, 635], height: 2.45 }],
    frame: ["woodcutter-construction-02-frame-2x-v1.png", { image: [768, 640], bbox: [131, 151, 691, 602], height: 2.75 }],
    late: ["woodcutter-construction-03-late-2x-v1.png", { image: [768, 640], bbox: [124, 148, 676, 616], height: 2.95 }],
    complete: ["woodcutter-level-1-2x-v1.png", { image: [768, 640], bbox: [112, 149, 655, 610], height: 3.05 }],
  };
  for (const [name, [filename, crop]] of Object.entries(buildingSpecs)) {
    const sprite = await loadCroppedSprite(filename, crop);
    sprite.position.set(buildingGround.x, buildingGround.y + sprite.scale.y / 2, 1.5);
    sprite.renderOrder = 6;
    sprite.visible = false;
    buildingSprites[name] = sprite;
    scene.add(sprite);
  }

  const treeSpecs: Record<string, [string, CropSpec]> = {
    healthy: ["deciduous-01-healthy-2x-v1.png", { image: [640, 512], bbox: [0, 49, 325, 504], height: 4.25 }],
    notched: ["deciduous-01-notched-2x-v1.png", { image: [640, 512], bbox: [0, 51, 325, 509], height: 4.25 }],
    falling: ["deciduous-01-falling-southeast-2x-v1.png", { image: [640, 512], bbox: [28, 42, 616, 500], height: 3.45 }],
    felled: ["deciduous-01-felled-2x-v1.png", { image: [640, 512], bbox: [94, 143, 597, 490], height: 2.15 }],
  };
  for (const [name, [filename, crop]] of Object.entries(treeSpecs)) {
    const sprite = await loadCroppedSprite(filename, crop);
    sprite.position.set(treeGround.x, treeGround.y + sprite.scale.y / 2, 1);
    sprite.renderOrder = 5;
    treeSprites[name] = sprite;
    scene.add(sprite);
  }

  const stockpileCrops: CropSpec[] = [
    { image: [384, 256], bbox: [85, 16, 300, 234], height: 1.15 },
    { image: [384, 256], bbox: [77, 20, 306, 234], height: 1.15 },
    { image: [384, 256], bbox: [78, 21, 307, 235], height: 1.15 },
    { image: [384, 256], bbox: [78, 21, 307, 233], height: 1.15 },
  ];
  for (let index = 0; index < stockpileCrops.length; index += 1) {
    const sprite = await loadCroppedSprite(`log-stockpile-01-state-${String(index + 1).padStart(2, "0")}-2x-v1.png`, stockpileCrops[index]);
    sprite.position.set(stockpileGround.x, stockpileGround.y + sprite.scale.y / 2, 2);
    sprite.renderOrder = 10;
    sprite.visible = false;
    stockpileSprites.push(sprite);
    scene.add(sprite);
  }

  buildArt.src = assetUrl("woodcutter-level-1-2x-v1.png");
  resetSettlement();
  resize();
  loading.classList.add("hidden");
}

buildButton.addEventListener("click", beginConstruction);
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
    handleSimulationEvents(simulation.update(delta * speed));
    if (simulation.state.mode === "construction") renderConstruction();
    else if (simulation.state.mode === "harvesting") {
      if (renderedHarvestPhaseIndex !== simulation.state.harvestPhaseIndex) enterHarvestPhase();
      renderHarvest();
    }
  }
  renderer.render(scene, camera);
});

initialize().catch((error: unknown) => {
  console.error(error);
  loading.innerHTML = `<strong>Could not load the settlement.</strong><span>${String(error)}</span>`;
});
