import { CAMPAIGNS, isCampaignUnlocked, starsToUnlock, totalStars, type CampaignDefinition } from "../game/campaigns";
import { requireElement } from "./dom";

/** Route coordinates are shared by the road, stops and scroll centering. */
const STOP_STEP = 176;
const TOP_MARGIN = 390;
const BOTTOM_MARGIN = 390;
const X_PATTERN = [49, 56, 63, 57, 45, 37, 43, 53, 62, 58, 47, 38] as const;
export const PROVINCE_CENTERS: ReadonlyArray<{ x: number; y: number }> = CAMPAIGNS.map((_, index) => {
  return { x: X_PATTERN[index % X_PATTERN.length], y: TOP_MARGIN + index * STOP_STEP };
});
const BOARD_HEIGHT = TOP_MARGIN + (CAMPAIGNS.length - 1) * STOP_STEP + BOTTOM_MARGIN;
const REGIONS = ["Southern hamlets", "River country", "Woodland road", "Outer marches", "Far frontier"] as const;

/** The illustrated route is UI only; main.ts owns campaign selection and saves. */
export function createCampaignMap(onLaunch: (campaign: CampaignDefinition) => void) {
  const map = requireElement<HTMLElement>("#campaign-map");
  const board = requireElement<HTMLElement>("#campaign-board");
  const stops = requireElement<HTMLElement>("#campaign-stops");
  const scroller = requireElement<HTMLElement>("#campaign-scroller");
  const highlight = requireElement<HTMLElement>("#province-highlight");
  const stage = requireElement<HTMLElement>("#campaign-stage");
  const title = requireElement<HTMLElement>("#campaign-name");
  const copy = requireElement<HTMLElement>("#campaign-copy");
  const briefing = requireElement<HTMLElement>("#campaign-briefing");
  const state = requireElement<HTMLElement>("#campaign-state");
  const launch = requireElement<HTMLButtonElement>("#campaign-launch");
  board.style.height = `${BOARD_HEIGHT}px`;

  let activeId = CAMPAIGNS[0].id;
  let stars: Record<string, number> = {};
  let selectedIndex = 0;
  let currentRunIsComplete = false;
  let currentMove = 1;

  function unlocked(index: number): boolean {
    return isCampaignUnlocked(index + 1, stars);
  }
  const won = (campaign: CampaignDefinition): boolean => (stars[campaign.id] ?? 0) > 0;

  /** A continuous north-to-south road, long enough to frame the end stops. */
  const road = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  road.setAttribute("class", "campaign-road");
  road.setAttribute("viewBox", `0 0 1000 ${BOARD_HEIGHT}`);
  road.setAttribute("preserveAspectRatio", "none");
  road.setAttribute("aria-hidden", "true");
  const line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  line.setAttribute("points", `500,90 ${PROVINCE_CENTERS.map((point) => `${point.x * 10},${point.y}`).join(" ")} 500,${BOARD_HEIGHT - 90}`);
  road.appendChild(line);
  stops.before(road);

  const origin = document.createElement("div");
  origin.className = "campaign-origin";
  origin.innerHTML = '<span aria-hidden="true">⌂</span><strong>OUR VILLAGE</strong><small>The road south</small>';
  board.appendChild(origin);
  REGIONS.forEach((name, index) => {
    const marker = document.createElement("div");
    marker.className = "campaign-region";
    marker.style.top = `${TOP_MARGIN + index * 5 * STOP_STEP - 105}px`;
    marker.textContent = name;
    board.appendChild(marker);
  });

  /** Center the chosen stop in the visible map, without moving the page. */
  function centerSelected(smooth = false): void {
    const target = PROVINCE_CENTERS[selectedIndex].y - scroller.clientHeight / 2;
    scroller.scrollTo({ top: target, behavior: smooth && !window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "smooth" : "instant" });
  }

  function render(): void {
    stops.replaceChildren();
    highlight.style.left = `${PROVINCE_CENTERS[selectedIndex].x}%`;
    highlight.style.top = `${PROVINCE_CENTERS[selectedIndex].y}px`;
    CAMPAIGNS.forEach((campaign, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `campaign-stop${index === selectedIndex ? " selected" : ""}${won(campaign) ? " completed" : ""}${activeId === campaign.id && !currentRunIsComplete ? " current" : ""}`;
      button.style.left = `${PROVINCE_CENTERS[index].x}%`;
      button.style.top = `${PROVINCE_CENTERS[index].y}px`;
      button.classList.toggle("locked", !unlocked(index));
      const earned = stars[campaign.id] ?? 0;
      button.setAttribute("aria-label", `Campaign ${index + 1}, ${campaign.name}: ${won(campaign) ? `won, ${earned} of 3 stars` : unlocked(index) ? "open" : "locked"}`);
      const flag = document.createElement("span");
      flag.className = "stop-flag";
      flag.setAttribute("aria-hidden", "true");
      flag.textContent = String(index + 1);
      const details = document.createElement("span");
      details.className = "stop-details";
      const name = document.createElement("strong");
      name.className = "stop-title";
      name.textContent = campaign.name;
      const progressLabel = document.createElement("span");
      progressLabel.className = "stop-stars";
      progressLabel.textContent = earned ? `${"★".repeat(earned)}${"☆".repeat(3 - earned)}` : unlocked(index) ? "Ready to defend" : "Locked";
      details.append(name, progressLabel);
      button.append(flag, details);
      button.addEventListener("click", () => {
        selectedIndex = index;
        render();
        stops.querySelectorAll<HTMLButtonElement>("button")[index]?.focus({ preventScroll: true });
        centerSelected(true);
      });
      stops.appendChild(button);
    });
    const campaign = CAMPAIGNS[selectedIndex];
    stage.textContent = `CAMPAIGN ${selectedIndex + 1} OF ${CAMPAIGNS.length} · ${totalStars(stars)} ★`;
    title.textContent = campaign.name;
    copy.textContent = campaign.subtitle;
    // A run that hasn't built anything yet is offered as a fresh start.
    const isCurrent = activeId === campaign.id && currentMove > 1;
    const movesUntilAttack = isCurrent && !currentRunIsComplete ? Math.max(1, campaign.moveLimit - currentMove + 1) : campaign.moveLimit;
    briefing.textContent = `${campaign.objective.enemyName} from ${campaign.objective.kingdomName} arrive in ${movesUntilAttack} ${movesUntilAttack === 1 ? "move" : "moves"}. ${campaign.objective.briefing}`;
    const earned = stars[campaign.id] ?? 0;
    const open = unlocked(selectedIndex);
    let progress: string;
    if (!open) {
      const previous = CAMPAIGNS[selectedIndex - 1];
      const needed = starsToUnlock(selectedIndex + 1);
      progress = !won(previous) ? `Locked: win ${previous.name} first` : `Locked: needs ${needed} ★ in total (you have ${totalStars(stars)}). Replay earlier campaigns for more stars.`;
    } else {
      progress = won(campaign) ? `Best: ${"★".repeat(earned)}${"☆".repeat(3 - earned)} · replay for more stars` : isCurrent && currentRunIsComplete ? "Defeat · try again" : isCurrent ? "Settlement in progress" : "Open";
    }
    state.textContent = `${campaign.objective.strength} enemy ${campaign.objective.strength === 1 ? "soldier" : "soldiers"} · ${progress}`;
    launch.disabled = !open;
    launch.textContent = !open ? "Locked" : isCurrent && !currentRunIsComplete ? "Continue settlement" : won(campaign) ? "Replay campaign" : "Begin campaign";
  }

  window.addEventListener("resize", () => { if (!map.classList.contains("hidden")) centerSelected(); });

  launch.addEventListener("click", () => {
    if (!unlocked(selectedIndex)) return;
    try {
      onLaunch(CAMPAIGNS[selectedIndex]);
    } catch (error) {
      console.error("[Grow an Empire] Could not start the selected campaign", error);
      state.textContent = "Could not start this campaign. Reload to retry.";
    }
  });

  return {
    show(activeCampaignId: string, campaignStars: Readonly<Record<string, number>>, runComplete: boolean, move: number) {
      activeId = activeCampaignId;
      stars = { ...campaignStars };
      currentRunIsComplete = runComplete;
      currentMove = move;
      const activeIndex = Math.max(0, CAMPAIGNS.findIndex((campaign) => campaign.id === activeCampaignId));
      const next = CAMPAIGNS.findIndex((campaign, index) => unlocked(index) && !won(campaign));
      selectedIndex = !runComplete ? activeIndex : next >= 0 ? next : activeIndex;
      map.classList.remove("hidden");
      render();
      centerSelected();
      launch.focus({ preventScroll: true });
    },
    hide() {
      const hadFocus = map.contains(document.activeElement);
      map.classList.add("hidden");
      // The launch button becomes hidden here. Return keyboard focus to the
      // visible map toggle instead of leaving it on the document body.
      if (hadFocus) document.getElementById("map-toggle")?.focus();
    },
    get isOpen() { return !map.classList.contains("hidden"); },
  };
}
