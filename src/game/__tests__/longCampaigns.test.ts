import { describe, expect, it } from "vitest";
import { CAMPAIGNS } from "../campaigns";
import { SettlementSimulation } from "../settlementSimulation";
import { playMove } from "./play";
import { BUILDINGS } from "../content";

describe("extended campaign preparation", () => {
  it.each([6, 11, 16, 21, 23, 25])("campaign %i resolves its exact move limit and survives saves after move 12", number => {
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
  });
});
