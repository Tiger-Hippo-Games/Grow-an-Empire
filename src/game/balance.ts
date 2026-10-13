/**
 * Balance tools: plays every reachable game under a declared choice policy
 * and reports how each one ends at the muster (trained army, militia, and the
 * gold the pre-battle market could raise). Calibration keeps the reference
 * build-first policy: Gather when stuck. The every-turn policy also explores
 * strategic Gather choices. Used by `__tests__/balance.test.ts` and
 * `Tools/balance/calibrate.ts`; not part of the game bundle (nothing imports it).
 */
import { SettlementSimulation, type SettlementState } from "./settlementSimulation";
import { CAMPAIGN_1 } from "./campaigns";
import type { CampaignDefinition } from "./campaigns";
import { enemyHeadCount, enemyStrength, playerStrength, watchtowerVolley, type EnemyArmy } from "./battle";
import { BURJ_MILITIA_STRENGTH, DHARMA_STAMBHA_BONUS, KOSHAGAR_SELLSWORD_CAP, PRAKARA_REDUCTION, SELLSWORD_COST } from "./economy";

export interface Ending {
  archers: number; swordsmen: number; horsemen: number; militia: number; gold: number; market: boolean;
  /** War elephants, and whether the Prakara and the Dharma Stambha stand. */
  elephants: number; prakara: boolean; stambha: boolean;
  /** Whether the Burj (full-strength militia) and the Koshagar (+2 sellswords) stand. */
  burj: boolean; koshagar: boolean;
  gathers: number; swaps: number; deserted: number; built: string[];
}

export interface SearchResult { endings: Ending[]; deadEnds: number }

function endingOf(sim: SettlementSimulation): Ending {
  return {
    ...sim.state.trainedUnits, militia: sim.militia, gold: sim.musterGold, market: sim.hasMarketplace,
    elephants: sim.elephants, prakara: sim.has("prakara"), stambha: sim.has("dharma-stambha"), burj: sim.has("burj"), koshagar: sim.has("koshagar"),
    gathers: sim.state.gatherMoves, swaps: sim.state.swaps, deserted: sim.state.deserted, built: [...sim.state.builtBuildingIds],
  };
}

/** Seeded reference policies keep long-campaign calibration bounded and reproducible.
 * Twelve-move campaigns retain the exhaustive proof; longer campaigns sample
 * 4,096 build-first journeys. This is a policy sample, not a count of all orders.
 */
export function sampleEndings(campaign: CampaignDefinition, count = 4096): SearchResult {
  let seed = 0x6a09e667;
  const random = (): number => {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    return (seed >>> 0) / 0x100000000;
  };
  const endings: Ending[] = [];
  let deadEnds = 0;
  for (let run = 0; run < count; run++) {
    const sim = new SettlementSimulation(campaign);
    for (let move = 0; move < campaign.moveLimit; move++) {
      const affordable = sim.state.availableBuildingIds.filter(id => sim.canAffordBuilding(id));
      const swaps = affordable.length ? [] : sim.state.availableBuildingIds.filter(id => sim.swapPlanFor(id));
      const options = affordable.length ? affordable : swaps;
      if (options.length) {
        const id = options[Math.floor(random() * options.length)];
        if (affordable.length) sim.chooseBuilding(id); else sim.swapAndBuild(id);
        sim.update(1e9);
      } else if (sim.canGather()) sim.gather();
      else { deadEnds++; break; }
    }
    if (sim.state.mode === "muster") endings.push(endingOf(sim));
  }
  return { endings, deadEnds };
}

const referenceCache = new Map<string, SearchResult>();
export function referenceEndings(campaign: CampaignDefinition): SearchResult {
  const key = `${campaign.moveLimit}/${campaign.availableBuildingIds.join(",")}`;
  let result = referenceCache.get(key);
  if (!result) {
    result = campaign.moveLimit === 12 ? searchEndings({ campaign }) : sampleEndings(campaign);
    referenceCache.set(key, result);
  }
  return result;
}

