import { MathUtils } from "three";
import {
  BUILDINGS,
  CIVIC_LEVEL_NAMES,
  RESOURCE_LABELS,
  TOTAL_MOVES,
  TOTAL_SETTLEMENT_LEVELS,
  type ResourceName,
} from "../game/content";
import type { ArmyReport, SimulationMode, ResourceLedger, TrainedUnits } from "../game/settlementSimulation";
import { assetUrl } from "../render/assetCatalog";
import { buildingFilename } from "../render/constructionView";
import { requireElement } from "./dom";

/** User actions the HUD reports back to `main.ts`. The HUD never changes game state itself. */
export interface HudCallbacks {
  onPlayToggle(): void;
  onRestart(): void;
  onSpeedChange(speed: number): void;
  onGridToggle(visible: boolean): void;
  onSelectBuilding(buildingId: string): void;
  onTutorialModalChange(visible: boolean): void;
  /** The first-run tutorial opened (for analytics). */
  onTutorialStarted(): void;
  /** The tutorial was finished or skipped; the caller remembers it in the save. */
  onTutorialFinished(result: { skipped: boolean; stepCount: number; seconds: number }): void;
}

/** The slice of simulation state the HUD displays. */
export interface HudStateSnapshot {
  mode: SimulationMode;
  move: number;
  population: number;
  trainedUnits: TrainedUnits;
  resources: ResourceLedger;
  availableBuildingIds: string[];
}

/**
 * Every DOM element and piece of on-screen text: the top HUD, the build-choice
 * panel, the resource ledger, the milestone toast, and the transport controls.
 * Nothing here touches Three.js or the simulation directly — main.ts feeds it
 * plain values and callbacks.
 */
