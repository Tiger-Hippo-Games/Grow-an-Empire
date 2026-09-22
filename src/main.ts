import * as THREE from "three";
import "./styles.css";

type Direction = "southeast" | "southwest" | "northeast" | "northwest";
type AnimatedClipName = "walk" | "chop" | "pickup" | "carry";
type PhaseName =
  | "travel"
  | "chop"
  | "fall"
  | "pickup"
  | "carry"
  | "deliver"
  | "stockpile";

interface SheetClip {
  texture: THREE.Texture;
  fps: number;
  frames: number;
}

interface Phase {
  name: PhaseName;
  label: string;
  duration: number;
}

interface CropSpec {
  image: [number, number];
  bbox: [number, number, number, number];
  height: number;
}

const viewport = document.querySelector<HTMLElement>("#viewport");
const loading = document.querySelector<HTMLElement>("#loading");
const phaseLabel = document.querySelector<HTMLElement>("#phase");
const progressFill = document.querySelector<HTMLElement>("#phase-progress");
const cycleLabel = document.querySelector<HTMLElement>("#cycle");
const frameLabel = document.querySelector<HTMLElement>("#frame");
const logsLabel = document.querySelector<HTMLElement>("#logs");
const playToggle = document.querySelector<HTMLButtonElement>("#play-toggle");
const restartButton = document.querySelector<HTMLButtonElement>("#restart");
const speedInput = document.querySelector<HTMLInputElement>("#speed");
const speedValue = document.querySelector<HTMLOutputElement>("#speed-value");
const gridToggle = document.querySelector<HTMLInputElement>("#grid-toggle");

if (
  !viewport || !loading || !phaseLabel || !progressFill || !cycleLabel ||
  !frameLabel || !logsLabel || !playToggle || !restartButton || !speedInput ||
  !speedValue || !gridToggle
) {
  throw new Error("Required interface element is missing");
}

const importedAssets = import.meta.glob<string>(
  [
    "../Assets/Art/Production/Characters/WoodcutterMale01/Runtime2x/Sheets/*.png",
    "../Assets/Art/Production/Characters/WoodcutterMale01/Runtime2x/Idle/*.png",
    "../Assets/Art/Production/Environment/Trees/Deciduous01/Runtime2x/*.png",
    "../Assets/Art/Production/Props/LogStockpile01/Runtime2x/log-stockpile-01-state-*.png",
  ],
  { eager: true, query: "?url", import: "default" },
);

function assetUrl(filename: string): string {
  const match = Object.entries(importedAssets).find(([path]) => path.endsWith(filename));
  if (!match) throw new Error(`Bundled asset not found: ${filename}`);
  return match[1];
}

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
  const column = normalized % 4;
  const row = Math.floor(normalized / 4);
  clip.texture.offset.set(column * 0.25, row === 0 ? 0.5 : 0);
}

