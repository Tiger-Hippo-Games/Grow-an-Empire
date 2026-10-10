import { enemyStrength, playerStrength, resolveBattle, type ArmyCounts, type EnemyArmy, type PlayerArmy, type StarMargins } from "../game/battle";
import { CAMPAIGNS, CHAPTERS, type CampaignDefinition } from "../game/campaigns";
import { SELLSWORD_COST } from "../game/economy";
import type { ArmyReport, SellswordHire } from "../game/settlementSimulation";
import { iconStyle, type IconKind } from "../render/combatScene";
import { playBattle } from "../render/popupBattle";
import { buildingFilename } from "../render/constructionView";
import { assetUrl } from "../render/assetCatalog";
import { BUILDINGS } from "../game/content";
import { escapeHtml, focusFirst, trapTab } from "./dom";
import { amount, icon } from "./icons";

/**
 * The campaign's story screens, all modal dialogs over the city:
 *   1. the enemy briefing when a campaign starts;
 *   2. the muster when the last move ends: the enemy at the gates, both
 *      armies, and (with a Bazaar) the sellsword market;
 *   3. the battle strip; then
 *   4. the result, with stars and what would have done better.
 * main.ts decides when each appears; this module only draws and reports clicks.
 */

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

/** The counter to this army as a picture: "[archer] > [swordsman]". */
function counterIcons(army: EnemyArmy): string {
  const beats = (winner: "archers" | "swordsmen" | "horsemen", loser: "archers" | "swordsmen" | "horsemen"): string =>
    `<span class="counter">${icon(winner)}<b aria-hidden="true">›</b>${icon(loser)}</span>`;
  if (army.archers === 0 && army.horsemen === 0) return beats("archers", "swordsmen");
  if (army.swordsmen === 0 && army.horsemen === 0) return beats("horsemen", "archers");
  if (army.swordsmen === 0 && army.archers === 0) return beats("swordsmen", "horsemen");
  return `<span class="counter">${icon("archers")}${icon("swordsmen")}${icon("horsemen")}<span class="tag">mix</span></span>`;
}

/** "[shield] 59 vs 1.8" */
function strengthLine(mine: number, theirs: number): string {
  return `<span class="strength-line">${icon("strength")}<b>${mine.toFixed(1)}</b><span class="vs">vs</span><b>${theirs.toFixed(1)}</b></span>`;
}

/**
 * Text that phones fold away behind "Details" (the fixed 1280×720 layout
 * always shows it). `label` is the button's word.
 */
function extra(html: string, label = "Details"): string {
  if (!html.trim()) return "";
  return `<button type="button" class="flow-more" data-action="more" aria-expanded="false" aria-label="${label}" title="${label}">${icon("more")}<span class="w">${label}</span></button><div class="flow-extra">${html}</div>`;
}

function armyChips(army: { archers: number; swordsmen: number; horsemen: number; militia?: number }, enemy: boolean): string {
  const kinds: IconKind[] = ["swordsmen", "archers", "horsemen", "militia"];
  const labels: Record<IconKind, [string, string]> = { swordsmen: ["Swordsman", "Swordsmen"], archers: ["Archer", "Archers"], horsemen: ["Horseman", "Horsemen"], militia: ["Militia", "Militia"] };
  return kinds.filter((kind) => (army[kind] ?? 0) > 0)
    .map((kind) => `<span class="army-chip" title="${labels[kind][army[kind] === 1 ? 0 : 1]}"><i class="unit-icon unit-${kind}${enemy ? " enemy" : ""}" style='${iconStyle(kind, enemy)}'></i><b>${army[kind]}</b><span class="ws"> ${labels[kind][army[kind] === 1 ? 0 : 1]}</span></span>`)
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
  /** Soldiers who left for lack of rations during the run. */
  deserted?: number;
}

export interface ResultView {
  campaign: CampaignDefinition;
  report: ArmyReport;
  /** Building names in build order. */
  buildOrder: string[];
  /** The same buildings as ids (for their pictures). */
  buildOrderIds: string[];
  /** Ask the one-time "easy to follow?" question (portal-user testing, Docs/PLAYTEST_PORTAL.md). */
  askClarity?: boolean;
  bestStars: number;
  nextUnlocked: boolean;
  newRecord: boolean;
  /** The realm standing after this battle (absent on an old result reopened from a save). */
  realm?: RealmView;
}

