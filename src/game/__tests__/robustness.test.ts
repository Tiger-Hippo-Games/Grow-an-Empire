import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CAMPAIGN_1, type CampaignDefinition } from "../campaigns";
import { CONSTRUCTION_DURATION_SECONDS, nextBuildingOffer } from "../content";
import { clearSavedSnapshot, loadSavedSnapshot, saveSnapshot } from "../saveGame";
import { describeSnapshotProblem, SettlementSimulation, type SettlementSnapshot } from "../settlementSimulation";

/**
 * Error-handling and edge-case coverage added in the 2026-09-23 review:
 * saves that parse but would crash the renderer, old saves missing fields,
 * and campaigns that restrict the building pool.
 */

function midConstructionSnapshot(): SettlementSnapshot {
  const sim = new SettlementSimulation();
  sim.chooseBuilding("farm");
  sim.update(CONSTRUCTION_DURATION_SECONDS);
  sim.chooseBuilding("bakery");
  sim.update(5);
  return JSON.parse(JSON.stringify(sim.serialize()));
}

describe("snapshot validation beyond shape", () => {
  it("accepts a genuine mid-construction snapshot", () => {
    expect(describeSnapshotProblem(midConstructionSnapshot())).toBeNull();
  });

  it("rejects building ids that are not in the catalog (e.g. after a rename)", () => {
    const snapshot = midConstructionSnapshot();
    snapshot.state.builtBuildingIds = ["lumberyard"];
    expect(describeSnapshotProblem(snapshot)).toMatch(/builtBuildingIds/);
  });

  it("rejects a building built twice", () => {
    const snapshot = midConstructionSnapshot();
    snapshot.state.builtBuildingIds = ["farm", "farm"];
    expect(describeSnapshotProblem(snapshot)).toMatch(/duplicate/);
  });

  it("rejects construction mode with nothing selected", () => {
    const snapshot = midConstructionSnapshot();
    snapshot.state.selectedBuildingId = null;
    expect(describeSnapshotProblem(snapshot)).toMatch(/selected building/);
  });

  it("rejects a construction plot that doesn't follow the build order", () => {
    const snapshot = midConstructionSnapshot();
    snapshot.state.activePlotIndex = 5;
    expect(describeSnapshotProblem(snapshot)).toMatch(/activePlotIndex/);
  });

  it("rejects non-numeric resources", () => {
    const snapshot = midConstructionSnapshot();
    (snapshot.state.resources as Record<string, unknown>).wood = "lots";
    expect(describeSnapshotProblem(snapshot)).toMatch(/resources/);
  });

  it("rejects an out-of-range civic level", () => {
    const snapshot = midConstructionSnapshot();
    snapshot.state.civicLevel = 12;
    expect(describeSnapshotProblem(snapshot)).toMatch(/civic level/);
  });
});

describe("loadSnapshot", () => {
  it("fills resource keys and fields that an older save lacks", () => {
    const snapshot = midConstructionSnapshot();
    const partialResources = { grain: snapshot.state.resources.grain } as SettlementSnapshot["state"]["resources"];
    const legacy = { ...snapshot, state: { ...snapshot.state, resources: partialResources } };
    delete (legacy.state as Partial<SettlementSnapshot["state"]>).armyReport;

    const sim = new SettlementSimulation();
    sim.loadSnapshot(legacy);
    expect(sim.state.resources.wood).toBe(0);
    expect(sim.state.resources.grain).toBe(snapshot.state.resources.grain);
    expect(sim.state.armyReport).toBeNull();
    // And the restored run still completes normally.
    const events = sim.update(CONSTRUCTION_DURATION_SECONDS);
    expect(events.some((event) => event.type === "construction-complete")).toBe(true);
  });

  it("leaves the current state untouched when a snapshot is rejected", () => {
    const sim = new SettlementSimulation();
    sim.chooseBuilding("woodcutter");
    const before = structuredClone(sim.state);
    const bad = midConstructionSnapshot();
    bad.state.builtBuildingIds = ["not-a-building"];
    expect(() => sim.loadSnapshot(bad)).toThrow(/builtBuildingIds/);
    expect(sim.state).toEqual(before);
  });
});

describe("campaign building whitelist", () => {
  it("skips a disallowed top-ranked building instead of offering nothing", () => {
    // On Move 3, right after a Woodcutter, the Sawmill is the top pick. Without it,
    // the next eligible building should be offered instead.
    const built = ["farm", "woodcutter"];
    const pool = ["swine-farm", "bakery"];
    expect(nextBuildingOffer(built, pool, 3, "woodcutter")).toBe("sawmill");
    const withoutSawmill = CAMPAIGN_1.availableBuildingIds.filter((id) => id !== "sawmill");
    const offer = nextBuildingOffer(built, pool, 3, "woodcutter", withoutSawmill);
    expect(offer).toBeDefined();
    expect(offer).not.toBe("sawmill");
  });

  it("keeps three cards on offer in a campaign that excludes a building", () => {
    // Before this fix, excluding the top pick dropped the card entirely (2 cards left).
    const restricted: CampaignDefinition = {
      ...CAMPAIGN_1,
      id: "test-no-sawmill",
      availableBuildingIds: CAMPAIGN_1.availableBuildingIds.filter((id) => id !== "sawmill"),
    };
    const sim = new SettlementSimulation(restricted);
    for (const id of ["farm", "woodcutter"]) {
      sim.chooseBuilding(id);
      sim.update(CONSTRUCTION_DURATION_SECONDS);
    }
    expect(sim.state.availableBuildingIds).toHaveLength(3);
    expect(sim.state.availableBuildingIds).not.toContain("sawmill");
  });
});

describe("autosave storage wrapper", () => {
  const store = new Map<string, string>();
  const fakeStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
  };

  beforeEach(() => {
    store.clear();
    vi.stubGlobal("window", { localStorage: fakeStorage });
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("round-trips a valid save", () => {
    const snapshot = midConstructionSnapshot();
    expect(saveSnapshot(snapshot)).toBe(true);
    expect(loadSavedSnapshot()).toEqual(snapshot);
  });

  it("deletes a corrupt save so it can't block every future visit", () => {
    store.set("grow-an-empire:save:v1", "{not json");
    expect(loadSavedSnapshot()).toBeNull();
    expect(store.size).toBe(0);
  });

  it("deletes a save that parses but references unknown buildings", () => {
    const snapshot = midConstructionSnapshot();
    snapshot.state.builtBuildingIds = ["lumberyard"];
    store.set("grow-an-empire:save:v1", JSON.stringify(snapshot));
    expect(loadSavedSnapshot()).toBeNull();
    expect(store.size).toBe(0);
  });

  it("degrades to no autosave when storage throws", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => { throw new Error("denied"); },
        setItem: () => { throw new Error("quota"); },
        removeItem: () => { throw new Error("denied"); },
      },
    });
    expect(loadSavedSnapshot()).toBeNull();
    expect(saveSnapshot(midConstructionSnapshot())).toBe(false);
    expect(() => clearSavedSnapshot()).not.toThrow();
  });
});
