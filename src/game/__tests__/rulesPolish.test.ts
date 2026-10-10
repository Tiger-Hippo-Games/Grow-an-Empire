import { describe, expect, it } from "vitest";
import { CAMPAIGNS } from "../campaigns";
import { emptyStockpile, planSwap } from "../economy";
import { SettlementSimulation } from "../settlementSimulation";

/** v0.5.0: the swap's change, the defeat hint and the earlier ration warning. */
describe("rules polish", () => {
  it("keeps the gold a swap raises beyond what it needs", () => {
    const stock = { ...emptyStockpile(), wine: 3, wood: 1, stone: 2 };
    const plan = planSwap(stock, { wood: 4, stone: 2 });
    expect(plan).not.toBeNull();
    expect(plan!.goldNeeded).toBe(6);
    expect(plan!.goldRaised).toBe(10);
    expect(plan!.change).toBe(4);

    const sim = new SettlementSimulation();
    Object.assign(sim.state, { move: 3, builtBuildingIds: ["woodcutter", "marketplace"], availableBuildingIds: ["sawmill"], resources: { ...stock } });
    expect(sim.swapAndBuild("sawmill").map((event) => event.type)).toContain("construction-started");
    expect(sim.state.resources.gold).toBe(4);
    expect(sim.state.resources.wine).toBe(1);
  });

  it("only suggests soldiers the city could have trained", () => {
    // Only a Bow Hall stands: the defeat hint is about archers, not horsemen.
    const sim = new SettlementSimulation(CAMPAIGNS[2]);
    Object.assign(sim.state, { mode: "muster", move: 12, builtBuildingIds: ["woodcutter", "quarry", "sawmill", "weapons-workshop"], trainedUnits: { archers: 1, swordsmen: 0, horsemen: 0 } });
    sim.muster(null);
    const report = sim.state.armyReport!;
    expect(report.win).toBe(false);
    expect(report.gap).toMatch(/archer/);
  });

  it("explains that low food slows army growth without threatening desertion", () => {
    const sim = new SettlementSimulation();
    Object.assign(sim.state, { move: 2, builtBuildingIds: ["woodcutter"], availableBuildingIds: ["farm"], trainedUnits: { archers: 4, swordsmen: 0, horsemen: 0 },
      resources: { ...sim.state.resources, wood: 20, rations: 4 } });
    sim.chooseBuilding("farm");
    sim.update(60);
    expect(sim.state.resources.rations).toBe(3);
    expect(sim.state.lastSummary?.warnings.join(" ")).toMatch(/improves army growth.*Existing soldiers stay/);
  });
});
