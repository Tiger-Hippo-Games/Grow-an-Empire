import { MathUtils } from "three";
import {
  BUILDINGS,
  CIVIC_LEVEL_NAMES,
  RESOURCE_LABELS,
  TOTAL_MOVES,
  TOTAL_SETTLEMENT_LEVELS,
  type ResourceName,
} from "../game/content";
import { formatBag, RESOURCE_NAMES, type ResourceBag, type SwapPlan } from "../game/economy";
import type { MoveSummary, SimulationMode, ResourceLedger, TrainedUnits } from "../game/settlementSimulation";
import { assetUrl } from "../render/assetCatalog";
import { buildingFilename } from "../render/constructionView";
import { requireElement } from "./dom";
import type { CampaignDefinition } from "../game/campaigns";

/** User actions the HUD reports back to `main.ts`. The HUD never changes game state itself. */
export interface HudCallbacks {
  onPlayToggle(): void;
  onRestart(): void;
  onSpeedChange(speed: number): void;
  onGridToggle(visible: boolean): void;
  onSelectBuilding(buildingId: string): void;
  /** Stuck move with a Marketplace: sell goods to pay for this card, then build it. */
  onSwapBuild(buildingId: string): void;
  /** Stuck move: build nothing this move. */
  onGather(): void;
  onMuteToggle(): void;
  onFullscreenToggle(): void;
  /** The "Battle report" button. */
  onReportToggle(): void;
  onTutorialModalChange(visible: boolean): void;
  /** The first-run tutorial opened (for analytics). */
  onTutorialStarted(): void;
  /** The tutorial was finished or skipped; the caller remembers it in the save. */
  onTutorialFinished(result: { skipped: boolean; stepCount: number; seconds: number }): void;
}

/** One offered card, as the build panel shows it. */
export interface CardView { id: string; affordable: boolean; missing: ResourceBag; swap: SwapPlan | null }

