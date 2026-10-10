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
import { effectHtml } from "./cardEffect";
import { escapeHtml, focusFirst, requireElement } from "./dom";
import { amount, icon, iconWord, type IconName } from "./icons";
import type { CampaignDefinition } from "../game/campaigns";

/** User actions the HUD reports back to `main.ts`. The HUD never changes game state itself. */
export interface HudCallbacks {
  onPlayToggle(): void;
  onRestart(): void;
  onSpeedChange(speed: number): void;
  onGridToggle(visible: boolean): void;
  onSelectBuilding(buildingId: string): void;
  /** Stuck move with a Bazaar: sell goods to pay for this card, then build it. */
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
  /** UX analytics for portal-user testing (Docs/PLAYTEST_PORTAL.md). */
  onUxEvent?(name: string, properties: Record<string, unknown>): void;
  onUiSound?(): void;
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
  const speedSlider = requireElement<HTMLInputElement>("#speed-slider");
  const speedValue = requireElement<HTMLOutputElement>("#speed-value");
  const speeds = [1, 2, 4, 8];
  const gridToggle = requireElement<HTMLButtonElement>("#grid-toggle");
  const helpToggle = requireElement<HTMLButtonElement>("#help-toggle");
  const musterToggle = requireElement<HTMLButtonElement>("#muster-toggle");
  const muteToggle = requireElement<HTMLButtonElement>("#mute-toggle");
  const fullscreenToggle = requireElement<HTMLButtonElement>("#fullscreen-toggle");
  const controls = requireElement<HTMLElement>(".controls");
  const controlsMore = requireElement<HTMLButtonElement>("#controls-more");
  const controlsSecondary = requireElement<HTMLElement>("#controls-secondary");
  const cityUiToggle = requireElement<HTMLButtonElement>("#city-ui-toggle");
  const cityViewToggle = requireElement<HTMLButtonElement>("#city-view-toggle");
  const moveSummary = requireElement<HTMLElement>("#move-summary");
  const stockStrip = requireElement<HTMLElement>("#stock-strip");
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
    item.innerHTML = `<span title="${RESOURCE_LABELS[resource]}">${icon(resource)}<span class="sr">${RESOURCE_LABELS[resource]}</span></span><strong>0</strong>`;
    resourceGrid.appendChild(item);
    resourceElements.set(resource, item.querySelector("strong")!);
  }
  // Icons beside the settlement numbers and in the tutorial's picture steps.
  const METRIC_ICONS: Array<[string, IconName]> = [["#move", "move"], ["#civic-level", "civic"], ["#population", "people"], ["#archers", "archers"], ["#swordsmen", "swordsmen"], ["#horsemen", "horsemen"]];
  for (const [selector, name] of METRIC_ICONS) {
    const label = document.querySelector(selector)?.parentElement?.querySelector("span");
    if (label) { const word = label.textContent ?? ""; label.title = word; label.innerHTML = `${icon(name)}<span class="sr">${word}</span>`; }
  }
  stockpileToggle.querySelector("span")!.innerHTML = `${icon("stockpile")}<span class="sr">Stockpile</span>`;
  stockpileToggle.title = "Stockpile";
  tutorialScrim.querySelectorAll<HTMLElement>("[data-icons]").forEach((slot) => {
    slot.innerHTML = (slot.dataset.icons ?? "").split(" ").filter(Boolean).map((name) => icon(name as IconName)).join("");
  });
  for (let level = 0; level < TOTAL_SETTLEMENT_LEVELS; level += 1) {
    const pip = document.createElement("i");
    pip.title = `Level ${level}: ${CIVIC_LEVEL_NAMES[level]}`;
    levelPips.appendChild(pip);
  }

  // Words mode: while the player is learning (tutorial not yet finished, or
  // replayed from "How to play") labels and sentences show beside the icons
  // (`.w` elements, styles.css). After that the game speaks in icons only.
  let learning = true;
  function syncWords(): void {
    document.documentElement.classList.toggle("words", learning || tutorialActive);
  }
  /** main.ts: false once the player has finished or skipped the tutorial before. */
  function setLearning(on: boolean): void {
    learning = on;
    syncWords();
  }

  /** An icon button: the icon, its word only while learning, the word as its accessible name and tooltip. */
  function setButton(button: HTMLElement, name: IconName, label: string, visible = ""): void {
    button.innerHTML = `${icon(name)}${visible ? `<b>${visible}</b>` : ""}<span class="w btn-label">${label}</span>`;
    button.setAttribute("aria-label", label);
    button.title = label;
  }
  setButton(musterToggle, "report", "Battle report");
  setButton(requireElement<HTMLButtonElement>("#realm-toggle"), "rank", "Realm");
  setButton(requireElement<HTMLButtonElement>("#map-toggle"), "map", "Campaign map");
  setButton(controlsMore, "more", "More");
  setButton(gridToggle, "grid", "Grid · Off");
  setButton(helpToggle, "help", "How to play");
  setButton(restartButton, "restart", "Restart");
  setButton(cityViewToggle, "eye", "View city");
  setButton(cityUiToggle, "more", "Controls");
  setButton(stockpileClose, "close", "Close stockpile");
  setButton(fullscreenToggle, "fullscreen", "Full screen");
  setButton(muteToggle, "sound", "Sound · On");
  setButton(playToggle, "pause", "Pause");

  // What the player did while choosing (moves 1-3 are reported, for testing).
  let choiceShownAt = 0;
  let choiceInfoOpens = 0;
  let choiceBlockedTaps = 0;
  let choiceMove = 0;
  const ux = (name: string, properties: Record<string, unknown>): void => {
    try { callbacks.onUxEvent?.(name, { ...properties, learning: learning || tutorialActive }); } catch (error) { console.warn("[Grow an Empire] UX event failed", error); }
  };
  const reducedMotion = (): boolean => typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let lastFlownSummary = "";
  /** The move whose report the player has read (then the cards show). */
  let reportReadFor = -1;
  let lastPanelView: BuildPanelView | null = null;

  let milestoneUntil = 0;
  let campaignMoveLimit = TOTAL_MOVES;
  let selectedSpeed = 4;
  let gridVisible = false;
  let tutorialActive = false;
  let tutorialStartedAt = 0;
  let tutorialStepsSeen = 0;
  let chromeOpen = false;

  /**
   * The city is the default view. A choice opens one decision drawer; while
   * the simulation runs, the information bars and transport controls retreat
   * until the player explicitly asks to inspect them.
   */
  function syncPresentation(): void {
    const choiceOpen = !buildPanel.classList.contains("hidden");
    app.classList.toggle("ui-choice", choiceOpen);
    app.classList.toggle("ui-open", !choiceOpen && chromeOpen);
    app.classList.toggle("ui-idle", !choiceOpen && !chromeOpen);
    cityUiToggle.setAttribute("aria-expanded", String(chromeOpen));
    const chromeRetracted = choiceOpen || !chromeOpen;
    controls.inert = chromeRetracted;
    settlementBar.inert = chromeRetracted;
    statusBar.setAttribute("aria-hidden", String(chromeRetracted));
    settlementBar.setAttribute("aria-hidden", String(chromeRetracted));
    // Transforms do not trigger ResizeObserver, but the camera uses the
    // published panel bounds on compact screens.
    requestAnimationFrame(() => {
      publishLayout();
      window.dispatchEvent(new Event("gae:layout"));
    });
  }

  function setChromeOpen(open: boolean): void {
    chromeOpen = open;
    if (!open) {
      resourceLedger.classList.add("hidden");
      stockpileToggle.setAttribute("aria-expanded", "false");
      stockpileToggle.classList.remove("active");
      controls.classList.remove("expanded");
      controlsMore.setAttribute("aria-expanded", "false");
    }
    syncPresentation();
  }

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
    levelTrackLabel.innerHTML = `${icon("civic")}<b>${level}</b><span class="w"> · ${escapeHtml((CIVIC_LEVEL_NAMES[level] ?? "").toUpperCase())}</span>`;
    levelTrackLabel.title = `Level ${level}: ${CIVIC_LEVEL_NAMES[level] ?? ""}`;
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

  /** "+5 [wood] +3 [grain]": one icon and number per good. */
  function signedBag(bag: ResourceBag, sign: "+" | "−"): string {
    return RESOURCE_NAMES.filter((name) => (bag[name] ?? 0) > 0).map((name) => amount(name, bag[name] as number, { sign, className: sign === "+" ? "gain" : "loss" })).join("");
  }

  /** "2 grain spoiled" → "[grain]2 spoiled": amounts in sentences from the rules get their icon too. */
  function withIcons(html: string): string {
    return html.replace(/\b(\d+) (wood|stone|grain|livestock|cattle|fruit|mangoes|mango|planks?|rations?|wine|soma|gold)\b/gi, (_match, count: string, word: string) => {
      const lower = word.toLowerCase();
      const alias: Record<string, ResourceName> = { plank: "planks", ration: "rations", cattle: "livestock", mango: "fruit", mangoes: "fruit", soma: "wine" };
      const name = (alias[lower] ?? lower) as ResourceName;
      return amount(name, Number(count));
    });
  }

  /**
   * "Goods fly to the stockpile": what the city made last move rises from the
   * city and lands on its count in the strip, which pulses. Screen pixels, on
   * <body>, so the stage's scale transform doesn't distort the path. Skipped
   * with reduced motion.
   */
  function flyGoods(produced: ResourceBag): void {
    if (reducedMotion() || typeof Element.prototype.animate !== "function") return;
    const city = viewport.getBoundingClientRect();
    const scale = (window as { __gaeStageScale?: number }).__gaeStageScale ?? 1;
    const goods = RESOURCE_NAMES.filter((name) => (produced[name] ?? 0) > 0).slice(0, 6);
    goods.forEach((name, index) => {
      const target = stockStrip.querySelector<HTMLElement>(`.qty-${name}`);
      if (!target) return;
      const to = target.getBoundingClientRect();
      if (to.width === 0) return;
      const ghost = document.createElement("div");
      ghost.className = "fly-good";
      ghost.setAttribute("aria-hidden", "true");
      ghost.innerHTML = amount(name, produced[name] as number, { sign: "+" });
      ghost.style.transform = `scale(${scale})`;
      document.body.appendChild(ghost);
      const startX = city.left + city.width * (0.42 + 0.04 * index), startY = city.top + city.height * 0.42;
      const endX = to.left + to.width / 2 - 14, endY = to.top + to.height / 2 - 12;
      const flight = ghost.animate([
        { transform: `translate(${startX}px, ${startY}px) scale(${scale * 0.6})`, opacity: 0 },
        { transform: `translate(${startX}px, ${startY - 30}px) scale(${scale * 1.15})`, opacity: 1, offset: 0.25 },
        { transform: `translate(${endX}px, ${endY}px) scale(${scale * 0.8})`, opacity: 0.9 },
      ], { duration: 900, delay: 120 * index, easing: "cubic-bezier(.4,0,.2,1)", fill: "backwards" });
      const done = (): void => {
        ghost.remove();
        target.classList.remove("bump");
        void target.offsetWidth; // Restart the pulse.
        target.classList.add("bump");
      };
      flight.onfinish = done;
      flight.oncancel = () => ghost.remove();
    });
  }

  /** A building's painted picture at icon size (falls back to its name if the art fails). */
  function buildingThumb(buildingId: string): string {
    const name = escapeHtml(BUILDINGS[buildingId]?.name ?? buildingId);
    return `<img class="thumb" src="${assetUrl(buildingFilename(buildingId, "complete"))}" alt="${name}" title="${name}" />`;
  }

  /**
   * The "what happened last move" strip at the top of the build panel: one row
   * of icons (what was built, goods in and out, soldiers trained, rations
   * eaten), then at most two short warnings. Desktop adds the sentence form.
   */
  function renderSummary(summary: MoveSummary | null): void {
    if (!summary) { moveSummary.classList.add("hidden"); return; }
    const built = summary.buildingId ? buildingThumb(summary.buildingId) : `${icon("move")}<span class="tag">Gather</span>`;
    const trained = (["archers", "swordsmen", "horsemen"] as const).filter((type) => summary.trained[type] > 0)
      .map((type) => amount(type, summary.trained[type], { sign: "+", className: "gain" })).join("");
    const deserted = summary.deserted ? amount("people", summary.deserted, { sign: "−", className: "loss" }) : "";
    const idle = summary.stalled.length
      ? `<span class="idle" title="Idle: ${escapeHtml(summary.stalled.map((note) => `${BUILDINGS[note.buildingId]?.name ?? note.buildingId} (${note.reason})`).join("; "))}">${icon("idle")}${summary.stalled.map((note) => buildingThumb(note.buildingId)).join("")}</span>`
      : "";
    const row = [
      `<span class="summary-move">${summary.move}</span>`,
      built,
      summary.produced ? signedBag(summary.produced, "+") : "",
      summary.consumed ? signedBag(summary.consumed, "−") : "",
      trained,
      deserted,
      idle,
    ].filter(Boolean).join("");
    const label = [
      `Move ${summary.move}: ${summary.buildingId ? `built the ${BUILDINGS[summary.buildingId]?.name ?? summary.buildingId}` : "gathered"}`,
      summary.produced && Object.keys(summary.produced).length ? `made ${formatBag(summary.produced)}` : "",
      summary.consumed && Object.keys(summary.consumed).length ? `used ${formatBag(summary.consumed)}` : "",
      summary.upkeep ? `the army ate ${summary.upkeep} ration${summary.upkeep === 1 ? "" : "s"}` : "",
      summary.stalled.length ? `idle: ${summary.stalled.map((note) => `${BUILDINGS[note.buildingId]?.name ?? note.buildingId} (${note.reason})`).join("; ")}` : "",
    ].filter(Boolean).join(", ");
    const warnings = summary.warnings.map((text) => `<p class="summary-warning">${icon("warning")}<span>${withIcons(escapeHtml(text))}</span></p>`).join("");
    const reopen = summary.ledger ? `<button type="button" class="summary-reopen" aria-label="Show the move ${summary.move} report again" title="Move report">${icon("report")}</button>` : "";
    moveSummary.innerHTML = `<p class="summary-row" aria-label="${escapeHtml(label)}">${row}${reopen}</p><p class="summary-text w">${escapeHtml(label)}.</p>${warnings}`;
    moveSummary.querySelector(".summary-reopen")?.addEventListener("click", () => {
      if (!lastPanelView) return;
      reportReadFor = -1;
      renderBuildPanel(lastPanelView);
    });
    moveSummary.classList.remove("hidden");
  }

  /**
   * The stockpile above the cards: what the player has, as icons, so a card's
   * cost can be read against it without opening anything. Shows every good
   * the city holds plus any a card on offer asks for.
   */
  function renderStockStrip(view: BuildPanelView): void {
    const wanted = new Set<ResourceName>();
    for (const card of view.cards) for (const name of RESOURCE_NAMES) if ((BUILDINGS[card.id]?.cost[name] ?? 0) > 0) wanted.add(name);
    const shown = RESOURCE_NAMES.filter((name) => (view.resources[name] ?? 0) > 0 || wanted.has(name));
    stockStrip.innerHTML = `<span class="strip-label w">You have</span>${shown.map((name) => amount(name, Math.floor(view.resources[name] ?? 0), { className: wanted.has(name) ? "wanted" : undefined })).join("")}`;
    if (view.summary) {
      const key = `${view.move}:${view.summary.move}`;
      if (key !== lastFlownSummary) {
        lastFlownSummary = key;
        requestAnimationFrame(() => flyGoods(view.summary!.produced ?? {}));
      }
    }
    stockStrip.setAttribute("aria-label", `You have ${shown.map((name) => `${Math.floor(view.resources[name] ?? 0)} ${iconWord(name, view.resources[name] ?? 0)}`).join(", ")}`);
  }

  function costChips(cost: ResourceBag, resources: ResourceLedger): string {
    return RESOURCE_NAMES.filter((name) => (cost[name] ?? 0) > 0)
      .map((name) => amount(name, cost[name] as number, { className: `cost-chip${(resources[name] ?? 0) < (cost[name] ?? 0) ? " short" : ""}` })).join("");
  }

  /** A building's picture (or the army, or spoilage) for a report line. */
  function ledgerSource(source: string): { art: string; name: string } {
    if (source === "army") return { art: icon("strength"), name: "Army" };
    if (source === "spoilage") return { art: icon("warning"), name: "Spoiled" };
    const name = BUILDINGS[source]?.name ?? source;
    return { art: `<img src="${assetUrl(buildingFilename(source, "complete"))}" alt="" />`, name };
  }

  /**
   * The move report, shown before the next choice: every building's line
   * (what it took → what it made, soldiers trained, or why it stood idle),
   * the army's rations, spoilage, then each good from before to after. The
   * cards come after "Choose" (or a key 1–3 / Enter), so the player reads what
   * the last move did before ordering the next building.
   */
  function renderReport(view: BuildPanelView, summary: MoveSummary): void {
    const ledger = summary.ledger ?? [];
    const lines = ledger.map((entry) => {
      const { art, name } = ledgerSource(entry.source);
      const used = signedBag(entry.used, "−");
      const made = signedBag(entry.made, "+");
      const trained = (["archers", "swordsmen", "horsemen"] as const).filter((type) => (entry.trained?.[type] ?? 0) > 0)
        .map((type) => amount(type, entry.trained![type] as number, { sign: "+", className: "gain" })).join("");
      const deserted = entry.deserted ? amount("people", entry.deserted, { sign: "−", className: "loss" }) : "";
      const output = `${made}${trained}${deserted}`;
      const body = entry.idle
        ? `<span class="ledger-idle">${icon("idle")}<span class="w">${escapeHtml(entry.idle)}</span></span>`
        : `${used ? `<span class="ledger-used">${used}</span>` : ""}${used && output ? `<span class="ledger-arrow" aria-hidden="true">→</span>` : ""}<span class="ledger-made">${output}</span>`;
      const spoken = entry.idle ? `idle, ${entry.idle}` : [
        Object.keys(entry.used).length ? `used ${formatBag(entry.used)}` : "",
        Object.keys(entry.made).length ? `made ${formatBag(entry.made)}` : "",
        trained ? `trained ${(["archers", "swordsmen", "horsemen"] as const).filter((type) => (entry.trained?.[type] ?? 0) > 0).map((type) => `${entry.trained![type]} ${type}`).join(", ")}` : "",
        entry.deserted ? `${entry.deserted} deserted` : "",
      ].filter(Boolean).join("; ");
      return `<li class="ledger-line${entry.idle ? " idle" : ""}${entry.source === "army" || entry.source === "spoilage" ? " upkeep" : ""}" aria-label="${escapeHtml(`${name}: ${spoken}`)}" title="${escapeHtml(name)}"><span class="ledger-art" aria-hidden="true">${art}</span><span class="ledger-name w">${escapeHtml(name)}</span><span class="ledger-flow" aria-hidden="true">${body}</span></li>`;
    }).join("");
    const before = summary.before ?? {};
    const changed = RESOURCE_NAMES.filter((name) => Math.floor(before[name] ?? 0) !== Math.floor(view.resources[name] ?? 0));
    const net = changed.map((name) => {
      const from = Math.floor(before[name] ?? 0);
      const to = Math.floor(view.resources[name] ?? 0);
      const delta = to - from;
      return `<span class="net-good ${delta > 0 ? "gain" : "loss"}" aria-label="${iconWord(name, to)}: ${from} to ${to}">${icon(name)}<s>${from}</s><b>${to}</b><small>${delta > 0 ? "+" : "−"}${Math.abs(delta)}</small></span>`;
    }).join("");
    const built = summary.buildingId ? `<span class="report-built" title="${escapeHtml(BUILDINGS[summary.buildingId]?.name ?? "")}"><img src="${assetUrl(buildingFilename(summary.buildingId, "complete"))}" alt="" />${icon("build")}</span>` : `<span class="tag">Gather</span>`;
    const warnings = summary.warnings.map((text) => `<p class="summary-warning">${icon("warning")}<span>${withIcons(escapeHtml(text))}</span></p>`).join("");
    buildOptions.innerHTML = `<section class="move-report" aria-label="Move ${summary.move} report">
      <p class="report-head"><span class="summary-move" aria-label="Move ${summary.move}">${icon("move")}${summary.move}</span><span class="report-title">${icon("report")}<span class="w">Move report</span></span>${built}</p>
      ${lines ? `<ul class="ledger">${lines}</ul>` : `<p class="report-empty w">Nothing worked yet: build producers first.</p>`}
      ${net ? `<div class="report-net" aria-label="Stockpile after the move">${net}</div>` : ""}
      ${warnings}
    </section>`;
    buildFoot.replaceChildren();
    const next = document.createElement("button");
    next.type = "button";
    next.className = "report-continue";
    next.dataset.primary = "";
    next.innerHTML = `${icon("build")}<b>Choose</b><span class="w"> the next building (Enter)</span>`;
    next.setAttribute("aria-label", `Choose the building for move ${view.move}`);
    next.addEventListener("click", () => {
      callbacks.onUiSound?.();
      reportReadFor = summary.move;
      ux("ux_report_read", { move: summary.move, seconds: Math.round((performance.now() - choiceShownAt) / 100) / 10 });
      renderBuildPanel(view);
      (buildFoot.querySelector<HTMLButtonElement>(".gather-button") ?? buildOptions.querySelector<HTMLButtonElement>(".build-card.affordable, .build-card.swappable"))?.focus({ preventScroll: true });
    });
    buildFoot.appendChild(next);
    buildPanel.classList.add("reporting");
    buildPanel.classList.remove("hidden");
    buildPanel.scrollTop = 0;
    chromeOpen = false;
    syncPresentation();
    setStatus(`Move ${summary.move} report: read it, then choose`, 0);
  }

  /**
   * Rebuilds the choice cards for the current move and shows the panel.
   * Only acts while the simulation is awaiting a choice. Affordable cards call
   * `onSelectBuilding`; on a stuck move with a Bazaar, a card that a swap
   * can pay for calls `onSwapBuild`; otherwise it is disabled and says what it
   * lacks. When nothing can be built, a Gather button appears.
   */
  function renderBuildPanel(view: BuildPanelView): void {
    if (view.mode !== "awaiting-choice") return;
    lastPanelView = view;
    buildOptions.replaceChildren();
    buildPanel.removeAttribute("aria-busy");
    moveChip.innerHTML = `${icon("move")}${view.move}/${campaignMoveLimit}`;
    moveChip.setAttribute("aria-label", `Move ${view.move} of ${campaignMoveLimit}`);
    renderStockStrip(view);
    if (choiceMove !== view.move) {
      choiceMove = view.move;
      choiceShownAt = performance.now();
      choiceInfoOpens = 0;
      choiceBlockedTaps = 0;
    }
    // First the report of the move just played; the cards once it has been read.
    if (view.summary?.ledger && reportReadFor !== view.summary.move && !tutorialActive) {
      moveSummary.classList.add("hidden");
      renderReport(view, view.summary);
      return;
    }
    buildPanel.classList.remove("reporting");
    renderSummary(view.summary);
    view.cards.forEach((card, index) => {
      const building = BUILDINGS[card.id];
      if (!building) {
        console.warn(`[Grow an Empire] Skipping unknown building card "${card.id}"`);
        return;
      }
      const button = document.createElement("button");
      button.type = "button";
      const state = card.affordable ? "affordable" : card.swap ? "swappable" : "unaffordable";
      button.className = `build-card ${state}`;
      button.dataset.key = String(index + 1);
      const action = card.affordable ? `${icon("build")}<span class="w">BUILD</span>` : card.swap ? `${icon("market")}${icon("build")}<span class="w">SWAP</span>` : `<span class="w">NEEDS</span>`;
      const missing = state === "unaffordable" ? RESOURCE_NAMES.filter((name) => (card.missing[name] ?? 0) > 0).map((name) => amount(name, card.missing[name] as number, { className: "short" })).join("") : "";
      const swapLine = card.swap ? `<span class="build-swap">${icon("market")}${signedBag(card.swap.sell, "−")}<span class="arrow">→</span>${signedBag(card.swap.buy, "+")}${card.swap.change > 0 ? amount("gold", card.swap.change, { sign: "+", className: "gain" }) : ""}</span>` : "";
      button.setAttribute("aria-label", `${index + 1}: ${card.affordable ? "Build" : card.swap ? "Swap goods and build" : "Can't afford"} ${building.name}. Costs ${formatBag(building.cost)}. ${building.benefit}. ${building.unlocks}`);
      button.innerHTML = `<span class="build-key" aria-hidden="true">${index + 1}</span><span class="build-art"><img src="${assetUrl(buildingFilename(card.id, "complete"))}" alt="" /></span><span class="build-name">${building.name}</span><span class="build-costs">${costChips(building.cost, view.resources)}</span><span class="build-effect">${effectHtml(card.id)}</span><span class="build-benefit w">${building.benefit}</span>${swapLine}<span class="build-unlock w">${icon("unlock")}${building.unlocks}</span><span class="build-action">${action}${missing ? `<span class="build-missing">${missing}</span>` : ""}</span>`;
      if (state === "unaffordable") button.setAttribute("aria-disabled", "true");
      let longPressed = false;
      let pressTimer = 0;
      const cancelPress = (): void => { clearTimeout(pressTimer); pressTimer = 0; };
      // Long press (touch or pen) opens the card's details instead of choosing it.
      button.addEventListener("pointerdown", (event) => {
        if (event.pointerType === "mouse") return;
        longPressed = false;
        cancelPress();
        const startX = event.clientX, startY = event.clientY;
        const move = (moveEvent: PointerEvent): void => { if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) > 10) cancelPress(); };
        button.addEventListener("pointermove", move);
        button.addEventListener("pointerup", () => { cancelPress(); button.removeEventListener("pointermove", move); }, { once: true });
        button.addEventListener("pointercancel", () => { cancelPress(); button.removeEventListener("pointermove", move); }, { once: true });
        pressTimer = window.setTimeout(() => {
          longPressed = true;
          openInfo("long_press");
          navigator.vibrate?.(12);
        }, 450);
      });
      button.addEventListener("contextmenu", (event) => event.preventDefault());
      button.addEventListener("click", (event) => {
        if (longPressed) { longPressed = false; event.preventDefault(); return; }
        if (state === "unaffordable") {
          choiceBlockedTaps += 1;
          ux("ux_unaffordable_tap", { building_id: card.id, move: view.move });
          return;
        }
        if (view.move <= 3) {
          ux("ux_choice", { move: view.move, building_id: card.id, seconds: Math.round((performance.now() - choiceShownAt) / 100) / 10, info_opened: choiceInfoOpens, unaffordable_taps: choiceBlockedTaps, swap: state === "swappable" });
        }
        if (tutorialActive) {
          tutorialCoach.classList.add("hidden");
          buildPanel.classList.remove("tutorial-focus");
        }
        if (state === "affordable") callbacks.onSelectBuilding(card.id);
        else callbacks.onSwapBuild(card.id);
      });
      const slot = document.createElement("div");
      slot.className = "build-slot";
      const info = document.createElement("button");
      info.type = "button";
      info.className = "build-info";
      info.setAttribute("aria-label", `About the ${building.name}`);
      info.setAttribute("aria-expanded", "false");
      info.textContent = "i";
      function openInfo(via: "button" | "long_press"): void {
        slot.classList.add("show-info");
        info.setAttribute("aria-expanded", "true");
        choiceInfoOpens += 1;
        ux("ux_card_info", { building_id: card.id, move: view.move, via });
      }
      info.addEventListener("click", () => {
        if (slot.classList.contains("show-info")) {
          slot.classList.remove("show-info");
          info.setAttribute("aria-expanded", "false");
        } else openInfo("button");
      });
      slot.append(button, info);
      buildOptions.appendChild(slot);
    });
    buildFoot.replaceChildren();
    if (view.canGather) {
      const gather = document.createElement("button");
      gather.type = "button";
      gather.className = "gather-button";
      gather.innerHTML = `${icon("stockpile")}<b>Gather</b> <span class="w">Buildings work; spend 1 move. (G)</span>${icon("play")}`;
      gather.setAttribute("aria-label", "Gather resources: advance one move without building; existing buildings produce and the army still eats. Press G");
      gather.addEventListener("click", callbacks.onGather);
      buildFoot.appendChild(gather);
    } else {
      const hint = document.createElement("p");
      hint.className = "decision-hint w";
      hint.textContent = view.cards.some((card) => card.swap)
        ? "Swap spare goods at the Bazaar (twice the price)."
        : "Paid now. Built earlier, it works for more moves. Keys 1-3.";
      buildFoot.appendChild(hint);
    }
    buildPanel.classList.remove("hidden");
    chromeOpen = false;
    syncPresentation();
    const optionCount = buildOptions.childElementCount;
    if (optionCount === 0) {
      // The exhaustive offer test proves this can't happen with the current
      // catalog, but a future content change could starve the pool. Say so
      // instead of showing an empty panel with no way forward.
      setStatus(view.canGather ? `Move ${view.move}: gather resources to continue`
        : `Move ${view.move}: no buildings are available. Press Restart to begin a new settlement.`, 0);
      return;
    }
    const affordable = view.cards.filter((card) => card.affordable).length;
    setStatus(view.canGather ? `Move ${view.move}: gather resources${view.cards.some((card) => card.swap) ? " or swap at the Bazaar" : " to build next move"}`
      : affordable === 0 ? `Move ${view.move}: swap goods at the Bazaar to build`
      : `Move ${view.move} ready: choose one of ${affordable} affordable building${affordable === 1 ? "" : "s"}`, 0);
  }

  function hideBuildPanel(): void {
    buildPanel.classList.add("hidden");
    chromeOpen = false;
    syncPresentation();
  }

  /** Disables the choice cards while a selection is being prepared (prevents double-clicks). */
  function setBuildPanelBusy(busy: boolean): void {
    buildPanel.toggleAttribute("aria-busy", busy);
    buildOptions.querySelectorAll("button").forEach((button) => { button.disabled = busy; });
    buildFoot.querySelectorAll("button").forEach((button) => { button.disabled = busy; });
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
    milestoneCopy.removeAttribute("aria-label");
    milestone.classList.add("visible");
    milestoneUntil = animationElapsed + (final ? 6 : 3.5);
  }

  /** The "building finished" toast: its name and what it now makes, as icons. */
  function showBuiltMilestone(buildingId: string, animationElapsed: number): void {
    const building = BUILDINGS[buildingId];
    showMilestone(building?.name ?? buildingId, "", animationElapsed);
    milestoneKicker.innerHTML = `${icon("build")}<span class="w">BUILT</span>`;
    milestoneCopy.innerHTML = `<span class="milestone-effect">${effectHtml(buildingId)}</span>`;
    milestoneCopy.setAttribute("aria-label", building?.benefit ?? "");
  }

  function hideMilestone(): void {
    milestone.classList.remove("visible");
  }

  function setCampaign(campaign: CampaignDefinition, index: number): void {
    campaignMoveLimit = campaign.moveLimit;
    for (const node of document.querySelectorAll<HTMLElement>("[data-move-limit]")) node.textContent = String(campaign.moveLimit);
    [...levelPips.children].forEach((pip, pipIndex) => { (pip as HTMLElement).hidden = pipIndex > campaignMoveLimit; });
    campaignKicker.textContent = `CAMPAIGN ${index + 1} / 25`;
    campaignTitle.textContent = campaign.name;
    const army = campaign.objective.army;
    raidObjective.innerHTML = `${(["swordsmen", "archers", "horsemen"] as const).filter((kind) => army[kind] > 0).map((kind) => amount(kind, army[kind])).join("")}${amount("move", campaign.moveLimit)}`;
    raidObjective.setAttribute("aria-label", `${campaign.objective.enemyName}: ${campaign.objective.strength} ${campaign.objective.strength === 1 ? "soldier" : "soldiers"} after move ${campaign.moveLimit}`);
  }

  /** Shows or hides the "Battle report" button (shown once a battle has been fought). */
  function setReportAvailable(available: boolean): void {
    musterToggle.classList.toggle("hidden", !available);
  }

  function setMuted(muted: boolean): void {
    setButton(muteToggle, muted ? "mute" : "sound", muted ? "Sound · Off" : "Sound · On");
    muteToggle.setAttribute("aria-pressed", String(muted));
  }

  function setFullscreenAvailable(available: boolean): void {
    fullscreenToggle.classList.toggle("hidden", !available);
  }
  function setFullscreenLabel(active: boolean): void {
    setButton(fullscreenToggle, "fullscreen", active ? "Exit full screen" : "Full screen");
  }

  /** Called once per frame; hides the milestone toast once its timer expires. */
  function updateMilestoneVisibility(animationElapsed: number): void {
    if (milestone.classList.contains("visible") && animationElapsed >= milestoneUntil) hideMilestone();
  }

  function setPlayingLabel(playing: boolean): void {
    setButton(playToggle, playing ? "pause" : "play", playing ? "Pause" : "Play");
  }

  function setSpeedLabel(speed: number): void {
    selectedSpeed = speed;
    speedSlider.value = String(speeds.indexOf(speed));
    speedSlider.setAttribute("aria-valuetext", `${speed} times speed`);
    speedValue.value = `${speed}×`;
  }

  function setStockpileVisible(visible: boolean): void {
    resourceLedger.classList.toggle("hidden", !visible);
    stockpileToggle.setAttribute("aria-expanded", String(visible));
    stockpileToggle.classList.toggle("active", visible);
    if (visible) chromeOpen = true;
    syncPresentation();
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
    learning = false;
    syncWords();
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
    syncWords();
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
    tutorialCoachTitle.textContent = "Pick a building";
    tutorialCoachCopy.innerHTML = `Cost ${icon("wood")} is paid now. It makes ${icon("move")} every move after.`;
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
    tutorialCoachTitle.textContent = "Every move, the city works";
    tutorialCoachCopy.innerHTML = `Goods ${icon("wood")} become soldiers ${icon("archers")}. Soldiers eat ${icon("rations")}. Battle after move ${campaignMoveLimit}.`;
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
  // Restart throws the whole run away, and on a phone it sits next to the
  // other controls, so it asks once in place (the portal forbids confirm()):
  // the first press arms it for 4 s, the second restarts.
  let restartArmed = 0;
  const disarmRestart = (): void => {
    clearTimeout(restartArmed);
    restartArmed = 0;
    setButton(restartButton, "restart", "Restart");
    restartButton.classList.remove("armed");
  };
  restartButton.addEventListener("click", (event) => {
    if (!restartArmed) {
      event.stopPropagation(); // Keep the More menu open for the second press.
      setButton(restartButton, "restart", "Restart? Press again", "Again?");
      restartButton.classList.add("armed");
      restartArmed = window.setTimeout(disarmRestart, 4000);
      return;
    }
    disarmRestart();
    callbacks.onRestart();
  });
  speedSlider.addEventListener("input", () => callbacks.onSpeedChange(speeds[Number(speedSlider.value)]));
  gridToggle.addEventListener("click", () => {
    gridVisible = !gridVisible;
    setButton(gridToggle, "grid", `Grid · ${gridVisible ? "On" : "Off"}`);
    gridToggle.setAttribute("aria-pressed", String(gridVisible));
    callbacks.onGridToggle(gridVisible);
  });
  stockpileToggle.addEventListener("click", () => setStockpileVisible(resourceLedger.classList.contains("hidden")));
  stockpileClose.addEventListener("click", () => setStockpileVisible(false));
  cityUiToggle.addEventListener("click", () => {
    setChromeOpen(true);
    playToggle.focus();
  });
  cityViewToggle.addEventListener("click", () => {
    setChromeOpen(false);
    cityUiToggle.focus();
  });
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
    focusFirst(helpToggle, buildPanel.querySelector<HTMLElement>("button:not([disabled])"), cityUiToggle);
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
      focusFirst(helpToggle, buildPanel.querySelector<HTMLElement>("button:not([disabled])"), cityUiToggle);
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
    if (hadFocus) focusFirst(helpToggle, buildPanel.querySelector<HTMLElement>("button:not([disabled])"), cityUiToggle);
  });
  musterToggle.addEventListener("click", callbacks.onReportToggle);

  // "More": on phones and small frames the secondary controls fold into a
  // menu above the control row (styles.css). In the fixed layout the button
  // is hidden and every control sits in the row.
  function setMoreOpen(open: boolean): void {
    controls.classList.toggle("expanded", open);
    controlsMore.setAttribute("aria-expanded", String(open));
    if (open) chromeOpen = true;
    syncPresentation();
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
    if (["1", "2", "3", "enter"].includes(key) && buildPanel.classList.contains("reporting") && !buildPanel.classList.contains("hidden")) {
      event.preventDefault();
      buildFoot.querySelector<HTMLButtonElement>(".report-continue")?.click();
    } else if (["1", "2", "3"].includes(key) && !buildPanel.classList.contains("hidden")) {
      const card = buildOptions.querySelector<HTMLButtonElement>(`button[data-key="${key}"]`);
      if (card && !card.disabled) { event.preventDefault(); card.click(); }
    } else if (key === "g" && !buildPanel.classList.contains("hidden")) {
      buildFoot.querySelector<HTMLButtonElement>(".gather-button")?.click();
    } else if (key === " " || key === "p") {
      if (key === " " && target?.tagName === "BUTTON") return; // Space on a focused button presses it.
      event.preventDefault();
      playToggle.click();
    } else if (key === "s") {
      callbacks.onSpeedChange(speeds[(speeds.indexOf(selectedSpeed) + 1) % speeds.length]);
    } else if (key === "m") {
      muteToggle.click();
    } else if (key === "f" && !fullscreenToggle.classList.contains("hidden")) {
      fullscreenToggle.click();
    }
  });

  syncPresentation();

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
    showBuiltMilestone,
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
    setLearning,
    handleTutorialEvent,
  };
}

export type Hud = ReturnType<typeof createHud>;
