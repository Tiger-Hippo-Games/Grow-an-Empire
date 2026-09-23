import { Timer } from "three";
import { BUILDINGS, OPENING_BUILD_OPTIONS, TOTAL_MOVES } from "./game/content";
import { SettlementSimulation, type SettlementSnapshot, type SimulationEvent } from "./game/settlementSimulation";
import { createPlatform } from "./platform/adapters";
import { createProgressStore, DEFAULT_SETTINGS, newRunId, type SavedGame, type SavedSettings } from "./platform/progressStore";
import { createSessionTracker, listenForPortalMessages, notifyPortalReady } from "./platform/session";
import { createSceneSetup } from "./render/sceneSetup";
import { civicGround, createCityLayout, getBuildingPosition, loadEmptyTerrain, loadForest, type TerrainHandle } from "./render/cityLayout";
import { createCivicCenter } from "./render/civicCenter";
import { createWorkerAnimation } from "./render/workerAnimation";
import { createConstructionView } from "./render/constructionView";
import { createVillagerField } from "./render/villagers";
import { createCombatScene } from "./render/combatScene";
import { createCharacterAssets, roleForBuilding } from "./render/characterAssets";
import { onImageLoadProgress } from "./render/spriteAssets";
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
let combatElapsed = 0;
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
const LOOP_FAILED_MESSAGE = "Something went wrong in the simulation. Press Restart, or reload to continue from your last save.";
/** Set if drawing itself throws (e.g. a shader fails to compile); drawing stops instead of failing every frame. */
let renderFailed = false;
/** True while the portal has paused the game (GP_PAUSE), so GP_RESUME only undoes its own pause. */
let pausedByPortal = false;
/** Identifies this playthrough in saves; Restart starts a new one (see platform/progressStore.ts). */
let saveRunId = newRunId();
/** Player preferences stored alongside the save. */
let settings: SavedSettings = { ...DEFAULT_SETTINGS };
/** Real time the current construction started, for the `level_completed` event. */
let constructionStartedAt = 0;
/** Set when something changed the scene while the game isn't advancing (paused, loading, report open). */
let renderRequested = true;
/** True between `webglcontextlost` and `webglcontextrestored`; nothing is drawn meanwhile. */
let contextLost = false;

/** Asks for one redraw on the next frame even if the game is paused. */
function requestRender(): void {
  renderRequested = true;
}

const simulation = new SettlementSimulation();
/** The GoLive SDK when running on the portal; an offline stand-in otherwise. */
const platform = createPlatform();
const progress = createProgressStore(platform, simulation.campaign.id);
const session = createSessionTracker(platform);

/** Analytics with the game version attached. Fire-and-forget. */
function track(eventName: string, properties: Record<string, unknown> = {}): void {
  platform.track(eventName, { ...properties, game_version: __APP_VERSION__ });
}

/**
 * Reports an unexpected error to the portal's analytics, so failures on
 * players' devices are visible to us (CODING_STANDARDS §20). Each distinct
 * message is sent once, and at most 5 per page load, so a repeating error
 * can't flood the analytics.
 */
const reportedErrors = new Set<string>();
function reportRuntimeError(error: unknown, where: string): void {
  const message = (error instanceof Error ? error.message : String(error)).slice(0, 200);
  const key = `${where}:${message}`;
  if (reportedErrors.has(key) || reportedErrors.size >= 5) return;
  reportedErrors.add(key);
  track("runtime_error", { where, message });
}

// Errors nobody caught (a bug in an event handler, a rejected promise with no
// .catch). Before boot, index.html's watchdog shows them on the loading
// screen; after boot the game keeps running, so they're logged and reported.
window.addEventListener("error", (event) => {
  if (initialized && event.error !== undefined) reportRuntimeError(event.error ?? event.message, "uncaught");
});
window.addEventListener("unhandledrejection", (event) => {
  if (initialized) reportRuntimeError(event.reason, "unhandled_rejection");
});

