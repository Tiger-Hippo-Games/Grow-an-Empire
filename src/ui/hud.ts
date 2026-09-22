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

export interface HudCallbacks {
  onPlayToggle(): void;
  onRestart(): void;
  onSpeedChange(speed: number): void;
  onGridToggle(visible: boolean): void;
  onSelectBuilding(buildingId: string): void;
}

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
  const milestone = requireElement<HTMLElement>("#milestone");
  const milestoneKicker = requireElement<HTMLElement>("#milestone-kicker");
  const milestoneTitle = requireElement<HTMLElement>("#milestone-title");
  const milestoneCopy = requireElement<HTMLElement>("#milestone-copy");
  const levelTrackLabel = requireElement<HTMLElement>("#level-track-label");
  const levelPips = requireElement<HTMLElement>("#level-pips");
  const playToggle = requireElement<HTMLButtonElement>("#play-toggle");
  const restartButton = requireElement<HTMLButtonElement>("#restart");
  const speedInput = requireElement<HTMLInputElement>("#speed");
  const speedValue = requireElement<HTMLOutputElement>("#speed-value");
  const gridToggle = requireElement<HTMLInputElement>("#grid-toggle");
  const armyReport = requireElement<HTMLElement>("#army-report");
  const armyOutcome = requireElement<HTMLElement>("#army-outcome");
  const armyScore = requireElement<HTMLElement>("#army-score");
  const armySummary = requireElement<HTMLElement>("#army-summary");
  const armyUnits = requireElement<HTMLElement>("#army-units");
  const armyStats = requireElement<HTMLElement>("#army-stats");
  const armyExplanations = requireElement<HTMLElement>("#army-explanations");
  const viewCity = requireElement<HTMLButtonElement>("#view-city");
  const musterToggle = requireElement<HTMLButtonElement>("#muster-toggle");

  const resourceElements = new Map<ResourceName, HTMLElement>();
  for (const resource of Object.keys(RESOURCE_LABELS) as ResourceName[]) {
    const item = document.createElement("div");
    item.innerHTML = `<span>${RESOURCE_LABELS[resource]}</span><strong>0</strong>`;
    resourceLedger.appendChild(item);
    resourceElements.set(resource, item.querySelector("strong")!);
  }
  for (let level = 0; level < TOTAL_SETTLEMENT_LEVELS; level += 1) {
    const pip = document.createElement("i");
    pip.title = `Level ${level}: ${CIVIC_LEVEL_NAMES[level]}`;
    levelPips.appendChild(pip);
  }

  let milestoneUntil = 0;

  function setStatus(label: string, progress: number): void {
    phaseLabel.textContent = label;
    progressFill.style.width = `${MathUtils.clamp(progress, 0, 1) * 100}%`;
  }

  function setCivicLevel(level: number): void {
    civicLabel.textContent = `${level} / ${TOTAL_SETTLEMENT_LEVELS - 1}`;
    levelTrackLabel.textContent = `LEVEL ${level} · ${CIVIC_LEVEL_NAMES[level].toUpperCase()}`;
    [...levelPips.children].forEach((pip, index) => pip.classList.toggle("active", index <= level));
  }

  function setResource(resource: ResourceName, total: number): void {
    resourceElements.get(resource)!.textContent = String(total);
  }

  function updateHud(snapshot: Pick<HudStateSnapshot, "move" | "population" | "resources">): void {
    moveLabel.textContent = `${Math.min(snapshot.move, TOTAL_MOVES)} / ${TOTAL_MOVES}`;
    populationLabel.textContent = String(snapshot.population);
    for (const resource of Object.keys(RESOURCE_LABELS) as ResourceName[]) {
      setResource(resource, snapshot.resources[resource]);
    }
  }

  function renderBuildPanel(snapshot: Pick<HudStateSnapshot, "mode" | "move" | "availableBuildingIds">): void {
    if (snapshot.mode !== "awaiting-choice") return;
    buildOptions.replaceChildren();
    moveChip.textContent = `MOVE ${snapshot.move} OF ${TOTAL_MOVES}`;
    for (const buildingId of snapshot.availableBuildingIds) {
      const building = BUILDINGS[buildingId];
      const button = document.createElement("button");
      button.className = "build-card";
      button.type = "button";
      button.innerHTML = `<img src="${assetUrl(buildingFilename(buildingId, "complete"))}" alt="${building.name}" /><span class="build-copy"><span class="build-name">${building.name}</span><span class="build-description">${building.description}</span><span class="build-benefit"><b>Role</b> ${building.benefit} · ${building.unlocks}</span></span><span class="build-cta">Build</span>`;
      button.addEventListener("click", () => callbacks.onSelectBuilding(buildingId));
      buildOptions.appendChild(button);
    }
    buildPanel.classList.remove("hidden");
    const optionCount = snapshot.availableBuildingIds.length;
    const choiceCopy = optionCount === 1 ? "build the final remaining district" : `choose one of ${optionCount} buildings`;
    setStatus(`Move ${snapshot.move} ready — ${choiceCopy}`, 0);
  }

  function hideBuildPanel(): void {
    buildPanel.classList.add("hidden");
  }

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

  function renderArmyReport(report: ArmyReport, buildOrder: string[]): void {
    armyOutcome.textContent = report.outcome;
    armyScore.textContent = `${report.score} / ${report.enemyStrength}`;
    armySummary.textContent = `${report.totalUnits} troops answer the muster against the Ashfang Raiders. Build order: ${buildOrder.join(" → ")}.`;
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
    speedInput.value = String(speed);
    speedValue.value = `${speed}×`;
  }

  playToggle.addEventListener("click", callbacks.onPlayToggle);
  restartButton.addEventListener("click", callbacks.onRestart);
  speedInput.addEventListener("input", () => callbacks.onSpeedChange(Number(speedInput.value)));
  gridToggle.addEventListener("change", () => callbacks.onGridToggle(gridToggle.checked));
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
    showMilestone,
    hideMilestone,
    updateMilestoneVisibility,
    setPlayingLabel,
    setSpeedLabel,
    renderArmyReport,
    hideArmyReport,
    resetArmyReport,
    isGridChecked: () => gridToggle.checked,
  };
}

export type Hud = ReturnType<typeof createHud>;
