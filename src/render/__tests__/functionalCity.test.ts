import { describe, expect, it } from "vitest";
import { BUILDINGS } from "../../game/content";
import { civicGround, getBuildingPosition, getRoadRoute, getServiceRoute, getVisibleRoadSegments } from "../cityLayout";
import { buildFunctionalRoutes } from "../villagers";
import { CHARACTER_FILES, directionFromVector, roleForBuilding, walkAtlasIndex, walkSheetFilename, workSheetFilename } from "../characterAssets";

describe("functional city routes", () => {
  it("places every building at its reserved anchor in the 1920 × 1080 plan", () => {
    const anchors: Record<string, [number, number]> = {
      farm: [220, 300], granary: [410, 300], baoli: [330, 480], bakery: [545, 465],
      "fruit-orchard": [190, 640], winery: [410, 660], "swine-farm": [200, 830], butchery: [420, 850],
      house: [690, 620], dharmashala: [720, 330], koshagar: [1000, 270], "dharma-stambha": [960, 720], marketplace: [1200, 640],
      woodcutter: [1650, 290], sawmill: [1440, 300], sarai: [1420, 490],
      quarry: [1660, 600], blacksmith: [1460, 700], "weapons-workshop": [1700, 830],
      burj: [500, 1000], prakara: [700, 920], barracks: [1300, 900], stable: [1500, 990], gajashala: [1740, 1010],
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

  it("keeps every quarter logical: fields by water, war on the southern frontier, plots apart", () => {
    const plan = (id: string) => { const p = getBuildingPosition(id); return { x: p.x * 27 + 960, y: 540 - p.y * 27 }; };
    const gap = (a: string, b: string) => Math.hypot(plan(a).x - plan(b).x, plan(a).y - plan(b).y);
    // The Baoli waters the Farm, Mango Grove and Goshala, so it sits among them.
    for (const watered of ["farm", "fruit-orchard", "swine-farm"]) expect(gap("baoli", watered)).toBeLessThan(400);
    // Processors stand beside their producers.
    expect(gap("granary", "farm")).toBeLessThan(220);
    expect(gap("winery", "fruit-orchard")).toBeLessThan(240);
    expect(gap("butchery", "swine-farm")).toBeLessThan(240);
    expect(gap("sawmill", "woodcutter")).toBeLessThan(240);
    expect(gap("blacksmith", "quarry")).toBeLessThan(240);
    // Trade and treasury stay with the Bazaar; the Dharmashala with the House.
    expect(gap("sarai", "marketplace")).toBeLessThan(300);
    expect(gap("koshagar", "marketplace")).toBeLessThan(450);
    expect(gap("dharmashala", "house")).toBeLessThan(300);
    // Every war-quarter building faces the enemy road south of the Town Hall.
    const hallY = 540 - civicGround.y * 27;
    for (const id of ["prakara", "burj", "barracks", "stable", "gajashala"]) expect(plan(id).y).toBeGreaterThan(hallY + 300);
    // No two plots crowd each other.
    const ids = Object.keys(BUILDINGS);
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) expect(gap(ids[i], ids[j]), `${ids[i]} / ${ids[j]}`).toBeGreaterThan(165);
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

  it("selects the three polished 64-frame walks and retains the specialist/action sheets", () => {
    expect(Object.keys(CHARACTER_FILES)).toHaveLength(14);
    for (const role of Object.keys(CHARACTER_FILES) as Array<keyof typeof CHARACTER_FILES>) {
      const poses = ["builder", "farmer", "woodcutter"].includes(role) ? 64 : 32;
      expect(walkSheetFilename(role)).toBe(`${role}-walk${poses}-master-v1.png`);
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

});
