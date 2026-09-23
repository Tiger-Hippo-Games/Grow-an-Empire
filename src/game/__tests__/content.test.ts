import { describe, expect, it } from "vitest";
import {
  BUILDINGS,
  isBuildingEligible,
  nextBuildingOffer,
  OPENING_BUILD_OPTIONS,
  populationForLevel,
  TOTAL_MOVES,
  TOTAL_SETTLEMENT_LEVELS,
  CIVIC_LEVEL_NAMES,
} from "../content";

describe("building catalog integrity", () => {
  it("gives every building an id matching its own catalog key", () => {
    for (const [key, definition] of Object.entries(BUILDINGS)) {
      expect(definition.id).toBe(key);
    }
  });

  it("only references prerequisite ids that exist in the catalog", () => {
    for (const definition of Object.values(BUILDINGS)) {
      for (const id of [...(definition.requiresAll ?? []), ...(definition.requiresAny ?? [])]) {
        expect(BUILDINGS[id], `${definition.id} requires unknown building "${id}"`).toBeDefined();
      }
    }
  });

  it("never lets a building require itself, directly or via requiresAny", () => {
    for (const definition of Object.values(BUILDINGS)) {
      expect(definition.requiresAll ?? []).not.toContain(definition.id);
      expect(definition.requiresAny ?? []).not.toContain(definition.id);
    }
  });

  it("gives every building a unique offerPriority (the deterministic tie-break)", () => {
    const priorities = Object.values(BUILDINGS).map((b) => b.offerPriority);
    expect(new Set(priorities).size).toBe(priorities.length);
  });

  it("keeps every offerMove within the twelve-move run", () => {
    for (const definition of Object.values(BUILDINGS)) {
      expect(definition.offerMove).toBeGreaterThanOrEqual(1);
      expect(definition.offerMove).toBeLessThanOrEqual(TOTAL_MOVES);
    }
  });

  it("matches the documented opening three-card offer", () => {
    expect(OPENING_BUILD_OPTIONS).toEqual(["woodcutter", "farm", "house"]);
  });

  it("names exactly one civic level label per settlement level", () => {
    expect(CIVIC_LEVEL_NAMES).toHaveLength(TOTAL_SETTLEMENT_LEVELS);
  });
});

describe("isBuildingEligible", () => {
  it("rejects a building before its offerMove", () => {
    expect(isBuildingEligible(BUILDINGS["weapons-workshop"], ["blacksmith"], 4)).toBe(false);
    expect(isBuildingEligible(BUILDINGS["weapons-workshop"], ["blacksmith"], 5)).toBe(true);
    expect(isBuildingEligible(BUILDINGS.barracks, [], 5)).toBe(false);
    expect(isBuildingEligible(BUILDINGS.barracks, ["blacksmith"], 5)).toBe(true);
    expect(isBuildingEligible(BUILDINGS.barracks, ["weapons-workshop"], 5)).toBe(true);
  });

  it("enforces requiresAll (every dependency must be built)", () => {
    expect(isBuildingEligible(BUILDINGS.bakery, [], 4)).toBe(false);
    expect(isBuildingEligible(BUILDINGS.bakery, ["farm"], 4)).toBe(true);
  });

  it("enforces requiresAny (at least one dependency must be built)", () => {
    expect(isBuildingEligible(BUILDINGS.granary, [], 4)).toBe(false);
    expect(isBuildingEligible(BUILDINGS.granary, ["farm"], 4)).toBe(true);
    expect(isBuildingEligible(BUILDINGS.granary, ["fruit-orchard"], 4)).toBe(true);
  });

  it("has no requirement at all for opening buildings", () => {
    expect(isBuildingEligible(BUILDINGS.woodcutter, [], 1)).toBe(true);
  });
});

describe("nextBuildingOffer", () => {
  it("offers Barracks immediately after completing Blacksmith", () => {
    const built = ["quarry", "blacksmith"];
    expect(nextBuildingOffer(built, ["farm", "marketplace"], 5, "blacksmith")).toBe("barracks");
  });

  it("prioritizes a building that directly follows from the one just completed", () => {
    // Farm unlocks Bakery and Granary; Quarry is unrelated but has an earlier offerMove.
    const offer = nextBuildingOffer(["farm"], ["woodcutter", "swine-farm"], 2, "farm");
    expect(offer).toBe("bakery");
  });

  it("never re-offers a built or already-available building", () => {
    const offer = nextBuildingOffer(
      ["woodcutter", "farm", "swine-farm"],
      ["bakery", "sawmill"],
      2,
      "swine-farm",
    );
    expect(offer).not.toBe("bakery");
    expect(offer).not.toBe("sawmill");
    expect(offer).toBe("butchery");
  });

  it("falls back to earliest offerMove then lowest offerPriority when nothing depends on the last build", () => {
    // Nothing depends directly on House. Of the buildings not yet built or
    // offered, Bakery and Butchery are also eligible (Sawmill is excluded
    // because it's already in the current pool); Bakery wins on offerMove.
    const offer = nextBuildingOffer(["woodcutter", "farm", "swine-farm", "house"], ["sawmill"], 4, "house");
    expect(offer).toBe("bakery");
  });

  it("returns undefined when every eligible building is already built or offered", () => {
    const allIds = Object.keys(BUILDINGS);
    expect(nextBuildingOffer(allIds, [], 8, allIds[0])).toBeUndefined();
  });
});

describe("populationForLevel", () => {
  it("matches the documented 1, 2, 4, 7, 11, 16, 22, 29, 37 curve", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map(populationForLevel)).toEqual([1, 2, 4, 7, 11, 16, 22, 29, 37]);
  });
});