const hud = createHud({
  onPlayToggle: () => {
    if (loopFailed) {
      // Resuming would just hit the same error again; only Restart or a reload recovers.
      hud.setPlayingLabel(false);
      hud.setStatus(LOOP_FAILED_MESSAGE, 0);
      return;
    }
    playing = !playing;
    pausedByPortal = false;
    hud.setPlayingLabel(playing);
  },
  onRestart: () => {
    progress.clear();
    saveRunId = newRunId();
    resetSettlement();
    autosave({ immediate: true });
    session.start();
    track("game_start", { resumed: false, restart: true });
  },
  onSpeedChange: (value) => {
    speed = value;
    hud.setSpeedLabel(value);
    track("settings_changed", { setting: "speed", value });
  },
  onGridToggle: (visible) => {
    cityLayout.grid.visible = visible;
    requestRender();
    track("settings_changed", { setting: "grid", value: visible });
  },
  onTutorialStarted: () => track("tutorial_started", { replay: settings.tutorialComplete }),
  onTutorialFinished: ({ skipped, stepCount, seconds }) => {
    const firstTime = !settings.tutorialComplete;
    settings = { ...settings, tutorialComplete: true };
    autosave();
    if (firstTime) track(skipped ? "tutorial_skipped" : "tutorial_completed", { step_count: stepCount, time_seconds: seconds });
  },
  onSelectBuilding: (buildingId) => {
    beginConstruction(buildingId).catch((error: unknown) => {
      // Not a load failure (those are handled inside): something broke while
      // placing the building. Say so rather than failing silently.
      console.error("[Grow an Empire] Starting construction failed", error);
      reportRuntimeError(error, "begin_construction");
      hud.setStatus("Something went wrong starting that building. Press Restart, or reload to continue from your last save.", 0);
    });
  },
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

const { renderer, scene, camera, resize: resizeCamera, quality, viewBounds } = createSceneSetup(hud.viewport);
let terrain: TerrainHandle | null = null;
/** Resizes the canvas and camera, and stretches the terrain to cover the new view. */
function resize(): void {
  resizeCamera();
  const view = viewBounds();
  terrain?.fit(view.width, view.height, view.centerX, view.centerY);
}
const cityLayout = createCityLayout(scene);
const civicCenter = createCivicCenter(scene, requestRender);
const characterAssets = createCharacterAssets();
const workerAnimation = createWorkerAnimation(scene, characterAssets);
const constructionView = createConstructionView(scene, workerAnimation, cityLayout, hud.setStatus);
const villagerField = createVillagerField(scene, characterAssets);
const combatScene = createCombatScene(scene, characterAssets);
let lastCombatStatus: string | null = null;

function showBattleResult(): void {
  const report = simulation.state.armyReport;
  if (!report) return;
  combatScene.clear();
  villagerField.setCombatActive(false);
  villagerField.syncVillagers(Math.max(0, simulation.state.population - simulation.state.trainedUnits.archers - simulation.state.trainedUnits.swordsmen));
  villagerField.beginArmyMuster(report, animationElapsed);
  hud.renderArmyReport(report, buildOrderNames(), simulation.campaign.objective.enemyName);
  hud.showMilestone(report.outcome, report.outcome === "Victory" ? "The city held against all five raiders." : "The raiders broke through the defense.", animationElapsed, true);
  hud.setStatus(`Campaign complete — ${report.outcome}`, 1);
  requestRender();
}

async function startCombat(report: NonNullable<SettlementSnapshot["state"]["armyReport"]>): Promise<void> {
  const startingRun = runId;
  hud.hideMilestone();
  hud.hideArmyReport();
  hud.setStatus("Raiders are approaching from the south!", 0);
  try {
    await combatScene.load();
    if (runId !== startingRun || simulation.state.mode !== "complete") return;
    villagerField.setCombatActive(true);
    combatElapsed = 0;
    const view = viewBounds();
    combatScene.start(report, combatElapsed, view.centerY - view.height / 2);
    lastCombatStatus = null;
    requestRender();
  } catch (error) {
    console.error("[Grow an Empire] Combat art failed to load", error);
    if (runId === startingRun) showBattleResult();
  }
}

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
    trainedUnits: simulation.state.trainedUnits,
    resources: simulation.state.resources,
    availableBuildingIds: simulation.state.availableBuildingIds,
  };
}

/** The current run as a save (snapshot + run id + settings). */
function currentSave(): SavedGame {
  return { ...simulation.serialize(), runId: saveRunId, settings };
}

