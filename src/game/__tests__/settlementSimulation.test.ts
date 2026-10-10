import { describe, expect, it } from "vitest";
import { CAMPAIGN_1, CAMPAIGNS } from "../campaigns";
import { BUILDINGS, CONSTRUCTION_DURATION_SECONDS, OPENING_BUILD_OPTIONS, TOTAL_MOVES } from "../content";
import { MINIMUM_MOVE_STOCKPILE, SELLSWORD_COST, STARTING_STOCKPILE, type ResourceName } from "../economy";
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
  it("can build a Granary immediately after the opening Farm and keeps surplus grain", () => {
    const sim = new SettlementSimulation();
    build(sim, "farm");
    expect(sim.state.availableBuildingIds).toContain("granary");
    expect(sim.canAffordBuilding("granary")).toBe(true);
    expect(sim.costOf("granary")).toEqual({ wood: 4, stone: 2 });
    build(sim, "granary");
    expect(sim.state.resources.grain).toBeGreaterThan(8);
    expect(sim.state.lastSummary?.warnings.join(" ")).not.toMatch(/spoiled/);
  });

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

  it("turns wood into planks at the Carpenter's Yard", () => {
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

  it("retains unfed soldiers and pauses training instead of deserting", () => {
    const sim = new SettlementSimulation();
    for (const id of ["woodcutter", "quarry", "farm", "sawmill", "weapons-workshop"]) build(sim, id);
    sim.state.trainedUnits.archers = 12;
    sim.state.resources.rations = 0;
    const population = sim.state.population;
    const events = build(sim, "barracks");
    expect(events.some((event) => (event.type as string) === "soldiers-deserted")).toBe(false); // The event no longer exists.
    expect(sim.state.deserted).toBe(0);
    expect(sim.state.trainedUnits.archers).toBe(12);
    expect(sim.state.population).toBeGreaterThanOrEqual(population);
    expect(sim.state.lastSummary?.trained.archers).toBe(0);
    expect(sim.state.lastSummary?.warnings.some((text) => /existing soldiers stay/.test(text))).toBe(true);
  });

  it("restores basic supplies after Gather with no producers and credits the ledger", () => {
    const sim = new SettlementSimulation();
    emptyAll(sim);
    sim.gather();
    for (const [name, minimum] of Object.entries(MINIMUM_MOVE_STOCKPILE)) expect(sim.state.resources[name as ResourceName]).toBe(minimum);
    const camp = sim.state.lastSummary?.ledger?.find(entry => entry.source === "camp");
    expect(camp?.made).toEqual(MINIMUM_MOVE_STOCKPILE);
    expect(sim.state.lastSummary?.produced).toEqual(MINIMUM_MOVE_STOCKPILE);
  });

  it("can pay for the Granary after a processor-heavy move", () => {
    const sim = new SettlementSimulation();
    for (const id of ["woodcutter", "farm", "quarry", "sawmill"]) build(sim, id);
    sim.state.resources.wood = 0;
    sim.state.resources.stone = 0;
    sim.gather();
    expect(sim.canAffordBuilding("granary")).toBe(true);
    expect(sim.state.availableBuildingIds).toContain("granary");
    expect(sim.chooseBuilding("granary")[0]?.type).toBe("construction-started");
  });

  it("spoils grain above the cap without a Granary", () => {
    const sim = new SettlementSimulation();
    sim.state.resources.grain = 20;
    build(sim, "woodcutter");
    expect(sim.state.resources.grain).toBe(8);
  });
});

describe("stuck moves", () => {
  it("gathers when nothing is affordable and there is no Bazaar", () => {
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

  it("gathers strategically while cards are affordable and keeps the offers", () => {
    const sim = new SettlementSimulation();
    const cards = [...sim.state.availableBuildingIds];
    const resources = { ...sim.state.resources };
    expect(cards.some(id => sim.canAffordBuilding(id))).toBe(true);
    expect(sim.gather()[0]).toEqual({ type: "gathered", move: 1 });
    expect(sim.state.move).toBe(2);
    expect(sim.state.availableBuildingIds).toEqual(cards);
    expect(sim.state.resources).toEqual(resources);
    expect(sim.state.builtBuildingIds).toEqual([]);
    expect(sim.state.lastSummary?.buildingId).toBeNull();
  });

  it("rejects Gather during construction, muster and after battle", () => {
    const sim = new SettlementSimulation();
    sim.chooseBuilding("woodcutter");
    expect(sim.canGather()).toBe(false);
    expect(sim.gather()).toEqual([]);
    sim.update(1e9);
    while (sim.state.mode === "awaiting-choice") sim.gather();
    expect(sim.state.mode).toBe("muster");
    expect(sim.gather()).toEqual([]);
    sim.muster();
    expect(sim.gather()).toEqual([]);
  });

  it("can gather instead of a Bazaar swap, without spending or replacing the offered cards", () => {
    const sim = new SettlementSimulation();
    sim.state.builtBuildingIds.push("marketplace", "woodcutter");
    emptyAll(sim);
    sim.state.resources.stone = 20;
    const cards = [...sim.state.availableBuildingIds];
    expect(sim.swapPlanFor("farm")).not.toBeNull();
    expect(sim.gather()[0].type).toBe("gathered");
    expect(sim.state.resources.wood).toBeGreaterThan(0);
    expect(sim.state.availableBuildingIds).toEqual(cards);
    expect(sim.state.swaps).toBe(0);
    expect(sim.state.move).toBe(2);
    expect(sim.canGather()).toBe(true);
  });

  it("swaps goods at twice the selling price when stuck with a Bazaar", () => {
    const sim = new SettlementSimulation();
    sim.state.builtBuildingIds.push("marketplace");
    emptyAll(sim);
    sim.state.resources.stone = 20;
    const plan = sim.swapPlanFor("woodcutter");
    expect(plan).not.toBeNull();
    expect(plan!.buy).toEqual({ wood: 2 });
    expect(plan!.goldNeeded).toBe(4);
    expect(plan!.sell).toEqual({ stone: 8 });
    expect(sim.canGather()).toBe(true);
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

  it("hires no sellswords without a Bazaar", () => {
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

describe("the move report ledger", () => {
  it("accounts for every good the move made and used, per building", async () => {
    const { SettlementSimulation } = await import("../settlementSimulation");
    const sim = new SettlementSimulation();
    for (let move = 0; move < 8 && sim.state.mode === "awaiting-choice"; move += 1) {
      const id = sim.state.availableBuildingIds.find((option) => sim.canAffordBuilding(option));
      if (id) sim.chooseBuilding(id); else sim.gather();
      sim.update(1e9);
      const summary = sim.state.lastSummary!;
      const ledger = summary.ledger!;
      expect(ledger.length).toBeGreaterThan(0);
      const total = (key: "used" | "made"): Record<string, number> => {
        const sum: Record<string, number> = {};
        for (const entry of ledger) for (const [name, amount] of Object.entries(entry[key])) sum[name] = (sum[name] ?? 0) + (amount as number);
        return sum;
      };
      expect(total("made")).toEqual(summary.produced);
      expect(total("used")).toEqual(summary.consumed);
      // before + made − used = after, for every good.
      for (const name of Object.keys(sim.state.resources)) {
        const before = summary.before?.[name as keyof typeof summary.before] ?? 0;
        expect(before + (summary.produced[name as keyof typeof summary.produced] ?? 0) - (summary.consumed[name as keyof typeof summary.consumed] ?? 0), name)
          .toBeCloseTo(sim.state.resources[name as keyof typeof sim.state.resources]);
      }
    }
  });
});