function createIsoGrid(): THREE.Group {
  const group = new THREE.Group();
  const positions: number[] = [];
  const width = 13;
  const halfRows = 8;
  for (let row = -halfRows; row <= halfRows; row += 1) {
    const y = row * 0.38;
    positions.push(-width, y - width * 0.5, 0, width, y + width * 0.5, 0);
    positions.push(-width, y + width * 0.5, 0, width, y - width * 0.5, 0);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({ color: 0x526e43, transparent: true, opacity: 0.35 });
  group.add(new THREE.LineSegments(geometry, material));
  group.position.y = -1.55;
  group.scale.y = 0.52;
  group.renderOrder = -10;
  return group;
}

const phases: Phase[] = [
  { name: "travel", label: "Walking to the harvest tree", duration: 3.6 },
  { name: "chop", label: "Chopping the tree", duration: 3.1 },
  { name: "fall", label: "Tree falling", duration: 1.5 },
  { name: "pickup", label: "Picking up a log", duration: 1.15 },
  { name: "carry", label: "Carrying timber to storage", duration: 3.8 },
  { name: "deliver", label: "Delivering the log", duration: 1.15 },
  { name: "stockpile", label: "Stockpile updated", duration: 1.1 },
];

const workerStartX = -3.5;
const treeWorkX = 2.15;
const stockpileWorkX = -2.75;
const workerY = -0.72;

let phaseIndex = 0;
let phaseElapsed = 0;
let cycle = 1;
let deliveredLogs = 0;
let playing = true;
let speed = 1;

const grid = createIsoGrid();
scene.add(grid);

const clips = new Map<string, SheetClip>();
const treeSprites: Record<string, THREE.Sprite> = {};
const stockpileSprites: THREE.Sprite[] = [];

const workerMaterial = new THREE.SpriteMaterial({ transparent: true, depthTest: false });
const worker = new THREE.Sprite(workerMaterial);
worker.scale.set(2.25, 2.25, 1);
worker.position.set(workerStartX, workerY, 3);
worker.renderOrder = 20;
scene.add(worker);

let stockpileLevel = 1;
const worldBaseline = -1.67;

function showOnlyTree(name: string): void {
  for (const [key, sprite] of Object.entries(treeSprites)) sprite.visible = key === name;
}

function showStockpile(level: number): void {
  stockpileLevel = THREE.MathUtils.clamp(level, 1, 4);
  stockpileSprites.forEach((sprite, index) => { sprite.visible = index === stockpileLevel - 1; });
  logsLabel.textContent = `${stockpileLevel - 1} / 3`;
}

function useClip(name: AnimatedClipName, direction: Direction, frame: number): void {
  const clip = clips.get(`${name}:${direction}`);
  if (!clip) throw new Error(`Clip not loaded: ${name}:${direction}`);
  setSheetFrame(clip, frame);
  workerMaterial.map = clip.texture;
  workerMaterial.needsUpdate = true;
  frameLabel.textContent = `${frame + 1} / 8`;
}

function frameFor(clip: SheetClip, elapsed: number, reverse = false): number {
  const frame = Math.floor(elapsed * clip.fps) % clip.frames;
  return reverse ? clip.frames - 1 - frame : frame;
}

function phaseProgress(): number {
  return THREE.MathUtils.clamp(phaseElapsed / phases[phaseIndex].duration, 0, 1);
}

function enterPhase(): void {
  const phase = phases[phaseIndex];
  phaseLabel.textContent = phase.label;
  if (phase.name === "travel") {
    showOnlyTree("healthy");
    worker.visible = true;
    worker.position.x = workerStartX;
  } else if (phase.name === "chop") {
    worker.position.x = treeWorkX;
  } else if (phase.name === "fall") {
    worker.visible = false;
    showOnlyTree("notched");
  } else if (phase.name === "pickup") {
    worker.visible = true;
    worker.position.x = treeWorkX;
    showOnlyTree("felled");
  } else if (phase.name === "carry") {
    worker.position.x = treeWorkX;
  } else if (phase.name === "deliver") {
    worker.position.x = stockpileWorkX;
  } else if (phase.name === "stockpile") {
    deliveredLogs += 1;
    showStockpile(Math.min(4, deliveredLogs + 1));
    worker.visible = true;
  }
}

function advancePhase(): void {
  phaseElapsed = 0;
  phaseIndex += 1;
  if (phaseIndex >= phases.length) {
    phaseIndex = 0;
    cycle += 1;
    if (deliveredLogs >= 3) {
      deliveredLogs = 0;
      showStockpile(1);
    }
    cycleLabel.textContent = String(cycle);
  }
  enterPhase();
}

function updateSimulation(delta: number): void {
  phaseElapsed += delta * speed;
  const phase = phases[phaseIndex];
  const progress = phaseProgress();
  progressFill.style.width = `${progress * 100}%`;

  if (phase.name === "travel") {
    const clip = clips.get("walk:southeast")!;
    useClip("walk", "southeast", frameFor(clip, phaseElapsed));
    worker.position.x = THREE.MathUtils.lerp(workerStartX, treeWorkX, progress);
  } else if (phase.name === "chop") {
    const clip = clips.get("chop:southeast")!;
    const frame = frameFor(clip, phaseElapsed);
    useClip("chop", "southeast", frame);
    if (phaseElapsed > 0.8) showOnlyTree("notched");
  } else if (phase.name === "fall") {
    frameLabel.textContent = "world";
    if (progress < 0.34) showOnlyTree("notched");
    else if (progress < 0.76) showOnlyTree("falling");
    else showOnlyTree("felled");
  } else if (phase.name === "pickup") {
    const clip = clips.get("pickup:southeast")!;
    useClip("pickup", "southeast", Math.min(7, Math.floor(progress * 8)));
  } else if (phase.name === "carry") {
    const clip = clips.get("carry:southwest")!;
    useClip("carry", "southwest", frameFor(clip, phaseElapsed));
    worker.position.x = THREE.MathUtils.lerp(treeWorkX, stockpileWorkX, progress);
  } else if (phase.name === "deliver") {
    const frame = 7 - Math.min(7, Math.floor(progress * 8));
    useClip("pickup", "southwest", frame);
  } else {
    frameLabel.textContent = "hold";
  }

  if (phaseElapsed >= phase.duration) advancePhase();
}

function resetSimulation(): void {
  phaseIndex = 0;
  phaseElapsed = 0;
  cycle = 1;
  deliveredLogs = 0;
  cycleLabel.textContent = "1";
  showStockpile(1);
  enterPhase();
}

function resize(): void {
  const width = viewport.clientWidth;
  const height = viewport.clientHeight;
  renderer.setSize(width, height, false);
  const aspect = width / Math.max(height, 1);
  const viewHeight = aspect < 1 ? 9.5 : 7.8;
  camera.left = (-viewHeight * aspect) / 2;
  camera.right = (viewHeight * aspect) / 2;
  camera.top = viewHeight / 2;
  camera.bottom = -viewHeight / 2;
  camera.updateProjectionMatrix();
}

async function initialize(): Promise<void> {
  const directions: Direction[] = ["southeast", "southwest", "northeast", "northwest"];
  const clipDefinitions: Array<[AnimatedClipName, number]> = [
    ["walk", 9.0909],
    ["chop", 9.5238],
    ["pickup", 8],
    ["carry", 9.0909],
  ];
  await Promise.all(
    clipDefinitions.flatMap(([name, fps]) =>
      directions.map(async (direction) => {
        const action = name === "pickup" || name === "carry" ? `${name}-log` : name;
        const filename = `woodcutter-male-01-${action}-${direction}-sheet-2x-v1.png`;
        clips.set(`${name}:${direction}`, await loadSheet(filename, fps));
      }),
    ),
  );

  const treeSpecs: Record<string, [string, CropSpec]> = {
    healthy: ["deciduous-01-healthy-2x-v1.png", { image: [640, 512], bbox: [0, 49, 325, 504], height: 4.7 }],
    notched: ["deciduous-01-notched-2x-v1.png", { image: [640, 512], bbox: [0, 51, 325, 509], height: 4.7 }],
    falling: ["deciduous-01-falling-southeast-2x-v1.png", { image: [640, 512], bbox: [28, 42, 616, 500], height: 3.75 }],
    felled: ["deciduous-01-felled-2x-v1.png", { image: [640, 512], bbox: [94, 143, 597, 490], height: 2.35 }],
  };
  for (const [name, [filename, crop]] of Object.entries(treeSpecs)) {
    const sprite = await loadCroppedSprite(filename, crop);
    sprite.position.set(3.25, worldBaseline + sprite.scale.y / 2, 1);
    sprite.renderOrder = 5;
    treeSprites[name] = sprite;
    scene.add(sprite);
  }

  const stockpileCrops: CropSpec[] = [
    { image: [384, 256], bbox: [85, 16, 300, 234], height: 1.45 },
    { image: [384, 256], bbox: [77, 20, 306, 234], height: 1.45 },
    { image: [384, 256], bbox: [78, 21, 307, 235], height: 1.45 },
    { image: [384, 256], bbox: [78, 21, 307, 233], height: 1.45 },
  ];
  for (let index = 0; index < 4; index += 1) {
    const sprite = await loadCroppedSprite(
      `log-stockpile-01-state-${String(index + 1).padStart(2, "0")}-2x-v1.png`,
      stockpileCrops[index],
    );
    sprite.position.set(-3.35, worldBaseline + sprite.scale.y / 2, 2);
    sprite.renderOrder = 10;
    stockpileSprites.push(sprite);
    scene.add(sprite);
  }

  showOnlyTree("healthy");
  showStockpile(1);
  resetSimulation();
  resize();
  loading.classList.add("hidden");
}

playToggle.addEventListener("click", () => {
  playing = !playing;
  playToggle.textContent = playing ? "Pause" : "Play";
});
restartButton.addEventListener("click", resetSimulation);
speedInput.addEventListener("input", () => {
  speed = Number(speedInput.value);
  speedValue.value = `${speed}×`;
});
gridToggle.addEventListener("change", () => { grid.visible = gridToggle.checked; });
window.addEventListener("resize", resize);

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const delta = Math.min(clock.getDelta(), 0.05);
  if (playing && loading.classList.contains("hidden")) updateSimulation(delta);
  renderer.render(scene, camera);
});

initialize().catch((error: unknown) => {
  console.error(error);
  loading.innerHTML = `<strong>Could not load the prototype.</strong><span>${String(error)}</span>`;
});
