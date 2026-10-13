import { BUILDINGS } from "../../src/game/content";
import { assetUrl } from "../../src/render/assetCatalog";
import { createSceneSetup } from "../../src/render/sceneSetup";
import { createCityLayout, getBuildingPosition, loadEmptyTerrain, loadForest } from "../../src/render/cityLayout";
import { createCivicCenter } from "../../src/render/civicCenter";
import { loadSpriteAsset, spriteFromAsset } from "../../src/render/spriteAssets";
import type { Sprite } from "three";

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
