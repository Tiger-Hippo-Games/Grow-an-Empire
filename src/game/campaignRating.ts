/** Campaign-wide goals are separate from battle strength and never alter the economy. */
export interface CampaignHealth {
  historyKnown: boolean;
  populationIssueMoves: number;
  resourceIssueMoves: number;
  firstPopulationMove: number | null;
  firstResourceMove: number | null;
}
export interface CampaignStarGoals { victory: boolean; population: boolean; resources: boolean }

export function freshCampaignHealth(historyKnown = true): CampaignHealth {
  return { historyKnown, populationIssueMoves: 0, resourceIssueMoves: 0, firstPopulationMove: null, firstResourceMove: null };
}

export function recordCampaignIssues(health: CampaignHealth, move: number, population: boolean, resources: boolean): void {
  if (population) { health.populationIssueMoves++; health.firstPopulationMove ??= move; }
  if (resources) { health.resourceIssueMoves++; health.firstResourceMove ??= move; }
}

/** Defeat earns zero. Each clean-city bonus is independent, and requires a victory. */
export function campaignRating(win: boolean, health: CampaignHealth): { stars: 0 | 1 | 2 | 3; goals: CampaignStarGoals } {
  const goals = { victory: win, population: win && health.historyKnown && health.populationIssueMoves === 0, resources: win && health.historyKnown && health.resourceIssueMoves === 0 };
  return { stars: (Number(goals.victory) + Number(goals.population) + Number(goals.resources)) as 0 | 1 | 2 | 3, goals };
}

export function isCampaignHealth(value: unknown, moveLimit: number): value is CampaignHealth {
  if (!value || typeof value !== "object") return false;
  const h = value as CampaignHealth;
  const count = (n: number) => Number.isInteger(n) && n >= 0 && n <= moveLimit;
  const first = (n: number | null, total: number) => total === 0 ? n === null : Number.isInteger(n) && n !== null && n >= 1 && n <= moveLimit;
  return typeof h.historyKnown === "boolean" && count(h.populationIssueMoves) && count(h.resourceIssueMoves)
    && first(h.firstPopulationMove, h.populationIssueMoves) && first(h.firstResourceMove, h.resourceIssueMoves);
}