/**
 * Saves the current run: to the browser immediately and to the GoLive cloud
 * shortly after (or right away with `immediate`). Does nothing until boot has
 * finished (see `initialized`).
 */
function autosave(options: { immediate?: boolean } = {}): void {
  if (!initialized) return;
  progress.save(currentSave(), options);
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
  workerAnimation.useCharacter(roleForBuilding(buildingId));
  hud.setStatus(`${name} approved — builders mobilizing`, 0);
  constructionStartedAt = performance.now();
  track("level_start", { level: simulation.state.move, building: buildingId });
  requestRender();
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
      track("level_completed", {
        level: event.plotIndex + 1,
        building: event.buildingId,
        time_seconds: Math.round((performance.now() - constructionStartedAt) / 1000),
      });
      cityLayout.placementPad.visible = false;
      constructionView.showPlotStage(event.plotIndex, "complete");
      cityLayout.syncBuiltBuildings(simulation.state.builtBuildingIds);
      const completedMove = event.plotIndex + 1;
      // (The final move's toast is replaced right away by the game-complete one.)
      const copy = completedMove < TOTAL_MOVES
        ? `Completed on Move ${completedMove}. The civic center also advanced.`
        : `Completed on Move ${completedMove}. The Grand Muster Hall stands ready to defend the city.`;
      const newSoldiers = [
        simulation.state.builtBuildingIds.includes("blacksmith") && "1 swordsman",
        simulation.state.builtBuildingIds.includes("weapons-workshop") && "1 archer",
        simulation.state.builtBuildingIds.includes("stable") && "2 horsemen",
      ].filter(Boolean).join(" and ");
      hud.showMilestone(BUILDINGS[event.buildingId].name, newSoldiers ? `${copy} ${newSoldiers} joined the garrison.` : copy, animationElapsed);
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
      villagerField.syncVillagers(Math.max(0, event.total - simulation.state.trainedUnits.archers - simulation.state.trainedUnits.swordsmen - simulation.state.trainedUnits.horsemen));
    } else if (event.type === "unit-trained") {
      villagerField.syncGarrison(event.units, animationElapsed, simulation.state.builtBuildingIds);
      const newUnits = [event.newSwordsmen && "1 swordsman", event.newArchers && "1 archer", event.newHorsemen && "2 horsemen"].filter(Boolean).join(" and ");
      hud.setStatus(`${newUnits} joined the town hall garrison · ${event.units.swordsmen + event.units.archers + event.units.horsemen} defenders`, 1);
    } else if (event.type === "army-mustered") {
      void startCombat(event.report);
    } else if (event.type === "game-complete") {
      const report = simulation.state.armyReport;
      if (report?.outcome === "Settlement Lost") track("level_failed", { level: TOTAL_MOVES, reason: report.outcome });
      track("game_over", {
        final_score: report?.score ?? 0,
        level_reached: simulation.state.civicLevel,
        reason: report?.outcome ?? "complete",
        outcome: report?.outcome,
      });
      autosave({ immediate: true });
      session.end();
      workerAnimation.worker.visible = false;
      hud.hideBuildPanel();
      hud.setStatus("The city defense is under way…", 1);
    }
  }
  if (events.length === 0) return; // Nothing changed: skip the HUD rewrite and the save (runs every frame).
  hud.updateHud(stateSnapshot());
  if (simulation.state.civicLevel === 1 && events.some((event) => event.type === "construction-complete")) {
    hud.handleTutorialEvent("first-move-complete");
  }
  autosave();
}

/** Building names in build order, for the army report. */
function buildOrderNames(): string[] {
  return simulation.buildOrderSummary().map(({ buildingId }) => BUILDINGS[buildingId]?.name ?? buildingId);
}

/** Starts a brand-new run and resets every render/UI object to match (also used when a save can't be restored). */
function resetSettlement(): void {
  runId += 1;
  combatScene.clear();
  lastCombatStatus = null;
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
  villagerField.clearArmyMuster();
  villagerField.syncVillagers(Math.max(0, simulation.state.population - simulation.state.trainedUnits.archers - simulation.state.trainedUnits.swordsmen - simulation.state.trainedUnits.horsemen));
  villagerField.syncGarrison(simulation.state.trainedUnits);
  workerAnimation.worker.visible = true;
  workerAnimation.placeWorker(civicGround);
  workerAnimation.useCharacter("builder");
  hud.renderBuildPanel(stateSnapshot());
  requestRender();
}

