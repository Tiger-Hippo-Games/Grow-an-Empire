import { describe, expect, it } from "vitest";
import { CAMPAIGNS } from "../campaigns";
import { SettlementSimulation } from "../settlementSimulation";
import proofs from "./fixtures/three-star-routes.json";

describe("every campaign has a legal three-star replay", () => {
  it("covers all 25 campaigns", () => expect(proofs.map(p => p.campaign)).toEqual(CAMPAIGNS.map(c => c.number)));
  it.each(proofs)("campaign $campaign", proof => {
    const sim = new SettlementSimulation(CAMPAIGNS[proof.campaign - 1]);
    expect(proof.choices).toHaveLength(sim.campaign.moveLimit);
    for (const choice of proof.choices) {
      if (choice === "gather") expect(sim.gather().length).toBeGreaterThan(0);
      else {
        expect(sim.state.availableBuildingIds).toContain(choice);
        const events = sim.canAffordBuilding(choice) ? sim.chooseBuilding(choice) : sim.swapAndBuild(choice);
        expect(events.length).toBeGreaterThan(0); sim.update(1e9);
      }
      expect(sim.state.campaignHealth.populationIssueMoves).toBe(0);
      expect(sim.state.campaignHealth.resourceIssueMoves).toBe(0);
    }
    expect(sim.state.mode).toBe("muster"); sim.muster(sim.bestHire());
    expect(sim.state.armyReport?.stars).toBe(3);
    expect(sim.state.armyReport?.starGoals).toEqual({ victory: true, population: true, resources: true });
  });
});
