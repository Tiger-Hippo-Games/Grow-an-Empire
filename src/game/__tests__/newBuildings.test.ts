import { describe, expect, it } from "vitest";
import { effectiveCounts, playerStrength, resolveBattle, watchtowerVolley } from "../battle";
import { CAMPAIGNS } from "../campaigns";
import { BUILDINGS, nextBuildingOffer } from "../content";
import { baoliBonus, DHARMA_STAMBHA_BONUS, ELEPHANT_INTERVAL, PRAKARA_REDUCTION, WAR_BUILDINGS } from "../economy";
import { SettlementSimulation, type SettlementSnapshot } from "../settlementSimulation";

/** Puts a city on a given move with given buildings (each standing `age` moves), awaiting a choice. */
function cityWith(buildings: Record<string, number>, move = 5, campaign = CAMPAIGNS[0]): SettlementSimulation {
  const sim = new SettlementSimulation(campaign);
  Object.assign(sim.state, {
    move, civicLevel: move - 1, population: 40,
    builtBuildingIds: Object.keys(buildings), availableBuildingIds: [],
    buildingMaturity: { ...buildings },
  });
  return sim;
}

describe("Baoli (stepwell)", () => {
  it("adds +1, then +2, then +3 to every food producer as it ages", () => {
    expect([1, 3, 4, 6, 7].map(baoliBonus)).toEqual([1, 1, 2, 2, 3]);
    const sim = cityWith({ farm: 5, "fruit-orchard": 5, "swine-farm": 5, baoli: 3 });
    sim.gather();
    const line = sim.state.lastSummary?.ledger?.find((entry) => entry.source === "baoli");
    // The Baoli is 4 moves old after this move's ageing: +2 each.
    expect(line?.made).toEqual({ grain: 2, fruit: 2, livestock: 2 });
  });

  it("waters only the producers that stand", () => {
    const sim = cityWith({ farm: 2, baoli: 0 });
    sim.gather();
    expect(sim.state.lastSummary?.ledger?.find((entry) => entry.source === "baoli")?.made).toEqual({ grain: 1 });
  });
});

describe("Prakara (watchtower)", () => {
  it("fells a quarter of the enemy, spread across its kinds", () => {
    const enemy = { swordsmen: 8, archers: 9, horsemen: 8, veterancy: 1 };
    const { remaining, felled } = watchtowerVolley(enemy, PRAKARA_REDUCTION);
    expect(felled.swordsmen + felled.archers + felled.horsemen).toBe(6); // round(25 × 0.25)
    expect(remaining.swordsmen + remaining.archers + remaining.horsemen).toBe(19);
    expect(remaining.veterancy).toBe(1);
    for (const kind of ["swordsmen", "archers", "horsemen"] as const) expect(felled[kind]).toBeGreaterThanOrEqual(1);
  });

  it("is applied at the muster and explained in the report", () => {
    const campaign = CAMPAIGNS[6]; // swordsmen only
    const total = campaign.objective.army.swordsmen;
    const felled = Math.round(total * PRAKARA_REDUCTION);
    const sim = cityWith({ granary: 3, quarry: 6, prakara: 2 }, campaign.moveLimit, campaign);
    sim.state.mode = "muster";
    sim.muster();
    const report = sim.state.armyReport!;
    expect(report.felled?.swordsmen).toBe(felled);
    expect(report.enemy.swordsmen).toBe(total - felled);
    expect(report.enemyCount).toBe(total - felled);
    expect(report.explanations.join(" ")).toMatch(new RegExp(`Prakara's archers felled ${felled}`));
  });
});

