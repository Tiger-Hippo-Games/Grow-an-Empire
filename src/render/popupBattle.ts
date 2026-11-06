import { combatFrame, formationDepth } from "./battlePresentation";
import type { BattleRound } from "../game/battle";
import { iconStyle, type IconKind } from "./combatScene";
import { assetUrl } from "./assetCatalog";

const ORDER: IconKind[] = ["elephants", "swordsmen", "horsemen", "archers", "militia"];
const APPROACH_MS = 1000;
const ROUND_MS = 1350;
type Counts = Record<IconKind, number>;
export interface BattleSide { title: string; start: Counts }

/** One actor per actual soldier; kinds with zero recruits never create actors. */
function formation(side: BattleSide, enemy: boolean, columns: number) {
  const element = document.createElement("section");
  element.className = `battle-formation${enemy ? " enemy" : ""}`;
  element.setAttribute("aria-label", side.title);
  const rows = new Map<IconKind, { icons: HTMLElement[]; sprites: HTMLElement[]; standing: number; more: HTMLElement; row: HTMLElement }>();
  for (const kind of ORDER) {
    const count = side.start[kind] ?? 0;
    if (!count) continue;
    const row = document.createElement("div");
    row.className = "battle-rank";
    row.style.setProperty("--rank", String(rows.size));
    row.setAttribute("aria-label", `${kind}: ${count}`);
    const icons: HTMLElement[] = [];
    const sprites: HTMLElement[] = [];
    row.style.setProperty("--columns", String(Math.min(count, columns)));
    for (let index = 0; index < count; index++) {
      const actor = document.createElement("span");
      actor.className = `battle-actor actor-${kind}`;
      actor.style.setProperty("--beat", `${index * -137}ms`);
      actor.setAttribute("aria-hidden", "true");
      const sprite = document.createElement("i");
      sprite.className = `unit-icon unit-${kind}${enemy ? " enemy" : ""}`;
      const art = kind === "militia" ? `background-image:url("${assetUrl("militia-work8-master-v1.png")}")` : iconStyle(kind, enemy);
      if (art) sprite.setAttribute("style", art);
      actor.appendChild(sprite);
      row.appendChild(actor);
      icons.push(actor);
      sprites.push(sprite);
    }
    const more = document.createElement("b");
    more.className = "unit-more";
    more.textContent = "";
    more.setAttribute("aria-hidden", "true");
    row.appendChild(more);
    element.appendChild(row);
    rows.set(kind, { icons, sprites, standing: count, more, row });
  }
  return { element, start: side.start, rows, enemy };
}

/**
 * Presents the already-resolved battle in the muster popup without changing
 * game state. Hidden tabs pause playback; each displayed actor is one unit of the recorded army, with exact casualties.
 */
