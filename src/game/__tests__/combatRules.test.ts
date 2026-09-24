import { describe, expect, it } from "vitest";
import { defenseStrategy, ENEMY_SWORDSMEN } from "../combatRules";
import { CAMPAIGNS, campaignById } from "../campaigns";
import { CONSTRUCTION_DURATION_SECONDS } from "../content";
import { SettlementSimulation } from "../settlementSimulation";

describe("Campaign 1 defense against five raider swordsmen", () => {
  it("uses the four promised thresholds, including their exact boundaries", () => {
    expect(ENEMY_SWORDSMEN).toBe(5);
    expect(defenseStrategy({ swordsmen: 5, archers: 0, horsemen: 0 })).toBeNull();
    expect(defenseStrategy({ swordsmen: 6, archers: 0, horsemen: 0 })).toBe("swordsmen");
    expect(defenseStrategy({ swordsmen: 0, archers: 9, horsemen: 0 })).toBeNull();
    expect(defenseStrategy({ swordsmen: 0, archers: 10, horsemen: 0 })).toBe("archers");
    expect(defenseStrategy({ swordsmen: 0, archers: 0, horsemen: 5 })).toBeNull();
    expect(defenseStrategy({ swordsmen: 0, archers: 0, horsemen: 6 })).toBe("horsemen");
    expect(defenseStrategy({ swordsmen: 3, archers: 2, horsemen: 0 })).toBeNull();
    expect(defenseStrategy({ swordsmen: 2, archers: 3, horsemen: 0 })).toBeNull();
    expect(defenseStrategy({ swordsmen: 3, archers: 3, horsemen: 0 })).toBe("mixed");
  });
});

describe("campaign road", () => {
  it("has distinct playable stops with increasing threats", () => {
    expect(CAMPAIGNS.map((campaign) => campaign.objective.strength)).toEqual([5, 6, 7, 6]);
    expect(CAMPAIGNS.map((campaign) => campaign.moveLimit)).toEqual([12, 13, 14, 14]);
    expect(new Set(CAMPAIGNS.map((campaign) => campaign.id)).size).toBe(4);
    for (const campaign of CAMPAIGNS) expect(campaignById(campaign.id)).toBe(campaign);
  });

  it("runs each longer campaign through its final move", () => {
    for (const campaign of CAMPAIGNS) {
      const sim = new SettlementSimulation(campaign);
      while (sim.state.mode !== "complete") {
        expect(sim.state.availableBuildingIds.length, campaign.name).toBeGreaterThan(0);
        sim.chooseBuilding(sim.state.availableBuildingIds[0]);
        sim.update(CONSTRUCTION_DURATION_SECONDS);
      }
      expect(sim.state.civicLevel).toBe(campaign.moveLimit);
      expect(sim.state.armyReport?.enemyStrength).toBe(campaign.objective.strength);
    }
  });

  it("requires larger garrisons for the later campaigns", () => {
    expect(defenseStrategy({ swordsmen: 6, archers: 0, horsemen: 0 }, 6)).toBeNull();
    expect(defenseStrategy({ swordsmen: 8, archers: 0, horsemen: 0 }, 6)).toBe("swordsmen");
    expect(defenseStrategy({ swordsmen: 8, archers: 0, horsemen: 0 }, 7)).toBeNull();
    expect(defenseStrategy({ swordsmen: 9, archers: 0, horsemen: 0 }, 7)).toBe("swordsmen");
  });
});
