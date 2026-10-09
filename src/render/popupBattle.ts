import type { BattleRound } from "../game/battle";
import { iconStyle, type IconKind } from "./combatScene";
import { assetUrl } from "./assetCatalog";

const ORDER: IconKind[] = ["swordsmen", "horsemen", "archers", "militia"];
const MAX_ICONS = 6;
const APPROACH_MS = 1000;
const ROUND_MS = 1350;
type Counts = Record<IconKind, number>;
export interface BattleSide { title: string; start: Counts }

/** A bounded formation; exact head counts stay in the popup's army chips. */
function formation(side: BattleSide, enemy: boolean) {
  const element = document.createElement("section");
  element.className = `battle-formation${enemy ? " enemy" : ""}`;
  element.setAttribute("aria-label", side.title);
  const rows = new Map<IconKind, { icons: HTMLElement[]; more: HTMLElement; row: HTMLElement }>();
  for (const kind of ORDER) {
    const count = side.start[kind];
    if (!count) continue;
    const row = document.createElement("div");
    row.className = "battle-rank";
    row.style.setProperty("--rank", String(rows.size));
    row.setAttribute("aria-label", `${kind}: ${count}`);
    const icons: HTMLElement[] = [];
    for (let index = 0; index < Math.min(count, MAX_ICONS); index++) {
      const actor = document.createElement("span");
      actor.className = "battle-actor";
      actor.style.setProperty("--beat", `${index * -137}ms`);
      actor.setAttribute("aria-hidden", "true");
      const sprite = document.createElement("i");
      sprite.className = `unit-icon unit-${kind}${enemy ? " enemy" : ""}`;
      const art = iconStyle(kind, enemy);
      if (art) sprite.setAttribute("style", art);
      actor.appendChild(sprite);
      row.appendChild(actor);
      icons.push(actor);
    }
    const more = document.createElement("b");
    more.className = "unit-more";
    more.textContent = count > MAX_ICONS ? `+${count - MAX_ICONS}` : "";
    more.setAttribute("aria-hidden", "true");
    row.appendChild(more);
    element.appendChild(row);
    rows.set(kind, { icons, more, row });
  }
  return { element, start: side.start, rows };
}

/**
 * Presents the already-resolved battle in the muster popup without changing
 * game state. Hidden tabs pause playback; large armies use bounded sprites
 * while head counts and casualties remain exact.
 */
export function playBattle(container: HTMLElement, player: BattleSide, enemy: BattleSide, rounds: BattleRound[], callbacks: { onRound?(index: number, round: BattleRound): void; onDone(): void }): () => void {
  container.replaceChildren();
  const arena = document.createElement("div");
  arena.className = "popup-battlefield approaching";
  arena.style.backgroundImage = `linear-gradient(#12152a66, #30211666), url("${assetUrl("village-empty-terrain-16x9-v2.png")}")`;
  arena.setAttribute("aria-label", "The two armies approach and fight round by round");
  const sides = [formation(player, false), formation(enemy, true)];
  sides.forEach(side => arena.appendChild(side.element));
  const clash = document.createElement("span");
  clash.className = "battle-clash";
  clash.setAttribute("aria-hidden", "true");
  arena.appendChild(clash);
  const status = document.createElement("p");
  status.className = "battle-phase";
  status.setAttribute("role", "status");
  status.textContent = "The armies approach";
  container.append(arena, status);
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  arena.classList.toggle("reduced-motion", reduced);
  const approach = reduced ? 0 : APPROACH_MS;
  const step = reduced ? 120 : ROUND_MS;
  let frame = 0;
  let elapsed = 0;
  let previous = performance.now();
  let shown = 0;
  let stopped = false;

  function stop(): void { stopped = true; cancelAnimationFrame(frame); }
  function tick(now: number): void {
    if (stopped) return;
    const delta = Math.min(100, Math.max(0, now - previous));
    previous = now;
    if (document.visibilityState !== "hidden") elapsed += delta;
    try {
      if (elapsed >= approach && !arena.classList.contains("engaged")) {
        arena.classList.remove("approaching");
        arena.classList.add("engaged");
        status.textContent = "The lines meet";
      }
      const due = Math.min(rounds.length, Math.floor(Math.max(0, elapsed - approach) / step));
      while (shown < due) {
        const round = rounds[shown];
        const counts: Counts[] = [{ ...round.player }, { ...round.enemy, militia: 0 }];
        sides.forEach((side, sideIndex) => {
          for (const [kind, row] of side.rows) {
            const left = counts[sideIndex][kind];
            const standing = Math.round(left / Math.max(1, side.start[kind]) * row.icons.length);
            row.icons.forEach((actor, index) => actor.classList.toggle("fallen", index >= standing));
            row.more.textContent = left > standing ? `+${left - standing}` : "";
            row.row.setAttribute("aria-label", `${kind}: ${left} of ${side.start[kind]} standing`);
          }
        });
        status.textContent = `Round ${shown + 1} of ${rounds.length}`;
        const impact = document.createElement("i");
        clash.replaceChildren(impact);
        callbacks.onRound?.(shown, round);
        shown++;
      }
      if (elapsed >= approach + step * rounds.length + (reduced ? 120 : 800)) {
        stop();
        callbacks.onDone();
        return;
      }
    } catch (error) {
      stop();
      console.warn("[Grow an Empire] Popup battle animation failed; showing the saved result.", error);
      callbacks.onDone();
      return;
    }
    frame = requestAnimationFrame(tick);
  }
  frame = requestAnimationFrame(tick);
  return stop;
}
