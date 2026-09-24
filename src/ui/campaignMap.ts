import { CAMPAIGNS, type CampaignDefinition } from "../game/campaigns";
import { assetUrl } from "../render/assetCatalog";
import { requireElement } from "./dom";

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
  map.style.setProperty("--campaign-map-image", `url("${assetUrl("southern-pass-map-v5.png")}")`);

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
    highlight.style.left = `${[15, 38, 62, 85][selectedIndex]}%`;
    CAMPAIGNS.forEach((campaign, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `campaign-stop stop-${index + 1}${index === selectedIndex ? " selected" : ""}${completed.has(campaign.id) ? " completed" : ""}`;
      button.disabled = !unlocked(index);
      button.setAttribute("aria-label", `${campaign.name}, ${completed.has(campaign.id) ? "secured" : unlocked(index) ? "available" : "threatening, defend the heartland first"}`);
      button.innerHTML = `<span class="stop-flag" aria-hidden="true">${completed.has(campaign.id) ? "★" : unlocked(index) ? String(index + 1) : "⚔"}</span><span class="stop-name">${campaign.objective.kingdomName}</span>`;
      button.addEventListener("click", () => { selectedIndex = index; render(); });
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

  launch.addEventListener("click", () => onLaunch(CAMPAIGNS[selectedIndex]));

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
    hide() { map.classList.add("hidden"); },
    get isOpen() { return !map.classList.contains("hidden"); },
  };
}
