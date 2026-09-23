import { MathUtils } from "three";
import {
  BUILDINGS,
  CIVIC_LEVEL_NAMES,
  RESOURCE_LABELS,
  TOTAL_MOVES,
  TOTAL_SETTLEMENT_LEVELS,
  type ResourceName,
} from "../game/content";
import type { ArmyReport, SimulationMode, ResourceLedger } from "../game/settlementSimulation";
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
}

/** The slice of simulation state the HUD displays. */
export interface HudStateSnapshot {
  mode: SimulationMode;
  move: number;
  population: number;
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
  const buildPanel = requireElement<HTMLElement>("#build-panel");
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
  const tutorialStorageKey = "grow-an-empire:tutorial:v1";

  /** Sets the "Settlement activity" label and its progress bar (0–1, clamped). */
  function setStatus(label: string, progress: number): void {
    phaseLabel.textContent = label;
    progressFill.style.width = `${MathUtils.clamp(progress, 0, 1) * 100}%`;
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
  function updateHud(snapshot: Pick<HudStateSnapshot, "move" | "population" | "resources">): void {
    moveLabel.textContent = `${Math.min(snapshot.move, TOTAL_MOVES)} / ${TOTAL_MOVES}`;
    populationLabel.textContent = String(snapshot.population);
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
    const choiceCopy = optionCount === 1 ? "build the final remaining district" : `choose one of ${optionCount} buildings`;
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
    milestoneKicker.textContent = final ? "EIGHT MOVES COMPLETE" : "CIVIC UPGRADE";
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
    armyScore.textContent = `${report.score} / ${report.enemyStrength}`;
    armySummary.textContent = `${report.totalUnits} troops answer the muster against ${enemyName}. Build order: ${buildOrder.join(" → ")}.`;
    const unitLabels: Array<[keyof ArmyReport["units"], string]> = [
      ["militia", "Militia"], ["spearmen", "Spearmen"], ["archers", "Archers"],
      ["veterans", "Veterans"], ["mercenaries", "Mercenaries"],
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

  // --- First-run tutorial -------------------------------------------------
  // Welcome modal (pauses the game) → step 1 coach on the build panel →
  // step 2 coach after the first construction completes → done (remembered in localStorage).

  function tutorialWasCompleted(): boolean {
    try { return window.localStorage.getItem(tutorialStorageKey) === "complete"; } catch { return false; }
  }

  function finishTutorial(): void {
    tutorialActive = false;
    tutorialScrim.classList.add("hidden");
    tutorialCoach.classList.add("hidden");
    buildPanel.classList.remove("tutorial-focus");
    callbacks.onTutorialModalChange(false);
    try { window.localStorage.setItem(tutorialStorageKey, "complete"); } catch { /* Continue without persistence. */ }
  }

  function showTutorialWelcome(): void {
    tutorialActive = true;
    tutorialCoach.classList.add("hidden");
    tutorialNext.classList.add("hidden");
    buildPanel.classList.remove("tutorial-focus");
    tutorialScrim.classList.remove("hidden");
    callbacks.onTutorialModalChange(true);
  }

  function showChoiceCoach(): void {
    tutorialScrim.classList.add("hidden");
    callbacks.onTutorialModalChange(false);
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
    tutorialStep.textContent = "STEP 2 OF 2";
    tutorialCoachTitle.textContent = "Watch the whole city react";
    tutorialCoachCopy.textContent = "Each move upgrades the Town Hall, adds villagers, and runs every completed building. The raiders arrive immediately after Move 8.";
    tutorialNext.classList.remove("hidden");
    tutorialCoach.dataset.step = "growth";
    tutorialCoach.classList.remove("hidden");
    buildPanel.classList.remove("tutorial-focus");
  }

  /** Opens the tutorial on a brand-new campaign, unless the player has finished or skipped it before. */
  /** Forgets that the tutorial was completed, so it shows again on the next fresh campaign (used by `?reset`). */
  function resetTutorialProgress(): void {
    try { window.localStorage.removeItem(tutorialStorageKey); } catch { /* Storage unavailable. */ }
  }

  function maybeStartTutorial(isFreshCampaign: boolean): void {
    if (isFreshCampaign && !tutorialWasCompleted()) showTutorialWelcome();
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
  tutorialStart.addEventListener("click", () => buildPanel.classList.contains("hidden") ? showGrowthCoach() : showChoiceCoach());
  tutorialSkip.addEventListener("click", finishTutorial);
  tutorialNext.addEventListener("click", finishTutorial);
  viewCity.addEventListener("click", hideArmyReport);
  musterToggle.addEventListener("click", () => armyReport.classList.toggle("hidden"));

  return {
    viewport,
    loading,
    setStatus,
    setCivicLevel,
    setResource,
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
    resetTutorialProgress,
    handleTutorialEvent,
    isGridChecked: () => gridVisible,
  };
}

export type Hud = ReturnType<typeof createHud>;
