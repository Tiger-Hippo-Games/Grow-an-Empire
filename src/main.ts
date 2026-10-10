import { Timer } from "three";
import { createActionGuard } from "./game/actionGuard";
import { BUILDINGS, OPENING_BUILD_OPTIONS } from "./game/content";
import { CAMPAIGNS, campaignById, isCampaignUnlocked, totalStars, type CampaignDefinition } from "./game/campaigns";
import { missingFor, SettlementSimulation, type SellswordHire, type SettlementSnapshot, type SimulationEvent } from "./game/settlementSimulation";
import { isRegisteredPlayer, leaderboardEntry, type LeaderboardEntry } from "./game/leaderboard";
import { AiRealmSource, campedAt, conquerorsByCampaign, newRealmState, realmStanding, readRealmState, recordBattle, standingFromStars, visitRealm, type RealmState } from "./game/realm";
import { createPlatform } from "./platform/adapters";
import { createScoreSubmission } from "./platform/scoreSubmission";
import type { PlayerInfo } from "./platform/types";
import { createProgressStore, DEFAULT_SETTINGS, mergeStars, newRunId, type SavedGame, type SavedSettings } from "./platform/progressStore";
import { createSessionTracker, listenForPortalMessages, notifyPortalReady } from "./platform/session";
import { createSceneSetup } from "./render/sceneSetup";
import { civicGround, createCityLayout, getBuildingPosition, loadEmptyTerrain, loadForest, type TerrainHandle } from "./render/cityLayout";
import { createCivicCenter } from "./render/civicCenter";
import { createWorkerAnimation } from "./render/workerAnimation";
import { createConstructionView } from "./render/constructionView";
import { createVillagerField } from "./render/villagers";
import { createCharacterAssets, roleForBuilding } from "./render/characterAssets";
import { onImageLoadProgress } from "./render/spriteAssets";
import { createHud, type BuildPanelView, type HudStateSnapshot } from "./ui/hud";
import { createCampaignMap } from "./ui/campaignMap";
import { createCampaignFlow, type RealmView } from "./ui/campaignFlow";
import { createRealmBoard } from "./ui/realmBoard";
import { createSound } from "./ui/sound";
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
let speed = 4;
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
/** The portal reveals the iframe only after our first successful draw. */
let portalReadySent = false;

/** Asks for one redraw on the next frame even if the game is paused. */
function requestRender(): void {
  renderRequested = true;
}

let simulation = new SettlementSimulation();
let completedCampaignIds: string[] = [];
/** Best stars per campaign id (saved; unlocks later campaigns). */
let campaignStars: Record<string, number> = {};
/** The signed-in portal player (null offline), for the leaderboard. */
let player: PlayerInfo | null = null;
/** Last leaderboard entry saved or reported (keeps its time when nothing improved). */
let leaderboard: LeaderboardEntry | null = null;
/** The rival realm (game/realm.ts): the AI field now, real players later behind the same source. */
const realmSource = new AiRealmSource();
let realm: RealmState = newRealmState();
/** The name the realm board shows for the player. */
function playerName(): string { return player?.displayName?.trim() || "You"; }
const sound = createSound(false);
let tutorialPending = false;
/** The GoLive SDK when running on the portal; an offline stand-in otherwise. */
const platform = createPlatform();
const scoreSubmission = createScoreSubmission(platform);
const progress = createProgressStore(platform, null);
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
  console.warn(`[Grow an Empire] ${where} failed`, error);
  track("runtime_error", { where, message });
}

/** State or view may be partially changed: pause and protect the last good save. */
function failSimulation(error: unknown, where: string): void {
  loopFailed = true;
  playing = false;
  sound.setPaused(true);
  reportRuntimeError(error, where);
  hud.setPlayingLabel(false);
  hud.setStatus(LOOP_FAILED_MESSAGE, 0);
}
const guardAction = createActionGuard(() => initialized && !loopFailed && !renderFailed && !contextLost && !pausedByPortal, failSimulation);

