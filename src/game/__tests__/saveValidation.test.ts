import { describe, expect, it } from "vitest";
import { CONSTRUCTION_DURATION_SECONDS, MAX_CAMPAIGN_MOVES } from "../content";
import { describeSnapshotProblem, SettlementSimulation, type SettlementSnapshot } from "../settlementSimulation";
import { playMove, playToEnd } from "./play";

/**
 * Save hardening from the 2026-10-02 review: values that pass a shape check
 * but would crash or mislead the HUD, the result dialog or the battle strip.
 */

const ORDER = ["woodcutter", "quarry", "farm", "sawmill", "bakery", "weapons-workshop"];
const copy = (sim: SettlementSimulation): SettlementSnapshot => JSON.parse(JSON.stringify(sim.serialize()));

function finished(): SettlementSimulation {
  const sim = new SettlementSimulation();
  playToEnd(sim, ORDER);
  expect(sim.state.mode).toBe("complete");
  return sim;
}

function afterOneMove(): SettlementSimulation {
  const sim = new SettlementSimulation();
  playMove(sim, ORDER);
  return sim;
}

describe("save validation", () => {
  it("round-trips a finished city with its report and summary untouched", () => {
    const sim = finished();
    const snapshot = copy(sim);
    expect(describeSnapshotProblem(snapshot)).toBeNull();
    const loaded = new SettlementSimulation();
    loaded.loadSnapshot(snapshot);
    expect(loaded.state.armyReport).toEqual(sim.state.armyReport);
    expect(loaded.state.lastSummary).toEqual(sim.state.lastSummary);
  });

  it("re-fights a finished city whose report is damaged instead of rejecting it", () => {
    const sim = finished();
    for (const damage of [
      (r: Record<string, unknown>) => { r.stars = 7; },
      (r: Record<string, unknown>) => { r.win = !r.win; },
      (r: Record<string, unknown>) => { r.rounds = [{ player: null, enemy: {} }]; },
      (r: Record<string, unknown>) => { r.sellswords = "two"; },
      (r: Record<string, unknown>) => { r.goldSpent = "lots"; },
    ]) {
      const snapshot = copy(sim);
      damage(snapshot.state.armyReport as unknown as Record<string, unknown>);
      expect(describeSnapshotProblem(snapshot)).toBeNull();
      const loaded = new SettlementSimulation();
      loaded.loadSnapshot(snapshot);
      expect(loaded.state.armyReport?.stars).toBe(loaded.state.armyReport?.win ? loaded.state.armyReport.stars : 0);
      expect(Array.isArray(loaded.state.armyReport?.rounds)).toBe(true);
    }
  });

  it("drops a damaged move summary but keeps the city", () => {
    const snapshot = copy(afterOneMove());
    (snapshot.state.lastSummary as unknown as Record<string, unknown>).warnings = [{ html: "<img>" }];
    const loaded = new SettlementSimulation();
    loaded.loadSnapshot(snapshot);
    expect(loaded.state.lastSummary).toBeNull();
    expect(loaded.state.builtBuildingIds).toEqual(snapshot.state.builtBuildingIds);
  });

  it("rejects negative resources and counters", () => {
    let snapshot = copy(afterOneMove());
    snapshot.state.resources.gold = -50;
    expect(describeSnapshotProblem(snapshot)).toMatch(/resources/);
    snapshot = copy(afterOneMove());
    snapshot.state.deserted = -1;
    expect(describeSnapshotProblem(snapshot)).toMatch(/deserted/);
    snapshot = copy(afterOneMove());
    (snapshot.state as unknown as Record<string, unknown>).swaps = 1.5;
    expect(describeSnapshotProblem(snapshot)).toMatch(/swaps/);
  });

  it("rejects a move past the campaign's last move", () => {
    const snapshot = copy(afterOneMove());
    snapshot.state.move = MAX_CAMPAIGN_MOVES + 1;
    expect(describeSnapshotProblem(snapshot)).toMatch(/move/);
  });

  it("rejects a building that is both built and on offer", () => {
    const snapshot = copy(afterOneMove());
    snapshot.state.availableBuildingIds.push(snapshot.state.builtBuildingIds[0]);
    expect(describeSnapshotProblem(snapshot)).toMatch(/built and on offer/);
  });

  it("rejects a battle report in a city that hasn't fought", () => {
    const snapshot = copy(afterOneMove());
    snapshot.state.armyReport = finished().state.armyReport;
    expect(describeSnapshotProblem(snapshot)).toMatch(/armyReport/);
  });

  it("clamps an out-of-range construction timer", () => {
    const sim = new SettlementSimulation();
    sim.chooseBuilding("farm");
    sim.update(3);
    const snapshot = copy(sim);
    snapshot.state.constructionElapsed = 10_000;
    const loaded = new SettlementSimulation();
    loaded.loadSnapshot(snapshot);
    expect(loaded.state.constructionElapsed).toBe(CONSTRUCTION_DURATION_SECONDS);
    snapshot.state.constructionElapsed = -5;
    loaded.loadSnapshot(snapshot);
    expect(loaded.state.constructionElapsed).toBe(0);
  });

  it("treats muster(null) as no sellswords", () => {
    const sim = new SettlementSimulation();
    for (let i = 0; i < 40 && sim.state.mode !== "muster"; i += 1) playMove(sim, ORDER);
    expect(sim.muster(null).map((event) => event.type)).toEqual(["army-mustered", "game-complete"]);
  });
});
