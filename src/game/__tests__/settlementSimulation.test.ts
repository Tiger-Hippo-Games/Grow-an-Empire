import { describe, expect, it } from "vitest";
import { CAMPAIGN_1, CAMPAIGNS } from "../campaigns";
import { BUILDINGS, CONSTRUCTION_DURATION_SECONDS, OPENING_BUILD_OPTIONS, TOTAL_MOVES } from "../content";
import { SELLSWORD_COST, STARTING_STOCKPILE, type ResourceName } from "../economy";
import { isValidSnapshot, SAVE_SCHEMA_VERSION, SettlementSimulation, type SimulationEvent } from "../settlementSimulation";
import { playMove, playToEnd, playToMuster } from "./play";

export const ARMY_ORDER = ["woodcutter", "quarry", "farm", "sawmill", "bakery", "weapons-workshop", "barracks", "blacksmith", "granary", "house", "marketplace"];

function build(sim: SettlementSimulation, id: string): SimulationEvent[] {
  const started = sim.chooseBuilding(id);
  expect(started, `could not start ${id}`).toHaveLength(1);
  return sim.update(CONSTRUCTION_DURATION_SECONDS);
}

function emptyAll(sim: SettlementSimulation): void {
  for (const name of Object.keys(sim.state.resources) as ResourceName[]) sim.state.resources[name] = 0;
}

describe("costs and construction", () => {
  it("starts with the documented stockpile and pays the build cost up front", () => {
    const sim = new SettlementSimulation();
    for (const [name, amount] of Object.entries(STARTING_STOCKPILE)) expect(sim.state.resources[name as ResourceName]).toBe(amount);
    const wood = sim.state.resources.wood;
    sim.chooseBuilding("quarry");
    expect(sim.state.resources.wood).toBe(wood - (BUILDINGS.quarry.cost.wood ?? 0));
  });

  it("can afford all three opening cards", () => {
    const sim = new SettlementSimulation();
    for (const id of OPENING_BUILD_OPTIONS) expect(sim.canAffordBuilding(id), id).toBe(true);
  });

  it("refuses an unaffordable card, one not on offer, or one with missing prerequisites", () => {
    const sim = new SettlementSimulation();
    expect(sim.chooseBuilding("barracks")).toEqual([]);
    sim.state.availableBuildingIds.push("bakery");
    expect(sim.chooseBuilding("bakery")).toEqual([]);
    sim.state.resources.wood = 0;
    expect(sim.chooseBuilding("woodcutter")).toEqual([]);
    expect(sim.state.mode).toBe("awaiting-choice");
  });

  it("does not complete until the construction deadline", () => {
    const sim = new SettlementSimulation();
    sim.chooseBuilding("farm");
    expect(sim.update(CONSTRUCTION_DURATION_SECONDS - 0.01)).toEqual([]);
    expect(sim.state.builtBuildingIds).toEqual([]);
    expect(sim.update(0.01).some((event) => event.type === "construction-complete")).toBe(true);
  });

  it("emits a completed move's events in a stable order", () => {
    const sim = new SettlementSimulation();
    sim.chooseBuilding("woodcutter");
    const types = sim.update(CONSTRUCTION_DURATION_SECONDS).map((event) => event.type);
    expect(types).toEqual(["construction-complete", "civic-upgraded", "economy-resolved", "population-changed", "move-summary", "choices-ready"]);
  });
});

