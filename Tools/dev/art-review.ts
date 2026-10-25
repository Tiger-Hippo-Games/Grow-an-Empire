import { BUILDINGS } from "../../src/game/content";
import { assetUrl } from "../../src/render/assetCatalog";
import { createSceneSetup } from "../../src/render/sceneSetup";
import { createCityLayout, getBuildingPosition, loadEmptyTerrain, loadForest } from "../../src/render/cityLayout";
import { createCivicCenter } from "../../src/render/civicCenter";
import { loadSpriteAsset, spriteFromAsset } from "../../src/render/spriteAssets";
import type { Sprite } from "three";
import { createCharacterAssets } from "../../src/render/characterAssets";
import { createVillagerField } from "../../src/render/villagers";

const NEW = ["baoli", "prakara", "gajashala", "dharma-stambha", "burj", "sarai", "koshagar", "dharmashala"];
const STAGES = ["foundation", "frame", "late", "complete"] as const;
type Stage = typeof STAGES[number];
const HEIGHTS = { foundation: 5.4, frame: 6, late: 6.3, complete: 6.5 };
const suffix = { foundation: "construction-01-foundation", frame: "construction-02-frame", late: "construction-03-late", complete: "level-1" };
const filename = (id: string, stage: Stage): string => `${id}-${suffix[stage]}-2x-v1.png`;
const status = document.getElementById("status")!;
const viewport = document.getElementById("viewport")!;
const { renderer, scene, camera, resize, viewBounds } = createSceneSetup(viewport);
const layout = createCityLayout(scene);
const civic = createCivicCenter(scene, draw);
const characters = createCharacterAssets(draw);
let workforce: ReturnType<typeof createVillagerField>;
let motionPlaying = true, motionElapsed = 0, motionReady = false;
const built = Object.keys(BUILDINGS);
const sprites = new Map<string, Partial<Record<Stage, Sprite>>>();
let onlyNew = false;
let selectedStage: Stage = "complete";