export function createHud(callbacks: HudCallbacks) {
  const viewport = requireElement<HTMLElement>("#viewport");
  const loading = requireElement<HTMLElement>("#loading");
  const phaseLabel = requireElement<HTMLElement>("#phase");
  const progressFill = requireElement<HTMLElement>("#phase-progress");
  const moveLabel = requireElement<HTMLElement>("#move");
  const civicLabel = requireElement<HTMLElement>("#civic-level");
  const populationLabel = requireElement<HTMLElement>("#population");
  const archersLabel = requireElement<HTMLElement>("#archers");
  const swordsmenLabel = requireElement<HTMLElement>("#swordsmen");
  const horsemenLabel = requireElement<HTMLElement>("#horsemen");
  const buildPanel = requireElement<HTMLElement>("#build-panel");
  const statusBar = requireElement<HTMLElement>(".hud");
  const settlementBar = requireElement<HTMLElement>(".settlement-hud");
  const app = requireElement<HTMLElement>("#app");
  const buildOptions = requireElement<HTMLElement>("#build-options");
  const moveChip = requireElement<HTMLElement>("#move-chip");
  const resourceLedger = requireElement<HTMLElement>("#resource-ledger");
  const resourceGrid = requireElement<HTMLElement>("#resource-grid");
  const stockpileToggle = requireElement<HTMLButtonElement>("#stockpile-toggle");
  const stockpileClose = requireElement<HTMLButtonElement>("#stockpile-close");
  const stockpileTotal = requireElement<HTMLElement>("#stockpile-total");
  const milestone = requireElement<HTMLElement>("#milestone");
  const milestoneKicker = requireElement<HTMLElement>("#milestone-kicker");
  const milestoneTitle = requireElement<HTMLElement>("#milestone-title");
  const milestoneCopy = requireElement<HTMLElement>("#milestone-copy");
  const levelTrackLabel = requireElement<HTMLElement>("#level-track-label");
  const levelPips = requireElement<HTMLElement>("#level-pips");
  const playToggle = requireElement<HTMLButtonElement>("#play-toggle");
  const restartButton = requireElement<HTMLButtonElement>("#restart");
  const speedToggle = requireElement<HTMLButtonElement>("#speed-toggle");
  const gridToggle = requireElement<HTMLButtonElement>("#grid-toggle");
  const helpToggle = requireElement<HTMLButtonElement>("#help-toggle");
  const armyReport = requireElement<HTMLElement>("#army-report");
  const armyOutcome = requireElement<HTMLElement>("#army-outcome");
  const armyScore = requireElement<HTMLElement>("#army-score");
  const armySummary = requireElement<HTMLElement>("#army-summary");
  const armyUnits = requireElement<HTMLElement>("#army-units");
  const armyStats = requireElement<HTMLElement>("#army-stats");
  const armyExplanations = requireElement<HTMLElement>("#army-explanations");
  const viewCity = requireElement<HTMLButtonElement>("#view-city");
  const musterToggle = requireElement<HTMLButtonElement>("#muster-toggle");
  const tutorialScrim = requireElement<HTMLElement>("#tutorial-scrim");
  const tutorialCoach = requireElement<HTMLElement>("#tutorial-coach");
  const tutorialStep = requireElement<HTMLElement>("#tutorial-step");
  const tutorialCoachTitle = requireElement<HTMLElement>("#tutorial-coach-title");
  const tutorialCoachCopy = requireElement<HTMLElement>("#tutorial-coach-copy");
  const tutorialStart = requireElement<HTMLButtonElement>("#tutorial-start");
  const tutorialSkip = requireElement<HTMLButtonElement>("#tutorial-skip");
  const tutorialNext = requireElement<HTMLButtonElement>("#tutorial-next");

  const resourceElements = new Map<ResourceName, HTMLElement>();
  for (const resource of Object.keys(RESOURCE_LABELS) as ResourceName[]) {
    const item = document.createElement("div");
    item.innerHTML = `<span>${RESOURCE_LABELS[resource]}</span><strong>0</strong>`;
    resourceGrid.appendChild(item);
    resourceElements.set(resource, item.querySelector("strong")!);
  }
  for (let level = 0; level < TOTAL_SETTLEMENT_LEVELS; level += 1) {
    const pip = document.createElement("i");
    pip.title = `Level ${level}: ${CIVIC_LEVEL_NAMES[level]}`;
    levelPips.appendChild(pip);
  }

  let milestoneUntil = 0;
  let selectedSpeed = 1;
  let gridVisible = false;
  let tutorialActive = false;
  let tutorialStartedAt = 0;
  let tutorialStepsSeen = 0;

  /** Sets the "Settlement activity" label and its progress bar (0–1, clamped). */
  let lastStatusLabel = "";
  let lastStatusWidth = "";
  function setStatus(label: string, progress: number): void {
    // Called every frame during construction: only touch the DOM when the
    // visible text or bar width actually changes (MOBILE_PERFORMANCE §27).
    if (label !== lastStatusLabel) {
      phaseLabel.textContent = label;
      lastStatusLabel = label;
    }
    const width = `${(MathUtils.clamp(progress, 0, 1) * 100).toFixed(1)}%`;
    if (width !== lastStatusWidth) {
      progressFill.style.width = width;
      lastStatusWidth = width;
    }
  }

  /** Updates the civic level readout, level-track label, and pips. */
  function setCivicLevel(level: number): void {
    civicLabel.textContent = `${level} / ${TOTAL_SETTLEMENT_LEVELS - 1}`;
    levelTrackLabel.textContent = `LEVEL ${level} · ${(CIVIC_LEVEL_NAMES[level] ?? "").toUpperCase()}`;
    [...levelPips.children].forEach((pip, index) => pip.classList.toggle("active", index <= level));
  }

  /** Updates one stockpile cell. Missing or non-numeric totals display as 0. */
  function setResource(resource: ResourceName, total: number): void {
    const element = resourceElements.get(resource);
    if (element) element.textContent = String(Number.isFinite(total) ? total : 0);
  }

  /** Refreshes the move counter, population, and every stockpile total. */
  function updateHud(snapshot: Pick<HudStateSnapshot, "move" | "population" | "resources" | "trainedUnits">): void {
    moveLabel.textContent = `${Math.min(snapshot.move, TOTAL_MOVES)} / ${TOTAL_MOVES}`;
    populationLabel.textContent = String(snapshot.population);
    archersLabel.textContent = String(snapshot.trainedUnits.archers);
    swordsmenLabel.textContent = String(snapshot.trainedUnits.swordsmen);
    horsemenLabel.textContent = String(snapshot.trainedUnits.horsemen);
    for (const resource of Object.keys(RESOURCE_LABELS) as ResourceName[]) {
      setResource(resource, snapshot.resources[resource]);
    }
    stockpileTotal.textContent = String(Object.values(snapshot.resources).reduce((sum, amount) => sum + (Number.isFinite(amount) ? amount : 0), 0));
  }

  /**
   * Rebuilds the choice cards for the current move and shows the panel.
   * Only acts while the simulation is awaiting a choice. Clicking a card calls
   * `onSelectBuilding`; the panel stays open until `main.ts` hides it, so a
   * failed selection can be retried.
   */
  function renderBuildPanel(snapshot: Pick<HudStateSnapshot, "mode" | "move" | "availableBuildingIds">): void {
    if (snapshot.mode !== "awaiting-choice") return;
    buildOptions.replaceChildren();
    buildPanel.removeAttribute("aria-busy");
    moveChip.textContent = `${snapshot.move} OF ${TOTAL_MOVES}`;
    for (const buildingId of snapshot.availableBuildingIds) {
      const building = BUILDINGS[buildingId];
      if (!building) {
        console.warn(`Skipping unknown building card "${buildingId}"`);
        continue;
      }
      const button = document.createElement("button");
      button.className = "build-card";
      button.type = "button";
      button.setAttribute("aria-label", `Build ${building.name}. ${building.benefit}. ${building.unlocks}`);
      button.innerHTML = `<span class="build-art"><img src="${assetUrl(buildingFilename(buildingId, "complete"))}" alt="" /></span><span class="build-name">${building.name}</span><span class="build-benefit">${building.benefit}</span><span class="build-unlock">${building.unlocks}</span>`;
      button.addEventListener("click", () => {
        if (tutorialActive) {
          tutorialCoach.classList.add("hidden");
          buildPanel.classList.remove("tutorial-focus");
        }
        callbacks.onSelectBuilding(buildingId);
      });
      buildOptions.appendChild(button);
    }
    buildPanel.classList.remove("hidden");
    const optionCount = buildOptions.childElementCount;
    if (optionCount === 0) {
      // The exhaustive offer test proves this can't happen with the current
      // catalog, but a future content change could starve the pool. Say so
      // instead of showing an empty panel with no way forward.
      setStatus(`Move ${snapshot.move}: no buildings are available. Press Restart to begin a new settlement.`, 0);
      return;
    }
    const choiceCopy = optionCount === 1 ? "choose the available building" : `choose one of ${optionCount} buildings`;
    setStatus(`Move ${snapshot.move} ready — ${choiceCopy}`, 0);
  }

  function hideBuildPanel(): void {
    buildPanel.classList.add("hidden");
  }

  /** Disables the choice cards while a selection is being prepared (prevents double-clicks). */
  function setBuildPanelBusy(busy: boolean): void {
    buildPanel.toggleAttribute("aria-busy", busy);
    buildOptions.querySelectorAll("button").forEach((button) => { button.disabled = busy; });
  }

  const loadingLabel = loading.querySelector("span");
  /** Shows boot progress on the loading screen, e.g. "Preparing the city… 12 / 20". */
  function setLoadingProgress(settled: number, requested: number): void {
    if (loadingLabel && requested > 0) loadingLabel.textContent = `Preparing the city… ${settled} / ${requested}`;
  }

  /** Replaces the loading screen's content with an error message and a reload button. */
  function showLoadError(message: string): void {
    const title = document.createElement("strong");
    title.textContent = "Could not load the settlement.";
    const detail = document.createElement("span");
    detail.textContent = message;
    const retry = document.createElement("button");
    retry.type = "button";
    retry.textContent = "Reload";
    retry.addEventListener("click", () => window.location.reload());
    loading.replaceChildren(title, detail, retry);
    loading.classList.remove("hidden");
  }

  /** Shows the milestone toast for 3.5s (6s for the final one), measured in animation time. */
  function showMilestone(title: string, copy: string, animationElapsed: number, final = false): void {
    milestoneKicker.textContent = final ? "TWELVE MOVES COMPLETE" : "CIVIC UPGRADE";
    milestoneTitle.textContent = title;
    milestoneCopy.textContent = copy;
    milestone.classList.add("visible");
    milestoneUntil = animationElapsed + (final ? 6 : 3.5);
  }

  function hideMilestone(): void {
    milestone.classList.remove("visible");
  }

  /** Fills in and opens the end-of-campaign army report. `buildOrder` is building names, move 1 first. */
  function renderArmyReport(report: ArmyReport, buildOrder: string[], enemyName: string): void {
    armyOutcome.textContent = report.outcome;
    armyScore.textContent = String(report.enemyStrength);
    armySummary.textContent = `${report.enemyStrength} swordsmen from ${enemyName} attacked. ${report.units.swordsmen} swordsmen, ${report.units.archers} archers, and ${report.units.horsemen} horsemen defended the clearing. Build order: ${buildOrder.join(" → ")}.`;
    const unitLabels: Array<[keyof ArmyReport["units"], string]> = [
      ["militia", "Militia"], ["spearmen", "Spearmen"], ["archers", "Archers"],
      ["swordsmen", "Swordsmen"], ["horsemen", "Horsemen"], ["mercenaries", "Mercenaries"],
    ];
    armyUnits.innerHTML = unitLabels.map(([key, label]) => `<div><span>${label}</span><b>${report.units[key]}</b></div>`).join("");
    armyStats.innerHTML = [
      ["Combat", report.combatStrength], ["Supply turns", report.supplyTurns],
      ["City defense", report.cityDefense], ["Morale", report.morale],
    ].map(([label, value]) => `<div><span>${label}</span><b>${value}</b></div>`).join("");
    armyExplanations.innerHTML = report.explanations.map((explanation) => `<li>${explanation}</li>`).join("");
    armyReport.classList.remove("hidden");
    musterToggle.classList.remove("hidden");
  }

  function hideArmyReport(): void { armyReport.classList.add("hidden"); }
  function resetArmyReport(): void {
    hideArmyReport();
    musterToggle.classList.add("hidden");
  }

  /** Called once per frame; hides the milestone toast once its timer expires. */
  function updateMilestoneVisibility(animationElapsed: number): void {
    if (milestone.classList.contains("visible") && animationElapsed >= milestoneUntil) hideMilestone();
  }

  function setPlayingLabel(playing: boolean): void {
    playToggle.textContent = playing ? "Pause" : "Play";
  }

  function setSpeedLabel(speed: number): void {
    selectedSpeed = speed;
    speedToggle.textContent = `Speed · ${speed}×`;
  }

  function setStockpileVisible(visible: boolean): void {
    resourceLedger.classList.toggle("hidden", !visible);
    stockpileToggle.setAttribute("aria-expanded", String(visible));
    stockpileToggle.classList.toggle("active", visible);
  }

  // --- Layout ---------------------------------------------------------------
  // Publishes the real positions of the top bars and the build panel as CSS
  // variables (see the "Mobile and portal layout" block in styles.css), so
  // panels stack below/above them at any screen size instead of relying on
  // fixed pixel offsets that break when text wraps on a phone.
  function publishLayout(): void {
    const appBox = app.getBoundingClientRect();
    // The stage is scaled on screen (index.html), but these variables are used
    // inside it, so convert screen pixels back to stage pixels.
    const toStage = app.offsetWidth > 0 && appBox.width > 0 ? app.offsetWidth / appBox.width : 1;
    const root = document.documentElement.style;
    const hudBox = statusBar.getBoundingClientRect();
    const settlementBox = settlementBar.getBoundingClientRect();
    if (hudBox.height > 0) root.setProperty("--hud-bottom", `${Math.round((hudBox.bottom - appBox.top) * toStage)}px`);
    if (settlementBox.height > 0) root.setProperty("--settlement-bottom", `${Math.round((settlementBox.bottom - appBox.top) * toStage)}px`);
    const panelBox = buildPanel.getBoundingClientRect();
    if (panelBox.height > 0) root.setProperty("--build-panel-reach", `${Math.round((appBox.bottom - panelBox.top) * toStage)}px`);
  }
  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(() => publishLayout());
    for (const element of [app, statusBar, settlementBar, buildPanel]) observer.observe(element);
  }
  window.addEventListener("resize", publishLayout);
  publishLayout();

  // --- First-run tutorial -------------------------------------------------
  // Welcome modal (pauses the game) → step 1 coach on the build panel →
  // step 2 coach after the first construction completes → done. main.ts
  // remembers completion in the save (so it follows the player to the cloud).

  function finishTutorial(skipped: boolean): void {
    const wasActive = tutorialActive;
    tutorialActive = false;
    tutorialScrim.classList.add("hidden");
    tutorialCoach.classList.add("hidden");
    buildPanel.classList.remove("tutorial-focus");
    callbacks.onTutorialModalChange(false);
    if (wasActive) {
      callbacks.onTutorialFinished({ skipped, stepCount: tutorialStepsSeen, seconds: Math.round((performance.now() - tutorialStartedAt) / 1000) });
    }
  }

  function showTutorialWelcome(): void {
    if (!tutorialActive) {
      tutorialStartedAt = performance.now();
      tutorialStepsSeen = 0;
      callbacks.onTutorialStarted();
    }
    tutorialActive = true;
    tutorialCoach.classList.add("hidden");
    tutorialNext.classList.add("hidden");
    buildPanel.classList.remove("tutorial-focus");
    tutorialScrim.classList.remove("hidden");
    callbacks.onTutorialModalChange(true);
    tutorialStart.focus(); // Move focus into the dialog (QA_CHECKLIST §13: focus handling).
  }

  function showChoiceCoach(): void {
    tutorialScrim.classList.add("hidden");
    callbacks.onTutorialModalChange(false);
    tutorialStepsSeen = Math.max(tutorialStepsSeen, 1);
    tutorialStep.textContent = "STEP 1 OF 2";
    tutorialCoachTitle.textContent = "Your first decision";
    tutorialCoachCopy.textContent = "Choose one building. Earlier choices work for more moves, so watch what each option produces and unlocks.";
    tutorialNext.classList.add("hidden");
    tutorialCoach.dataset.step = "choice";
    tutorialCoach.classList.remove("hidden");
    buildPanel.classList.add("tutorial-focus");
  }

  function showGrowthCoach(): void {
    tutorialScrim.classList.add("hidden");
    callbacks.onTutorialModalChange(false);
    tutorialStepsSeen = Math.max(tutorialStepsSeen, 2);
    tutorialStep.textContent = "STEP 2 OF 2";
    tutorialCoachTitle.textContent = "Watch the whole city react";
    tutorialCoachCopy.textContent = `Each move upgrades the settlement, adds villagers, and runs every completed building. The raiders arrive immediately after Move ${TOTAL_MOVES}.`;
    tutorialNext.classList.remove("hidden");
    tutorialCoach.dataset.step = "growth";
    tutorialCoach.classList.remove("hidden");
    buildPanel.classList.remove("tutorial-focus");
  }

  /** Opens the tutorial on a brand-new campaign, unless the player has finished or skipped it before. */
  function maybeStartTutorial(isFreshCampaign: boolean, completedBefore: boolean): void {
    if (isFreshCampaign && !completedBefore) showTutorialWelcome();
  }

  function handleTutorialEvent(event: "first-move-complete"): void {
    if (event === "first-move-complete" && tutorialActive) showGrowthCoach();
  }

  playToggle.addEventListener("click", callbacks.onPlayToggle);
  restartButton.addEventListener("click", callbacks.onRestart);
  speedToggle.addEventListener("click", () => {
    const speeds = [1, 2, 4, 8];
    const next = speeds[(speeds.indexOf(selectedSpeed) + 1) % speeds.length];
    callbacks.onSpeedChange(next);
  });
  gridToggle.addEventListener("click", () => {
    gridVisible = !gridVisible;
    gridToggle.textContent = `Grid · ${gridVisible ? "On" : "Off"}`;
    gridToggle.setAttribute("aria-pressed", String(gridVisible));
    callbacks.onGridToggle(gridVisible);
  });
  stockpileToggle.addEventListener("click", () => setStockpileVisible(resourceLedger.classList.contains("hidden")));
  stockpileClose.addEventListener("click", () => setStockpileVisible(false));
  helpToggle.addEventListener("click", showTutorialWelcome);
  // The clicked dialog button disappears with the dialog, so move keyboard
  // focus somewhere useful rather than leaving it on a hidden element.
  tutorialStart.addEventListener("click", () => {
    if (buildPanel.classList.contains("hidden")) {
      showGrowthCoach();
      tutorialNext.focus();
    } else {
      showChoiceCoach();
      buildPanel.querySelector<HTMLButtonElement>("button:not([disabled])")?.focus();
    }
  });
  tutorialSkip.addEventListener("click", () => {
    finishTutorial(true);
    helpToggle.focus();
  });
  // Keyboard support for the modal dialog: Esc skips it, Tab stays inside it.
  // Listens on the document, not the dialog, so it still works after a click
  // on the backdrop has moved focus out of the dialog.
  document.addEventListener("keydown", (event) => {
    if (tutorialScrim.classList.contains("hidden")) return;
    if (event.key === "Tab" && !tutorialScrim.contains(document.activeElement)) {
      event.preventDefault();
      tutorialStart.focus();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      finishTutorial(true);
      helpToggle.focus();
    } else if (event.key === "Tab") {
      const focusable = [...tutorialScrim.querySelectorAll<HTMLElement>("button:not([disabled])")].filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  tutorialNext.addEventListener("click", () => {
    const hadFocus = document.activeElement === tutorialNext;
    finishTutorial(false);
    if (hadFocus) helpToggle.focus();
  });
  viewCity.addEventListener("click", hideArmyReport);
  musterToggle.addEventListener("click", () => armyReport.classList.toggle("hidden"));

  return {
    viewport,
    loading,
    setLoadingProgress,
    setStatus,
    setCivicLevel,
    updateHud,
    renderBuildPanel,
    hideBuildPanel,
    setBuildPanelBusy,
    showLoadError,
    showMilestone,
    hideMilestone,
    updateMilestoneVisibility,
    setPlayingLabel,
    setSpeedLabel,
    renderArmyReport,
    hideArmyReport,
    resetArmyReport,
    maybeStartTutorial,
    handleTutorialEvent,
  };
}

export type Hud = ReturnType<typeof createHud>;
