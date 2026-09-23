import { Timer } from "three";
import { BUILDINGS, OPENING_BUILD_OPTIONS, TOTAL_MOVES } from "./game/content";
import { SettlementSimulation, type SettlementSnapshot, type SimulationEvent } from "./game/settlementSimulation";
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
//
// Data flow, once per frame:
//   frame delta × speed → simulation.update() → events → handleSimulationEvents()
//   (one-off reactions: new plots, roads, HUD, autosave) → per-frame render calls
//   (construction animation, villagers, pulses) → renderer.render().

/** False while the game is paused (Pause button or tutorial modal). */
let playing = true;
/** Simulation speed multiplier (1, 2, 4, 8). */
let speed = 1;
/** Visual clock in seconds (scaled by speed, stops while paused). Drives every animation. */
let animationElapsed = 0;
/** Whether to resume play when the tutorial modal closes (i.e. it was playing when it opened). */
let resumeAfterTutorial = false;
/**
 * Becomes true once boot has finished and the world matches the simulation.
 * Until then the frame loop doesn't advance and autosave is disabled: saving
 * the blank pre-boot state would overwrite the player's real save if the page
 * is closed (or boot fails) while loading.
 */
let initialized = false;
/** True while a chosen building's art is loading; blocks double-clicks on the cards. */
let selectionPending = false;
/** Incremented on every restart, so an async selection from a previous run can tell it's stale. */
let runId = 0;
/** Set if the frame loop throws; the game pauses rather than throwing again 60 times a second. */
let loopFailed = false;

const simulation = new SettlementSimulation();

const hud = createHud({
  onPlayToggle: () => {
    playing = !playing;
    hud.setPlayingLabel(playing);
  },
  onRestart: () => {
    clearSavedSnapshot();
    resetSettlement();
    autosave();
  },
  onSpeedChange: (value) => {
    speed = value;
    hud.setSpeedLabel(value);
  },
  onGridToggle: (visible) => {
    cityLayout.grid.visible = visible;
  },
  onSelectBuilding: (buildingId) => beginConstruction(buildingId),
  onTutorialModalChange: (visible) => {
    if (visible) {
      resumeAfterTutorial = playing;
      playing = false;
      hud.setPlayingLabel(false);
    } else if (resumeAfterTutorial) {
      playing = true;
      resumeAfterTutorial = false;
      hud.setPlayingLabel(true);
    }
  },
});

const { renderer, scene, camera, resize } = createSceneSetup(hud.viewport);
const cityLayout = createCityLayout(scene);
const civicCenter = createCivicCenter(scene);
const workerAnimation = createWorkerAnimation(scene);
const constructionView = createConstructionView(scene, workerAnimation, cityLayout, hud.setStatus);
const villagerField = createVillagerField(scene, workerAnimation);

const timer = new Timer();
timer.connect(document); // Resets the delta when the tab becomes visible again, so a background tab doesn't cause a jump.

/**
 * Real seconds since the previous frame, capped at 50ms so a hitch never
 * advances the game by a large step. Called on every frame, paused or not,
 * so the first frame after un-pausing doesn't carry the whole pause.
 */
function getFrameDelta(): number {
  timer.update();
  return Math.min(timer.getDelta(), 0.05);
}

/** The subset of simulation state the HUD needs. */
function stateSnapshot(): HudStateSnapshot {
  return {
    mode: simulation.state.mode,
    move: simulation.state.move,
    population: simulation.state.population,
    resources: simulation.state.resources,
    availableBuildingIds: simulation.state.availableBuildingIds,
  };
}

/** Saves the current run to localStorage. Does nothing until boot has finished (see `initialized`). */
function autosave(): void {
  if (!initialized) return;
  saveSnapshot(simulation.serialize());
}

/**
 * Handles a click on a build card.
 *
 * The building's art is loaded *before* the simulation is told about the
 * choice. It's normally already cached (it's preloaded when the card is
 * offered), so this is instant. If it isn't, the game waits in the
 * awaiting-choice state, so construction time can't run out before the
 * building is visible. If the load fails, the choice is never committed:
 * the player sees a message and can pick again.
 */
