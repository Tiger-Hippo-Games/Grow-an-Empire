import { Timer } from "three";
import { BUILDINGS } from "./game/content";
import { SettlementSimulation, type SimulationEvent } from "./game/settlementSimulation";
import { clearSavedSnapshot, loadSavedSnapshot, saveSnapshot } from "./game/saveGame";
import { createSceneSetup } from "./render/sceneSetup";
import { civicGround, createCityLayout, getBuildingPosition, loadForest } from "./render/cityLayout";
import { createCivicCenter } from "./render/civicCenter";
import { createWorkerAnimation } from "./render/workerAnimation";
import { createConstructionView } from "./render/constructionView";
import { createVillagerField } from "./render/villagers";
import { createHud, type HudStateSnapshot } from "./ui/hud";
import "./styles.css";

// This file is the orchestrator: it owns nothing about *how* to draw a
// building, animate a villager, or lay out a road — that lives in
// `render/*` and `ui/hud.ts`. It only owns *when* those things happen,
// driven by the simulation's state and events.

let playing = true;
let speed = 1;
let animationElapsed = 0;

const simulation = new SettlementSimulation();

const hud = createHud({
  onPlayToggle: () => {
    playing = !playing;
    hud.setPlayingLabel(playing);
  },
  onRestart: () => {
    clearSavedSnapshot();
    resetSettlement();
  },
  onSpeedChange: (value) => {
    speed = value;
    hud.setSpeedLabel(value);
  },
  onGridToggle: (visible) => {
    cityLayout.grid.visible = visible;
  },
  onSelectBuilding: (buildingId) => beginConstruction(buildingId),
});

const { renderer, scene, camera, resize } = createSceneSetup(hud.viewport);
const cityLayout = createCityLayout(scene);
const civicCenter = createCivicCenter(scene);
const workerAnimation = createWorkerAnimation(scene);
const constructionView = createConstructionView(scene, workerAnimation, cityLayout, hud.setStatus);
const villagerField = createVillagerField(scene, workerAnimation);

const timer = new Timer();
timer.connect(document);
function getFrameDelta(): number {
  timer.update();
  return Math.min(timer.getDelta(), 0.05);
}

function stateSnapshot(): HudStateSnapshot {
  return {
    mode: simulation.state.mode,
    move: simulation.state.move,
    population: simulation.state.population,
    resources: simulation.state.resources,
    availableBuildingIds: simulation.state.availableBuildingIds,
  };
}

function autosave(): void {
  saveSnapshot(simulation.serialize());
}

function beginConstruction(buildingId: string): void {
  const events = simulation.chooseBuilding(buildingId);
  const event = events.find((item) => item.type === "construction-started");
  if (!event || event.type !== "construction-started") return;

  constructionView.createPlotSprites(buildingId, event.plotIndex);
  cityLayout.showRoadForBuilding(buildingId);
  constructionView.showPlotStage(event.plotIndex, "foundation");
  const plot = getBuildingPosition(buildingId);
  cityLayout.placementPad.position.set(plot.x, plot.y + 0.12, 0.5);
  cityLayout.placementPad.visible = true;
  hud.hideBuildPanel();
  hud.hideMilestone();
  workerAnimation.worker.visible = true;
  workerAnimation.placeWorker(civicGround);
  workerAnimation.useClip("walk", "southeast", 0);
  hud.setStatus(`${BUILDINGS[buildingId].name} approved — builders mobilizing`, 0);
  autosave();
}

function handleSimulationEvents(events: SimulationEvent[]): void {
  for (const event of events) {
    if (event.type === "construction-complete") {
      cityLayout.placementPad.visible = false;
      constructionView.showPlotStage(event.plotIndex, "complete");
      cityLayout.syncBuiltBuildings(simulation.state.builtBuildingIds);
      const completedMove = event.plotIndex + 1;
      const copy = completedMove <= 8
        ? `Completed on Move ${completedMove}. The civic center also advanced.`
        : `Completed on Move ${completedMove}. The Grand Town Hall now anchors the expanding city.`;
      hud.showMilestone(BUILDINGS[event.buildingId].name, copy, animationElapsed);
    } else if (event.type === "civic-upgraded") {
      civicCenter.setLevel(event.level);
      cityLayout.setCivicLevel(event.level);
      hud.setCivicLevel(event.level);
    } else if (event.type === "choices-ready") {
      hud.renderBuildPanel(stateSnapshot());
    } else if (event.type === "economy-resolved") {
      for (const buildingId of event.activeBuildingIds) constructionView.markProduced(buildingId, animationElapsed);
    } else if (event.type === "population-changed") {
      villagerField.syncVillagers(event.total);
    } else if (event.type === "army-mustered") {
      villagerField.beginArmyMuster(event.report, animationElapsed);
      hud.renderArmyReport(event.report, simulation.buildOrderSummary().map(({ buildingId }) => BUILDINGS[buildingId].name));
    } else if (event.type === "game-complete") {
      workerAnimation.worker.visible = false;
      hud.hideBuildPanel();
      hud.showMilestone(
        simulation.state.armyReport?.outcome ?? "Army mustered",
        `Campaign score ${simulation.state.armyReport?.score ?? 0} against ${simulation.campaign.objective.enemyName}.`,
        animationElapsed,
        true,
      );
      hud.setStatus(`Campaign complete — ${simulation.state.armyReport?.outcome ?? "muster resolved"}`, 1);
    }
  }
  hud.updateHud(stateSnapshot());
  if (events.length > 0) autosave();
}

