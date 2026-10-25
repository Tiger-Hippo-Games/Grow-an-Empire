import { describe, expect, it } from "vitest";
import { effectiveCounts, playerStrength, resolveBattle, watchtowerVolley } from "../battle";
import { CAMPAIGNS } from "../campaigns";
import { BUILDINGS, nextBuildingOffer } from "../content";
import {
  baoliBonus, BURJ_MILITIA_STRENGTH, DHARMA_STAMBHA_BONUS, ELEPHANT_INTERVAL, KOSHAGAR_MAX_INTEREST, KOSHAGAR_SELLSWORD_CAP, PRAKARA_REDUCTION,
  SARAI_BUY_MULTIPLIER, SARAI_EXTRA_SALES, WAR_BUILDINGS,
} from "../economy";
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
  it("adds +2, then +3, then +4 to every food producer as it ages", () => {
    expect([1, 3, 4, 6, 7].map(baoliBonus)).toEqual([2, 2, 3, 3, 4]);
    const sim = cityWith({ farm: 5, "fruit-orchard": 5, "swine-farm": 5, baoli: 3 });
    sim.gather();
    const line = sim.state.lastSummary?.ledger?.find((entry) => entry.source === "baoli");
    // The Baoli is 4 moves old after this move's ageing: +3 each.
    expect(line?.made).toEqual({ grain: 3, fruit: 3, livestock: 3 });
  });

  it("waters only the producers that stand", () => {
    const sim = cityWith({ farm: 2, baoli: 0 });
    sim.gather();
    expect(sim.state.lastSummary?.ledger?.find((entry) => entry.source === "baoli")?.made).toEqual({ grain: 2 });
  });

  it("lets the Royal Kitchen run one more cycle a move", () => {
    const run = (baoli: boolean) => {
      const sim = cityWith(baoli ? { bakery: 1, baoli: 1 } : { bakery: 1 });
      sim.state.resources.grain = 20;
      sim.gather();
      return sim.state.lastSummary?.ledger?.find((entry) => entry.source === "bakery")?.made.rations ?? 0;
    };
    expect(run(true)).toBe(run(false) + 3);
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
    const outcome = resolveBattle({ archers: 0, swordsmen: 4, horsemen: 0, militia: 0, elephants: 2 }, { archers: 4, swordsmen: 0, horsemen: 0, veterancy: 1 });
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
    expect(playerStrength(army, enemy, { bonus: DHARMA_STAMBHA_BONUS })).toBeCloseTo(1.2 * playerStrength(army, enemy));
    const campaign = CAMPAIGNS[0];
    const sim = cityWith(Object.fromEntries([...WAR_BUILDINGS, "dharma-stambha"].map((id) => [id, 3])), campaign.moveLimit, campaign);
    sim.state.trainedUnits = { archers: 2, swordsmen: 2, horsemen: 0 };
    sim.state.mode = "muster";
    sim.muster();
    expect(sim.state.armyReport?.strengthBonus).toBe(DHARMA_STAMBHA_BONUS);
    expect(sim.state.armyReport?.explanations.join(" ")).toMatch(/Dharma Stambha made the army 20% stronger/);
  });
});

describe("Burj (bastion)", () => {
  it("drills the militia to full strength and raises the cap to 14", () => {
    const campaign = CAMPAIGNS[0];
    const plain = cityWith({ house: 6 }, campaign.moveLimit, campaign);
    const drilled = cityWith({ house: 6, burj: 3 }, campaign.moveLimit, campaign);
    expect(plain.militia).toBe(10);
    expect(drilled.militia).toBe(14);
    expect(drilled.battleSetup().mods.militiaStrength).toBe(BURJ_MILITIA_STRENGTH);
    const enemy = { archers: 2, swordsmen: 2, horsemen: 2, veterancy: 1 };
    const militia = { archers: 0, swordsmen: 0, horsemen: 0, militia: 10 };
    expect(playerStrength(militia, enemy, { militiaStrength: BURJ_MILITIA_STRENGTH })).toBeCloseTo(2 * playerStrength(militia, enemy));
    drilled.state.mode = "muster";
    drilled.muster();
    expect(drilled.state.armyReport?.militiaStrength).toBe(1);
    expect(drilled.state.armyReport?.explanations.join(" ")).toMatch(/Burj drilled the militia/);
  });
});

