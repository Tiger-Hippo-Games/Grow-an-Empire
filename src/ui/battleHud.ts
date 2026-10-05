import { enemyStrength, playerStrength, type BattleRound, type EnemyArmy } from "../game/battle";
import { escapeHtml } from "./dom";
import { amount, icon } from "./icons";

/**
 * The fight's HUD bar, across the top of the screen and only while the armies
 * fight in the city (render/battleField.ts): your army's counts on the left,
 * the enemy's on the right, and between them a tug-of-war bar of strength
 * showing who is winning, with one pip per round. Skip ends the fight.
 */
export interface BattleHudStart {
  enemyName: string;
  player: { archers: number; swordsmen: number; horsemen: number; militia: number };
  enemy: EnemyArmy;
  rounds: number;
}

const KINDS = ["swordsmen", "archers", "horsemen", "militia"] as const;

export function createBattleHud(root: HTMLElement, onSkip: () => void) {
  const bar = document.createElement("section");
  bar.className = "battle-hud hidden";
  bar.setAttribute("aria-label", "Battle");
  bar.setAttribute("aria-live", "polite");
  const body = document.createElement("div");
  body.className = "bh-body";
  const skip = document.createElement("button");
  skip.type = "button";
  skip.className = "bh-skip";
  skip.setAttribute("aria-label", "Skip the battle");
  skip.title = "Skip";
  skip.innerHTML = `${icon("speed")}<span class="w">Skip</span>`;
  skip.addEventListener("click", onSkip);
  bar.append(body, skip);
  root.appendChild(bar);
  let start: BattleHudStart | null = null;

  function chips(counts: Readonly<Record<string, number>>, kinds: readonly string[]): string {
    return kinds.filter((kind) => (counts[kind] ?? 0) > 0)
      .map((kind) => amount(kind as "archers", counts[kind])).join("") || amount("strength", 0);
  }

  function draw(player: BattleHudStart["player"], enemy: { archers: number; swordsmen: number; horsemen: number }, roundsDone: number): void {
    if (!start) return;
    const ours = playerStrength(player, enemy);
    const theirs = enemyStrength({ ...enemy, veterancy: start.enemy.veterancy }, player);
    const share = ours + theirs > 0 ? ours / (ours + theirs) : 0.5;
    const winning = ours > theirs;
    body.innerHTML = `
      <div class="bh-side bh-you"><span class="bh-name">${icon("rank")}<span class="w">Your army</span></span><span class="bh-units">${chips(player, KINDS)}</span></div>
      <div class="bh-middle">
        <div class="bh-tug" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(share * 100)}" aria-label="${winning ? "You are winning" : "The enemy is winning"}: ${ours.toFixed(1)} against ${theirs.toFixed(1)}">
          <span class="bh-ours" style="width:${(share * 100).toFixed(1)}%"></span><span class="bh-mark" style="left:${(share * 100).toFixed(1)}%"></span>
        </div>
        <div class="bh-numbers"><b class="${winning ? "good" : ""}">${ours.toFixed(1)}</b><span class="bh-pips" aria-label="Round ${Math.min(roundsDone + 1, start.rounds)} of ${start.rounds}">${Array.from({ length: start.rounds }, (_, index) => `<i class="${index < roundsDone ? "done" : ""}"></i>`).join("")}</span><b class="${winning ? "" : "bad"}">${theirs.toFixed(1)}</b></div>
      </div>
      <div class="bh-side bh-enemy"><span class="bh-name">${escapeHtml(start.enemyName)}</span><span class="bh-units">${chips(enemy, KINDS.slice(0, 3))}</span></div>`;
  }

  return {
    show(next: BattleHudStart): void {
      start = next;
      bar.classList.remove("hidden");
      draw(next.player, next.enemy, 0);
    },
    /** A round landed: redraw with the survivors. */
    round(index: number, round: BattleRound): void {
      draw(round.player, round.enemy, index + 1);
    },
    hide(): void {
      bar.classList.add("hidden");
      start = null;
    },
    get visible() { return !bar.classList.contains("hidden"); },
  };
}

export type BattleHud = ReturnType<typeof createBattleHud>;
