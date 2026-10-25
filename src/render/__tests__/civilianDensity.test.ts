import { describe, expect, it } from "vitest";
import { Scene, Texture } from "three";
import { BUILDINGS } from "../../game/content";
import { createVillagerField } from "../villagers";

function fixture() {
  const scene = new Scene(), texture = new Texture();
  const characters = { load: async () => undefined, ensureRole: async () => undefined, getFrame: () => texture, getWalkFrame: () => texture, getWorkFrame: () => null };
  const field = createVillagerField(scene, characters);
  const workers = () => scene.children.filter(o => typeof o.userData.citizenId === "number" && o.visible);
  const soldiers = () => scene.children.filter(o => o.userData.armyRole && o.visible);
  return { field, workers, soldiers };
}

describe("one civilian per completed building", () => {
  it("creates none before construction, one for each completed site, and no extra supply/trade actors", () => {
    const { field, workers } = fixture();
    field.renderVillagers(0, []); expect(workers()).toHaveLength(0);
    const built = Object.keys(BUILDINGS);
    for (let frame = 0; frame < 60; frame++) field.renderVillagers(frame / 30, built);
    expect(workers()).toHaveLength(built.length);
    expect(workers().map(o => o.userData.buildingId).sort()).toEqual([...built].sort());
    field.renderVillagers(3, [...built, "farm"]);
    expect(workers()).toHaveLength(built.length);
  });
  it("keeps workers unique after growth, restart and combat visibility changes", () => {
    const { field, workers } = fixture();
    field.renderVillagers(0, ["farm", "bakery"]);
    field.renderVillagers(1, ["farm", "bakery", "granary"]);
    expect(workers()).toHaveLength(3);
    field.clearArmyMuster(); field.syncVillagers(["house"]); field.renderVillagers(2, ["house"]);
    expect(workers().map(o => o.userData.buildingId)).toEqual(["house"]);
    field.setCombatActive(true); expect(workers()).toHaveLength(0);
    field.setCombatActive(false); expect(workers()).toHaveLength(1);
  });
  it("uses the focused woodcutter as that building's sole visible worker", () => {
    const { field, workers } = fixture();
    const built = ["woodcutter", "sawmill"];
    field.renderVillagers(0, built, 0, "woodcutter");
    expect(workers().map(o => o.userData.buildingId)).toEqual(["sawmill"]);
    field.renderVillagers(1, built, 1, "farm"); // one crew at an unfinished new site
    expect(workers().map(o => o.userData.buildingId).sort()).toEqual([...built].sort());
  });
  it("preserves the full existing garrison representation independently of civilian density", () => {
    const { field, workers, soldiers } = fixture();
    field.syncGarrison({ swordsmen: 14, archers: 14, horsemen: 14 });
    field.renderVillagers(0, ["barracks", "stable"]);
    expect(workers()).toHaveLength(2);
    expect(soldiers()).toHaveLength(42);
    field.renderVillagers(1, []);
    expect(workers()).toHaveLength(0);
    expect(soldiers()).toHaveLength(42);
  });
});
