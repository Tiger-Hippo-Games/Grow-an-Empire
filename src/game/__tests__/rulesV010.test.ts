import { describe, expect, it } from "vitest";
import { searchEndings } from "../balance";
import { CAMPAIGNS } from "../campaigns";
import { MINIMUM_MOVE_STOCKPILE, type ResourceName } from "../economy";
import { SettlementSimulation, type SettlementSnapshot } from "../settlementSimulation";
import { playMove, playToEnd } from "./play";

/** Pins down the v0.10 rules (camp supplies, no economy desertion) against older saves and edge cases. */
describe("v0.10 rules", () => {
  it("loads a schema-6 save from v0.8/v0.9 that recorded desertion, and adds none", () => {
    const sim = new SettlementSimulation();
    for (let move = 0; move < 3; move += 1) playMove(sim, ["woodcutter", "farm", "quarry"]);
    const snapshot = JSON.parse(JSON.stringify(sim.serialize())) as SettlementSnapshot;
    snapshot.state.deserted = 5;
    if (snapshot.state.lastSummary) {
      snapshot.state.lastSummary.deserted = 3;
      snapshot.state.lastSummary.ledger = [...(snapshot.state.lastSummary.ledger ?? []), { source: "army", used: { rations: 2 }, made: {}, deserted: 3 }];
    }
    const loaded = new SettlementSimulation();
    loaded.loadSnapshot(snapshot);
    expect(loaded.state.deserted).toBe(5);
    playMove(loaded);
    expect(loaded.state.lastSummary?.deserted).toBe(0);
    expect(loaded.state.deserted).toBe(5);
    playToEnd(loaded);
    expect(loaded.state.armyReport?.explanations.join(" ")).toMatch(/5 soldiers deserted/);
  });

  it("tops up camp supplies on the final move too, so a Bazaar can sell them at the muster", () => {
    const sim = new SettlementSimulation();
    Object.assign(sim.state, { move: sim.campaign.moveLimit, civicLevel: sim.campaign.moveLimit - 1, builtBuildingIds: ["marketplace"], availableBuildingIds: [] });
    for (const name of Object.keys(sim.state.resources) as ResourceName[]) sim.state.resources[name] = 0;
    sim.gather();
    expect(sim.state.mode).toBe("muster");
    for (const [name, floor] of Object.entries(MINIMUM_MOVE_STOCKPILE)) expect(sim.state.resources[name as ResourceName]).toBeGreaterThanOrEqual(floor);
    expect(sim.hasMarketplace).toBe(true);
    expect(sim.musterGold).toBeGreaterThan(0); // Intended: the reserve is the city's to sell.
  });

  it("without a food building, the 1-ration floor feeds at most 4 soldiers", () => {
    const sim = new SettlementSimulation();
    Object.assign(sim.state, { move: 2, civicLevel: 1, population: 40, builtBuildingIds: ["woodcutter", "sawmill", "weapons-workshop"], availableBuildingIds: [] });
    sim.state.resources.planks = 80;
    sim.state.resources.rations = 0;
    while (sim.state.mode === "awaiting-choice") sim.gather();
    const army = sim.state.trainedUnits.archers + sim.state.trainedUnits.swordsmen + sim.state.trainedUnits.horsemen * 2;
    expect(army).toBeGreaterThan(0);
    expect(army).toBeLessThanOrEqual(4);
  });

  it.each([5, 15, 25])("campaign %i at eight moves has no dead ends", (number) => {
    const campaign = { ...CAMPAIGNS[number - 1], moveLimit: 8 };
    const { endings, deadEnds } = searchEndings({ campaign });
    expect(deadEnds).toBe(0);
    expect(endings.length).toBeGreaterThan(0);
    expect(endings.every((ending) => ending.deserted === 0)).toBe(true);
  });
});