function cloneInto(state: SettlementState, campaign: CampaignDefinition): SettlementSimulation {
  const sim = new SettlementSimulation(campaign);
  Object.assign(sim.state, structuredClone(state));
  return sim;
}

function keyOf(state: SettlementState): string {
  const { lastSummary: _ignored, ...rest } = state;
  return JSON.stringify(rest);
}

export function searchEndings({ gatherPolicy = "when-stuck", campaign = CAMPAIGN_1 }: { gatherPolicy?: "when-stuck" | "every-turn"; campaign?: CampaignDefinition } = {}): SearchResult {
  const seen = new Set<string>();
  const endings: Ending[] = [];
  let deadEnds = 0;
  const stack: SettlementState[] = [new SettlementSimulation(campaign).state];
  while (stack.length) {
    const state = stack.pop()!;
    const key = keyOf(state);
    if (seen.has(key)) continue;
    seen.add(key);
    const sim = cloneInto(state, campaign);
    if (sim.state.mode === "muster") {
      endings.push({
        archers: sim.state.trainedUnits.archers, swordsmen: sim.state.trainedUnits.swordsmen, horsemen: sim.state.trainedUnits.horsemen,
        militia: sim.militia, gold: sim.musterGold, market: sim.hasMarketplace,
        elephants: sim.elephants, prakara: sim.has("prakara"), stambha: sim.has("dharma-stambha"), burj: sim.has("burj"), koshagar: sim.has("koshagar"),
        gathers: sim.state.gatherMoves, swaps: sim.state.swaps, deserted: sim.state.deserted, built: [...sim.state.builtBuildingIds],
      });
      continue;
    }
    const options = sim.state.availableBuildingIds.filter((id) => sim.canAffordBuilding(id));
    const next: SettlementState[] = [];
    for (const id of options) {
      const branch = cloneInto(state, campaign);
      branch.chooseBuilding(id);
      branch.update(1e9);
      next.push(branch.state);
    }
    if (options.length === 0) {
      for (const id of sim.state.availableBuildingIds) {
        if (!sim.swapPlanFor(id)) continue;
        const branch = cloneInto(state, campaign);
        branch.swapAndBuild(id);
        branch.update(1e9);
        next.push(branch.state);
      }
    }
    if (sim.canGather() && (options.length === 0 || gatherPolicy === "every-turn")) {
      const branch = cloneInto(state, campaign);
      if (branch.gather().length > 0) next.push(branch.state);
    }
    if (next.length === 0) deadEnds += 1;
    stack.push(...next);
  }
  return { endings, deadEnds };
}

/**
 * Best margin an ending can reach against `enemy`, with the best sellsword mix,
 * under the same battle conditions as `SettlementSimulation.battleSetup()`.
 */
export function bestMargin(ending: Ending, campaignEnemy: EnemyArmy): number {
  const cap = ending.market ? Math.floor(enemyHeadCount(campaignEnemy) / 2) + (ending.koshagar ? KOSHAGAR_SELLSWORD_CAP : 0) : 0;
  const budget = Math.min(cap, Math.floor(ending.gold / SELLSWORD_COST));
  const enemy = ending.prakara ? watchtowerVolley(campaignEnemy, PRAKARA_REDUCTION).remaining : campaignEnemy;
  const mods = { bonus: ending.stambha ? DHARMA_STAMBHA_BONUS : 0, ...(ending.burj ? { militiaStrength: BURJ_MILITIA_STRENGTH } : {}) };
  let best = -Infinity;
  for (let archers = 0; archers <= budget; archers += 1) {
    const army = { archers: ending.archers + archers, swordsmen: ending.swordsmen + budget - archers, horsemen: ending.horsemen, militia: ending.militia, elephants: ending.elephants };
    const ours = playerStrength(army, enemy, mods);
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