// Errors nobody caught (a bug in an event handler, a rejected promise with no
// .catch). Before boot, index.html's watchdog shows them on the loading
// screen; after boot pause the run and protect its last successful save.
window.addEventListener("error", (event) => {
  if (initialized && event.error !== undefined) failSimulation(event.error ?? event.message, "uncaught");
});
window.addEventListener("unhandledrejection", (event) => {
  if (initialized) failSimulation(event.reason, "unhandled_rejection");
});

const hud = createHud({
  onPlayToggle: () => {
    if (renderFailed) {
      hud.setPlayingLabel(false);
      hud.setStatus("The graphics failed to draw. Reload to continue from your last save.", 0);
      return;
    }
    if (loopFailed) {
      // Resuming would just hit the same error again; only Restart or a reload recovers.
      hud.setPlayingLabel(false);
      hud.setStatus(LOOP_FAILED_MESSAGE, 0);
      return;
    }
    playing = !playing;
    pausedByPortal = false;
    sound.setPaused(false);
    hud.setPlayingLabel(playing);
  },
  onRestart: () => {
    flow.hide(); // A dialog left open over a new run would have nothing to act on.
    progress.clear();
    saveRunId = newRunId();
    resetSettlement();
    autosave({ immediate: true });
    session.start();
    track("game_start", { resumed: false, restart: true });
  },
  onSpeedChange: (value) => {
    if (![1, 2, 4, 8].includes(value) || value === speed) return;
    speed = value;
    hud.setSpeedLabel(value);
    sound.play("click");
    requestRender();
    track("settings_changed", { setting: "speed", value });
  },
  onGridToggle: (visible) => {
    cityLayout.grid.visible = visible;
    requestRender();
    track("settings_changed", { setting: "grid", value: visible });
  },
  onTutorialStarted: () => track("tutorial_started", { replay: settings.tutorialComplete }),
  onUxEvent: (name, properties) => track(name, { ...properties, campaign_number: simulation.campaign.number, layout: (window as { __gaeLayout?: string }).__gaeLayout ?? "unknown" }),
  onUiSound: () => { sound.play("click"); requestRender(); },
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
      failSimulation(error, "begin_construction");
    });
  },
  onSwapBuild: (buildingId) => {
    beginConstruction(buildingId, { swap: true }).catch((error: unknown) => {
      failSimulation(error, "swap_build");
    });
  },
  onGather: () => guardAction("gather", () => {
    if (simulation.state.mode !== "awaiting-choice") return;
    const move = simulation.state.move;
    const events = simulation.gather();
    if (events.length === 0) return;
    hud.hideBuildPanel();
    track("move_gathered", { level: move, campaign_number: simulation.campaign.number });
    handleSimulationEvents(events);
  }),
  onMuteToggle: () => {
    settings = { ...settings, muted: !settings.muted };
    sound.setMuted(settings.muted === true);
    hud.setMuted(settings.muted === true);
    autosave();
    track("settings_changed", { setting: "muted", value: settings.muted });
  },
  onFullscreenToggle: () => {
    const request = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen({ navigationUI: "hide" });
    Promise.resolve(request).catch((error: unknown) => {
      // Refused (e.g. the portal frame doesn't allow full screen): hide the button.
      console.warn("[Grow an Empire] Full screen was refused", error);
      hud.setFullscreenAvailable(false);
    });
  },
  onReportToggle: () => {
    if (flow.isOpen) flow.hide();
    else if (!flow.reopenResult() && simulation.state.mode === "complete") presentBattle(false);
  },
  onTutorialModalChange: (visible) => setModalPause(visible),
});

/** Pauses while a dialog is open, and resumes afterwards if the game was playing. */
let modalCount = 0;
function setModalPause(open: boolean): void {
  if (open) {
    if (modalCount === 0) {
      resumeAfterTutorial = playing;
      playing = false;
      hud.setPlayingLabel(false);
    }
    modalCount += 1;
  } else if (modalCount > 0) {
    modalCount -= 1;
    // A portal pause outlasts the dialog: GP_RESUME resumes play, not closing the dialog.
    if (modalCount === 0 && resumeAfterTutorial && !pausedByPortal) {
      playing = true;
      resumeAfterTutorial = false;
      hud.setPlayingLabel(true);
    }
  }
}