export function playBattle(container: HTMLElement, player: BattleSide, enemy: BattleSide, rounds: BattleRound[], callbacks: { onRound?(index: number, round: BattleRound): void; onDone(): void; isPaused?(): boolean }): () => void {
  container.replaceChildren();
  const arena = document.createElement("div");
  arena.className = "popup-battlefield approaching";
  arena.style.backgroundImage = `linear-gradient(#12152a66, #30211666), url("${assetUrl("village-empty-terrain-16x9-v2.png")}")`;
  arena.setAttribute("aria-label", "The two armies approach and fight round by round");
  const largestArmy = Math.max(Object.values(player.start).reduce((a,b) => a+b, 0), Object.values(enemy.start).reduce((a,b) => a+b, 0));
  const columns = Math.min(40, Math.max(4, Math.ceil(Math.sqrt(largestArmy * 4))));
  arena.style.setProperty("--battle-columns", String(columns));
  arena.style.setProperty("--army-depth", String(Math.max(formationDepth(player.start, columns), formationDepth(enemy.start, columns))));
  const sides = [formation(player, false, columns), formation(enemy, true, columns)];
  sides.forEach(side => arena.appendChild(side.element));
  for (const [index, side] of [player, enemy].entries()) {
    const label = document.createElement("span");
    label.className = `battle-banner${index ? " enemy" : ""}`;
    label.textContent = side.title;
    arena.appendChild(label);
  }
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
  const noOpposition = [player.start, enemy.start].some(counts => Object.values(counts).every(count => count === 0));
  const approach = reduced || noOpposition ? 0 : APPROACH_MS;
  const step = reduced ? 120 : ROUND_MS;
  let frame = 0;
  let elapsed = 0;
  let previous = performance.now();
  let shown = 0;
  let lastVolley = -1;
  const frames = new WeakMap<HTMLElement, number>();
  let stopped = false;
  let resolvedAt: number | null = noOpposition ? 0 : null;
  if (noOpposition) {
    arena.classList.remove("approaching");
    arena.classList.add("resolved");
    status.textContent = Object.values(player.start).some(count => count > 0) ? "Your army holds the field" : "Your army has fallen";
  }

  function stop(): void { stopped = true; cancelAnimationFrame(frame); }
  function tick(now: number): void {
    if (stopped) return;
    const delta = Math.min(100, Math.max(0, now - previous));
    previous = now;
    let finished = false;
    try {
      const paused = document.visibilityState === "hidden" || callbacks.isPaused?.() === true;
      arena.classList.toggle("playback-paused", paused);
      if (!paused) elapsed += delta;
      if (elapsed >= approach && !arena.classList.contains("engaged") && resolvedAt === null) {
        arena.classList.remove("approaching");
        arena.classList.add("engaged");
        status.textContent = "The lines meet";
      }
      let due = Math.min(rounds.length, Math.floor(Math.max(0, elapsed - approach) / step));
      if (resolvedAt !== null) due = rounds.length;
      while (shown < due) {
        const round = rounds[shown];
        const counts: Counts[] = [{ ...round.player, elephants: round.player.elephants ?? 0 }, { ...round.enemy, militia: 0, elephants: 0 }];
        sides.forEach((side, sideIndex) => {
          for (const [kind, row] of side.rows) {
            const left = counts[sideIndex][kind];
            const standing = Math.min(left, row.icons.length);
            row.standing = standing;
            row.icons.forEach((actor, index) => actor.classList.toggle("fallen", index >= standing));
            row.more.textContent = "";
            row.row.setAttribute("aria-label", `${kind}: ${left} of ${side.start[kind]} standing`);
          }
        });
        if (resolvedAt === null) {
          status.textContent = `Round ${shown + 1} of ${rounds.length}`;

        }
        if (counts.some(side => Object.values(side).every(count => count === 0))) {
          resolvedAt ??= elapsed;
          arena.classList.remove("engaged");
          arena.classList.add("resolved");
          clash.replaceChildren();
          status.textContent = Object.values(counts[0]).some(count => count > 0) ? "Your army holds the field" : "Your army has fallen";
          due = rounds.length; // Deliver exact final counts without more empty combat rounds.
        }
        callbacks.onRound?.(shown, round);
        shown++;
      }
      // Quantized poses, attack/recovery and arrows use the same paused playback clock.
      const fighting = resolvedAt === null && elapsed >= approach && !reduced;
      const phase = ((elapsed - approach) % step) / step;
      arena.classList.toggle("striking", fighting && phase >= .35 && phase < .65);
      for (const side of sides) for (const [kind, row] of side.rows) row.sprites.forEach((sprite, index) => {
        const front = kind === "archers" || (side.enemy ? index < columns : index >= Math.max(0, row.standing - columns));
        const attacking = fighting && front && index < row.standing;
        row.icons[index].classList.toggle("attacking", attacking);
        const pose = attacking ? combatFrame(kind, phase) : 0;
        if (frames.get(sprite) === pose) return;
        frames.set(sprite, pose);
        sprite.style.setProperty("background-position", `${pose % 4 * 100 / 3}% ${pose >= 4 ? 100 : 0}%`);
      });
      const volley = Math.floor((elapsed - approach) / step);
      if (fighting && phase >= .40 && volley !== lastVolley) {
        lastVolley = volley;
        clash.replaceChildren(document.createElement("i"));
        sides.forEach((side, sideIndex) => {
          const archers = side.rows.get("archers");
          if (!archers?.icons.some(actor => !actor.classList.contains("fallen"))) return;
          const arrows = document.createElement("span");
          arrows.className = `battle-volley${sideIndex ? " enemy-volley" : ""}`;
          clash.appendChild(arrows);
        });
      }
      if (elapsed >= (resolvedAt ?? approach + step * rounds.length) + (reduced ? 120 : 800)) {
        finished = true;
      }
    } catch (error) {
      stop();
      console.warn("[Grow an Empire] Popup battle animation failed; showing the saved result.", error);
      callbacks.onDone();
      return;
    }
    if (finished) { stop(); callbacks.onDone(); return; }
    frame = requestAnimationFrame(tick);
  }
  frame = requestAnimationFrame(tick);
  return stop;
}
