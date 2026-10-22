/** Development-only fixture: production HUD and renderer, all plots, no save access. */
import { createHud } from "../../src/ui/hud";
import { BUILDINGS } from "../../src/game/content";
import { CAMPAIGNS } from "../../src/game/campaigns";
import { RESOURCE_NAMES } from "../../src/game/economy";
import { createSceneSetup } from "../../src/render/sceneSetup";
import { createCivicCenter } from "../../src/render/civicCenter";
import { getBuildingPosition, loadEmptyTerrain, loadForest } from "../../src/render/cityLayout";
import { loadSpriteAsset, spriteFromAsset } from "../../src/render/spriteAssets";
import { buildingFilename } from "../../src/render/constructionView";
import { Vector3, type Sprite } from "three";

const noop = () => {};
const hud = createHud({onPlayToggle:noop,onRestart:noop,onSpeedChange:noop,onGridToggle:noop,onSelectBuilding:noop,onSwapBuild:noop,onGather:noop,onMuteToggle:noop,onFullscreenToggle:noop,onReportToggle:noop,onTutorialModalChange:noop,onTutorialStarted:noop,onTutorialFinished:noop});
const {renderer,scene,camera,resize,viewBounds}=createSceneSetup(document.getElementById("viewport")!);
const sprites: Sprite[]=[];
let terrain: Awaited<ReturnType<typeof loadEmptyTerrain>>;
function draw() { resize(); if(terrain){const b=viewBounds();terrain.fit(b.width,b.height,b.centerX,b.centerY);} renderer.render(scene,camera); }
window.addEventListener("gae:layout",draw);
window.addEventListener("resize",draw);
const resources=Object.fromEntries(RESOURCE_NAMES.map(id=>[id,999]));
function offers(offset:number,words:boolean) {
  hud.renderBuildPanel({mode:"awaiting-choice",move:9,cards:Object.keys(BUILDINGS).slice(offset,offset+3).map(id=>({id,affordable:true,missing:{},swap:null})),canGather:true,hasMarketplace:false,summary:null,resources});
  document.documentElement.classList.toggle("words",words);
  draw();
}
function projected() {
  return sprites.map(sprite=>({name:sprite.name,corners:[[-1,-1],[-1,1],[1,-1],[1,1]].map(([x,y])=>{
    const p=new Vector3(sprite.position.x+x*sprite.scale.x/2,sprite.position.y+y*sprite.scale.y/2,sprite.position.z).project(camera);
    const v=document.getElementById("viewport")!.getBoundingClientRect();
    return {x:v.left+(p.x+1)*v.width/2,y:v.top+(1-p.y)*v.height/2};
  })}));
}
async function boot() {
  hud.setCampaign(CAMPAIGNS[0],0);
  hud.updateHud({mode:"awaiting-choice",move:9,population:50,trainedUnits:{archers:10,swordsmen:10,horsemen:10},resources,availableBuildingIds:[]});
  terrain=await loadEmptyTerrain(scene);
  await loadForest(scene);
  const civic=createCivicCenter(scene,draw);await civic.load(8);civic.setLevel(8);
  await Promise.all(Object.keys(BUILDINGS).map(async(id,index)=>{
    const sprite=spriteFromAsset(await loadSpriteAsset(buildingFilename(id,"complete")),6.5);
    const p=getBuildingPosition(id);sprite.position.set(p.x,p.y+sprite.scale.y/2,1.5);sprite.name=id;sprite.renderOrder=20+index;scene.add(sprite);sprites.push(sprite);
  }));
  document.getElementById("loading")!.classList.add("hidden");
  document.documentElement.dataset.booted="true";
  offers(0,true);
  Object.assign(window,{__frameReview:{offers,projected,ready:true}});
}
void boot();
