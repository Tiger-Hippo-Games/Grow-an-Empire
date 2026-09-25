import { CAMPAIGNS, isCampaignUnlocked, starsToUnlock, totalStars, type CampaignDefinition } from "../game/campaigns";
import { assetUrl } from "../render/assetCatalog";
import { IMAGE_TIMEOUT_MS } from "../render/spriteAssets";
import { requireElement } from "./dom";

/**
 * Marker centers, as percentages of the 16:9 map master: a road that winds
 * from the villages in the south (campaign 1) up to the northern pass
 * (campaign 25), five stops per row. Keep them in one place so the hit
 * targets, the road and the highlight ring can't drift apart.
 */
const ROWS = [74, 60, 46, 33, 20];
const COLUMNS = [12, 31, 50, 69, 88];
export const PROVINCE_CENTERS: ReadonlyArray<{ x: number; y: number }> = CAMPAIGNS.map((_, index) => {
  const row = Math.floor(index / 5);
  const column = row % 2 === 0 ? index % 5 : 4 - (index % 5);
  return { x: COLUMNS[column], y: ROWS[row] };
});
const MAP_ART = "southern-pass-map-v5.png";

/** The illustrated route is UI only; main.ts owns campaign selection and saves. */
export function createCampaignMap(onLaunch: (campaign: CampaignDefinition) => void) {
  const map = requireElement<HTMLElement>("#campaign-map");
  const stops = requireElement<HTMLElement>("#campaign-stops");
  const scroller = requireElement<HTMLElement>("#campaign-scroller");
  const highlight = requireElement<HTMLElement>("#province-highlight");
  const stage = requireElement<HTMLElement>("#campaign-stage");
  const title = requireElement<HTMLElement>("#campaign-name");
  const copy = requireElement<HTMLElement>("#campaign-copy");
  const briefing = requireElement<HTMLElement>("#campaign-briefing");
  const state = requireElement<HTMLElement>("#campaign-state");
  const launch = requireElement<HTMLButtonElement>("#campaign-launch");
  // CSS backgrounds do not emit a usable DOM error. Probe the same bundled
  // image so a failed download has a logged, playable fallback instead of a
  // silent blank map. The browser cache prevents a second network transfer.
  try {
    const url = assetUrl(MAP_ART);
    const image = new Image();
    let settled = false;
    const fail = (cause: unknown): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      map.classList.add("map-art-failed");
      console.warn(`[Grow an Empire] Campaign map artwork failed to load: ${MAP_ART}`, cause);
    };
    const timeout = setTimeout(() => fail(new Error(`Timed out after ${IMAGE_TIMEOUT_MS / 1000} s`)), IMAGE_TIMEOUT_MS);
    image.onload = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      map.style.setProperty("--campaign-map-image", `url("${url}")`);
    };
    image.onerror = (event) => fail(event);
    image.src = url;
  } catch (error) {
    map.classList.add("map-art-failed");
    console.warn(`[Grow an Empire] Campaign map artwork is unavailable: ${MAP_ART}`, error);
  }

  let activeId = CAMPAIGNS[0].id;
  let stars: Record<string, number> = {};
  let selectedIndex = 0;
  let currentRunIsComplete = false;
  let currentMove = 1;

  function unlocked(index: number): boolean {
    return isCampaignUnlocked(index + 1, stars);
  }
  const won = (campaign: CampaignDefinition): boolean => (stars[campaign.id] ?? 0) > 0;

  /** The road between the markers, drawn once as an SVG polyline. */
  const road = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  road.setAttribute("class", "campaign-road");
  road.setAttribute("viewBox", "0 0 160 90");
  road.setAttribute("preserveAspectRatio", "none");
  road.setAttribute("aria-hidden", "true");
  const line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  line.setAttribute("points", PROVINCE_CENTERS.map((point) => `${point.x * 1.6},${point.y * 0.9}`).join(" "));
  road.appendChild(line);
  stops.before(road);

  function render(): void {
    stops.replaceChildren();
    highlight.style.left = `${PROVINCE_CENTERS[selectedIndex].x}%`;
    highlight.style.top = `${PROVINCE_CENTERS[selectedIndex].y}%`;
    CAMPAIGNS.forEach((campaign, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `campaign-stop${index === selectedIndex ? " selected" : ""}${won(campaign) ? " completed" : ""}${activeId === campaign.id && !currentRunIsComplete ? " current" : ""}`;
      button.style.left = `${PROVINCE_CENTERS[index].x}%`;
      button.style.top = `${PROVINCE_CENTERS[index].y}%`;
      button.classList.toggle("locked", !unlocked(index));
      const earned = stars[campaign.id] ?? 0;
      button.setAttribute("aria-label", `Campaign ${index + 1}, ${campaign.name}: ${won(campaign) ? `won, ${earned} of 3 stars` : unlocked(index) ? "open" : "locked"}`);
      const flag = document.createElement("span");
      flag.className = "stop-flag";
      flag.setAttribute("aria-hidden", "true");
      flag.textContent = String(index + 1);
      const name = document.createElement("span");
      name.className = "stop-stars";
      name.setAttribute("aria-hidden", "true");
      name.textContent = won(campaign) ? `${"★".repeat(earned)}${"☆".repeat(3 - earned)}` : "";
      button.append(flag, name);
      button.addEventListener("click", () => {
        selectedIndex = index;
        render();
        stops.querySelectorAll<HTMLButtonElement>("button")[index]?.focus({ preventScroll: true });
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
    revealSelected();
  }

  /**
   * On a narrow frame the board is wider than the screen and scrolls sideways
   * (styles.css, fluid layout): keep the selected marker in view. Sets
   * scrollLeft directly; scrollIntoView could also scroll the stage itself.
   */
  function revealSelected(): void {
    if (scroller.scrollWidth <= scroller.clientWidth + 1) return;
    const board = stops.parentElement;
    if (!board) return;
    const x = board.offsetLeft + (PROVINCE_CENTERS[selectedIndex].x / 100) * board.offsetWidth;
    const left = scroller.scrollLeft;
    if (x < left + 60 || x > left + scroller.clientWidth - 60) scroller.scrollLeft = x - scroller.clientWidth / 2;
  }
  window.addEventListener("resize", () => { if (!map.classList.contains("hidden")) revealSelected(); });

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
      render(); // After un-hiding, so the board has a size to scroll to.
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
