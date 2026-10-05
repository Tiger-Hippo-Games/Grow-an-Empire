import { JANAPADAS, rankedRows, type PlayerStanding, type RankedRow, type RealmSource, type RealmState } from "../game/realm";
import { escapeHtml, trapTab } from "./dom";
import { icon } from "./icons";

/**
 * The Realm board (game/realm.ts): the top 5 rajas, the player's
 * neighbourhood (3 above, 3 below) and a filter by janapada. A modal over
 * the city or the map; opened from More → Realm or the rank chip on the map.
 * It reads standings only; nothing here changes the game.
 */
export interface RealmBoardInput {
  source: RealmSource;
  state: RealmState;
  player: PlayerStanding;
}

const number = (value: number): string => value.toLocaleString("en-IN");

function row(entry: RankedRow): string {
  const you = entry.kind === "player";
  return `<li class="realm-row${you ? " you" : ""}" aria-label="Rank ${entry.rank}: ${escapeHtml(entry.title)} ${escapeHtml(entry.name)}, campaign ${entry.level}, ${entry.stars} stars${entry.kind === "ai" ? ", AI" : ""}">
    <span class="realm-pos">${number(entry.rank)}</span>
    <i class="banner-dot" style="--banner:${entry.colour}" title="${escapeHtml(entry.emblem)}"></i>
    <span class="realm-who"><b>${escapeHtml(entry.name)}</b><small>${escapeHtml(entry.title)}</small></span>
    <span class="realm-level">${icon("civic")}${entry.level}</span>
    <span class="realm-stars">${icon("star")}${entry.stars}</span>
  </li>`;
}

export function createRealmBoard(root: HTMLElement, onModalChange: (open: boolean) => void) {
  const scrim = document.createElement("div");
  scrim.className = "realm-scrim hidden";
  const dialog = document.createElement("section");
  dialog.className = "realm-board flow-dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-label", "The realm");
  scrim.appendChild(dialog);
  root.appendChild(scrim);
  let open = false;
  let input: RealmBoardInput | null = null;
  let filter = "";
  let returnFocus: HTMLElement | null = null;

  function render(): void {
    if (!input) return;
    const all = rankedRows(input.source, input.state, input.player);
    const me = all.find((entry) => entry.kind === "player")!;
    const shown = filter ? rankedRows(input.source, input.state, input.player, filter) : all;
    const at = shown.indexOf(shown.find((entry) => entry.kind === "player")!);
    const top = shown.slice(0, 5);
    const near = shown.slice(Math.max(0, at - 3), at + 4).filter((entry) => !top.includes(entry));
    dialog.innerHTML = `
      <p class="flow-kicker">THE REALM · ${number(all.length)} <span class="w">RAJAS</span></p>
      <h2 class="realm-head">${icon("rank")}<b>${number(me.rank)}</b><small>/ ${number(all.length)}</small><span class="realm-title">${escapeHtml(me.title)}</span></h2>
      <label class="realm-filter"><span class="w">Janapada</span><select aria-label="Show rajas from one janapada"><option value="">All</option>${JANAPADAS.map((name) => `<option${name === filter ? " selected" : ""}>${name}</option>`).join("")}</select></label>
      <ol class="realm-list" aria-label="Top rajas">${top.map(row).join("")}</ol>
      ${near.length ? `<p class="realm-gap" aria-hidden="true">⋯</p><ol class="realm-list" aria-label="Around you">${near.map(row).join("")}</ol>` : ""}
      <p class="flow-note quiet w">The other rajas are AI rivals on the same road. Win campaigns and stars to climb.</p>
      <div class="flow-actions"><button type="button" data-primary data-action="close">${icon("close")}<span class="w">Close</span></button></div>`;
    dialog.querySelector<HTMLSelectElement>("select")!.addEventListener("change", (event) => {
      filter = (event.target as HTMLSelectElement).value;
      render();
      dialog.querySelector<HTMLSelectElement>("select")?.focus();
    });
    dialog.querySelector("[data-action=close]")!.addEventListener("click", hide);
  }

  function show(next: RealmBoardInput): void {
    input = next;
    returnFocus = document.activeElement as HTMLElement | null;
    render();
    scrim.classList.remove("hidden");
    if (!open) { open = true; onModalChange(true); }
    dialog.querySelector<HTMLButtonElement>("[data-primary]")?.focus({ preventScroll: true });
    dialog.scrollTop = 0;
  }

  function hide(): void {
    scrim.classList.add("hidden");
    if (open) { open = false; onModalChange(false); }
    returnFocus?.focus?.({ preventScroll: true });
  }

  document.addEventListener("keydown", (event) => {
    if (!open) return;
    trapTab(event, dialog);
    if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); hide(); }
  }, true);
  scrim.addEventListener("click", (event) => { if (event.target === scrim) hide(); });

  return { show, hide, get isOpen() { return open; } };
}

export type RealmBoard = ReturnType<typeof createRealmBoard>;