/**
 * Rebuilds every render-side object to match a loaded save, without replaying
 * construction or re-running `reset()`. Assumes the art for every building in
 * the save is already loaded (see `initialize()`).
 */
function hydrateFromLoadedState(): void {
  runId += 1;
  combatScene.clear();
  lastCombatStatus = null;
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
  villagerField.syncVillagers(Math.max(0, simulation.state.population - simulation.state.trainedUnits.archers - simulation.state.trainedUnits.swordsmen - simulation.state.trainedUnits.horsemen));
  villagerField.syncGarrison(simulation.state.trainedUnits);

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
    workerAnimation.useCharacter("builder");
    hud.renderBuildPanel(stateSnapshot());
  } else {
    cityLayout.placementPad.visible = false;
    workerAnimation.worker.visible = false;
    hud.hideBuildPanel();
    if (simulation.state.armyReport) {
      void startCombat(simulation.state.armyReport);
    }
  }  requestRender();
}

window.addEventListener("resize", () => {
  resize();
  requestRender();
});

// WebGL context loss (GPU reset, too many tabs, backgrounded mobile browser).
// preventDefault() lets the browser restore it; Three.js re-uploads textures.
renderer.domElement.addEventListener("webglcontextlost", (event) => {
  event.preventDefault();
  contextLost = true;
  hud.setStatus("The graphics context was lost. Waiting for the browser to restore it…", 0);
  console.warn("[Grow an Empire] WebGL context lost");
});
renderer.domElement.addEventListener("webglcontextrestored", () => {
  contextLost = false;
  requestRender();
  hud.setStatus("Graphics restored.", 0);
  console.info("[Grow an Empire] WebGL context restored");
});

/** Page is going away: save everywhere now and close the analytics session. */
function onPageExit(): void {
  autosave({ immediate: true });
  void progress.flush();
  session.end();
}
// Mobile browsers can kill a background tab without any unload event, so the
// save also happens whenever the tab is hidden (SUBMISSION_GUIDE §5.1).
window.addEventListener("pagehide", onPageExit);
window.addEventListener("beforeunload", onPageExit);
window.addEventListener("pageshow", (event) => {
  // Restored from the back/forward cache: the old session was ended on pagehide.
  if (event.persisted && initialized && simulation.state.mode !== "complete") session.start();
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") autosave({ immediate: true });
});

listenForPortalMessages((message) => {
  if (message === "GP_PAUSE" && playing) {
    playing = false;
    pausedByPortal = true;
    hud.setPlayingLabel(false);
  } else if (message === "GP_RESUME" && pausedByPortal) {
    playing = true;
    pausedByPortal = false;
    hud.setPlayingLabel(true);
    // GP_SESSION_END ended the analytics session; a resume means play goes on.
    if (initialized && simulation.state.mode !== "complete") session.start();
  } else if (message === "GP_SESSION_END") {
    // The portal is closing the game: stop, save everywhere, end the session.
    if (playing) {
      playing = false;
      pausedByPortal = true;
      hud.setPlayingLabel(false);
    }
    onPageExit();
  }
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
    progress.clear();
    return false;
  }
}

/** Before the tutorial flag moved into the save it had its own localStorage key; honour it once. */
function legacyTutorialCompleted(): boolean {
  try {
    return window.localStorage.getItem("grow-an-empire:tutorial:v1") === "complete";
  } catch {
    return false;
  }
}

/**
 * Testing convenience: open the game with `?reset` in the URL
 * (e.g. http://127.0.0.1:4173/?reset) to discard the autosave and show the
 * tutorial again, i.e. play exactly as a first-time player would. The flag is
 * removed from the address bar straight away, so a later reload resumes normally.
 */
