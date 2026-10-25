import { describe, expect, it } from "vitest";
import { campaignRating, freshCampaignHealth, recordCampaignIssues } from "../campaignRating";
import { CAMPAIGN_1 } from "../campaigns";
import { RESOURCE_NAMES } from "../economy";
import { migrateSnapshot, SettlementSimulation } from "../settlementSimulation";
import { toSavedGame } from "../../platform/progressStore";

describe("campaign stars", () => {
  it.each([[false, false, 3], [true, false, 2], [false, true, 2], [true, true, 1]] as const)("scores a victory with population issue %s, resource issue %s", (population, resources, stars) => {
    const health = freshCampaignHealth(); recordCampaignIssues(health, 2, population, resources);
    expect(campaignRating(true, health)).toEqual({ stars, goals: { victory: true, population: !population, resources: !resources } });
    expect(campaignRating(false, health)).toEqual({ stars: 0, goals: { victory: false, population: false, resources: false } });
  });
  it("gives a narrow clean victory all three stars, with no strength-margin requirement", () => {
    const campaign = { ...CAMPAIGN_1, objective: { ...CAMPAIGN_1.objective, army: { archers: 0, swordsmen: 1, horsemen: 0, veterancy: 1.24 } } };
    const sim = new SettlementSimulation(campaign);
    Object.assign(sim.state, { mode: "muster", population: 2, trainedUnits: { archers: 0, swordsmen: 1, horsemen: 0 } });
    sim.muster();
    expect(sim.state.armyReport?.margin).toBeLessThan(.01);
    expect(sim.state.armyReport?.stars).toBe(3);
    expect(sim.state.armyReport?.starGoals).toEqual({ victory: true, population: true, resources: true });
  });
  it("does not let overwhelming strength buy back a missed clean-city star", () => {
    const sim = new SettlementSimulation();
    Object.assign(sim.state, { mode: "muster", population: 200, trainedUnits: { archers: 100, swordsmen: 0, horsemen: 0 } });
    recordCampaignIssues(sim.state.campaignHealth, 1, false, true);
    sim.muster();
    expect(sim.state.armyReport?.win).toBe(true);
    expect(sim.state.armyReport?.stars).toBe(2);
    expect(sim.state.armyReport?.gap).toContain("resource shortages");
  });
});

function city(built: string[]) {
  const sim = new SettlementSimulation();
  sim.state.builtBuildingIds = built; sim.state.availableBuildingIds = [];
  return sim;
}

describe("campaign-wide issue tracking", () => {
  it("records a fully idle processor before camp supplies refill its inputs, and retains the issue after recovery/reload", () => {
    const sim = city(["sawmill"]); sim.state.resources.wood = 0;
    sim.gather();
    expect(sim.state.campaignHealth.resourceIssueMoves).toBe(1);
    expect(sim.state.campaignHealth.firstResourceMove).toBe(1);
    sim.state.resources.wood = 100; sim.gather();
    const loaded = new SettlementSimulation(); loaded.loadSnapshot(sim.serialize());
    expect(loaded.state.campaignHealth).toEqual(sim.state.campaignHealth);
    expect(loaded.state.campaignHealth.resourceIssueMoves).toBe(1);
    loaded.reset(); expect(loaded.state.campaignHealth).toEqual(freshCampaignHealth());
  });
  it("records recruitment blocked by missing villagers independently of resources", () => {
    const sim = city(["blacksmith"]);
    for (const name of RESOURCE_NAMES) sim.state.resources[name] = 100;
    sim.state.population = 2; sim.state.trainedUnits.swordsmen = 1;
    sim.gather();
    expect(sim.state.campaignHealth).toMatchObject({ populationIssueMoves: 1, resourceIssueMoves: 0, firstPopulationMove: 1 });
  });
  it("records unpaid army upkeep even without a military building or an idle processor", () => {
    const sim = city(["farm"]); sim.state.population = 105; sim.state.trainedUnits.swordsmen = 100; sim.state.resources.rations = 0;
    sim.gather();
    expect(sim.state.campaignHealth).toMatchObject({ populationIssueMoves: 0, resourceIssueMoves: 1 });
    expect(sim.state.resources.rations).toBeGreaterThan(0); // camp aid cannot erase the shortage
  });
  it("does not penalize low reserves, spoilage, successful partial production, or an unaffordable card", () => {
    const sim = city(["sawmill", "farm"]);
    sim.state.resources.wood = 2; sim.state.resources.grain = 100;
    sim.gather();
    expect(sim.state.lastSummary?.warnings.some(s => s.includes("spoiled"))).toBe(true);
    expect(sim.state.campaignHealth).toEqual(freshCampaignHealth());
    const fresh = new SettlementSimulation(); fresh.state.resources.wood = 0; fresh.state.resources.stone = 0;
    fresh.chooseBuilding("woodcutter");
    expect(fresh.state.campaignHealth).toEqual(freshCampaignHealth());
  });
});

describe("rating save migration", () => {
  function legacy(sim: SettlementSimulation) {
    const snapshot = JSON.parse(JSON.stringify(sim.serialize())); snapshot.schemaVersion = 6; delete snapshot.state.campaignHealth;
    return snapshot;
  }
  it("keeps a schema-6 mid-run city and best ratings without inventing clean history", () => {
    const sim = city(["farm"]); sim.gather();
    const old = { ...legacy(sim), runId: "legacy-run", campaignStars: { [sim.campaign.id]: 3 } };
    const saved = toSavedGame(old, sim.campaign.id)!;
    expect(saved.schemaVersion).toBe(7);
    expect(saved.campaignStars?.[sim.campaign.id]).toBe(3);
    expect(saved.state.builtBuildingIds).toEqual(["farm"]);
    expect(saved.state.campaignHealth.historyKnown).toBe(false);
    expect(campaignRating(true, saved.state.campaignHealth).stars).toBe(1);
    expect(old.schemaVersion).toBe(6);
  });
  it("can track every move in an old save that has not completed any moves yet", () => {
    expect(migrateSnapshot(legacy(new SettlementSimulation()))?.state.campaignHealth.historyKnown).toBe(true);
  });
  it("retains an old completed result without changing its earned stars", () => {
    const sim = new SettlementSimulation();
    Object.assign(sim.state, { mode: "muster", population: 200, trainedUnits: { archers: 100, swordsmen: 0, horsemen: 0 } }); sim.muster();
    const old = legacy(sim); delete old.state.armyReport.starGoals; old.state.armyReport.stars = 2;
    const loaded = new SettlementSimulation(); loaded.loadSnapshot(migrateSnapshot(old)!);
    expect(loaded.state.mode).toBe("complete"); expect(loaded.state.armyReport?.stars).toBe(2);
  });
  it("rejects corrupted health counters rather than silently granting clean-city stars", () => {
    const snapshot = new SettlementSimulation().serialize(); snapshot.state.campaignHealth.populationIssueMoves = -1;
    expect(migrateSnapshot(snapshot)).toBeNull();
  });
});