/** The player's place in the realm after a result (game/realm.ts). */
export interface RealmView {
  before: number;
  rank: number;
  of: number;
  overtaken: number;
  title: string;
  /** The most notable raja overtaken, and the one now just above. */
  notable: { name: string; title: string; colour: string } | null;
  nemesis: { name: string; title: string; colour: string; campaignsAhead: number } | null;
}

/** "Easy", "Medium" or "Hard" as a small coloured chip. */
export function tierChip(campaign: CampaignDefinition): string {
  const label = campaign.tier[0].toUpperCase() + campaign.tier.slice(1);
  return `<span class="tier-chip tier-${campaign.tier}"><span class="sr">Difficulty: </span>${label}</span>`;
}

const number = (value: number): string => value.toLocaleString("en-IN");

/** The rank line on the result: "[chakra] 812 → 655 / 1,009 · +157 [banner] · Samanta". */
function realmLine(realm: RealmView): string {
  const moved = realm.before !== realm.rank;
  return `<div class="realm-standing" role="group" aria-label="Realm rank ${realm.rank} of ${realm.of}${realm.overtaken ? `, ${realm.overtaken} rajas overtaken` : ""}">
    <span class="realm-rank">${icon("rank")}${moved ? `<s>${number(realm.before)}</s><b aria-hidden="true">→</b>` : ""}<b class="realm-now" data-from="${realm.before}" data-to="${realm.rank}">${number(realm.rank)}</b><small>/ ${number(realm.of)}</small></span>
    ${realm.overtaken ? `<span class="realm-overtaken">${icon("rival")}<b>+${number(realm.overtaken)}</b></span>` : ""}
    <span class="realm-title">${escapeHtml(realm.title)}</span>
  </div>`;
}

function realmDetails(realm: RealmView): string {
  const banner = (colour: string) => `<i class="banner-dot" style="--banner:${colour}"></i>`;
  const lines: string[] = [];
  if (realm.notable) lines.push(`<p class="flow-note">${banner(realm.notable.colour)} You overtook ${escapeHtml(realm.notable.title)} ${escapeHtml(realm.notable.name)}${realm.overtaken > 1 ? ` and ${number(realm.overtaken - 1)} more` : ""}.</p>`);
  if (realm.nemesis) lines.push(`<p class="flow-note">${banner(realm.nemesis.colour)} Next above you: ${escapeHtml(realm.nemesis.title)} ${escapeHtml(realm.nemesis.name)}${realm.nemesis.campaignsAhead > 0 ? `, ${realm.nemesis.campaignsAhead} ${realm.nemesis.campaignsAhead === 1 ? "campaign" : "campaigns"} ahead` : ""}.</p>`);
  else lines.push(`<p class="flow-note good">You lead all ${number(realm.of)} rajas of the realm.</p>`);
  lines.push(`<p class="flow-note quiet">The other rajas are AI rivals on the same road.</p>`);
  return lines.join("");
}

