import { describe, expect, it } from "vitest";
import { CAMPAIGNS } from "../campaigns";
import { SettlementSimulation } from "../settlementSimulation";
import { playMove } from "./play";
import { BUILDINGS } from "../content";

describe("extended campaign preparation", () => {
  it.each(CAMPAIGNS.map(c => c.number))("campaign %i resolves its exact move limit and survives saves after move 12", number => {
    const campaign = CAMPAIGNS[number - 1];
    let sim = new SettlementSimulation(campaign);
    for (let completed = 0; completed < campaign.moveLimit; completed++) {
      expect(sim.state.mode).toBe("awaiting-choice");
      expect(playMove(sim)).not.toBe("none");
      expect(sim.state.civicLevel).toBe(completed + 1);
      expect(sim.state.mode).toBe(completed + 1 === campaign.moveLimit ? "muster" : "awaiting-choice");
      const restored = new SettlementSimulation(campaign);
      restored.loadSnapshot(sim.serialize());
      expect(restored.state).toEqual(sim.state);
      sim = restored;
    }
    expect(sim.state.builtBuildingIds.length + sim.state.gatherMoves).toBe(campaign.moveLimit);
    expect(sim.canGather()).toBe(false);
  });

  it("allows the 25th move when every unique building is already built", () => {
    const sim = new SettlementSimulation(CAMPAIGNS[24]);
    sim.state.builtBuildingIds = Object.keys(BUILDINGS);
    sim.state.availableBuildingIds = [];
    sim.state.move = 25;
    sim.state.civicLevel = 24;
    expect(sim.canGather()).toBe(true);
    sim.gather();
    expect(sim.state.mode).toBe("muster");
    expect(sim.state.civicLevel).toBe(25);
  });

  it("gives an old unfinished muster its extra preparation moves", () => {
    const campaign = CAMPAIGNS[24];
    const old = new SettlementSimulation({ ...campaign, moveLimit: 12 });
    for (let move = 0; move < 12; move++) playMove(old);
    const restored = new SettlementSimulation(campaign);
    restored.loadSnapshot(old.serialize());
    expect(restored.state).toMatchObject({ mode: "awaiting-choice", move: 13, civicLevel: 12 });
    expect(restored.state.builtBuildingIds).toEqual(old.state.builtBuildingIds);
    expect(restored.state.availableBuildingIds).toHaveLength(3);
  });
  it("extends a twelve-move Campaign 2 muster to fifteen without losing the city", () => {
    const campaign = CAMPAIGNS[1], old = new SettlementSimulation({ ...campaign, moveLimit: 12 });
    for (let move = 0; move < 12; move++) playMove(old);
    const snapshot = old.serialize(), restored = new SettlementSimulation(campaign);
    restored.loadSnapshot(snapshot);
    expect(restored.state).toMatchObject({ mode: "awaiting-choice", move: 13, civicLevel: 12 });
    expect(restored.state.resources).toEqual(snapshot.state.resources);
    expect(restored.state.campaignHealth).toEqual(snapshot.state.campaignHealth);
    expect(restored.state.builtBuildingIds).toEqual(snapshot.state.builtBuildingIds);
    for (let move = 12; move < 15; move++) playMove(restored);
    expect(restored.state).toMatchObject({ mode: "muster", civicLevel: 15 });
  });

  it("preserves an older completed battle when preparation and the enemy change", () => {
    const campaign = CAMPAIGNS[1];
    const old = new SettlementSimulation({ ...campaign, moveLimit: 12, objective: { ...campaign.objective, army: { swordsmen: 1, archers: 0, horsemen: 0, veterancy: 1 } } });
    for (let move = 0; move < 12; move++) playMove(old);
    old.muster(old.bestHire());
    const snapshot = old.serialize(), restored = new SettlementSimulation(campaign);
    restored.loadSnapshot(snapshot);
    expect(restored.state.mode).toBe("complete");
    expect(restored.state.armyReport).toEqual(snapshot.state.armyReport);
    expect(restored.state.armyReport?.enemy).toMatchObject({ swordsmen: 1, archers: 0 });
  });

});
