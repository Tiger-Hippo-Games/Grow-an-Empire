/**
 * Balance tools: plays every reachable 12-move game under the current rules
 * and reports how each one ends at the muster (trained army, militia, and the
 * gold the pre-battle market could raise). Stuck moves take every possible
 * swap, else a Gather move. Used by `__tests__/balance.test.ts` and
 * `Tools/balance/calibrate.ts`; not part of the game bundle (nothing imports it).
 */
import { SettlementSimulation, type SettlementState } from "./settlementSimulation";
import { CAMPAIGN_1 } from "./campaigns";
import { enemyHeadCount, enemyStrength, playerStrength, type EnemyArmy } from "./battle";
import { SELLSWORD_COST } from "./economy";

export interface Ending {
  archers: number; swordsmen: number; horsemen: number; militia: number; gold: number; market: boolean;
  gathers: number; swaps: number; deserted: number; built: string[];
}

export interface SearchResult { endings: Ending[]; deadEnds: number }

function cloneInto(state: SettlementState): SettlementSimulation {
  const sim = new SettlementSimulation(CAMPAIGN_1);
  Object.assign(sim.state, structuredClone(state));
  return sim;
}

function keyOf(state: SettlementState): string {
  const { lastSummary: _ignored, ...rest } = state;
  return JSON.stringify(rest);
}

export function searchEndings(): SearchResult {
  const seen = new Set<string>();
  const endings: Ending[] = [];
  let deadEnds = 0;
  const stack: SettlementState[] = [new SettlementSimulation(CAMPAIGN_1).state];
  while (stack.length) {
    const state = stack.pop()!;
    const key = keyOf(state);
    if (seen.has(key)) continue;
    seen.add(key);
    const sim = cloneInto(state);
    if (sim.state.mode === "muster") {
      endings.push({
        archers: sim.state.trainedUnits.archers, swordsmen: sim.state.trainedUnits.swordsmen, horsemen: sim.state.trainedUnits.horsemen,
        militia: sim.militia, gold: sim.musterGold, market: sim.hasMarketplace,
        gathers: sim.state.gatherMoves, swaps: sim.state.swaps, deserted: sim.state.deserted, built: [...sim.state.builtBuildingIds],
      });
      continue;
    }
    const options = sim.state.availableBuildingIds.filter((id) => sim.canAffordBuilding(id));
    const next: SettlementState[] = [];
    for (const id of options) {
      const branch = cloneInto(state);
      branch.chooseBuilding(id);
      branch.update(1e9);
      next.push(branch.state);
    }
    if (options.length === 0) {
      for (const id of sim.state.availableBuildingIds) {
        if (!sim.swapPlanFor(id)) continue;
        const branch = cloneInto(state);
        branch.swapAndBuild(id);
        branch.update(1e9);
        next.push(branch.state);
      }
      if (sim.canGather()) {
        const branch = cloneInto(state);
        if (branch.gather().length === 0) { deadEnds += 1; continue; }
        next.push(branch.state);
      }
      if (next.length === 0) deadEnds += 1;
    }
    stack.push(...next);
  }
  return { endings, deadEnds };
}

/** Best margin an ending can reach against `enemy`, with the best sellsword mix. */
export function bestMargin(ending: Ending, enemy: EnemyArmy): number {
  const cap = ending.market ? Math.floor(enemyHeadCount(enemy) / 2) : 0;
  const budget = Math.min(cap, Math.floor(ending.gold / SELLSWORD_COST));
  let best = -Infinity;
  for (let archers = 0; archers <= budget; archers += 1) {
    const army = { archers: ending.archers + archers, swordsmen: ending.swordsmen + budget - archers, horsemen: ending.horsemen, militia: ending.militia };
    const ours = playerStrength(army, enemy);
    const theirs = enemyStrength(enemy, army);
    best = Math.max(best, theirs > 0 ? ours / theirs - 1 : 1);
  }
  return best;
}

export function winShare(endings: Ending[], enemy: EnemyArmy): number {
  let wins = 0;
  for (const ending of endings) if (bestMargin(ending, enemy) > 0) wins += 1;
  return wins / endings.length;
}
