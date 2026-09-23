import { describe, expect, it } from "vitest";
import { CAMPAIGN_1 } from "../campaigns";
import { CONSTRUCTION_DURATION_SECONDS, populationForLevel, TOTAL_MOVES } from "../content";
import { isValidSnapshot, SAVE_SCHEMA_VERSION, SettlementSimulation, type SettlementSnapshot } from "../settlementSimulation";
import { defenseStrategy } from "../combatRules";

function build(sim: SettlementSimulation, buildingId: string) {
  const started = sim.chooseBuilding(buildingId);
  expect(started).toHaveLength(1);
  return [...started, ...sim.update(CONSTRUCTION_DURATION_SECONDS)];
}

describe("building choices and construction", () => {
  it("accepts only an offered building while awaiting a choice", () => {
    const sim = new SettlementSimulation();
    expect(sim.chooseBuilding("barracks")).toEqual([]);
    expect(sim.chooseBuilding("woodcutter")[0]).toMatchObject({ type: "construction-started", buildingId: "woodcutter" });
    expect(sim.chooseBuilding("farm")).toEqual([]);
  });

  it("refuses a card whose prerequisites are not yet built", () => {
    const sim = new SettlementSimulation();
    sim.state.availableBuildingIds.push("barracks");
    expect(sim.chooseBuilding("barracks")).toEqual([]);
    expect(sim.state.mode).toBe("awaiting-choice");
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
    expect(sim.state.availableBuildingIds).toEqual(["woodcutter", "quarry", "swine-farm"]);
  });
});

describe("move economy", () => {
  it("adds two people for each civic level after a House is built", () => {
    const sim = new SettlementSimulation();
    const preference = ["woodcutter", "sawmill", "quarry", "house"];
    while (!sim.state.builtBuildingIds.includes("house")) {
      build(sim, preference.find((id) => sim.state.availableBuildingIds.includes(id)) ?? sim.state.availableBuildingIds[0]);
    }
    const level = sim.state.civicLevel;
    expect(sim.state.population).toBe(populationForLevel(level) + 2);
    build(sim, sim.state.availableBuildingIds[0]);
    expect(sim.state.population).toBe(populationForLevel(level + 1) + 4);
  });

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
    const sim = new SettlementSimulation();
    const preference = ["farm", "woodcutter", "sawmill", "quarry", "bakery"];
    while (!sim.state.builtBuildingIds.includes("bakery")) {
      build(sim, preference.find((id) => sim.state.availableBuildingIds.includes(id)) ?? sim.state.availableBuildingIds[0]);
    }
    expect(sim.state.resources.rations).toBeGreaterThanOrEqual(3);
    expect(sim.state.resources.grain).toBeGreaterThan(0);
  });

  it("matures early buildings across subsequent moves", () => {
    const sim = new SettlementSimulation();
    while (!sim.state.builtBuildingIds.includes("sawmill")) {
      const preference = ["woodcutter", "sawmill"];
      build(sim, preference.find((id) => sim.state.availableBuildingIds.includes(id)) ?? sim.state.availableBuildingIds[0]);
    }
    expect(sim.state.buildingMaturity.woodcutter).toBe(sim.state.builtBuildingIds.length - sim.state.builtBuildingIds.indexOf("woodcutter"));
    expect(sim.state.buildingMaturity.sawmill).toBe(1);
  });

  it("adds exactly one archer and swordsman per move once their workshops exist", () => {
    const sim = new SettlementSimulation();
    const preference = ["woodcutter", "sawmill", "quarry", "blacksmith", "weapons-workshop", "barracks"];
    let archers = 0;
    let swordsmen = 0;
    let horsemen = 0;
    while (sim.state.mode !== "complete") {
      const choice = preference.find((id) => sim.state.availableBuildingIds.includes(id)) ?? sim.state.availableBuildingIds[0];
      const events = build(sim, choice);
      if (sim.state.builtBuildingIds.includes("weapons-workshop")) archers += 1;
      if (sim.state.builtBuildingIds.includes("blacksmith")) swordsmen += 1;
      if (sim.state.builtBuildingIds.includes("stable")) horsemen += 2;
      expect(sim.state.trainedUnits).toEqual({ archers, swordsmen, horsemen });
      const trained = events.find((event) => event.type === "unit-trained");
      expect(Boolean(trained)).toBe(Boolean(archers || swordsmen));
    }
    expect(archers).toBeGreaterThan(0);
    expect(swordsmen).toBeGreaterThan(0);
    expect(sim.state.armyReport?.units.horsemen).toBe(horsemen);
    expect(sim.state.armyReport?.units.archers).toBe(archers + 1); // Final reserve recruit, separate from per-move training.
    expect(sim.state.armyReport?.units.swordsmen).toBe(swordsmen);
  });
});

