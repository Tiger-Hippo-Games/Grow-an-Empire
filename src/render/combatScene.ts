import type { BattleRound } from "../game/battle";
import { assetUrl } from "./assetCatalog";

/**
 * The battle view: a strip of unit icons for each side that grey out round by
 * round as soldiers fall (the result is already decided by `resolveBattle`;
 * this only shows it). Icons are the first frame of each soldier's combat
 * sheet, so the view needs no extra art. Plain DOM, drawn over the city.
 */
export type IconKind = "archers" | "swordsmen" | "horsemen" | "militia";
const SHEETS: Record<"archers" | "swordsmen" | "horsemen" | "enemy", string> = {
  archers: "archer-combat-south8-master-v1.png",
  swordsmen: "swordsman-combat-south8-master-v1.png",
  horsemen: "horseman-combat-south8-master-v1.png",
  enemy: "enemy-combat-north8-master-v1.png",
};
/** Icons drawn per unit type before the rest are shown as "+N". */
const MAX_ICONS = 24;
const ROUND_MS = 900;
const LABELS: Record<IconKind, string> = { archers: "Archers", swordsmen: "Swordsmen", horsemen: "Horsemen", militia: "Militia" };

/** CSS `background` for a unit icon: the sheet is 4 × 2 frames; frame 0 is the ready pose. */
export function iconStyle(kind: IconKind, enemy: boolean): string {
  if (kind === "militia") return "";
  const url = assetUrl(enemy ? SHEETS.enemy : SHEETS[kind]);
  return `background-image:url("${url}")`;
}

/** Enemy sheets are one art set: tint by role so the three kinds read apart. */
function iconClass(kind: IconKind, enemy: boolean): string {
  return `unit-icon unit-${kind}${enemy ? " enemy" : ""}`;
}

type Counts = Record<IconKind, number>;

function row(kind: IconKind, count: number, enemy: boolean): { element: HTMLElement; icons: HTMLElement[]; label: HTMLElement } {
  const element = document.createElement("div");
  element.className = "unit-row";
  const label = document.createElement("span");
  label.className = "unit-row-label";
  label.textContent = `${LABELS[kind]} ${count}`;
  const strip = document.createElement("div");
  strip.className = "unit-row-icons";
  const icons: HTMLElement[] = [];
  const style = iconStyle(kind, enemy);
  for (let index = 0; index < Math.min(count, MAX_ICONS); index += 1) {
    const icon = document.createElement("i");
    icon.className = iconClass(kind, enemy);
    if (style) icon.setAttribute("style", style);
    strip.appendChild(icon);
    icons.push(icon);
  }
  if (count > MAX_ICONS) {
    const more = document.createElement("b");
    more.className = "unit-more";
    more.textContent = `+${count - MAX_ICONS}`;
    strip.appendChild(more);
  }
  element.append(label, strip);
  return { element, icons, label };
}

export interface BattleSide { title: string; start: Counts }

/**
 * Plays the battle into `container`: both armies appear, then each of the
 * four rounds greys out the fallen, then `onDone` runs. `onRound` fires per round
 * (for sound). With reduced motion the rounds pass almost instantly.
 */
export function playBattle(container: HTMLElement, player: BattleSide, enemy: BattleSide, rounds: BattleRound[], callbacks: { onRound?(index: number): void; onDone(): void }): () => void {
  container.replaceChildren();
  const sides: Array<{ start: Counts; rows: Map<IconKind, ReturnType<typeof row>>; enemy: boolean }> = [];
  for (const [side, isEnemy] of [[player, false], [enemy, true]] as const) {
    const column = document.createElement("section");
    column.className = `battle-side${isEnemy ? " enemy" : ""}`;
    const heading = document.createElement("h3");
    heading.textContent = side.title;
    column.appendChild(heading);
    const rows = new Map<IconKind, ReturnType<typeof row>>();
    for (const kind of ["swordsmen", "horsemen", "archers", "militia"] as IconKind[]) {
      if (!side.start[kind]) continue;
      const built = row(kind, side.start[kind], isEnemy);
      rows.set(kind, built);
      column.appendChild(built.element);
    }
    if (rows.size === 0) {
      const empty = document.createElement("p");
      empty.className = "battle-empty";
      empty.textContent = "No defenders";
      column.appendChild(empty);
    }
    container.appendChild(column);
    sides.push({ start: side.start, rows, enemy: isEnemy });
  }
  const versus = document.createElement("div");
  versus.className = "battle-versus";
  versus.textContent = "VS";
  container.insertBefore(versus, container.children[1] ?? null);

  const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const step = reduced ? 120 : ROUND_MS;
  const timers: ReturnType<typeof setTimeout>[] = [];
  rounds.forEach((round, index) => {
    timers.push(setTimeout(() => {
      const standing: Counts[] = [
        { ...round.player },
        { archers: round.enemy.archers, swordsmen: round.enemy.swordsmen, horsemen: round.enemy.horsemen, militia: 0 },
      ];
      sides.forEach((side, sideIndex) => {
        for (const [kind, built] of side.rows) {
          const left = standing[sideIndex][kind] ?? 0;
          const start = side.start[kind];
          // Grey icons from the end of the row; with "+N" rows, scale to the icons shown.
          const shown = Math.round((left / Math.max(1, start)) * built.icons.length);
          built.icons.forEach((icon, iconIndex) => icon.classList.toggle("fallen", iconIndex >= shown));
          built.label.textContent = `${LABELS[kind]} ${left} / ${start}`;
        }
      });
      callbacks.onRound?.(index);
    }, step * (index + 1)));
  });
  timers.push(setTimeout(callbacks.onDone, step * (rounds.length + 1) + (reduced ? 0 : 300)));
  return () => timers.forEach(clearTimeout);
}
