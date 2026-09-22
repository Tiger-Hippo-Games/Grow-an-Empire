import { describe, expect, it } from "vitest";
import { CAMPAIGN_1 } from "../campaigns";
import { CONSTRUCTION_DURATION_SECONDS, populationForLevel, TOTAL_MOVES } from "../content";
import { isValidSnapshot, SAVE_SCHEMA_VERSION, SettlementSimulation, type SettlementSnapshot } from "../settlementSimulation";

function build(sim: SettlementSimulation, buildingId: string) {
  const started = sim.chooseBuilding(buildingId);
  expect(started).toHaveLength(1);
  return [...started, ...sim.update(CONSTRUCTION_DURATION_SECONDS)];
}

function playOrder(order: string[]): SettlementSimulation {
  const sim = new SettlementSimulation();
  for (const buildingId of order) build(sim, buildingId);
  return sim;
}

describe("building choices and construction", () => {
  it("accepts only an offered building while awaiting a choice", () => {
    const sim = new SettlementSimulation();
    expect(sim.chooseBuilding("barracks")).toEqual([]);
    expect(sim.chooseBuilding("woodcutter")[0]).toMatchObject({ type: "construction-started", buildingId: "woodcutter" });
    expect(sim.chooseBuilding("farm")).toEqual([]);
  });

  it("does not complete until the construction deadline", () => {
    const sim = new SettlementSimulation();
    sim.chooseBuilding("woodcutter");
    expect(sim.update(CONSTRUCTION_DURATION_SECONDS - 0.001)).toEqual([]);
    expect(sim.state.mode).toBe("construction");
    expect(sim.update(0.001).some((event) => event.type === "construction-complete")).toBe(true);
  });

  it("resolves a completed move in a stable event order", () => {
    const sim = new SettlementSimulation();
    const events = build(sim, "farm");
    expect(events.map((event) => event.type)).toEqual([
      "construction-started", "construction-complete", "civic-upgraded", "economy-resolved", "population-changed", "choices-ready",
    ]);
    expect(sim.state.civicLevel).toBe(1);
    expect(sim.state.population).toBe(populationForLevel(1));
    expect(sim.state.availableBuildingIds).toEqual(["woodcutter", "swine-farm", "bakery"]);
  });
});

describe("move economy", () => {
  it("produces only when a move completes, not while the player waits", () => {
    const sim = new SettlementSimulation();
    build(sim, "woodcutter");
    const afterMove = sim.state.resources.wood;
    sim.update(300);
    expect(sim.state.resources.wood).toBe(afterMove);
    build(sim, "sawmill");
    expect(sim.state.resources.planks).toBeGreaterThan(0);
  });

  it("runs producers before converters and consumes their inputs", () => {
    const sim = playOrder(["farm", "bakery"]);
    expect(sim.state.resources.rations).toBe(3);
    expect(sim.state.resources.grain).toBe(2);
  });

  it("matures early buildings across subsequent moves", () => {
    const sim = playOrder(["woodcutter", "sawmill", "farm", "bakery"]);
    expect(sim.state.buildingMaturity.woodcutter).toBe(4);
    expect(sim.state.buildingMaturity.bakery).toBe(1);
  });
});

describe("Campaign 1 finale", () => {
  const balanced = ["woodcutter", "sawmill", "farm", "bakery", "quarry", "blacksmith", "weapons-workshop", "barracks"];
  const undersupplied = ["woodcutter", "sawmill", "fruit-orchard", "winery", "quarry", "blacksmith", "weapons-workshop", "barracks"];

  it("ends after Move 8 and emits an Army Muster before game-complete", () => {
    const sim = new SettlementSimulation();
    let finalEvents = [] as ReturnType<typeof build>;
    while (sim.state.mode !== "complete") finalEvents = build(sim, sim.state.availableBuildingIds[0]);
    expect(sim.state.civicLevel).toBe(TOTAL_MOVES);
    expect(sim.state.builtBuildingIds).toHaveLength(TOTAL_MOVES);
    expect(finalEvents.slice(-2).map((event) => event.type)).toEqual(["army-mustered", "game-complete"]);
    expect(sim.state.armyReport).not.toBeNull();
    const resources = { ...sim.state.resources };
    expect(sim.update(300)).toEqual([]);
    expect(sim.state.resources).toEqual(resources);
  });

  it("rewards a complete supply-and-arms chain with victory", () => {
    const sim = playOrder(balanced);
    expect(sim.state.armyReport?.outcome).toBe("Victory");
    expect(sim.state.armyReport?.score).toBeGreaterThanOrEqual(CAMPAIGN_1.objective.strength);
    expect(sim.state.armyReport?.supplyTurns).toBeGreaterThan(0);
    expect(sim.state.armyReport?.units.archers).toBeGreaterThan(0);
  });

  it("allows a strong but unsupplied build to lose", () => {
    const sim = playOrder(undersupplied);
    expect(sim.state.armyReport?.supplyTurns).toBe(0);
    expect(sim.state.armyReport?.outcome).toBe("Settlement Lost");
  });
});

describe("reset, summaries, and saves", () => {
  it("resets to a fresh campaign and summarizes completed moves only", () => {
    const sim = new SettlementSimulation();
    build(sim, "farm");
    sim.chooseBuilding("woodcutter");
    expect(sim.buildOrderSummary()).toEqual([{ move: 1, buildingId: "farm" }]);
    sim.reset();
    expect(sim.state).toEqual(new SettlementSimulation().state);
  });

  it("round-trips an independent mid-construction state through JSON", () => {
    const original = new SettlementSimulation();
    build(original, "farm");
    original.chooseBuilding("woodcutter");
    original.update(10);
    const snapshot: SettlementSnapshot = JSON.parse(JSON.stringify(original.serialize()));
    expect(snapshot.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(isValidSnapshot(snapshot)).toBe(true);
    const restored = new SettlementSimulation();
    restored.loadSnapshot(snapshot);
    expect(restored.state).toEqual(original.state);
    restored.update(5);
    expect(restored.state.constructionElapsed).not.toBe(original.state.constructionElapsed);
  });

  it("rejects unsupported and cross-campaign snapshots", () => {
    const sim = new SettlementSimulation();
    const snapshot = sim.serialize();
    expect(() => sim.loadSnapshot({ ...snapshot, schemaVersion: 999 as typeof SAVE_SCHEMA_VERSION })).toThrow();
    expect(() => sim.loadSnapshot({ ...snapshot, campaignId: "campaign-2" })).toThrow();
  });

  it.each([null, 42, {}, { schemaVersion: SAVE_SCHEMA_VERSION }, { schemaVersion: SAVE_SCHEMA_VERSION, savedAt: "now", campaignId: CAMPAIGN_1.id, state: { mode: "orbiting" } }])(
    "rejects malformed snapshot %j", (value) => expect(isValidSnapshot(value)).toBe(false),
  );
});