/** Rolls the rank number from its old value to its new one (skipped with reduced motion). */
function rollRank(root: HTMLElement): void {
  const node = root.querySelector<HTMLElement>(".realm-now");
  if (!node) return;
  const from = Number(node.dataset.from), to = Number(node.dataset.to);
  if (!(from > to) || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const start = performance.now(), duration = 900;
  const step = (now: number): void => {
    const t = Math.min(1, (now - start) / duration);
    node.textContent = number(Math.round(from + (to - from) * (1 - (1 - t) ** 3)));
    if (t < 1 && node.isConnected) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export interface FlowCallbacks {
  onFight(hire: SellswordHire): void;
  onMap(): void;
  onReplay(): void;
  onNext(): void;
  onViewCity(): void;
  onSound(name: "click" | "hit" | "victory" | "defeat" | "coins" | "conch"): void;
  onModalChange(open: boolean): void;
  /** Portal pause and graphics loss must not advance unseen battle rounds. */
  isPlaybackPaused?(): boolean;
  /** UX analytics (Docs/PLAYTEST_PORTAL.md): Details opened, the clarity vote. */
  onUxEvent?(name: string, properties: Record<string, unknown>): void;
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
  /** When the current screen appeared: a second click of a double click must not press the next screen's button. */
  let shownAt = 0;
  /** Where focus was before the first dialog opened, to give it back on close. */
  let returnFocus: HTMLElement | null = null;
  // Modal: Tab and Shift+Tab stay inside the open dialog.
  document.addEventListener("keydown", (event) => { if (open) trapTab(event, dialog); });
  // Each screen replaces the last in the same spot (Fight → Skip, Next → Prepare
  // the defence), so the second click of a double click (event.detail 2+) must
  // not press the new screen's button. Single clicks and keys always count.
  dialog.addEventListener("click", (event) => {
    if (event.detail < 2 || performance.now() - shownAt >= 600) return;
    if (!(event.target as HTMLElement).closest("button")) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  function show(kind: string, html: string): void {
    stopBattle?.();
    stopBattle = null;
    dialog.dataset.kind = kind;
    root.classList.toggle("fighting", kind === "battle");
    dialog.classList.remove("show-extra");
    dialog.innerHTML = html;
    dialog.scrollTop = 0;
    shownAt = performance.now();
    const heading = dialog.querySelector<HTMLElement>("h2");
    if (heading) {
      heading.id = "flow-title";
      heading.tabIndex = -1;
      dialog.setAttribute("aria-labelledby", "flow-title");
    } else dialog.removeAttribute("aria-labelledby");
    scrim.classList.remove("hidden");
    if (!open) {
      const active = document.activeElement;
      returnFocus = active instanceof HTMLElement && active !== document.body ? active : null;
      open = true;
      callbacks.onModalChange(true);
    }
    // The battle's only button is Skip: start on the heading, so a stray Enter doesn't skip the fight.
    if (kind === "battle") heading?.focus({ preventScroll: true });
    else dialog.querySelector<HTMLButtonElement>("[data-primary]")?.focus({ preventScroll: true });
    dialog.querySelector<HTMLButtonElement>("[data-action=more]")?.addEventListener("click", (event) => {
      const button = event.currentTarget as HTMLButtonElement;
      const showing = dialog.classList.toggle("show-extra");
      callbacks.onSound("click");
      if (showing) callbacks.onUxEvent?.("ux_details_opened", { dialog: kind });
      button.setAttribute("aria-expanded", String(showing));
      button.setAttribute("aria-label", showing ? "Less" : "Details");
    });
  }

  function hide(): void {
    stopBattle?.();
    stopBattle = null;
    scrim.classList.add("hidden");
    root.classList.remove("fighting");
    if (open) {
      open = false;
      callbacks.onModalChange(false);
      // Give focus back (to where it was, else the build panel or the controls), never to the page body.
      if (!document.activeElement || document.activeElement === document.body || dialog.contains(document.activeElement)) {
        focusFirst(returnFocus, "#build-panel:not(.hidden) button:not([disabled])", "#play-toggle", "#city-ui-toggle");
      }
      returnFocus = null;
    }
  }

  function starRules(stars: StarMargins): string {
    return `<ul class="star-rules" aria-label="One star for a win, two for winning by ${percent(stars.two)}, three for winning by ${percent(stars.three)}"><li><b>★</b><span class="w"> Win</span></li><li><b>★★</b> +${percent(stars.two)}</li><li><b>★★★</b> +${percent(stars.three)}</li></ul>`;
  }

  /** 1. The enemy briefing at the start of a campaign. */
  function showBriefing(campaign: CampaignDefinition, onBegin: () => void): void {
    const { objective } = campaign;
    const veteran = objective.army.veterancy > 1 ? `<p class="flow-note">${icon("warning")} Veterans: +${percent(objective.army.veterancy - 1)} strength</p>` : "";
    show("briefing", `
      <p class="flow-kicker">CAMPAIGN ${campaign.number} / ${CAMPAIGNS.length} ${tierChip(campaign)}</p>
      <h2>${escapeHtml(objective.enemyName)}</h2>
      <div class="army-chips">${armyChips(objective.army, true)}</div>
      ${veteran}
      <p class="flow-counter"><span class="tag w">Counter</span>${counterIcons(objective.army)}<span class="arrive" role="img" aria-label="Arrive after move ${campaign.moveLimit}">${icon("move")}<b>${campaign.moveLimit}</b><span class="w"> moves</span></span></p>
      ${starRules(campaign.stars)}
      ${extra(`<p class="flow-sub">${["I", "II", "III", "IV", "V"][campaign.chapter] ?? ""} · ${escapeHtml(CHAPTERS[campaign.chapter]?.name ?? "")}: ${escapeHtml(CHAPTERS[campaign.chapter]?.lore ?? "")}</p>
      <p class="flow-sub">from ${escapeHtml(objective.kingdomName)}</p>
      <p class="flow-lead">${escapeHtml(objective.briefing)}</p>
      <p class="flow-hint">${escapeHtml(objective.counterHint)}</p>
      <p class="flow-note">They reach the city after Move ${campaign.moveLimit}. Every building you raise before then shapes the army that meets them.</p>`)}
      <div class="flow-actions"><button type="button" data-primary data-action="begin">Prepare the defence</button><button type="button" class="quiet icon-button" data-action="map" aria-label="Campaign map" title="Campaign map">${icon("map")}<span class="w">Campaign map</span></button></div>`);
    dialog.querySelector("[data-action=begin]")!.addEventListener("click", () => { callbacks.onSound("click"); hide(); onBegin(); });
    dialog.querySelector("[data-action=map]")!.addEventListener("click", () => { hide(); callbacks.onMap(); });
  }

  /** 2. The muster: the enemy has arrived. With a Bazaar, sellswords can be hired. */
  function showMuster(view: MusterView): void {
    const { campaign } = view;
    const enemy: EnemyArmy = campaign.objective.army;
    let hire: SellswordHire = { archers: 0, swordsmen: 0 };
    const market = view.hasMarketplace && view.cap === 0
      ? `<p class="flow-note market-missing"><span aria-hidden="true">${icon("market")}${icon("lock")}</span><span class="ws"> Too few enemies to hire sellswords.</span></p>`
      : view.hasMarketplace
      ? `<div class="market">
          <div class="market-heading"><strong>${icon("market")} Sellswords</strong><span>${amount("gold", SELLSWORD_COST)} each · max ${view.cap}</span></div>
          <p class="flow-note"><span class="w">You can raise </span>${icon("stockpile")}<span class="arrow">→</span>${amount("gold", view.gold)}</p>
          <div class="market-rows">
            ${(["archers", "swordsmen"] as const).map((kind) => `<div class="market-row"><i class="unit-icon unit-${kind}" style='${iconStyle(kind, false)}'></i><span class="w">${kind === "archers" ? "Archers" : "Swordsmen"}</span>
              <button type="button" data-step="${kind}:-1" aria-label="One fewer ${kind}">−</button><b data-count="${kind}">0</b><button type="button" data-step="${kind}:1" aria-label="One more ${kind}">+</button></div>`).join("")}
          </div>
          <div class="market-foot"><span data-spend></span><button type="button" class="quiet" data-action="best">Best mix</button></div>
        </div>`
      : `<p class="flow-note market-missing"><span aria-hidden="true">${icon("market")}${icon("lock")}</span><span class="ws"> No Bazaar: no sellswords.</span></p>`;
    show("muster", `
      <p class="flow-kicker w">MOVE ${campaign.moveLimit} · THE ENEMY ARRIVES</p>
      <h2>${escapeHtml(campaign.objective.enemyName)} attack</h2>
      <div class="muster-armies">
        <div><span class="side-label">${icon("strength")}<span class="w">Your army</span></span><div class="army-chips" data-ours></div></div>
        <div><span class="side-label">${escapeHtml(campaign.objective.kingdomName)}</span><div class="army-chips">${armyChips(enemy, true)}</div></div>
      </div>
      ${view.deserted ? `<p class="flow-note deserted"><span aria-hidden="true">${icon("warning")}${amount("people", view.deserted, { sign: "−", className: "loss" })}${icon("rations")}</span><span class="ws"> ${view.deserted} soldiers deserted for lack of rations (an older save)</span></p>` : ""}
      <div class="forecast"><div class="forecast-bar"><i data-bar></i></div><p data-forecast aria-live="polite"></p></div>
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
      forecast.innerHTML = `<span aria-hidden="true">${strengthLine(mine, theirs)} ${outcome.win
        ? `<span class="good">Win ${starText(outcome.stars)}</span>`
        : `<span class="bad">Defeat</span>`}</span><span class="sr">Strength ${mine.toFixed(1)} against ${theirs.toFixed(1)}. Forecast: ${outcome.win ? `victory, ${winText(outcome.margin)}, ${outcome.stars} stars` : "defeat"}</span>`;
      for (const kind of ["archers", "swordsmen"] as const) {
        const count = dialog.querySelector(`[data-count=${kind}]`);
        if (count) count.textContent = String(hire[kind]);
      }
      // The steppers say when they can't go further.
      const left = budget - hire.archers - hire.swordsmen;
      dialog.querySelectorAll<HTMLButtonElement>("[data-step]").forEach((button) => {
        const [kind, delta] = button.dataset.step!.split(":") as ["archers" | "swordsmen", string];
        button.disabled = Number(delta) < 0 ? hire[kind] === 0 : left <= 0;
      });
      const spend = dialog.querySelector("[data-spend]");
      if (spend) spend.innerHTML = `${amount("gold", (hire.archers + hire.swordsmen) * SELLSWORD_COST, { sign: "−" })} <span class="tag">${budget - hire.archers - hire.swordsmen} more</span>`;
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

  /** 3. The muster popup becomes the battlefield, then shows the result. */
  function showBattle(result: ResultView): void {
    const { report, campaign } = result;
    lastResult = result;
    show("battle", `
      <p class="flow-kicker w">CAMPAIGN ${campaign.number} · THE BATTLE</p>
      <h2>${escapeHtml(campaign.objective.enemyName)} attack</h2>
      <div class="muster-armies battle-armies">
        <div><span class="side-label">${icon("strength")}<span class="w">Your army</span></span><div class="army-chips" data-ours>${armyChips(report.units, false)}</div></div>
        <div><span class="side-label">${escapeHtml(campaign.objective.kingdomName)}</span><div class="army-chips" data-enemy>${armyChips(report.enemy, true)}</div></div>
      </div>
      <div class="popup-balance" role="meter" aria-valuemin="0" aria-valuemax="100" data-balance><span></span></div>
      <div class="popup-battle" data-strip></div>
      <div class="flow-actions"><button type="button" class="quiet" data-primary data-action="skip" aria-label="Skip the battle">${icon("speed")}<span class="w">Skip</span></button></div>`);
    const strip = dialog.querySelector<HTMLElement>("[data-strip]")!;
    callbacks.onSound("conch");
    const finish = (): void => showResult(result);
    const updateArmies = (ours: PlayerArmy, theirs: ArmyCounts): void => {
      dialog.querySelector("[data-ours]")!.innerHTML = armyChips(ours, false);
      dialog.querySelector("[data-enemy]")!.innerHTML = armyChips(theirs, true);
      const mine = playerStrength(ours, theirs);
      const hostile = enemyStrength({ ...theirs, veterancy: campaign.objective.army.veterancy }, ours);
      const share = mine + hostile > 0 ? mine / (mine + hostile) : 0.5;
      const meter = dialog.querySelector<HTMLElement>("[data-balance]")!;
      meter.setAttribute("aria-valuenow", String(Math.round(share * 100)));
      meter.setAttribute("aria-label", `Your army strength ${mine.toFixed(1)}, enemy ${hostile.toFixed(1)}`);
      meter.querySelector<HTMLElement>("span")!.style.width = `${share * 100}%`;
    };
    updateArmies(report.units, report.enemy);
    stopBattle = playBattle(strip,
      { title: "Your army", start: { archers: report.units.archers, swordsmen: report.units.swordsmen, horsemen: report.units.horsemen, militia: report.units.militia } },
      { title: campaign.objective.enemyName, start: { archers: report.enemy.archers, swordsmen: report.enemy.swordsmen, horsemen: report.enemy.horsemen, militia: 0 } },
      report.rounds,
      { onRound: (_index, round) => { updateArmies(round.player, round.enemy); callbacks.onSound("hit"); }, onDone: finish, isPaused: callbacks.isPlaybackPaused });
    dialog.querySelector("[data-action=skip]")!.addEventListener("click", () => { callbacks.onSound("click"); finish(); });
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
      ? `<p class="flow-note">${icon("lock")} More ★ open ${escapeHtml(next.name)}: replay for stars.</p>` : "";
    show("result", `
      <p class="flow-kicker">CAMPAIGN ${campaign.number} · ${escapeHtml(campaign.name.toUpperCase())}</p>
      <h2 class="${report.win ? "good" : "bad"}">${report.win ? "Victory" : "The city has fallen"}</h2>
      <p class="result-stars" role="img" aria-label="${report.stars} of 3 stars">${starText(report.stars)}</p>
      ${result.newRecord && report.stars > 0 ? `<p class="flow-note good">New best!</p>` : result.bestStars > report.stars ? `<p class="flow-note">Best: ${starText(result.bestStars)}</p>` : ""}
      ${result.realm ? realmLine(result.realm) : ""}
      <p class="flow-lead"><span aria-hidden="true">${strengthLine(report.playerStrength, report.enemyStrength)}</span><span class="sr">Your strength ${report.playerStrength.toFixed(1)} against ${report.enemyStrength.toFixed(1)}</span></p>
      <div class="army-chips">${armyChips(report.units, false)}</div>
      ${report.gap ? `<p class="flow-hint">${escapeHtml(report.gap)}</p>` : ""}
      <p class="result-order"><span class="sr">Build order: ${escapeHtml(result.buildOrder.join(", "))}</span>${result.buildOrderIds.map((id) => `<img src="${assetUrl(buildingFilename(id, "complete"))}" alt="" title="${escapeHtml(BUILDINGS[id]?.name ?? id)}" />`).join("")}</p>
      ${extra(`${report.win ? `<p class="flow-note">${escapeHtml(winText(report.margin))}</p>` : ""}<ul class="result-notes">${report.explanations.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>
      <p class="result-order-text"><span>Build order</span> ${result.buildOrder.map(escapeHtml).join(" → ")}</p>${result.realm ? realmDetails(result.realm) : ""}`)}
      ${lockedNote}
      ${result.askClarity && !quiet ? `<div class="clarity" data-clarity><span>Easy to follow?</span><button type="button" data-vote="up" aria-label="Yes, easy to follow" title="Yes">${icon("thumbup")}</button><button type="button" data-vote="down" aria-label="No, hard to follow" title="No">${icon("thumbdown")}</button></div>` : ""}
      <div class="flow-actions">${nextButton}<button type="button" ${nextButton ? "class=\"quiet icon-button\"" : "data-primary"} data-action="replay" aria-label="${report.win ? "Replay for more stars" : "Try again"}" title="${report.win ? "Replay for more stars" : "Try again"}">${icon("restart")}<span class="${nextButton ? "w" : ""}">${report.win ? "Replay" : "Try again"}</span></button><button type="button" class="quiet icon-button" data-action="map" aria-label="Campaign map" title="Campaign map">${icon("map")}<span class="w">Campaign map</span></button><button type="button" class="quiet icon-button" data-action="city" aria-label="View the city" title="View the city">${icon("eye")}<span class="w">View the city</span></button></div>`);
    if (!quiet) rollRank(dialog);
    dialog.querySelectorAll<HTMLButtonElement>("[data-vote]").forEach((button) => button.addEventListener("click", () => {
      callbacks.onUxEvent?.("ux_clarity_vote", { vote: button.dataset.vote, campaign_number: campaign.number, won: report.win, stars: report.stars });
      const box = dialog.querySelector<HTMLElement>("[data-clarity]");
      if (box) box.innerHTML = `<span role="status">Thanks!</span>`;
      result.askClarity = false;
      // The pressed button is gone: keep focus in the dialog, on its main action.
      focusFirst(dialog.querySelector<HTMLElement>("[data-primary]"), dialog.querySelector<HTMLElement>(".flow-actions button"));
    }));
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
