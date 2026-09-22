import { describe, expect, it } from "vitest";
import { civicGround, getBuildingPosition, getRoadRoute } from "../cityLayout";
import { buildFunctionalRoutes } from "../villagers";

describe("functional city routes", () => {
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
});