describe("Gajashala (war elephants)", () => {
  it("sends an elephant on completion and then every 6 moves", () => {
    const sim = new SettlementSimulation();
    Object.assign(sim.state, {
      move: 4, civicLevel: 3, population: 30,
      builtBuildingIds: ["barracks"], availableBuildingIds: ["gajashala"], buildingMaturity: { barracks: 2 },
      resources: { ...sim.state.resources, planks: 20, stone: 20, grain: 20, rations: 40 },
    });
    sim.chooseBuilding("gajashala");
    const events = sim.update(1e9);
    expect(sim.elephants).toBe(1);
    expect(events.some((event) => event.type === "unit-trained" && event.newElephants === 1)).toBe(true);
    expect(sim.state.lastSummary?.elephants).toBe(1);
    for (let move = 0; move < ELEPHANT_INTERVAL - 1; move += 1) sim.gather();
    expect(sim.elephants).toBe(1);
    sim.gather();
    expect(sim.elephants).toBe(2);
  });

  it("eats two rations a move and fights like four swordsmen", () => {
    const sim = cityWith({ gajashala: 0 });
    sim.gather();
    expect(sim.upkeep).toBe(2);
    expect(effectiveCounts({ archers: 0, swordsmen: 1, horsemen: 0, elephants: 2 }).swordsmen).toBe(9);
    const enemy = { archers: 3, swordsmen: 3, horsemen: 3, veterancy: 1 };
    expect(playerStrength({ archers: 0, swordsmen: 0, horsemen: 0, militia: 0, elephants: 1 }, enemy))
      .toBeCloseTo(4 * playerStrength({ archers: 0, swordsmen: 1, horsemen: 0, militia: 0 }, enemy));
  });

  it("keeps elephants in the battle rounds until the end", () => {
    const outcome = resolveBattle({ archers: 0, swordsmen: 4, horsemen: 0, militia: 0, elephants: 2 }, { archers: 4, swordsmen: 0, horsemen: 0, veterancy: 1 }, { two: 0.5, three: 1 });
    expect(outcome.win).toBe(true);
    expect(outcome.rounds[0].player.elephants).toBe(2);
    expect(outcome.rounds.at(-1)!.player.elephants).toBeGreaterThan(0);
  });

  it("loads a save from before 0.10.4 with no elephants", () => {
    const sim = new SettlementSimulation();
    const snapshot = JSON.parse(JSON.stringify(sim.serialize())) as SettlementSnapshot;
    delete (snapshot.state as { elephants?: number }).elephants;
    const loaded = new SettlementSimulation();
    loaded.loadSnapshot(snapshot);
    expect(loaded.elephants).toBe(0);
  });
});

describe("Dharma Stambha", () => {
  it("is offered only once every war building stands, ahead of everything else", () => {
    const war = [...WAR_BUILDINGS];
    expect(BUILDINGS["dharma-stambha"].requiresAll).toEqual(war);
    expect(BUILDINGS["dharma-stambha"].requiresAll).not.toContain("prakara");
    const base = ["woodcutter", "farm", "quarry", "sawmill"];
    expect(nextBuildingOffer([...base, ...war.slice(0, 4)], [], 9, "stable")).not.toBe("dharma-stambha");
    expect(nextBuildingOffer([...base, ...war], [], 9, "gajashala")).toBe("dharma-stambha");
  });

  it("makes the army 20% stronger in the battle", () => {
    const enemy = { archers: 5, swordsmen: 5, horsemen: 5, veterancy: 1 };
    const army = { archers: 5, swordsmen: 5, horsemen: 2, militia: 3 };
    expect(playerStrength(army, enemy, DHARMA_STAMBHA_BONUS)).toBeCloseTo(1.2 * playerStrength(army, enemy));
    const campaign = CAMPAIGNS[0];
    const sim = cityWith(Object.fromEntries([...WAR_BUILDINGS, "dharma-stambha"].map((id) => [id, 3])), campaign.moveLimit, campaign);
    sim.state.trainedUnits = { archers: 2, swordsmen: 2, horsemen: 0 };
    sim.state.mode = "muster";
    sim.muster();
    expect(sim.state.armyReport?.strengthBonus).toBe(DHARMA_STAMBHA_BONUS);
    expect(sim.state.armyReport?.explanations.join(" ")).toMatch(/Dharma Stambha made the army 20% stronger/);
  });
});