function applyTestingUrlFlags(): boolean {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("reset")) return false;
  progress.clear();
  try { window.localStorage.removeItem("grow-an-empire:tutorial:v1"); } catch { /* Storage unavailable. */ }
  url.searchParams.delete("reset");
  try {
    window.history.replaceState(null, "", url);
  } catch {
    // Some sandboxed iframes refuse history changes; the flag then stays in the URL, which is harmless.
  }
  return true;
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
 * Platform order (GAME_ARCHITECTURE §6): sign in and fetch the cloud save
 * *in parallel with* the shared art download, so the portal adds no load
 * time. If the platform is unreachable the game carries on offline.
 *
 * Failure policy: if *art* fails to load (network), boot stops with a Reload
 * button and the save is kept, since the problem is probably temporary. If the
 * *save* is unusable, it's discarded and a new settlement starts.
 */
async function initialize(): Promise<void> {
  const resetRequested = applyTestingUrlFlags();
  const stopProgress = onImageLoadProgress((settled, requested) => {
    (window as unknown as { __gaeLoadActivityAt: number }).__gaeLoadActivityAt = Date.now();
    hud.setLoadingProgress(settled, requested);
  });
  const savedPromise = platform.connect().then((player) => progress.load(player?.id ?? null));
  // Only what the first screen needs blocks boot (about 1 MB). Everything else
  // starts once the game is playable (see startBackgroundLoads) so it doesn't
  // compete for bandwidth on a slow connection (MOBILE_PERFORMANCE §34-§37).
  await Promise.all([
    characterAssets.load(),
    civicCenter.load(0),
    loadEmptyTerrain(scene).then((handle) => { terrain = handle; }),
    loadForest(scene),
    savedPromise,
  ]);
  const saved: SavedGame | null = resetRequested ? null : await savedPromise;
  settings = resetRequested ? { ...DEFAULT_SETTINGS } : { ...DEFAULT_SETTINGS, ...saved?.settings };
  if (!resetRequested && legacyTutorialCompleted()) settings.tutorialComplete = true;
  // A resumed city needs its built (and under-construction) buildings on screen
  // straight away; offered cards only need their card picture, so the rest of
  // their art loads in the background, well before a card can be clicked.
  const neededNow = saved ? [...saved.state.builtBuildingIds, ...(saved.state.selectedBuildingId ? [saved.state.selectedBuildingId] : [])] : [];
  await Promise.all([
    constructionView.loadBuildingAssets(neededNow),
    saved ? civicCenter.load(saved.state.civicLevel) : Promise.resolve(),
  ]);
  const offered = saved ? buildingsNeededFor(saved) : OPENING_BUILD_OPTIONS;

  const resumed = saved !== null && tryResume(saved);
  if (resumed) saveRunId = saved.runId;
  if (!resumed) {
    resetSettlement();
    if (saved) hud.setStatus("Your saved settlement couldn't be restored, so a new one has begun. Choose your first building.", 0);
  }
  if (progress.savingDisabledReason) hud.setStatus(progress.savingDisabledReason, 0);
  stopProgress();
  resize();
  requestRender();
  hud.loading.classList.add("hidden");
  document.documentElement.dataset.booted = "true"; // Tells the boot watchdog in index.html that startup succeeded.
  performance.mark("gae-playable"); // Time-to-playable, for QA measurements (Docs/PERFORMANCE_BUDGET.md).
  initialized = true;
  autosave({ immediate: !resumed });
  console.info(`[Grow an Empire] v${__APP_VERSION__} · platform: ${platform.kind}`);
  if (simulation.state.mode !== "complete") session.start();
  track("game_start", { resumed, move: simulation.state.move });
  notifyPortalReady(__APP_VERSION__);
  startBackgroundLoads(offered);
  hud.maybeStartTutorial(!resumed, settings.tutorialComplete);
}

/**
 * Lower-priority art, fetched after the game is playable: the offered
 * buildings' construction stages (needed only once a card is clicked, and
 * awaited then if still missing) and the woodcutter's animation sheets (needed
 * only once a Woodcutter exists).
 */
function startBackgroundLoads(offered: string[]): void {
  constructionView.loadBuildingAssets(offered).catch((error: unknown) => console.warn("[Grow an Empire] Preloading offered buildings failed", error));
  workerAnimation.loadClips().catch((error: unknown) => console.warn("[Grow an Empire] Woodcutter animation failed to load", error));
  combatScene.load().catch((error: unknown) => console.warn("[Grow an Empire] Combat art preloading failed", error));
}