/** What the build panel needs for one move. */
export interface BuildPanelView {
  mode: SimulationMode;
  move: number;
  cards: CardView[];
  canGather: boolean;
  hasMarketplace: boolean;
  summary: MoveSummary | null;
  resources: ResourceLedger;
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
  const campaignKicker = requireElement<HTMLElement>(".brand .eyebrow");
  const campaignTitle = requireElement<HTMLElement>(".brand h1");
  const raidObjective = requireElement<HTMLElement>(".raid-objective strong");
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
  const musterToggle = requireElement<HTMLButtonElement>("#muster-toggle");
  const muteToggle = requireElement<HTMLButtonElement>("#mute-toggle");
  const fullscreenToggle = requireElement<HTMLButtonElement>("#fullscreen-toggle");
  const controls = requireElement<HTMLElement>(".controls");
  const controlsMore = requireElement<HTMLButtonElement>("#controls-more");
  const controlsSecondary = requireElement<HTMLElement>("#controls-secondary");
  const moveSummary = requireElement<HTMLElement>("#move-summary");
  const buildFoot = requireElement<HTMLElement>("#build-foot");
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
  let campaignMoveLimit = TOTAL_MOVES;
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
    civicLabel.textContent = `${level} / ${campaignMoveLimit}`;
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
    moveLabel.textContent = `${Math.min(snapshot.move, campaignMoveLimit)} / ${campaignMoveLimit}`;
    populationLabel.textContent = String(snapshot.population);
    archersLabel.textContent = String(snapshot.trainedUnits.archers);
    swordsmenLabel.textContent = String(snapshot.trainedUnits.swordsmen);
    horsemenLabel.textContent = String(snapshot.trainedUnits.horsemen);
    for (const resource of Object.keys(RESOURCE_LABELS) as ResourceName[]) {
      setResource(resource, snapshot.resources[resource]);
    }
    stockpileTotal.textContent = String(Object.values(snapshot.resources).reduce((sum, amount) => sum + (Number.isFinite(amount) ? amount : 0), 0));
  }

  /** "+5 wood, +3 grain" */
  function signedBag(bag: ResourceBag, sign: "+" | "−"): string {
    return RESOURCE_NAMES.filter((name) => (bag[name] ?? 0) > 0).map((name) => `${sign}${bag[name]} ${RESOURCE_LABELS[name].toLowerCase()}`).join(", ");
  }

  /** The "what happened last move" strip at the top of the build panel. */
  function renderSummary(summary: MoveSummary | null): void {
    if (!summary) { moveSummary.classList.add("hidden"); return; }
    const built = summary.buildingId ? `Built the ${BUILDINGS[summary.buildingId]?.name ?? summary.buildingId}` : "Gathered (nothing built)";
    const trained = (["archers", "swordsmen", "horsemen"] as const).filter((type) => summary.trained[type] > 0)
      .map((type) => `${summary.trained[type]} ${summary.trained[type] === 1 ? type.slice(0, -1).replace("swordsme", "swordsman").replace("horseme", "horseman") : type}`);
    const parts = [
      `<b>Move ${summary.move}</b> · ${built}`,
      summary.produced && Object.keys(summary.produced).length ? `<span class="gain">${signedBag(summary.produced, "+")}</span>` : "",
      summary.consumed && Object.keys(summary.consumed).length ? `<span class="loss">${signedBag(summary.consumed, "−")}</span>` : "",
      trained.length ? `<span class="gain">Trained ${trained.join(", ")}</span>` : "",
      summary.upkeep ? `Army ate ${summary.upkeep} ration${summary.upkeep === 1 ? "" : "s"}` : "",
      summary.stalled.length ? `<span class="idle">Idle: ${summary.stalled.map((note) => `${BUILDINGS[note.buildingId]?.name ?? note.buildingId} (${note.reason})`).join("; ")}</span>` : "",
    ].filter(Boolean);
    const warnings = summary.warnings.map((text) => `<p class="summary-warning">${text}</p>`).join("");
    moveSummary.innerHTML = `<p>${parts.join(" · ")}</p>${warnings}`;
    moveSummary.classList.remove("hidden");
  }

  function costChips(cost: ResourceBag, resources: ResourceLedger): string {
    return RESOURCE_NAMES.filter((name) => (cost[name] ?? 0) > 0)
      .map((name) => `<span class="cost-chip${(resources[name] ?? 0) < (cost[name] ?? 0) ? " short" : ""}">${cost[name]} ${RESOURCE_LABELS[name].toLowerCase()}</span>`).join("");
  }

  /**
   * Rebuilds the choice cards for the current move and shows the panel.
   * Only acts while the simulation is awaiting a choice. Affordable cards call
   * `onSelectBuilding`; on a stuck move with a Marketplace, a card that a swap
   * can pay for calls `onSwapBuild`; otherwise it is disabled and says what it
   * lacks. When nothing can be built, a Gather button appears.
   */
  function renderBuildPanel(view: BuildPanelView): void {
    if (view.mode !== "awaiting-choice") return;
    buildOptions.replaceChildren();
    buildPanel.removeAttribute("aria-busy");
    moveChip.textContent = `${view.move} OF ${campaignMoveLimit}`;
    renderSummary(view.summary);
    view.cards.forEach((card, index) => {
      const building = BUILDINGS[card.id];
      if (!building) {
        console.warn(`Skipping unknown building card "${card.id}"`);
        return;
      }
      const button = document.createElement("button");
      button.type = "button";
      const state = card.affordable ? "affordable" : card.swap ? "swappable" : "unaffordable";
      button.className = `build-card ${state}`;
      button.dataset.key = String(index + 1);
      const action = card.affordable ? "BUILD" : card.swap ? "SWAP & BUILD" : `NEEDS ${formatBag(card.missing).toUpperCase()}`;
      const swapLine = card.swap ? `<span class="build-swap">Market: sell ${formatBag(card.swap.sell)} to buy ${formatBag(card.swap.buy)}</span>` : "";
      button.setAttribute("aria-label", `${index + 1}: ${card.affordable ? "Build" : card.swap ? "Swap goods and build" : "Can't afford"} ${building.name}. Costs ${formatBag(building.cost)}. ${building.benefit}. ${building.unlocks}`);
      button.innerHTML = `<span class="build-key" aria-hidden="true">${index + 1}</span><span class="build-art"><img src="${assetUrl(buildingFilename(card.id, "complete"))}" alt="" /></span><span class="build-name">${building.name}</span><span class="build-costs">${costChips(building.cost, view.resources)}</span><span class="build-benefit">${building.benefit}</span>${swapLine}<span class="build-unlock">${building.unlocks}</span><span class="build-action">${action}</span>`;
      if (state === "unaffordable") button.setAttribute("aria-disabled", "true");
      button.addEventListener("click", () => {
        if (state === "unaffordable") return;
        if (tutorialActive) {
          tutorialCoach.classList.add("hidden");
          buildPanel.classList.remove("tutorial-focus");
        }
        if (state === "affordable") callbacks.onSelectBuilding(card.id);
        else callbacks.onSwapBuild(card.id);
      });
      buildOptions.appendChild(button);
    });
    buildFoot.replaceChildren();
    if (view.canGather) {
      const gather = document.createElement("button");
      gather.type = "button";
      gather.className = "gather-button";
      gather.innerHTML = `<b>Gather</b> <span>Nothing on offer is affordable${view.hasMarketplace ? " even with a swap" : ""}. Skip building this move: every building still works, and the move counts. (G)</span>`;
      gather.addEventListener("click", callbacks.onGather);
      buildFoot.appendChild(gather);
    } else {
      const hint = document.createElement("p");
      hint.className = "decision-hint";
      hint.textContent = view.cards.some((card) => card.swap)
        ? "Nothing is affordable: the Marketplace can swap your spare goods (at twice the price) for what a card needs."
        : "Costs are paid when building starts. Built earlier means more moves to produce and mature. Keys 1-3 choose.";
      buildFoot.appendChild(hint);
    }
    buildPanel.classList.remove("hidden");
    const optionCount = buildOptions.childElementCount;
    if (optionCount === 0) {
      // The exhaustive offer test proves this can't happen with the current
      // catalog, but a future content change could starve the pool. Say so
      // instead of showing an empty panel with no way forward.
      setStatus(`Move ${view.move}: no buildings are available. Press Restart to begin a new settlement.`, 0);
      return;
    }
    const affordable = view.cards.filter((card) => card.affordable).length;
    setStatus(view.canGather ? `Move ${view.move}: nothing is affordable, so gather this move`
      : affordable === 0 ? `Move ${view.move}: swap goods at the Marketplace to build`
      : `Move ${view.move} ready: choose one of ${affordable} affordable building${affordable === 1 ? "" : "s"}`, 0);
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
    milestoneKicker.textContent = final ? `${campaignMoveLimit} MOVES COMPLETE` : "MOVE COMPLETE";
    milestoneTitle.textContent = title;
    milestoneCopy.textContent = copy;
    milestone.classList.add("visible");
    milestoneUntil = animationElapsed + (final ? 6 : 3.5);
  }

  function hideMilestone(): void {
    milestone.classList.remove("visible");
  }

  function setCampaign(campaign: CampaignDefinition, index: number): void {
    campaignMoveLimit = campaign.moveLimit;
    [...levelPips.children].forEach((pip, pipIndex) => { (pip as HTMLElement).hidden = pipIndex > campaignMoveLimit; });
    campaignKicker.textContent = `CAMPAIGN ${index + 1} OF 25`;
    campaignTitle.textContent = campaign.name;
    raidObjective.textContent = `${campaign.objective.enemyName}: ${campaign.objective.strength} ${campaign.objective.strength === 1 ? "soldier" : "soldiers"} after move ${campaign.moveLimit}`;
  }

  /** Shows or hides the "Battle report" button (shown once a battle has been fought). */
  function setReportAvailable(available: boolean): void {
    musterToggle.classList.toggle("hidden", !available);
  }

  function setMuted(muted: boolean): void {
    muteToggle.textContent = muted ? "Sound · Off" : "Sound · On";
    muteToggle.setAttribute("aria-pressed", String(muted));
  }

  function setFullscreenAvailable(available: boolean): void {
    fullscreenToggle.classList.toggle("hidden", !available);
  }
  function setFullscreenLabel(active: boolean): void {
    fullscreenToggle.textContent = active ? "Exit full screen" : "Full screen";
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
  let lastLayout = "";
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
    // The camera keeps the city clear of the bars (sceneSetup.freeArea), so
    // tell main.ts when they move.
    const layout = [root.getPropertyValue("--hud-bottom"), root.getPropertyValue("--settlement-bottom"), app.offsetWidth, app.offsetHeight].join();
    if (layout !== lastLayout) {
      lastLayout = layout;
      window.dispatchEvent(new Event("gae:layout"));
    }
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
    tutorialCoachCopy.textContent = "Choose a building you can afford: its cost is shown on the card and paid now. Earlier buildings work for more moves, so watch what each one produces and unlocks.";
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
    tutorialCoachCopy.textContent = `After every move, each building works once: raw goods first, then workshops turn them into planks, rations and soldiers, and the army eats. The move summary on the build panel shows what happened. The enemy arrives after Move ${campaignMoveLimit}.`;
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
  musterToggle.addEventListener("click", callbacks.onReportToggle);

  // "More": on phones and small frames the secondary controls fold into a
  // menu above the control row (styles.css). In the fixed layout the button
  // is hidden and every control sits in the row.
  function setMoreOpen(open: boolean): void {
    controls.classList.toggle("expanded", open);
    controlsMore.setAttribute("aria-expanded", String(open));
  }
  controlsMore.addEventListener("click", () => setMoreOpen(!controls.classList.contains("expanded")));
  // Toggles (grid, sound) keep the menu open so the new state is visible; the rest close it.
  controlsSecondary.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest("button");
    if (button && button !== gridToggle && button !== muteToggle) setMoreOpen(false);
  });
  document.addEventListener("pointerdown", (event) => {
    if (controls.classList.contains("expanded") && !controls.contains(event.target as Node)) setMoreOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && controls.classList.contains("expanded")) {
      setMoreOpen(false);
      controlsMore.focus();
    }
  });
  muteToggle.addEventListener("click", callbacks.onMuteToggle);
  fullscreenToggle.addEventListener("click", callbacks.onFullscreenToggle);

  // Keyboard shortcuts (not while typing, and not while a dialog is open):
  // 1-3 choose a card, G gathers, Space or P pauses, S changes speed,
  // M mutes, F toggles full screen.
  document.addEventListener("keydown", (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
    if (document.querySelector(".flow-scrim:not(.hidden), .tutorial-scrim:not(.hidden), .campaign-map:not(.hidden)")) return;
    const key = event.key.toLowerCase();
    if (["1", "2", "3"].includes(key) && !buildPanel.classList.contains("hidden")) {
      const card = buildOptions.querySelector<HTMLButtonElement>(`button[data-key="${key}"]`);
      if (card && !card.disabled) { event.preventDefault(); card.click(); }
    } else if (key === "g" && !buildPanel.classList.contains("hidden")) {
      buildFoot.querySelector<HTMLButtonElement>(".gather-button")?.click();
    } else if (key === " " || key === "p") {
      if (key === " " && target?.tagName === "BUTTON") return; // Space on a focused button presses it.
      event.preventDefault();
      playToggle.click();
    } else if (key === "s") {
      speedToggle.click();
    } else if (key === "m") {
      muteToggle.click();
    } else if (key === "f" && !fullscreenToggle.classList.contains("hidden")) {
      fullscreenToggle.click();
    }
  });

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
    setCampaign,
    setReportAvailable,
    setMuted,
    setFullscreenAvailable,
    setFullscreenLabel,
    maybeStartTutorial,
    handleTutorialEvent,
  };
}

export type Hud = ReturnType<typeof createHud>;