describe("move economy", () => {
  it("produces only when a move completes", () => {
    const sim = new SettlementSimulation();
    const wood = sim.state.resources.wood - 2;
    build(sim, "woodcutter");
    expect(sim.state.resources.wood).toBe(wood + 5);
    sim.chooseBuilding("farm");
    sim.update(10);
    expect(sim.state.resources.wood).toBe(wood + 5 - 3);
  });

  it("turns wood into planks at the Sawmill", () => {
    const sim = new SettlementSimulation();
    for (const id of ["woodcutter", "quarry", "farm"]) build(sim, id);
    const events = build(sim, "sawmill");
    const summary = events.find((event) => event.type === "move-summary");
    expect(summary?.type === "move-summary" && summary.summary.produced.planks).toBe(6);
  });

  it("trains soldiers from materials and free villagers, and feeds them", () => {
    const sim = new SettlementSimulation();
    playToMuster(sim, ARMY_ORDER);
    const trained = sim.state.trainedUnits;
    expect(trained.archers + trained.swordsmen).toBeGreaterThan(4);
  });

  it("deserts unfed soldiers", () => {
    const sim = new SettlementSimulation();
    for (const id of ["woodcutter", "quarry", "farm", "sawmill", "weapons-workshop"]) build(sim, id);
    sim.state.trainedUnits.archers = 12;
    sim.state.resources.rations = 0;
    const events = build(sim, "barracks");
    expect(events.some((event) => event.type === "soldiers-deserted")).toBe(true);
    expect(sim.state.deserted).toBeGreaterThan(0);
    expect(sim.state.lastSummary?.warnings.some((text) => /deserted/.test(text))).toBe(true);
  });

  it("spoils grain above the cap without a Granary", () => {
    const sim = new SettlementSimulation();
    sim.state.resources.grain = 20;
    build(sim, "woodcutter");
    expect(sim.state.resources.grain).toBe(8);
  });
});

describe("stuck moves", () => {
  it("gathers when nothing is affordable and there is no Marketplace", () => {
    const sim = new SettlementSimulation();
    emptyAll(sim);
    expect(sim.isStuck()).toBe(true);
    expect(sim.canGather()).toBe(true);
    const move = sim.state.move;
    const events = sim.gather();
    expect(events[0]).toEqual({ type: "gathered", move });
    expect(sim.state.move).toBe(move + 1);
    expect(sim.state.gatherMoves).toBe(1);
    expect(sim.state.builtBuildingIds).toEqual([]);
  });

  it("refuses to gather while a card is affordable", () => {
    expect(new SettlementSimulation().gather()).toEqual([]);
  });

  it("swaps goods at twice the selling price when stuck with a Marketplace", () => {
    const sim = new SettlementSimulation();
    sim.state.builtBuildingIds.push("marketplace");
    emptyAll(sim);
    sim.state.resources.stone = 20;
    const plan = sim.swapPlanFor("woodcutter");
    expect(plan).not.toBeNull();
    expect(plan!.buy).toEqual({ wood: 2 });
    expect(plan!.goldNeeded).toBe(4);
    expect(plan!.sell).toEqual({ stone: 8 });
    expect(sim.canGather()).toBe(false);
    sim.swapAndBuild("woodcutter");
    expect(sim.state.mode).toBe("construction");
    expect(sim.state.resources.stone).toBe(12);
    expect(sim.state.resources.wood).toBe(0);
    expect(sim.state.swaps).toBe(1);
  });
});

