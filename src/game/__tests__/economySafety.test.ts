import { describe, expect, it } from "vitest";
import { CAMPAIGNS } from "../campaigns";
import { MINIMUM_MOVE_STOCKPILE, type ResourceName } from "../economy";
import { SettlementSimulation } from "../settlementSimulation";
import { playMove } from "./play";

describe("safe economy", () => {
  it("keeps basic supplies, people and trained units across every campaign's moves", () => {
    for (const campaign of CAMPAIGNS) {
      const sim = new SettlementSimulation(campaign);
      while (sim.state.mode === "awaiting-choice") {
        const population = sim.state.population;
        const army = { ...sim.state.trainedUnits };
        if (sim.state.move % 3 === 0) sim.gather();
        else { playMove(sim, ["woodcutter", "farm", "quarry", "sawmill", "weapons-workshop", "blacksmith", "stable"]); sim.update(1e9); }
        for (const [name, floor] of Object.entries(MINIMUM_MOVE_STOCKPILE)) expect(sim.state.resources[name as ResourceName], `${campaign.number}: ${name}`).toBeGreaterThanOrEqual(floor);
        expect(sim.state.population).toBeGreaterThanOrEqual(population);
        for (const type of ["archers", "swordsmen", "horsemen"] as const) expect(sim.state.trainedUnits[type]).toBeGreaterThanOrEqual(army[type]);
        expect(sim.state.lastSummary?.deserted).toBe(0);
        expect(sim.state.lastSummary?.warnings.join(" ")).not.toMatch(/will desert|deserted/);
      }
      expect(sim.state.mode).toBe("muster");
    }
  });

  it("uses food shortage to stall recruitment without spending training materials", () => {
    const sim = new SettlementSimulation();
    Object.assign(sim.state, { move: 6, civicLevel: 5, population: 30, builtBuildingIds: ["weapons-workshop"], trainedUnits: { archers: 8, swordsmen: 0, horsemen: 0 } });
    sim.state.resources.planks = 20;
    sim.state.resources.rations = 0;
    sim.gather();
    expect(sim.state.trainedUnits.archers).toBe(8);
    expect(sim.state.resources.planks).toBe(20);
    expect(sim.state.lastSummary?.stalled).toContainEqual({ buildingId: "weapons-workshop", reason: "needs rations for new recruits" });
    sim.state.resources.rations = 20;
    sim.gather();
    expect(sim.state.trainedUnits.archers).toBeGreaterThan(8);
    expect(sim.state.resources.planks).toBeLessThan(20);
  });
});