document.addEventListener("fullscreenchange", () => hud.setFullscreenLabel(Boolean(document.fullscreenElement)));
hud.setFullscreenAvailable(document.fullscreenEnabled === true);

const flow = createCampaignFlow(document.getElementById("app")!, {
  onFight: (hire) => fight(hire),
  onMap: () => openCampaignMap(),
  onReplay: () => selectCampaign(simulation.campaign, { fresh: true }),
  onNext: () => {
    const next = CAMPAIGNS[simulation.campaign.number];
    if (next && isCampaignUnlocked(next.number, campaignStars)) selectCampaign(next, { fresh: true });
    else openCampaignMap();
  },
  onViewCity: () => {
    hud.setReportAvailable(true);
    hud.setStatus(simulation.state.armyReport?.win ? "Victory: the city stands. Open the campaign map to go on." : "The city fell. Replay from the campaign map.", 1);
  },
  onSound: (name) => { sound.play(name); requestRender(); },
  onModalChange: (open) => setModalPause(open),
  isPlaybackPaused: () => pausedByPortal || contextLost || loopFailed || renderFailed,
  onUxEvent: (name, properties) => {
    track(name, { ...properties, layout: (window as { __gaeLayout?: string }).__gaeLayout ?? "unknown" });
  },
});

/**
 * Portal-user testing (Docs/PLAYTEST_PORTAL.md): each player is asked once,
 * on their first result, whether the game was easy to follow.
 */
const CLARITY_KEY = "grow-an-empire:ux-clarity:v1";
function clarityAsked(): boolean {
  try { return window.localStorage.getItem(CLARITY_KEY) !== null; } catch { return true; }
}
/** Marked when the question is shown, so it is asked once whether or not it is answered. */
function rememberClarityAsked(): void {
  try { window.localStorage.setItem(CLARITY_KEY, new Date().toISOString()); } catch { /* Storage unavailable: the question may come again. */ }
}

/**
 * Opens a campaign from the map (or the result screen). The current run
 * continues if it is this campaign and not finished; otherwise a new run starts
 * and the enemy briefing is shown first.
 */
function selectCampaign(campaign: CampaignDefinition, options: { fresh?: boolean } = {}): void {
  const untouched = simulation.state.move === 1 && simulation.state.mode === "awaiting-choice" && simulation.state.builtBuildingIds.length === 0;
  const continuing = !options.fresh && simulation.campaign.id === campaign.id && simulation.state.mode !== "complete" && !untouched;
  campaignMap.hide();
  flow.hide();
  flow.clearResult();
  if (!continuing) {
    simulation = new SettlementSimulation(campaign);
    saveRunId = newRunId();
    resetSettlement();
    autosave({ immediate: true });
  }
  hud.setCampaign(campaign, campaign.number - 1);
  hud.setCivicLevel(simulation.state.civicLevel);
  hud.updateHud(stateSnapshot());
  hud.setReportAvailable(simulation.state.mode === "complete");
  track("campaign_selected", { campaign: campaign.id, campaign_number: campaign.number, continuing });
  requestRender();
  const startPlaying = (): void => {
    playing = true;
    hud.setPlayingLabel(true);
    if (tutorialPending && !settings.tutorialComplete) hud.maybeStartTutorial(true, false);
    tutorialPending = false;
    if (initialized && simulation.state.mode !== "complete") session.start();
    if (simulation.state.mode === "muster") openMuster();
  };
  if (!continuing) flow.showBriefing(campaign, startPlaying);
  else startPlaying();
}

