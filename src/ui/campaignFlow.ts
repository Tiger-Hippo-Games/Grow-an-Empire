import { enemyStrength, playerStrength, resolveBattle, type EnemyArmy, type PlayerArmy, type StarMargins } from "../game/battle";
import { CAMPAIGNS, type CampaignDefinition } from "../game/campaigns";
import { SELLSWORD_COST } from "../game/economy";
import type { ArmyReport, SellswordHire } from "../game/settlementSimulation";
import { iconStyle, playBattle, type IconKind } from "../render/combatScene";
import { trapTab } from "./dom";

/**
 * The campaign's story screens, all modal dialogs over the city:
 *   1. the enemy briefing when a campaign starts;
 *   2. the muster when the last move ends: the enemy at the gates, both
 *      armies, and (with a Marketplace) the sellsword market;
 *   3. the battle strip; then
 *   4. the result, with stars and what would have done better.
 * main.ts decides when each appears; this module only draws and reports clicks.
 */

const escapeHtml = (text: string): string => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

function starText(stars: number): string {
  return `${"★".repeat(stars)}${"☆".repeat(3 - stars)}`;
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/** "won by 18%", or "more than three times their strength" for a rout. */
function winText(margin: number): string {
  return margin >= 2 ? "more than three times their strength" : `won by ${percent(margin)}`;
}

function armyChips(army: { archers: number; swordsmen: number; horsemen: number; militia?: number }, enemy: boolean): string {
  const kinds: IconKind[] = ["swordsmen", "archers", "horsemen", "militia"];
  const labels: Record<IconKind, [string, string]> = { swordsmen: ["Swordsman", "Swordsmen"], archers: ["Archer", "Archers"], horsemen: ["Horseman", "Horsemen"], militia: ["Militia", "Militia"] };
  return kinds.filter((kind) => (army[kind] ?? 0) > 0)
    .map((kind) => `<span class="army-chip"><i class="unit-icon unit-${kind}${enemy ? " enemy" : ""}" style='${iconStyle(kind, enemy)}'></i><b>${army[kind]}</b> ${labels[kind][army[kind] === 1 ? 0 : 1]}</span>`)
    .join("") || `<span class="army-chip empty">No soldiers</span>`;
}

export interface MusterView {
  campaign: CampaignDefinition;
  trained: { archers: number; swordsmen: number; horsemen: number };
  militia: number;
  hasMarketplace: boolean;
  gold: number;
  cap: number;
  bestHire: SellswordHire;
}

export interface ResultView {
  campaign: CampaignDefinition;
  report: ArmyReport;
  buildOrder: string[];
  bestStars: number;
  nextUnlocked: boolean;
  newRecord: boolean;
}

export interface FlowCallbacks {
  onFight(hire: SellswordHire): void;
  onMap(): void;
  onReplay(): void;
  onNext(): void;
  onViewCity(): void;
  onSound(name: "click" | "hit" | "victory" | "defeat" | "coins"): void;
  onModalChange(open: boolean): void;
}

export function createCampaignFlow(root: HTMLElement, callbacks: FlowCallbacks) {
  const scrim = document.createElement("div");
  scrim.className = "flow-scrim hidden";
  const dialog = document.createElement("section");
  dialog.className = "flow-dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  scrim.appendChild(dialog);
  root.appendChild(scrim);
  let stopBattle: (() => void) | null = null;
  let open = false;
  let lastResult: ResultView | null = null;
  // Modal: Tab and Shift+Tab stay inside the open dialog.
  document.addEventListener("keydown", (event) => { if (open) trapTab(event, dialog); });

  function show(kind: string, html: string): void {
    stopBattle?.();
    stopBattle = null;
    dialog.dataset.kind = kind;
    dialog.innerHTML = html;
    scrim.classList.remove("hidden");
    if (!open) { open = true; callbacks.onModalChange(true); }
    dialog.querySelector<HTMLButtonElement>("[data-primary]")?.focus();
  }

  function hide(): void {
    stopBattle?.();
    stopBattle = null;
    scrim.classList.add("hidden");
    if (open) { open = false; callbacks.onModalChange(false); }
  }

  function starRules(stars: StarMargins): string {
    return `<ul class="star-rules"><li><b>★</b> Win</li><li><b>★★</b> Win by ${percent(stars.two)}</li><li><b>★★★</b> Win by ${percent(stars.three)}</li></ul>`;
  }

  /** 1. The enemy briefing at the start of a campaign. */
  function showBriefing(campaign: CampaignDefinition, onBegin: () => void): void {
    const { objective } = campaign;
    const veteran = objective.army.veterancy > 1 ? `<p class="flow-note">Veterans: every enemy fights ${percent(objective.army.veterancy - 1)} harder.</p>` : "";
    show("briefing", `
      <p class="flow-kicker">CAMPAIGN ${campaign.number} OF ${CAMPAIGNS.length} · ENEMY SIGHTED</p>
      <h2>${escapeHtml(objective.enemyName)}</h2>
      <p class="flow-sub">from ${escapeHtml(objective.kingdomName)}</p>
      <p class="flow-lead">${escapeHtml(objective.briefing)}</p>
      <div class="army-chips">${armyChips(objective.army, true)}</div>
      ${veteran}
      <p class="flow-hint">${escapeHtml(objective.counterHint)}</p>
      <p class="flow-note">They reach the city after Move ${campaign.moveLimit}. Every building you raise before then shapes the army that meets them.</p>
      ${starRules(campaign.stars)}
      <div class="flow-actions"><button type="button" data-primary data-action="begin">Prepare the defence</button><button type="button" class="quiet" data-action="map">Campaign map</button></div>`);
    dialog.querySelector("[data-action=begin]")!.addEventListener("click", () => { callbacks.onSound("click"); hide(); onBegin(); });
    dialog.querySelector("[data-action=map]")!.addEventListener("click", () => { hide(); callbacks.onMap(); });
  }

  /** 2. The muster: the enemy has arrived. With a Marketplace, sellswords can be hired. */
  function showMuster(view: MusterView): void {
    const { campaign } = view;
    const enemy: EnemyArmy = campaign.objective.army;
    let hire: SellswordHire = { archers: 0, swordsmen: 0 };
    const market = view.hasMarketplace && view.cap === 0
      ? `<p class="flow-note market-missing">Their band is too small for the Marketplace to hire sellswords against.</p>`
      : view.hasMarketplace
      ? `<div class="market">
          <div class="market-heading"><strong>Marketplace: hire sellswords</strong><span>${SELLSWORD_COST} gold each · at most ${view.cap} (half their army)</span></div>
          <p class="flow-note">Selling the whole stockpile raises <b data-gold>${view.gold}</b> gold.</p>
          <div class="market-rows">
            ${(["archers", "swordsmen"] as const).map((kind) => `<div class="market-row"><i class="unit-icon unit-${kind}" style='${iconStyle(kind, false)}'></i><span>${kind === "archers" ? "Archers" : "Swordsmen"}</span>
              <button type="button" data-step="${kind}:-1" aria-label="One fewer ${kind}">−</button><b data-count="${kind}">0</b><button type="button" data-step="${kind}:1" aria-label="One more ${kind}">+</button></div>`).join("")}
          </div>
          <div class="market-foot"><span data-spend>Spend 0 gold</span><button type="button" class="quiet" data-action="best">Best mix</button></div>
        </div>`
      : `<p class="flow-note market-missing">No Marketplace: no sellswords can be hired. Next time, a Marketplace turns spare goods into soldiers here.</p>`;
    show("muster", `
      <p class="flow-kicker">MOVE ${campaign.moveLimit} COMPLETE · THE ENEMY IS AT THE GATES</p>
      <h2>${escapeHtml(campaign.objective.enemyName)} attack</h2>
      <div class="muster-armies">
        <div><span class="side-label">Your army</span><div class="army-chips" data-ours></div></div>
        <div><span class="side-label">${escapeHtml(campaign.objective.kingdomName)}</span><div class="army-chips">${armyChips(enemy, true)}</div></div>
      </div>
      <div class="forecast"><div class="forecast-bar"><i data-bar></i></div><p data-forecast></p></div>
      ${market}
      <div class="flow-actions"><button type="button" data-primary data-action="fight">Fight</button></div>`);
    const ours = dialog.querySelector<HTMLElement>("[data-ours]")!;
    const forecast = dialog.querySelector<HTMLElement>("[data-forecast]")!;
    const bar = dialog.querySelector<HTMLElement>("[data-bar]")!;
    const budget = Math.min(view.cap, Math.floor(view.gold / SELLSWORD_COST));
    function refresh(): void {
      const army: PlayerArmy = {
        archers: view.trained.archers + hire.archers, swordsmen: view.trained.swordsmen + hire.swordsmen,
        horsemen: view.trained.horsemen, militia: view.militia,
      };
      ours.innerHTML = armyChips(army, false);
      const mine = playerStrength(army, enemy);
      const theirs = enemyStrength(enemy, army);
      const outcome = resolveBattle(army, enemy, campaign.stars);
      bar.style.width = `${Math.round((mine / Math.max(1e-9, mine + theirs)) * 100)}%`;
      forecast.innerHTML = `Strength <b>${mine.toFixed(1)}</b> against <b>${theirs.toFixed(1)}</b> · ${outcome.win
        ? `<span class="good">Forecast: victory, ${winText(outcome.margin)} ${starText(outcome.stars)}</span>`
        : `<span class="bad">Forecast: defeat</span>`}`;
      for (const kind of ["archers", "swordsmen"] as const) {
        const count = dialog.querySelector(`[data-count=${kind}]`);
        if (count) count.textContent = String(hire[kind]);
      }
      const spend = dialog.querySelector("[data-spend]");
      if (spend) spend.textContent = `Spend ${(hire.archers + hire.swordsmen) * SELLSWORD_COST} of ${view.gold} gold · ${budget - hire.archers - hire.swordsmen} more can be hired`;
    }
    dialog.querySelectorAll<HTMLButtonElement>("[data-step]").forEach((button) => button.addEventListener("click", () => {
      const [kind, delta] = button.dataset.step!.split(":") as ["archers" | "swordsmen", string];
      const next = { ...hire, [kind]: Math.max(0, hire[kind] + Number(delta)) };
      if (next.archers + next.swordsmen > budget) return;
      hire = next;
      callbacks.onSound("coins");
      refresh();
    }));
    dialog.querySelector("[data-action=best]")?.addEventListener("click", () => { hire = { ...view.bestHire }; callbacks.onSound("coins"); refresh(); });
    dialog.querySelector("[data-action=fight]")!.addEventListener("click", () => callbacks.onFight(hire));
    refresh();
  }

  /** 3. The battle strip, then the result. */
  function showBattle(result: ResultView): void {
    const { report, campaign } = result;
    lastResult = result;
    show("battle", `
      <p class="flow-kicker">CAMPAIGN ${campaign.number} · THE BATTLE</p>
      <h2>The armies meet</h2>
      <div class="battle-strip" data-strip></div>
      <div class="flow-actions"><button type="button" class="quiet" data-primary data-action="skip">Skip</button></div>`);
    const strip = dialog.querySelector<HTMLElement>("[data-strip]")!;
    const finish = (): void => showResult(result);
    stopBattle = playBattle(strip,
      { title: "Your army", start: { archers: report.units.archers, swordsmen: report.units.swordsmen, horsemen: report.units.horsemen, militia: report.units.militia } },
      { title: campaign.objective.enemyName, start: { archers: report.enemy.archers, swordsmen: report.enemy.swordsmen, horsemen: report.enemy.horsemen, militia: 0 } },
      report.rounds,
      { onRound: () => callbacks.onSound("hit"), onDone: finish });
    dialog.querySelector("[data-action=skip]")!.addEventListener("click", finish);
  }

  /** 4. The result popup. */
  function showResult(result: ResultView, quiet = false): void {
    lastResult = result;
    const { report, campaign } = result;
    if (!quiet) callbacks.onSound(report.win ? "victory" : "defeat");
    const next = CAMPAIGNS[campaign.number];
    const nextButton = report.win && next && result.nextUnlocked
      ? `<button type="button" data-primary data-action="next">Next: ${escapeHtml(next.name)}</button>` : "";
    const lockedNote = report.win && next && !result.nextUnlocked
      ? `<p class="flow-note">More stars are needed to open ${escapeHtml(next.name)}: replay earlier campaigns to earn them.</p>` : "";
    show("result", `
      <p class="flow-kicker">CAMPAIGN ${campaign.number} · ${escapeHtml(campaign.name.toUpperCase())}</p>
      <h2 class="${report.win ? "good" : "bad"}">${report.win ? "Victory" : "The city has fallen"}</h2>
      <p class="result-stars" aria-label="${report.stars} of 3 stars">${starText(report.stars)}</p>
      ${result.newRecord && report.stars > 0 ? `<p class="flow-note good">New best for this campaign.</p>` : result.bestStars > report.stars ? `<p class="flow-note">Your best here: ${starText(result.bestStars)}</p>` : ""}
      <p class="flow-lead">Your strength <b>${report.playerStrength.toFixed(1)}</b> against <b>${report.enemyStrength.toFixed(1)}</b>${report.win ? ` · ${winText(report.margin)}` : ""}.</p>
      ${report.gap ? `<p class="flow-hint">${escapeHtml(report.gap)}</p>` : ""}
      <ul class="result-notes">${report.explanations.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>
      <p class="result-order"><span>Build order</span> ${result.buildOrder.map(escapeHtml).join(" → ")}</p>
      ${lockedNote}
      <div class="flow-actions">${nextButton}<button type="button" ${nextButton ? "class=\"quiet\"" : "data-primary"} data-action="replay">${report.win ? "Replay for more stars" : "Try again"}</button><button type="button" class="quiet" data-action="map">Campaign map</button><button type="button" class="quiet" data-action="city">View the city</button></div>`);
    dialog.querySelector("[data-action=next]")?.addEventListener("click", () => { hide(); callbacks.onNext(); });
    dialog.querySelector("[data-action=replay]")!.addEventListener("click", () => { hide(); callbacks.onReplay(); });
    dialog.querySelector("[data-action=map]")!.addEventListener("click", () => { hide(); callbacks.onMap(); });
    dialog.querySelector("[data-action=city]")!.addEventListener("click", () => { hide(); callbacks.onViewCity(); });
  }

  // Esc closes the result (to view the city); the other screens need a choice.
  document.addEventListener("keydown", (event) => {
    if (!open || event.key !== "Escape") return;
    if (dialog.dataset.kind === "result") { event.preventDefault(); hide(); callbacks.onViewCity(); }
    if (dialog.dataset.kind === "battle" && lastResult) { event.preventDefault(); showResult(lastResult); }
  });

  return {
    showBriefing,
    showMuster,
    showBattle,
    showResult,
    /** Reopens the last result (the "Battle report" button). */
    reopenResult(): boolean { if (!lastResult) return false; showResult(lastResult, true); return true; },
    hide,
    clearResult(): void { lastResult = null; },
    get isOpen() { return open; },
  };
}

export type CampaignFlow = ReturnType<typeof createCampaignFlow>;