function draw(): void { renderer.render(scene, camera); }
function applyView(): void {
  sprites.forEach((stages, id) => {
    for (const stage of STAGES) {
      const sprite = stages[stage];
      if (sprite) sprite.visible = stage === (NEW.includes(id) ? selectedStage : "complete") && (!onlyNew || NEW.includes(id));
    }
  });
  draw();
}
function inspect(id: string): void {
  const host = document.getElementById("stages")!;
  host.replaceChildren();
  for (const stage of STAGES) {
    const figure = document.createElement("figure");
    const img = document.createElement("img");
    img.src = assetUrl(filename(id, stage));
    img.alt = `${BUILDINGS[id].name}: ${stage}`;
    const caption = document.createElement("figcaption");
    caption.textContent = `${BUILDINGS[id].name} · ${stage}`;
    figure.append(img, caption);
    host.append(figure);
  }
}
async function boot(): Promise<void> {
  const [terrain] = await Promise.all([loadEmptyTerrain(scene), loadForest(scene), civic.load(8)]);
  civic.setLevel(8);
  await characters.load();
  await Promise.all(["builder", "farmer", "woodcutter", "merchant", "quarry", "baker", "blacksmith", "spearman", "miner", "archer", "horseman", "militia", "swordsman"].map(role => characters.ensureRole(role as Parameters<typeof characters.ensureRole>[0], true)));
  workforce = createVillagerField(scene, characters);
  workforce.syncVillagers(built);
  workforce.syncGarrison({ swordsmen: 14, archers: 14, horsemen: 14 });
  resize();
  const bounds = viewBounds();
  terrain.fit(bounds.width, bounds.height, bounds.centerX, bounds.centerY);
  const ids = Object.keys(BUILDINGS);
  await Promise.all(ids.map(async (id, index) => {
    const stages: Partial<Record<Stage, Sprite>> = {};
    await Promise.all((NEW.includes(id) ? STAGES : ["complete"] as const).map(async stage => {
      const sprite = spriteFromAsset(await loadSpriteAsset(filename(id, stage)), HEIGHTS[stage]);
      const position = getBuildingPosition(id);
      sprite.position.set(position.x, position.y + sprite.scale.y / 2, 1.5);
      sprite.renderOrder = 20 + index;
      sprite.visible = false;
      scene.add(sprite);
      stages[stage] = sprite;
    }));
    sprites.set(id, stages);
  }));
  layout.syncBuiltBuildings(ids);
  layout.setCivicLevel(12);
  layout.update(100);
  workforce.setRoadScale(layout.roadScale);
  workforce.renderVillagers(0, built, 0);
  for (const role of ["builder", "farmer", "woodcutter"]) {
    const figure = document.createElement("figure"), image = document.createElement("img"), caption = document.createElement("figcaption");
    image.src = assetUrl(`${role}-walk64-master-v1.png`); image.alt = `${role}: 64 authored walk frames`;
    image.style.maxWidth = "700px";
    caption.textContent = `${role}: eight facing directions × eight stride poses`;
    figure.append(image, caption); document.getElementById("walk-atlases")!.append(figure);
  }
  motionReady = true;
  document.getElementById("motion-status")!.textContent = "24 building workers · 42 trained soldiers · presentation only";
  Object.assign(window, { __cityMotionReview: {
    snapshot: () => ({ elapsed: motionElapsed, playing: motionPlaying, ready: motionReady, soldiers: scene.children.filter(o => o.userData.armyRole && o.visible).length, citizens: scene.children.filter(o => typeof o.userData.citizenId === "number").map(o => ({ id: o.userData.citizenId, building: o.userData.buildingId, profession: o.userData.profession, x: o.position.x, y: o.position.y, visible: o.visible })) }),
    advance: advanceMotion,
  } });
  applyView();
  for (const id of NEW) {
    const button = document.createElement("button");
    button.textContent = BUILDINGS[id].name;
    button.addEventListener("click", () => inspect(id));
    document.getElementById("building-list")!.append(button);
  }
  inspect(NEW[0]);
  (document.getElementById("atlas") as HTMLImageElement).src = assetUrl("elephant-combat-south8-master-v1.png");
  status.textContent = "Ready · all 24 plots are shown for a spacing stress check; campaigns have 12–25 moves and can build all 24.";
  window.addEventListener("resize", () => { resize(); const b = viewBounds(); terrain.fit(b.width, b.height, b.centerX, b.centerY); draw(); });
}
function advanceMotion(seconds: number): void {
  for (let left = seconds; left > 1e-6; left -= 1 / 30) {
    motionElapsed += Math.min(left, 1 / 30);
    workforce.renderVillagers(motionElapsed, built, motionElapsed);
  }
  draw();
}
let lastFrame = 0;
function animate(now: number): void {
  const delta = Math.min(.05, Math.max(0, (now - lastFrame) / 1000)); lastFrame = now;
  if (motionReady && motionPlaying && !document.hidden) advanceMotion(delta);
  requestAnimationFrame(animate);
}
document.getElementById("motion-toggle")!.addEventListener("click", event => {
  motionPlaying = !motionPlaying;
  (event.currentTarget as HTMLButtonElement).setAttribute("aria-pressed", String(motionPlaying));
  (event.currentTarget as HTMLButtonElement).textContent = motionPlaying ? "Pause city motion" : "Play city motion";
});
document.getElementById("motion-step")!.addEventListener("click", () => advanceMotion(1));
requestAnimationFrame(animate);
for (const [id, flag] of [["all", false], ["new", true]] as const) {
  document.getElementById(id)!.addEventListener("click", () => {
    onlyNew = flag;
    document.getElementById("all")!.setAttribute("aria-pressed", String(!flag));
    document.getElementById("new")!.setAttribute("aria-pressed", String(flag));
    applyView();
  });
}
document.getElementById("stage")!.addEventListener("change", event => { selectedStage = (event.target as HTMLSelectElement).value as Stage; applyView(); });
boot().catch((error: unknown) => { console.warn("[Grow an Empire] Art review failed", error); status.textContent = "Art could not load. Check the console, export runtime art and reload."; });