const realmBoard = createRealmBoard(document.getElementById("app")!, (open) => setModalPause(open));
function openRealmBoard(): void {
  realmBoard.show({ source: realmSource, state: realm, player: standingFromStars(campaignStars, playerName()) });
}
const campaignMap = createCampaignMap(selectCampaign, openRealmBoard);
document.getElementById("realm-toggle")?.addEventListener("click", openRealmBoard);
/** Pushes the realm's counts, camps and the player's rank to the map. */
function refreshRealm(): void {
  const standing = realmStanding(realmSource, realm, standingFromStars(campaignStars, playerName()));
  campaignMap.setRealm({
    rank: standing.rank, of: standing.of, title: standing.player.title,
    conquerors: conquerorsByCampaign(realmSource, realm.season),
    camped: campedAt(realmSource, realm.season).map((camp) => camp.map((row) => ({ name: row.name, title: row.title, colour: row.colour }))),
  });
}
function openCampaignMap(): void {
  if (!initialized || loopFailed || renderFailed) return;
  playing = false;
  hud.setPlayingLabel(false);
  flow.hide();
  // Stars won in another tab, or merged in from the cloud, count too.
  campaignStars = mergeStars(campaignStars, progress.knownStars);
  campaignMap.show(simulation.campaign.id, campaignStars, simulation.state.mode === "complete", simulation.state.move);
  requestRender();
}
document.getElementById("map-toggle")!.addEventListener("click", openCampaignMap);

/** Creates the 3D view, or explains to the player why it can't (WebGL off or unsupported). */
function createSceneOrExplain(): ReturnType<typeof createSceneSetup> {
  try {
    return createSceneSetup(hud.viewport);
  } catch (error) {
    console.error("[Grow an Empire] WebGL is unavailable", error);
    hud.showLoadError("This browser or device can't show the game's 3D graphics: WebGL is turned off or not supported. Try another browser, or turn on hardware acceleration in your browser settings.");
    // Stop here: nothing below can run without a renderer. The boot watchdog
    // leaves the message alone because it already has a button.
    throw error;
  }
}
const { renderer, scene, camera, resize: resizeCamera, quality, viewBounds } = createSceneOrExplain();
let terrain: TerrainHandle | null = null;
/** Resizes the canvas and camera, and stretches the terrain to cover the new view. */
function resize(): void {
  resizeCamera();
  const view = viewBounds();
  terrain?.fit(view.width, view.height, view.centerX, view.centerY);
}
const cityLayout = createCityLayout(scene);
const civicCenter = createCivicCenter(scene, requestRender);
const characterAssets = createCharacterAssets(requestRender);
const workerAnimation = createWorkerAnimation(scene, characterAssets);
const constructionView = createConstructionView(scene, workerAnimation, cityLayout, hud.setStatus);
const villagerField = createVillagerField(scene, characterAssets);
/** The muster: the last move is over and the enemy has arrived. */
function openMuster(): void {
  if (simulation.state.mode !== "muster") return;
  hud.hideBuildPanel();
  workerAnimation.worker.visible = false;
  hud.setStatus(`${simulation.campaign.objective.enemyName} are at the gates`, 1);
  sound.play("warning");
  flow.showMuster({
    campaign: simulation.campaign,
    trained: { ...simulation.state.trainedUnits },
    militia: simulation.militia,
    hasMarketplace: simulation.hasMarketplace,
    gold: simulation.musterGold,
    cap: simulation.sellswordCap,
    bestHire: simulation.bestHire(),
    deserted: simulation.state.deserted,
  });
}

/** "Fight" at the muster: hires the sellswords and resolves the battle. */
function fight(hire: SellswordHire): void {
  guardAction("fight", () => {
    const events = simulation.muster(hire);
    if (events.length === 0) return;
    handleSimulationEvents(events);
  });
}

/**
 * The muster dialog stays open and presents the fight before its result.
 */
function startFight(view: Parameters<typeof flow.showResult>[0]): void {
  flow.showBattle(view);
  requestRender();
}