async function beginConstruction(buildingId: string): Promise<void> {
  if (selectionPending || simulation.state.mode !== "awaiting-choice" || !simulation.state.availableBuildingIds.includes(buildingId)) return;
  const name = BUILDINGS[buildingId]?.name ?? buildingId;
  const startedInRun = runId;

  if (!constructionView.hasBuildingAssets(buildingId)) {
    selectionPending = true;
    hud.setBuildPanelBusy(true);
    hud.setStatus(`Preparing the ${name} plans…`, 0);
    try {
      await constructionView.ensureBuildingAssetsLoaded(buildingId);
    } catch (error) {
      console.error(error);
      if (startedInRun === runId) hud.setStatus(`Couldn't load the ${name} artwork. Check your connection and choose again.`, 0);
      return;
    } finally {
      selectionPending = false;
      hud.setBuildPanelBusy(false);
    }
    // The player restarted, or the state changed, while we were loading.
    if (startedInRun !== runId || simulation.state.mode !== "awaiting-choice") return;
  }

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
  hud.setStatus(`${name} approved — builders mobilizing`, 0);
  autosave();
}

/**
 * Applies one-off reactions to simulation events (see `SimulationEvent` for the
 * order they arrive in). Per-frame animation lives in the frame loop instead.
 * Autosaves whenever anything happened.
 */
function handleSimulationEvents(events: SimulationEvent[]): void {
  for (const event of events) {
    if (event.type === "construction-complete") {
      cityLayout.placementPad.visible = false;
      constructionView.showPlotStage(event.plotIndex, "complete");
      cityLayout.syncBuiltBuildings(simulation.state.builtBuildingIds);
      const completedMove = event.plotIndex + 1;
      // (The final move's toast is replaced right away by the game-complete one.)
      const copy = completedMove < TOTAL_MOVES
        ? `Completed on Move ${completedMove}. The civic center also advanced.`
        : `Completed on Move ${completedMove}. The Grand Town Hall now anchors the expanding city.`;
      hud.showMilestone(BUILDINGS[event.buildingId].name, copy, animationElapsed);
    } else if (event.type === "civic-upgraded") {
      civicCenter.setLevel(event.level);
      cityLayout.setCivicLevel(event.level);
      hud.setCivicLevel(event.level);
    } else if (event.type === "choices-ready") {
      // Kick off loading for the newly-offered building(s) as soon as they can
      // be picked, rather than blocking the build panel on it: the player
      // reads the cards for a while before clicking, so this normally finishes
      // well before it's needed. beginConstruction() awaits it again itself
      // as a safety net, so this is purely a head start, not a correctness
      // requirement.
      constructionView.loadBuildingAssets(event.options).catch((error: unknown) => console.error(error));
      hud.renderBuildPanel(stateSnapshot());
    } else if (event.type === "economy-resolved") {
      for (const buildingId of event.activeBuildingIds) constructionView.markProduced(buildingId, animationElapsed);
    } else if (event.type === "population-changed") {
      villagerField.syncVillagers(event.total);
    } else if (event.type === "army-mustered") {
      villagerField.beginArmyMuster(event.report, animationElapsed);
      hud.renderArmyReport(event.report, buildOrderNames(), simulation.campaign.objective.enemyName);
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
  if (simulation.state.civicLevel === 1 && events.some((event) => event.type === "construction-complete")) {
    hud.handleTutorialEvent("first-move-complete");
  }
  if (events.length > 0) autosave();
}

/** Building names in build order, for the army report. */
function buildOrderNames(): string[] {
  return simulation.buildOrderSummary().map(({ buildingId }) => BUILDINGS[buildingId]?.name ?? buildingId);
}

/** Starts a brand-new run and resets every render/UI object to match (also used when a save can't be restored). */
function resetSettlement(): void {
  runId += 1;
  selectionPending = false;
  loopFailed = false;
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

/**
 * Rebuilds every render-side object to match a loaded save, without replaying
 * construction or re-running `reset()`. Assumes the art for every building in
 * the save is already loaded (see `initialize()`).
 */
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

  const { selectedBuildingId: buildingId, activePlotIndex: plotIndex } = simulation.state;
  if (simulation.state.mode === "construction" && buildingId !== null && plotIndex !== null) {
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
      hud.renderArmyReport(simulation.state.armyReport, buildOrderNames(), simulation.campaign.objective.enemyName);
      hud.setStatus(`Campaign complete — ${simulation.state.armyReport.outcome}`, 1);
    }
  }
}

window.addEventListener("resize", resize);
// `pagehide` and `visibilitychange` fire more reliably than `beforeunload`,
// especially on mobile, where the tab may be killed without unloading.
window.addEventListener("pagehide", autosave);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") autosave();
});