/** One frame: advance the simulation (if playing), then animate and draw. */
function frame(): void {
  const realDelta = getFrameDelta();
  const delta = realDelta * speed;
  if (!playing || !initialized || loopFailed) return;
  probeFrameTime(realDelta);
  session.addPlayTime(realDelta);
  animationElapsed += delta;
  if (combatScene.active) combatElapsed += realDelta;
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
  if (combatScene.update(combatElapsed)) showBattleResult();
  else {
    const combatStatus = combatScene.status(combatElapsed);
    if (combatStatus && combatStatus !== lastCombatStatus) {
      lastCombatStatus = combatStatus;
      hud.setStatus(combatStatus, 1);
    }
  }
  hud.updateMilestoneVisibility(animationElapsed);
  constructionView.renderProductionPulses(animationElapsed);
}

/**
 * Automatic quality: if the first few seconds of play run below about 36 fps,
 * drop to the low tier (1x pixel ratio) once. It never switches back, so the
 * picture doesn't flicker between tiers (MOBILE_PERFORMANCE §16, §52).
 */
const frameProbe = { frames: 0, time: 0, done: new URLSearchParams(window.location.search).has("quality") };
function probeFrameTime(realDelta: number): void {
  if (frameProbe.done || !playing || !initialized) return;
  frameProbe.frames += 1;
  if (frameProbe.frames <= 60) return; // Skip the warm-up frames after boot.
  frameProbe.time += realDelta;
  if (frameProbe.frames < 240) return;
  frameProbe.done = true;
  const average = frameProbe.time / (frameProbe.frames - 60);
  if (average > 1 / 36 && quality.tier !== "low") {
    quality.set("low");
    resize();
    console.info(`[Grow an Empire] Average frame ${(average * 1000).toFixed(1)} ms; switched to low quality`);
    track("quality_changed", { tier: "low", avg_frame_ms: Math.round(average * 1000) });
  }
}

const perfOverlay = createPerfOverlay();

renderer.setAnimationLoop(() => {
  try {
    frame();
  } catch (error) {
    // Pause instead of throwing again every frame. The last autosave (taken at
    // the last event) is intact, so Restart or a reload recovers.
    loopFailed = true;
    playing = false;
    hud.setPlayingLabel(false);
    hud.setStatus(LOOP_FAILED_MESSAGE, 0);
    console.error(error);
    reportRuntimeError(error, "frame");
  }
  // Draw only while the scene can change: the game is playing, or something
  // asked for a redraw (MOBILE_PERFORMANCE §48: stop work when paused).
  if (contextLost || !initialized || renderFailed) return;
  if ((playing && !loopFailed) || renderRequested) {
    renderRequested = false;
    try {
      renderer.render(scene, camera);
    } catch (error) {
      renderFailed = true;
      playing = false;
      hud.setPlayingLabel(false);
      hud.setStatus("The graphics failed to draw. Reload to continue from your last save.", 0);
      console.error(error);
      reportRuntimeError(error, "render");
      return;
    }
    perfOverlay?.sample();
  }
});

/**
 * Development-only performance readout (`?perf`): FPS, frame time, draw calls
 * and GPU memory counts (THREEJS_STANDARDS §43). Not shown to players.
 */
function createPerfOverlay(): { sample(): void } | null {
  if (!new URLSearchParams(window.location.search).has("perf")) return null;
  const panel = document.createElement("div");
  panel.className = "perf-overlay";
  document.body.appendChild(panel);
  let frames = 0;
  let windowStart = performance.now();
  return {
    sample() {
      frames += 1;
      const now = performance.now();
      if (now - windowStart < 500) return;
      const fps = (frames * 1000) / (now - windowStart);
      const { render, memory } = renderer.info;
      panel.textContent = `${fps.toFixed(0)} fps · ${(1000 / fps).toFixed(1)} ms · ${render.calls} draws · ${memory.textures} tex · ${memory.geometries} geo · ${quality.tier} @${renderer.getPixelRatio()}x`;
      frames = 0;
      windowStart = now;
    },
  };
}

initialize().catch((error: unknown) => {
  console.error(error);
  const message = error instanceof Error ? error.message : String(error);
  track("load_error", { message: message.slice(0, 200) });
  hud.showLoadError(message);
});