/** Records stars and shows the popup battle, then its result. */
function presentBattle(animate: boolean): void {
  const report = simulation.state.armyReport;
  if (!report) return;
  const id = simulation.campaign.id;
  const previousBest = campaignStars[id] ?? 0;
  const before = standingFromStars(campaignStars, playerName());
  if (report.stars > previousBest) campaignStars = mergeStars(campaignStars, { [id]: report.stars });
  // Each battle fought moves the realm a season; a reopened result doesn't.
  let realmView: RealmView | undefined;
  if (animate) {
    const result = recordBattle(realmSource, realm, before, standingFromStars(campaignStars, playerName()));
    realm = result.state;
    const nemesis = result.after.nemesis;
    realmView = {
      before: result.before, rank: result.after.rank, of: result.after.of, overtaken: result.overtaken, title: result.after.player.title,
      notable: result.notable ? { name: result.notable.name, title: result.notable.title, colour: result.notable.colour } : null,
      nemesis: nemesis ? { name: nemesis.name, title: nemesis.title, colour: nemesis.colour, campaignsAhead: nemesis.level - result.after.player.level } : null,
    };
    refreshRealm();
    track("realm_rank", { rank: result.after.rank, of: result.after.of, before: result.before, overtaken: result.overtaken, season: realm.season, campaign_number: simulation.campaign.number });
  }
  if (report.win && !completedCampaignIds.includes(id)) completedCampaignIds.push(id);
  if (report.stars > previousBest) reportLeaderboard("improved");
  if (animate) scoreSubmission.submit(leaderboardEntry(campaignStars, leaderboard), player);
  const next = CAMPAIGNS[simulation.campaign.number];
  const view = {
    campaign: simulation.campaign,
    report,
    buildOrder: buildOrderNames(),
    buildOrderIds: simulation.buildOrderSummary().map(({ buildingId }) => buildingId),
    bestStars: Math.max(previousBest, report.stars),
    nextUnlocked: next ? isCampaignUnlocked(next.number, campaignStars) : false,
    newRecord: report.stars > previousBest,
    askClarity: animate && !clarityAsked(),
    realm: realmView,
  };
  if (view.askClarity) rememberClarityAsked();
  hud.setReportAvailable(true);
  hud.setStatus(`Campaign complete: ${report.win ? `victory ${"★".repeat(report.stars)}` : "the city fell"}`, 1);
  if (animate) startFight(view);
  else flow.showResult(view, true);
  requestRender();
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

/** What the build panel shows this move: each card's cost state, swaps, the Gather option and the last move's summary. */
function buildPanelView(): BuildPanelView {
  return {
    mode: simulation.state.mode,
    move: simulation.state.move,
    cards: simulation.state.availableBuildingIds.map((id) => ({
      id,
      affordable: simulation.canAffordBuilding(id),
      missing: simulation.canAffordBuilding(id) ? {} : missingFor(simulation.state, id),
      swap: simulation.swapPlanFor(id),
    })),
    canGather: simulation.canGather(),
    hasMarketplace: simulation.hasMarketplace,
    summary: simulation.state.lastSummary,
    resources: simulation.state.resources,
  };
}

/** The current run as a save (snapshot + run id + settings + stars + leaderboard standing). */
function currentSave(): SavedGame {
  leaderboard = leaderboardEntry(campaignStars, leaderboard);
  return { ...simulation.serialize(), runId: saveRunId, settings, completedCampaignIds, campaignStars, leaderboard, realm };
}

/**
 * Sends the player's standing to the portal (Docs/LEADERBOARD.md) as a
 * `leaderboard_score` diagnostic event, against their player id. Actual
 * rankings use scoreSubmission at battle end. Sent for signed-in
 * players when the score goes up, and once per visit so a player who
 * registered after playing as a guest shows up. Guests' standing is still
 * kept in their own cloud save.
 */
let reportedScore = -1;
function reportLeaderboard(reason: "improved" | "visit"): void {
  const entry = leaderboardEntry(campaignStars, leaderboard);
  leaderboard = entry;
  if (!player || !isRegisteredPlayer(player.authType) || entry.score === 0 || entry.score === reportedScore) return;
  reportedScore = entry.score;
  track("leaderboard_score", {
    player_id: player.id,
    display_name: player.displayName,
    auth_type: player.authType,
    level: entry.level,
    campaign_id: entry.campaignId,
    campaign_name: entry.campaignName,
    total_stars: entry.totalStars,
    score: entry.score,
    reached_at: entry.reachedAt,
    reason,
  });
}

/**
 * Saves the current run: to the browser immediately and to the GoLive cloud
 * shortly after (or right away with `immediate`). Does nothing until boot has
 * finished (see `initialized`).
 */
function autosave(options: { immediate?: boolean } = {}): void {
  if (!initialized || loopFailed || renderFailed) return;
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
async function beginConstruction(buildingId: string, options: { swap?: boolean } = {}): Promise<void> {
  if (!initialized || loopFailed || renderFailed || contextLost || pausedByPortal) return;
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
      reportRuntimeError(error, "building_art");
      if (startedInRun === runId) hud.setStatus(`Couldn't load the ${name} artwork. Check your connection and choose again.`, 0);
      return;
    } finally {
      selectionPending = false;
      hud.setBuildPanelBusy(false);
    }
    // The player restarted, or the state changed, while we were loading.
    if (startedInRun !== runId || loopFailed || renderFailed || contextLost || pausedByPortal || simulation.state.mode !== "awaiting-choice") return;
  }

  const events = options.swap ? simulation.swapAndBuild(buildingId) : simulation.chooseBuilding(buildingId);
  const event = events.find((item) => item.type === "construction-started");
  if (!event || event.type !== "construction-started") return;
  const swapped = events.find((item) => item.type === "swapped");
  if (swapped?.type === "swapped") {
    sound.play("coins");
    track("market_swap", { level: simulation.state.move, building: buildingId, gold: swapped.plan.goldNeeded, campaign_number: simulation.campaign.number });
  }
  sound.play("build");
  hud.updateHud(stateSnapshot());

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
  track("level_start", { level: simulation.state.move, building: buildingId, campaign_number: simulation.campaign.number });
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
      sound.play("complete");
      hud.showBuiltMilestone(event.buildingId, animationElapsed);
    } else if (event.type === "gathered") {
      sound.play("gather");
      hud.showMilestone("Gathering", "Nothing built; every building worked.", animationElapsed);
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
      hud.renderBuildPanel(buildPanelView());
      if (simulation.state.lastSummary?.warnings.length) sound.play("warning");
    } else if (event.type === "muster-ready") {
      openMuster();
    } else if (event.type === "soldiers-deserted") {
      villagerField.syncGarrison(event.units, animationElapsed, simulation.state.builtBuildingIds);
    } else if (event.type === "economy-resolved") {
      for (const buildingId of event.activeBuildingIds) constructionView.markProduced(buildingId, animationElapsed);
    } else if (event.type === "population-changed") {
      villagerField.syncVillagers(Math.max(0, event.total - simulation.state.trainedUnits.archers - simulation.state.trainedUnits.swordsmen - simulation.state.trainedUnits.horsemen));
    } else if (event.type === "unit-trained") {
      villagerField.syncGarrison(event.units, animationElapsed, simulation.state.builtBuildingIds);
      sound.play("trained");
      const trained = [
        event.newSwordsmen && `${event.newSwordsmen} swordsm${event.newSwordsmen === 1 ? "a" : "e"}n`,
        event.newArchers && `${event.newArchers} archer${event.newArchers === 1 ? "" : "s"}`,
        event.newHorsemen && `${event.newHorsemen} horsem${event.newHorsemen === 1 ? "a" : "e"}n`,
      ].filter(Boolean);
      hud.setStatus(`${trained.join(", ")} trained · ${event.units.swordsmen + event.units.archers + event.units.horsemen} soldiers`, 1);
    } else if (event.type === "army-mustered") {
      presentBattle(true);
    } else if (event.type === "game-complete") {
      const report = simulation.state.armyReport;
      const fields = {
        campaign: simulation.campaign.id,
        campaign_number: simulation.campaign.number,
        stars: report?.stars ?? 0,
        trades: simulation.state.swaps,
        gathers: simulation.state.gatherMoves,
        deserted: simulation.state.deserted,
        sellswords: (report?.sellswords.archers ?? 0) + (report?.sellswords.swordsmen ?? 0),
        margin: report ? Math.round(report.margin * 100) : 0,
      };
      if (report && !report.win) track("level_failed", { level: simulation.campaign.moveLimit, reason: report.outcome, ...fields });
      track("game_over", {
        final_score: report ? Math.max(0, Math.round(report.playerStrength * 10)) : 0,
        level_reached: simulation.state.civicLevel,
        reason: report?.outcome ?? "complete",
        outcome: report?.outcome,
        total_stars: totalStars(campaignStars),
        ...fields,
      });
      autosave({ immediate: true });
      session.end();
      workerAnimation.worker.visible = false;
      hud.hideBuildPanel();
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
  selectionPending = false;
  loopFailed = false;
  sound.setPaused(pausedByPortal);
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
  hud.setReportAvailable(false);
  civicCenter.setLevel(0);
  hud.setCivicLevel(0);
  hud.updateHud(stateSnapshot());
  villagerField.clearArmyMuster();
  document.getElementById("app")?.classList.remove("fighting");
  villagerField.syncVillagers(Math.max(0, simulation.state.population - simulation.state.trainedUnits.archers - simulation.state.trainedUnits.swordsmen - simulation.state.trainedUnits.horsemen));
  villagerField.syncGarrison(simulation.state.trainedUnits);
  workerAnimation.worker.visible = true;
  workerAnimation.placeWorker(civicGround);
  workerAnimation.useCharacter("builder");
  hud.renderBuildPanel(buildPanelView());
  requestRender();
}