describe("Campaign 1 finale", () => {
  function playPreferred(preference: string[]): SettlementSimulation {
    const sim = new SettlementSimulation();
    while (sim.state.mode !== "complete") {
      const choice = preference.find((id) => sim.state.availableBuildingIds.includes(id)) ?? sim.state.availableBuildingIds[0];
      build(sim, choice);
    }
    return sim;
  }

  it("ends after Move 12 and emits an Army Muster before game-complete", () => {
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

  it("can reach the swordsman, archer, and mixed defenses within twelve moves", () => {
    const paths = [
      { preference: ["woodcutter", "sawmill", "quarry", "farm", "bakery", "blacksmith", "house", "granary", "swine-farm", "butchery", "fruit-orchard", "winery", "marketplace", "barracks"], strategy: "swordsmen" },
      { preference: ["woodcutter", "sawmill", "quarry", "weapons-workshop", "farm", "house", "bakery", "granary", "swine-farm", "butchery", "fruit-orchard", "winery", "marketplace", "barracks"], strategy: "archers" },
      { preference: ["woodcutter", "sawmill", "quarry", "weapons-workshop", "blacksmith", "farm"], strategy: "mixed" },
    ] as const;
    for (const path of paths) {
      const sim = playPreferred([...path.preference]);
      expect(sim.state.builtBuildingIds, path.strategy).toHaveLength(12);
      expect(defenseStrategy(sim.state.armyReport!.units), `${path.strategy}: ${sim.state.builtBuildingIds.join(",")} / ${JSON.stringify(sim.state.armyReport!.units)}`).toBe(path.strategy);
      expect(sim.state.armyReport?.outcome, path.strategy).toBe("Victory");
    }
  });

  it("rewards a complete supply-and-arms chain with victory", () => {
    const sim = playPreferred(["house", "woodcutter", "sawmill", "farm", "bakery", "quarry", "blacksmith", "barracks", "weapons-workshop", "swine-farm", "butchery", "granary"]);
    expect(["Victory", "Decisive Victory", "Flourishing Victory"]).toContain(sim.state.armyReport?.outcome);
    expect(sim.state.armyReport?.enemyStrength).toBe(CAMPAIGN_1.objective.strength);
    expect(sim.state.armyReport?.supplyTurns).toBeGreaterThan(0);
    expect(sim.state.armyReport?.units.archers).toBeGreaterThan(0);
  });

  it("offers the Stable after both workshops and trains two horsemen per completed move", () => {
    const sim = new SettlementSimulation();
    const preference = ["woodcutter", "sawmill", "quarry", "blacksmith", "weapons-workshop", "stable"];
    let previous = 0;
    let stableBuilt = false;
    while (sim.state.mode !== "complete") {
      const choice = preference.find((id) => sim.state.availableBuildingIds.includes(id)) ?? sim.state.availableBuildingIds[0];
      if (choice === "stable") {
        expect(sim.state.builtBuildingIds).toEqual(expect.arrayContaining(["blacksmith", "weapons-workshop"]));
        stableBuilt = true;
      }
      build(sim, choice);
      expect(sim.state.trainedUnits.horsemen - previous).toBe(stableBuilt ? 2 : 0);
      previous = sim.state.trainedUnits.horsemen;
    }
    expect(stableBuilt).toBe(true);
    expect(sim.state.armyReport?.units.horsemen).toBe(previous);
    expect(previous).toBeGreaterThanOrEqual(6);
  });

  it("can reach the finale with no campaign supply turns", () => {
    const sim = playPreferred(["house", "woodcutter", "sawmill", "fruit-orchard", "winery", "quarry", "blacksmith", "barracks", "weapons-workshop", "marketplace", "swine-farm", "farm"]);
    expect(sim.state.armyReport?.supplyTurns).toBe(0);
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
