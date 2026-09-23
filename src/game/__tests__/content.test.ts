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
    expect(OPENING_BUILD_OPTIONS).toEqual(["woodcutter", "farm", "quarry"]);
  });

  it("names exactly one civic level label per settlement level", () => {
    expect(CIVIC_LEVEL_NAMES).toHaveLength(TOTAL_SETTLEMENT_LEVELS);
  });
});

describe("isBuildingEligible", () => {
  it("applies the exact settlement building dependencies", () => {
    const required: Record<string, string[]> = {
      woodcutter: [], farm: [], quarry: [], sawmill: ["woodcutter"],
      "fruit-orchard": ["farm"], "swine-farm": ["farm"],
      house: ["sawmill", "quarry"], "weapons-workshop": ["sawmill", "quarry"],
      blacksmith: ["sawmill", "quarry"], barracks: ["sawmill", "quarry"],
      granary: ["farm", "sawmill", "quarry"], winery: ["farm", "sawmill", "quarry"],
      bakery: ["farm", "sawmill", "quarry"], butchery: ["swine-farm", "sawmill"],
      marketplace: ["farm", "butchery"],
    };
    expect(Object.keys(required).sort()).toEqual(Object.keys(BUILDINGS).sort());
    for (const [id, dependencies] of Object.entries(required)) {
      expect(BUILDINGS[id].requiresAll ?? [], id).toEqual(dependencies);
      expect(BUILDINGS[id].requiresAny ?? [], id).toEqual([]);
      expect(isBuildingEligible(BUILDINGS[id], dependencies, 12), id).toBe(true);
      for (const missing of dependencies) {
        expect(isBuildingEligible(BUILDINGS[id], dependencies.filter((item) => item !== missing), 12), `${id} without ${missing}`).toBe(false);
      }
    }
  });
});

describe("nextBuildingOffer", () => {
  it("offers dependent buildings when their final prerequisite is completed", () => {
    expect(nextBuildingOffer(["woodcutter"], ["farm", "quarry"], 2, "woodcutter")).toBe("sawmill");
    expect(nextBuildingOffer(["farm"], ["woodcutter", "quarry"], 2, "farm")).toBe("swine-farm");
    expect(nextBuildingOffer(["woodcutter", "sawmill", "quarry"], ["farm", "swine-farm"], 4, "quarry")).toBe("weapons-workshop");
  });

  it("never re-offers a built or already-available building", () => {
    const offer = nextBuildingOffer(
      ["woodcutter", "farm", "sawmill", "swine-farm"],
      ["quarry", "fruit-orchard"],
      5,
      "swine-farm",
    );
    expect(offer).not.toBe("quarry");
    expect(offer).not.toBe("fruit-orchard");
    expect(offer).toBe("butchery");
  });

  it("falls back to earliest offerMove then lowest offerPriority when nothing depends on the last build", () => {
    const offer = nextBuildingOffer(["woodcutter", "sawmill", "quarry", "house"], ["farm"], 5, "house");
    expect(offer).toBe("weapons-workshop");
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