/** Every building a save needs on screen straight away: built, offered, and under construction. */
function buildingsNeededFor(saved: SettlementSnapshot): string[] {
  return [...new Set([
    ...saved.state.builtBuildingIds,
    ...saved.state.availableBuildingIds,
    ...(saved.state.selectedBuildingId ? [saved.state.selectedBuildingId] : []),
  ])];
}

/**
 * Tries to restore a save into the simulation and the scene.
 * @returns false if the save's *data* can't be used. The save is then deleted
 *          so it can't block every future visit, and the caller starts fresh.
 */
function tryResume(saved: SettlementSnapshot): boolean {
  try {
    simulation.loadSnapshot(saved);
    hydrateFromLoadedState();
    return true;
  } catch (error) {
    console.warn("Saved settlement could not be restored; starting a new one.", error);
    clearSavedSnapshot();
    return false;
  }
}

/**
 * Boot sequence: load shared art, restore the autosave if there is a usable
 * one (otherwise start fresh), then reveal the game.
 *
 * Load only the buildings this session can actually show right away: a fresh
 * game only ever starts with the opening offer, and a resumed save only needs
 * what's already built plus whatever is currently offered (and whatever is
 * mid-construction). Everything else loads on demand as it's offered (see the
 * "choices-ready" handling above). There are 15 buildings x 4 stages of real
 * art in the full catalog, and a single playthrough never touches more than a
 * fraction of it.
 *
 * Failure policy: if *art* fails to load (network), boot stops with a Reload
 * button and the save is kept, since the problem is probably temporary. If the
 * *save* is unusable, it's discarded and a new settlement starts.
 */
async function initialize(): Promise<void> {
  const saved = loadSavedSnapshot();
  await Promise.all([
    workerAnimation.loadClips(),
    constructionView.loadBuildingAssets(saved ? buildingsNeededFor(saved) : OPENING_BUILD_OPTIONS),
    civicCenter.load(),
    loadForest(scene),
  ]);

  const resumed = saved !== null && tryResume(saved);
  if (!resumed) {
    if (saved) await constructionView.loadBuildingAssets(OPENING_BUILD_OPTIONS);
    resetSettlement();
    if (saved) hud.setStatus("Your saved settlement couldn't be restored, so a new one has begun. Choose your first building.", 0);
  }
  resize();
  hud.loading.classList.add("hidden");
  initialized = true;
  autosave();
  hud.maybeStartTutorial(!resumed);
}

/** One frame: advance the simulation (if playing), then animate and draw. */
function frame(): void {
  const delta = getFrameDelta() * speed;
  if (!playing || !initialized || loopFailed) return;
  animationElapsed += delta;
  handleSimulationEvents(simulation.update(delta));
  const { mode, selectedBuildingId, activePlotIndex } = simulation.state;
  if (mode === "construction" && selectedBuildingId !== null && activePlotIndex !== null) {
    constructionView.renderConstruction(
      selectedBuildingId,
      activePlotIndex,
      simulation.constructionProgress,
      simulation.state.constructionElapsed,
      animationElapsed,
    );
  } else if (mode !== "complete") {
    constructionView.renderWoodcutterActivity(animationElapsed, simulation.state.builtBuildingIds);
  }
  villagerField.renderVillagers(animationElapsed, simulation.state.builtBuildingIds);
  hud.updateMilestoneVisibility(animationElapsed);
  constructionView.renderProductionPulses(animationElapsed);
}

renderer.setAnimationLoop(() => {
  try {
    frame();
  } catch (error) {
    // Pause instead of throwing again every frame. The last autosave (taken at
    // the last event) is intact, so Restart or a reload recovers.
    loopFailed = true;
    playing = false;
    hud.setPlayingLabel(false);
    hud.setStatus("Something went wrong in the simulation. Press Restart, or reload to continue from your last save.", 0);
    console.error(error);
  }
  renderer.render(scene, camera);
});

initialize().catch((error: unknown) => {
  console.error(error);
  hud.showLoadError(error instanceof Error ? error.message : String(error));
});
