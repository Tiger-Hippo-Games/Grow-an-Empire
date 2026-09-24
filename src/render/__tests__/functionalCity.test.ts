import { describe, expect, it } from "vitest";
import { BUILDINGS } from "../../game/content";
import { civicGround, getBuildingPosition, getRoadRoute, getServiceRoute, getVisibleRoadSegments } from "../cityLayout";
import { buildFunctionalRoutes } from "../villagers";
import { battleRoute } from "../combatScene";
import { CHARACTER_FILES, directionFromVector, roleForArmyUnitAtIndex, roleForBuilding, walkAtlasIndex, walkSheetFilename, workSheetFilename } from "../characterAssets";

describe("functional city routes", () => {
  it("places every building at its reserved anchor in the 1920 × 1080 plan", () => {
    const anchors: Record<string, [number, number]> = {
      marketplace: [1124, 580], house: [788, 587],
      woodcutter: [1639, 292], sawmill: [1466, 454],
      farm: [208, 294], bakery: [499, 476], granary: [398, 374],
      "fruit-orchard": [221, 609], winery: [424, 657],
      "swine-farm": [206, 767], butchery: [441, 820],
      quarry: [1634, 611], blacksmith: [1433, 657],
      "weapons-workshop": [1447, 797], barracks: [1693, 820],
      stable: [1240, 900],
    };
    const distinct = new Set<string>();
    expect(Object.keys(anchors).sort()).toEqual(Object.keys(BUILDINGS).sort());
    for (const [id, [x, y]] of Object.entries(anchors)) {
      const point = getBuildingPosition(id);
      expect(point.x * 27 + 960).toBeCloseTo(x);
      expect(540 - point.y * 27).toBeCloseTo(y);
      distinct.add(`${point.x},${point.y}`);
    }
    expect(distinct.size).toBe(Object.keys(anchors).length);
  });

  it("connects buildings in one district without detouring through the Town Hall", () => {
    const route = getRoadRoute("farm", "bakery");
    expect(route[0]).toEqual(getBuildingPosition("farm"));
    expect(route.at(-1)).toEqual(getBuildingPosition("bakery"));
    expect(route).not.toContainEqual(civicGround);
  });

  it("routes cross-district trade through the civic center", () => {
    expect(getRoadRoute("sawmill", "marketplace")).toContainEqual(civicGround);
  });

  it("adds a supply route only after both producer and processor exist", () => {
    expect(buildFunctionalRoutes(["farm"]).map((route) => route.id)).not.toContain("supply:farm:bakery");
    expect(buildFunctionalRoutes(["farm", "bakery"]).map((route) => route.id)).toContain("supply:farm:bakery");
  });

  it("gives every completed building a Town Hall service route", () => {
    const built = ["woodcutter", "sawmill", "farm", "bakery"];
    const ids = buildFunctionalRoutes(built).map((route) => route.id);
    for (const buildingId of built) expect(ids).toContain(`service:${buildingId}`);
  });

  it("assigns matching professions to farm, forge, quarry, and market routes", () => {
    const routes = buildFunctionalRoutes(["farm", "bakery", "quarry", "blacksmith", "marketplace"]);
    const profession = (id: string) => routes.find((route) => route.id === id)?.profession;
    expect(profession("service:farm")).toBe("farmer");
    expect(profession("service:bakery")).toBe("baker");
    expect(profession("service:blacksmith")).toBe("blacksmith");
    expect(profession("supply:quarry:blacksmith")).toBe("miner");
    expect(profession("trade:bakery")).toBe("merchant");
    for (const id of Object.keys(BUILDINGS)) {
      expect(CHARACTER_FILES[roleForBuilding(id)]).toMatch(/\.png$/);
      if (id !== "house") expect(roleForBuilding(id)).not.toBe("builder");
    }
  });

  it("maps each final army unit to its own artwork", () => {
    const units = { swordsmen: 1, archers: 1, horsemen: 1, spearmen: 1, militia: 1, mercenaries: 1 };
    expect([0, 1, 2, 3, 4, 5].map((index) => roleForArmyUnitAtIndex(units, index)))
      .toEqual(["swordsman", "horseman", "archer", "spearman", "militia", "horseman"]);
  });

  it("maps every character to 32 walk and eight action frames", () => {
    expect(Object.keys(CHARACTER_FILES)).toHaveLength(14);
    for (const role of Object.keys(CHARACTER_FILES) as Array<keyof typeof CHARACTER_FILES>) {
      expect(walkSheetFilename(role)).toBe(`${role}-walk32-master-v1.png`);
      expect(workSheetFilename(role)).toBe(`${role}-work8-master-v1.png`);
    }
  });

  it("chooses all eight walk directions from route vectors", () => {
    expect([[0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1]]
      .map(([x, y]) => directionFromVector(x, y))).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect([0, 1, 2, 3].map((pose) => walkAtlasIndex(3, pose))).toEqual([3, 11, 19, 27]);
  });

  it("keeps the first villager in the civic clearing before any path exists", () => {
    expect(getVisibleRoadSegments([])).toEqual([]);
    expect(buildFunctionalRoutes([])[0].points).toEqual([civicGround]);
  });

  it("routes the construction crew around every visible bend", () => {
    for (const id of Object.keys(BUILDINGS)) {
      const route = getServiceRoute(id);
      const visible = getVisibleRoadSegments([id]);
      expect(route[0]).toEqual(civicGround);
      expect(route.at(-1)).toEqual(getBuildingPosition(id));
      expect(route.length - 1).toBe(visible.length);
    }
    expect(getServiceRoute("woodcutter").length).toBeGreaterThan(3);
  });

  it("brings defenders south and raiders north in matching battle lanes", () => {
    for (let lane = 0; lane < 5; lane += 1) {
      const defender = battleRoute("swordsman", lane, -22);
      const raider = battleRoute("enemy", lane, -8);
      expect(defender.startX).toBe(defender.targetX);
      expect(raider.startX).toBe(raider.targetX);
      expect(defender.targetX).toBe(raider.targetX);
      expect(defender.targetY).toBeLessThan(defender.startY);
      expect(raider.targetY).toBeGreaterThan(raider.startY);
      expect(defender.targetY).toBeGreaterThan(raider.targetY);
    }
  });
});