describe("the muster and the battle", () => {
  it("stops at the muster after the final move, then fights once", () => {
    const sim = new SettlementSimulation();
    const events: string[] = [];
    for (let i = 0; i < 40 && sim.state.mode !== "muster"; i += 1) {
      if (sim.state.mode === "awaiting-choice") {
        const pick = sim.state.availableBuildingIds.find((id) => sim.canAffordBuilding(id));
        if (pick) events.push(...sim.chooseBuilding(pick).map((event) => event.type));
        else events.push(...sim.gather().map((event) => event.type));
      }
      events.push(...sim.update(CONSTRUCTION_DURATION_SECONDS).map((event) => event.type));
    }
    expect(sim.state.mode).toBe("muster");
    expect(sim.state.civicLevel).toBe(TOTAL_MOVES);
    expect(events.slice(-2)).toEqual(["move-summary", "muster-ready"]);
    expect(sim.muster().map((event) => event.type)).toEqual(["army-mustered", "game-complete"]);
    expect(sim.state.mode).toBe("complete");
    expect(sim.muster()).toEqual([]);
  });

  it("wins Campaign 1 with an army build", () => {
    const sim = new SettlementSimulation(CAMPAIGN_1);
    playToEnd(sim, ARMY_ORDER);
    expect(sim.state.armyReport?.win).toBe(true);
    expect(sim.state.armyReport?.stars).toBeGreaterThanOrEqual(1);
  });

  it("loses the final campaign with the same build and says what would have won", () => {
    const sim = new SettlementSimulation(CAMPAIGNS[24]);
    playToEnd(sim, ARMY_ORDER);
    const report = sim.state.armyReport!;
    expect(report.win).toBe(false);
    expect(report.stars).toBe(0);
    expect(report.gap).toMatch(/more .* would have won/);
    expect(report.rounds).toHaveLength(4);
    const last = report.rounds[3].player;
    expect(last.archers + last.swordsmen + last.horsemen + last.militia).toBe(0);
  });

  it("limits sellswords to half the enemy and to the gold available", () => {
    const sim = new SettlementSimulation(CAMPAIGNS[9]);
    playToMuster(sim, ARMY_ORDER);
    sim.state.builtBuildingIds.push(...(sim.hasMarketplace ? [] : ["marketplace"]));
    sim.state.resources.wine = 100;
    const cap = sim.sellswordCap;
    expect(cap).toBe(Math.floor(CAMPAIGNS[9].objective.strength / 2));
    expect(sim.canHire({ archers: cap + 1, swordsmen: 0 })).toBe(false);
    expect(sim.canHire({ archers: cap, swordsmen: 0 })).toBe(true);
    sim.state.resources.wine = 0;
    const affordable = Math.floor(sim.musterGold / SELLSWORD_COST);
    if (affordable < cap) expect(sim.canHire({ archers: affordable + 1, swordsmen: 0 })).toBe(false);
  });

  it("hires no sellswords without a Marketplace", () => {
    const sim = new SettlementSimulation();
    playToMuster(sim, ["woodcutter", "quarry", "farm", "sawmill", "bakery", "weapons-workshop"]);
    sim.state.builtBuildingIds = sim.state.builtBuildingIds.filter((id) => id !== "marketplace");
    expect(sim.sellswordCap).toBe(0);
    expect(sim.musterGold).toBe(0);
    expect(sim.canHire({ archers: 1, swordsmen: 0 })).toBe(false);
  });
});

describe("reset, summaries and saves", () => {
  it("resets to a fresh run", () => {
    const sim = new SettlementSimulation();
    playMove(sim);
    sim.reset();
    expect(sim.state.move).toBe(1);
    expect(sim.state.builtBuildingIds).toEqual([]);
    expect(sim.state.lastSummary).toBeNull();
  });

  it("keeps the last move summary for a reload", () => {
    const sim = new SettlementSimulation();
    build(sim, "woodcutter");
    expect(sim.state.lastSummary?.buildingId).toBe("woodcutter");
    expect(sim.state.lastSummary?.produced.wood).toBe(5);
  });

  it("round-trips a mid-construction state through JSON", () => {
    const sim = new SettlementSimulation();
    build(sim, "farm");
    sim.chooseBuilding("woodcutter");
    sim.update(12);
    const snapshot = JSON.parse(JSON.stringify(sim.serialize()));
    expect(snapshot.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    const copy = new SettlementSimulation();
    copy.loadSnapshot(snapshot);
    expect(copy.state).toEqual(sim.state);
  });

  it("round-trips a finished run with its report", () => {
    const sim = new SettlementSimulation();
    playToEnd(sim, ARMY_ORDER);
    const copy = new SettlementSimulation();
    copy.loadSnapshot(JSON.parse(JSON.stringify(sim.serialize())));
    expect(copy.state.armyReport).toEqual(sim.state.armyReport);
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