describe("Sarai (caravanserai)", () => {
  it("makes Bazaar swaps cheaper and sells one more good a move", () => {
    const setup = (sarai: boolean) => {
      const sim = cityWith(sarai ? { marketplace: 3, sarai: 1 } : { marketplace: 3 }, 6);
      for (const name of Object.keys(sim.state.resources) as Array<keyof typeof sim.state.resources>) sim.state.resources[name] = 0;
      Object.assign(sim.state.resources, { planks: 1, wood: 12, grain: 6 });
      sim.state.availableBuildingIds = ["winery"]; // 3 planks, 2 stone: unaffordable, so the move is stuck
      return sim;
    };
    const dear = setup(false).swapPlanFor("winery")!;
    const cheap = setup(true).swapPlanFor("winery")!;
    expect(dear.goldNeeded).toBe(2 * 2 * 2 + 2 * 0.5 * 2); // 2 planks + 2 stone at 2×
    expect(cheap.goldNeeded).toBeCloseTo(dear.goldNeeded * SARAI_BUY_MULTIPLIER / 2);
    const market = cityWith({ marketplace: 1, sarai: 1 }, 6);
    market.state.resources.wine = 5;
    market.gather();
    expect(market.state.lastSummary?.ledger?.find((entry) => entry.source === "marketplace")?.used.wine).toBe(1 + SARAI_EXTRA_SALES);
  });
});

describe("Koshagar (treasury)", () => {
  it("pays +1 gold per 5 stored (at most 6) and allows 2 more sellswords", () => {
    const sim = cityWith({ marketplace: 1, koshagar: 1 }, 6);
    sim.state.resources.gold = 23;
    sim.gather();
    expect(sim.state.lastSummary?.ledger?.find((entry) => entry.source === "koshagar")?.made.gold).toBe(4);
    const rich = cityWith({ marketplace: 1, koshagar: 1 }, 6);
    rich.state.resources.gold = 100;
    rich.gather();
    expect(rich.state.lastSummary?.ledger?.find((entry) => entry.source === "koshagar")?.made.gold).toBe(KOSHAGAR_MAX_INTEREST);
    const campaign = CAMPAIGNS[6];
    const half = Math.floor((campaign.objective.army.swordsmen + campaign.objective.army.archers + campaign.objective.army.horsemen) / 2);
    expect(cityWith({ marketplace: 1 }, 12, campaign).sellswordCap).toBe(half);
    expect(cityWith({ marketplace: 1, koshagar: 1 }, 12, campaign).sellswordCap).toBe(half + KOSHAGAR_SELLSWORD_CAP);
  });
});

describe("Dharmashala (rest house)", () => {
  it("adds 6 people on opening and 2 a move, 4 more militia, and every 4th soldier needs no villager", () => {
    const sim = new SettlementSimulation();
    Object.assign(sim.state, { move: 6, civicLevel: 5, population: 0, builtBuildingIds: ["house", "dharmashala"], availableBuildingIds: [], buildingMaturity: { house: 1, dharmashala: 0 } });
    sim.gather(); // civic level 6: 22 base, +4 for the House (2 moves), +6 for the Dharmashala (1 move)
    expect(sim.state.population).toBe(22 + 4 + 6);
    sim.gather();
    expect(sim.state.population).toBe(29 + 6 + 8);
    expect(sim.militiaCap).toBe(14);
    expect(cityWith({ burj: 1, dharmashala: 1 }).militiaCap).toBe(18);
    const city = cityWith({ house: 3, dharmashala: 2 });
    city.state.population = 20;
    city.state.trainedUnits = { archers: 8, swordsmen: 0, horsemen: 0 };
    expect(city.freeVillagers).toBe(20 - 2 - 6);
  });
});
