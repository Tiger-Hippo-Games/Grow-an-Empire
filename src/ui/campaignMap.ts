import { CAMPAIGNS, type CampaignDefinition } from "../game/campaigns";
import { assetUrl } from "../render/assetCatalog";
import { IMAGE_TIMEOUT_MS } from "../render/spriteAssets";
import { requireElement } from "./dom";

/**
 * Marker centers are percentages of the 16:9 map master. Keep these in one
 * place so the hit targets and selected-province ring cannot drift apart when
 * the illustration is revised. The four villages sit below the northern pass.
 */
const PROVINCE_CENTERS = [
  { x: 15, y: 67 }, { x: 38, y: 67 }, { x: 62, y: 67 }, { x: 85, y: 67 },
] as const;
const MAP_ART = "southern-pass-map-v5.png";

/** The illustrated route is UI only; main.ts owns campaign selection and saves. */
export function createCampaignMap(onLaunch: (campaign: CampaignDefinition) => void) {
  const map = requireElement<HTMLElement>("#campaign-map");
  const stops = requireElement<HTMLElement>("#campaign-stops");
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
  let completed = new Set<string>();
  let selectedIndex = 0;
  let currentRunIsComplete = false;
  let currentMove = 1;

  function unlocked(index: number): boolean {
    return index === 0 || completed.has(CAMPAIGNS[0].id);
  }

  function render(): void {
    stops.replaceChildren();
    highlight.style.left = `${PROVINCE_CENTERS[selectedIndex].x}%`;
    highlight.style.top = `${PROVINCE_CENTERS[selectedIndex].y + 1}%`;
    CAMPAIGNS.forEach((campaign, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `campaign-stop${index === selectedIndex ? " selected" : ""}${completed.has(campaign.id) ? " completed" : ""}`;
      button.style.left = `${PROVINCE_CENTERS[index].x}%`;
      button.style.top = `${PROVINCE_CENTERS[index].y}%`;
      button.disabled = !unlocked(index);
      button.setAttribute("aria-label", `${campaign.name}, ${completed.has(campaign.id) ? "secured" : unlocked(index) ? "available" : "threatening, defend the heartland first"}`);
      const flag = document.createElement("span");
      flag.className = "stop-flag";
      flag.setAttribute("aria-hidden", "true");
      flag.textContent = completed.has(campaign.id) ? "★" : unlocked(index) ? String(index + 1) : "⚔";
      const name = document.createElement("span");
      name.className = "stop-name";
      name.textContent = campaign.objective.kingdomName;
      button.append(flag, name);
      button.addEventListener("click", () => {
        selectedIndex = index;
        render();
        stops.querySelectorAll<HTMLButtonElement>("button")[index]?.focus();
      });
      stops.appendChild(button);
    });
    const campaign = CAMPAIGNS[selectedIndex];
    stage.textContent = `CAMPAIGN ${selectedIndex + 1} OF ${CAMPAIGNS.length}`;
    title.textContent = campaign.name;
    copy.textContent = campaign.subtitle;
    const isCurrent = activeId === campaign.id;
    const movesUntilAttack = isCurrent && !currentRunIsComplete ? Math.max(1, campaign.moveLimit - currentMove + 1) : campaign.moveLimit;
    briefing.textContent = `${campaign.objective.enemyName} from ${campaign.objective.kingdomName} will come up the southern road in ${movesUntilAttack} ${movesUntilAttack === 1 ? "move" : "moves"}.`;
    const progress = completed.has(campaign.id) ? "Province secured · replay available" : isCurrent && currentRunIsComplete ? "Defeat · try again" : isCurrent ? "Settlement in progress" : "Raiders gathering";
    state.textContent = `${campaign.objective.strength} enemy swordsmen · ${progress}`;
    launch.textContent = isCurrent && !currentRunIsComplete ? "Continue settlement" : completed.has(campaign.id) ? "Replay campaign" : "Begin campaign";
  }

  launch.addEventListener("click", () => {
    try {
      onLaunch(CAMPAIGNS[selectedIndex]);
    } catch (error) {
      console.error("[Grow an Empire] Could not start the selected campaign", error);
      state.textContent = "Could not start this campaign. Reload to retry.";
    }
  });

  return {
    show(activeCampaignId: string, completedIds: readonly string[], runComplete: boolean, move: number) {
      activeId = activeCampaignId;
      completed = new Set(completedIds);
      currentRunIsComplete = runComplete;
      currentMove = move;
      const activeIndex = Math.max(0, CAMPAIGNS.findIndex((campaign) => campaign.id === activeCampaignId));
      const next = CAMPAIGNS.findIndex((campaign, index) => unlocked(index) && !completed.has(campaign.id));
      selectedIndex = !runComplete ? activeIndex : next >= 0 ? next : activeIndex;
      render();
      map.classList.remove("hidden");
      launch.focus();
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