function resetSettlement(): void {
  simulation.reset();
  constructionView.clearPlots();
  cityLayout.hideAllRoads();
  cityLayout.setCivicLevel(0);
  animationElapsed = 0;
  playing = true;
  hud.setPlayingLabel(true);
  hud.setSpeedLabel(speed);
  cityLayout.placementPad.visible = false;
  hud.hideMilestone();
  hud.resetArmyReport();
  civicCenter.setLevel(0);
  hud.setCivicLevel(0);
  hud.updateHud(stateSnapshot());
  villagerField.syncVillagers(simulation.state.population);
  villagerField.clearArmyMuster();
  workerAnimation.worker.visible = true;
  workerAnimation.placeWorker(civicGround);
  workerAnimation.useClip("walk", "southeast", 0);
  hud.renderBuildPanel(stateSnapshot());
}

/** Rebuilds every render-side object to match a loaded save, without replaying construction or re-running `reset()`. */
function hydrateFromLoadedState(): void {
  constructionView.clearPlots();
  cityLayout.hideAllRoads();
  animationElapsed = 0;
  playing = true;
  hud.setPlayingLabel(true);
  hud.setSpeedLabel(speed);
  hud.hideMilestone();
  hud.resetArmyReport();
  villagerField.clearArmyMuster();

  simulation.state.builtBuildingIds.forEach((buildingId, plotIndex) => {
    constructionView.createPlotSprites(buildingId, plotIndex);
    cityLayout.showRoadForBuilding(buildingId);
    constructionView.showPlotStage(plotIndex, "complete");
  });
  cityLayout.syncBuiltBuildings(simulation.state.builtBuildingIds);

  civicCenter.setLevel(simulation.state.civicLevel);
  cityLayout.setCivicLevel(simulation.state.civicLevel);
  hud.setCivicLevel(simulation.state.civicLevel);
  hud.updateHud(stateSnapshot());
  villagerField.syncVillagers(simulation.state.population);

  if (simulation.state.mode === "construction") {
    const buildingId = simulation.state.selectedBuildingId!;
    const plotIndex = simulation.state.activePlotIndex!;
    constructionView.createPlotSprites(buildingId, plotIndex);
    cityLayout.showRoadForBuilding(buildingId);
    const plot = getBuildingPosition(buildingId);
    cityLayout.placementPad.position.set(plot.x, plot.y + 0.12, 0.5);
    cityLayout.placementPad.visible = true;
    hud.hideBuildPanel();
    constructionView.renderConstruction(
      buildingId,
      plotIndex,
      simulation.constructionProgress,
      simulation.state.constructionElapsed,
      animationElapsed,
    );
  } else if (simulation.state.mode === "awaiting-choice") {
    cityLayout.placementPad.visible = false;
    workerAnimation.worker.visible = true;
    workerAnimation.placeWorker(civicGround);
    workerAnimation.useClip("walk", "southeast", 0);
    hud.renderBuildPanel(stateSnapshot());
  } else {
    cityLayout.placementPad.visible = false;
    workerAnimation.worker.visible = false;
    hud.hideBuildPanel();
    if (simulation.state.armyReport) {
      villagerField.beginArmyMuster(simulation.state.armyReport, animationElapsed);
      hud.renderArmyReport(simulation.state.armyReport, simulation.buildOrderSummary().map(({ buildingId }) => BUILDINGS[buildingId].name));
      hud.setStatus(`Campaign complete — ${simulation.state.armyReport.outcome}`, 1);
    }
  }
}

window.addEventListener("resize", resize);
window.addEventListener("beforeunload", autosave);

async function initialize(): Promise<void> {
  await Promise.all([
    workerAnimation.loadClips(),
    constructionView.loadBuildingAssets(),
    civicCenter.load(),
    loadForest(scene),
  ]);

  const saved = loadSavedSnapshot();
  if (saved) {
    simulation.loadSnapshot(saved);
    hydrateFromLoadedState();
  } else {
    resetSettlement();
  }
  resize();
  hud.loading.classList.add("hidden");
}

renderer.setAnimationLoop(() => {
  if (playing && hud.loading.classList.contains("hidden")) {
    const delta = getFrameDelta() * speed;
    animationElapsed += delta;
    handleSimulationEvents(simulation.update(delta));
    if (simulation.state.mode === "construction") {
      constructionView.renderConstruction(
        simulation.state.selectedBuildingId!,
        simulation.state.activePlotIndex!,
        simulation.constructionProgress,
        simulation.state.constructionElapsed,
        animationElapsed,
      );
    } else if (simulation.state.mode !== "complete") {
      constructionView.renderWoodcutterActivity(animationElapsed, simulation.state.builtBuildingIds);
    }
    villagerField.renderVillagers(animationElapsed, simulation.state.builtBuildingIds);
    hud.updateMilestoneVisibility(animationElapsed);
    constructionView.renderProductionPulses(animationElapsed);
  }
  renderer.render(scene, camera);
});

initialize().catch((error: unknown) => {
  console.error(error);
  hud.loading.innerHTML = `<strong>Could not load the settlement.</strong><span>${String(error)}</span>`;
});