/**
 * Rebuilds every render-side object to match a loaded save, without replaying
 * construction or re-running `reset()`. Assumes the art for every building in
 * the save is already loaded (see `initialize()`).
 */
function hydrateFromLoadedState(): void {
  runId += 1;
  constructionView.clearPlots();
  cityLayout.hideAllRoads();
  animationElapsed = 0;
  playing = true;
  hud.setPlayingLabel(true);
  hud.setSpeedLabel(speed);
  hud.hideMilestone();
  hud.setReportAvailable(false);
  villagerField.clearArmyMuster();
  document.getElementById("app")?.classList.remove("fighting");

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
    hud.renderBuildPanel(buildPanelView());
  } else {
    // At the muster or finished: the muster dialog or the result opens when the campaign is selected.
    cityLayout.placementPad.visible = false;
    workerAnimation.worker.visible = false;
    hud.hideBuildPanel();
    hud.setReportAvailable(simulation.state.mode === "complete");
  }
  requestRender();
}

window.addEventListener("resize", () => {
  resize();
  requestRender();
});
// The HUD reports when its bars move (layout change, rotation), so the camera
// can keep the city in the part of the screen they leave free.
window.addEventListener("gae:layout", () => {
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
  if (message === "GP_PAUSE") {
    // Also while a dialog or the map has the game paused: closing it must
    // not resume behind the portal's back (setModalPause checks this flag).
    if (playing || modalCount > 0) pausedByPortal = true;
    playing = false;
    hud.setPlayingLabel(false);
    sound.setPaused(true);
  } else if (message === "GP_RESUME" && pausedByPortal) {
    pausedByPortal = false;
    sound.setPaused(false);
    // With a dialog or the map open, play resumes when the player closes it.
    if (modalCount > 0) resumeAfterTutorial = true;
    else if (!campaignMap.isOpen) {
      playing = true;
      hud.setPlayingLabel(true);
    }
    // GP_SESSION_END ended the analytics session; a resume means play goes on.
    if (initialized && simulation.state.mode !== "complete") session.start();
  } else if (message === "GP_SESSION_END") {
    pausedByPortal = true;
    sound.setPaused(true);
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
  } catch (error) {
    console.warn("[Grow an Empire] Saved settlement data could not be restored; starting a new one.", error);
    progress.clear();
    return false;
  }
  // A scene/HUD failure is a boot failure, not evidence of damaged save data.
  // Let initialize's handler offer Reload while leaving valid progress intact.
  hydrateFromLoadedState();
  return true;
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
  completedCampaignIds = [];
  campaignStars = {};
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
  platform.onLateSignIn((late) => {
    player = late;
    refreshRealm();
    reportLeaderboard("visit");
  });
  const savedPromise = platform.connect().then((signedIn) => {
    player = signedIn;
    return progress.load(signedIn?.id ?? null);
  });
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
  if (saved) {
    completedCampaignIds = saved.completedCampaignIds ?? [];
    campaignStars = { ...saved.campaignStars };
    leaderboard = saved.leaderboard ?? null;
    realm = readRealmState(saved.realm);
    const report = saved.state.mode === "complete" ? saved.state.armyReport : null;
    if (report?.win) {
      if (!completedCampaignIds.includes(saved.campaignId)) completedCampaignIds.push(saved.campaignId);
      campaignStars = mergeStars(campaignStars, { [saved.campaignId]: Math.max(1, report.stars ?? 1) });
    }
    simulation = new SettlementSimulation(campaignById(saved.campaignId) ?? CAMPAIGNS[0]);
  }
  settings = resetRequested ? { ...DEFAULT_SETTINGS } : { ...DEFAULT_SETTINGS, ...saved?.settings };
  if (resetRequested) realm = newRealmState();
  realm = visitRealm(realm, new Date());
  refreshRealm();
  if (!resetRequested && legacyTutorialCompleted()) settings.tutorialComplete = true;
  hud.setLearning(!settings.tutorialComplete);
  sound.setMuted(settings.muted === true);
  hud.setMuted(settings.muted === true);
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
  hud.setCampaign(simulation.campaign, CAMPAIGNS.findIndex((entry) => entry.id === simulation.campaign.id));
  hud.setCivicLevel(simulation.state.civicLevel);
  hud.updateHud(stateSnapshot());
  if (progress.savingDisabledReason) hud.setStatus(progress.savingDisabledReason, 0);
  // The map is the title screen. Its image (or the usable fallback) must be
  // ready before the portal loading screen is dismissed.
  await campaignMap.ready;
  stopProgress();
  resize();
  requestRender();
  hud.loading.classList.add("hidden");
  document.documentElement.dataset.booted = "true"; // Tells the boot watchdog in index.html that startup succeeded.
  performance.mark("gae-playable"); // Time-to-playable, for QA measurements (Docs/PERFORMANCE_BUDGET.md).
  initialized = true;
  autosave({ immediate: !resumed });
  console.info(`[Grow an Empire] v${__APP_VERSION__} · platform: ${platform.kind}`);
  playing = false;
  hud.setPlayingLabel(false);
  campaignMap.show(simulation.campaign.id, campaignStars, simulation.state.mode === "complete", simulation.state.move);
  track("game_start", { resumed, move: simulation.state.move, campaign_number: simulation.campaign.number, total_stars: totalStars(campaignStars) });
  reportLeaderboard("visit");
  startBackgroundLoads(offered);
  tutorialPending = !resumed;
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
  const roles = new Set([...offered, ...simulation.state.builtBuildingIds].map(roleForBuilding));
  roles.add("builder");
  for (const role of roles) {
    characterAssets.ensureRole(role, simulation.state.builtBuildingIds.some((id) => roleForBuilding(id) === role) || role === "builder")
      .catch((error: unknown) => console.warn(`[Grow an Empire] Preloading ${role} animation failed`, error));
  }
}

/** One frame: advance the simulation (if playing), then animate and draw. */
function frame(): void {
  const realDelta = getFrameDelta();
  const delta = realDelta * speed;
  // While the graphics are lost the game holds still: moves and the battle
  // must not go by unseen.
  if (!playing || !initialized || loopFailed || renderFailed || contextLost) return;
  probeFrameTime(realDelta);
  session.addPlayTime(realDelta);
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
    failSimulation(error, "frame");
  }
  // Draw only while the scene can change: the game is playing, or something
  // asked for a redraw (MOBILE_PERFORMANCE §48: stop work when paused).
  if (contextLost || !initialized || renderFailed) return;
  try {
    if ((playing && !loopFailed) || renderRequested) {
      renderRequested = false;
      renderer.render(scene, camera);
      if (!portalReadySent) {
        portalReadySent = true;
        requestAnimationFrame(() => notifyPortalReady(__APP_VERSION__));
      }
      perfOverlay?.sample();
    }
  } catch (error) {
    renderFailed = true;
    playing = false;
    hud.setPlayingLabel(false);
    hud.setStatus("The graphics failed to draw. Reload to continue from your last save.", 0);
    sound.setPaused(true);
    reportRuntimeError(error, "render");
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
  initialized = false;
  playing = false;
  sound.setPaused(true);
  reportRuntimeError(error, "initialize");
  const message = error instanceof Error ? error.message : String(error);
  track("load_error", { message: message.slice(0, 200) });
  hud.showLoadError(message);
});
