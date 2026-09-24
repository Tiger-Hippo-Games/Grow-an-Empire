import { describe, expect, it } from "vitest";
import { enemyStrength, gapToTarget, playerStrength, resolveBattle, starsFor, unitStrengths } from "../battle";
import { CAMPAIGNS, campaignById, isCampaignUnlocked, starsToUnlock, totalStars } from "../campaigns";
import { MAX_CAMPAIGN_MOVES } from "../content";

const none = { archers: 0, swordsmen: 0, horsemen: 0 };

describe("battle strength", () => {
  it("values each soldier by the enemy's mix", () => {
    expect(unitStrengths(none)).toEqual({ archers: 1.5, swordsmen: 2, horsemen: 3 });
    expect(unitStrengths({ archers: 0, swordsmen: 10, horsemen: 0 })).toEqual({ archers: 2, swordsmen: 2, horsemen: 2.5 });
    expect(unitStrengths({ archers: 10, swordsmen: 0, horsemen: 0 })).toEqual({ archers: 1.5, swordsmen: 1.5, horsemen: 3.5 });
  });

  it("counts militia at half strength and applies enemy veterancy", () => {
    const enemy = { archers: 0, swordsmen: 4, horsemen: 0, veterancy: 1.5 };
    expect(playerStrength({ ...none, militia: 4 }, enemy)).toBe(2);
    expect(enemyStrength(enemy, none)).toBe(12);
  });

  it("is decided by strength alone: more wins, a tie loses", () => {
    const enemy = { archers: 0, swordsmen: 2, horsemen: 0, veterancy: 1 };
    expect(resolveBattle({ ...none, swordsmen: 2, militia: 0 }, enemy, { two: 0.5, three: 1 }).win).toBe(false);
    expect(resolveBattle({ ...none, swordsmen: 2, militia: 1 }, enemy, { two: 0.5, three: 1 }).win).toBe(true);
  });

  it("awards stars by winning margin", () => {
    const margins = { two: 0.2, three: 0.5 };
    expect(starsFor(0.1, false, margins)).toBe(0);
    expect(starsFor(0.1, true, margins)).toBe(1);
    expect(starsFor(0.2, true, margins)).toBe(2);
    expect(starsFor(0.5, true, margins)).toBe(3);
  });

  it("wipes out the loser across four rounds", () => {
    const outcome = resolveBattle({ archers: 6, swordsmen: 0, horsemen: 0, militia: 0 }, { archers: 0, swordsmen: 2, horsemen: 0, veterancy: 1 }, { two: 0.5, three: 1 });
    expect(outcome.win).toBe(true);
    expect(outcome.rounds).toHaveLength(4);
    expect(outcome.rounds[3].enemy).toMatchObject(none);
    expect(outcome.rounds[3].player.archers).toBeGreaterThan(0);
  });

  it("reports the smallest addition that would have won", () => {
    const army = { archers: 0, swordsmen: 3, horsemen: 0, militia: 0 };
    const enemy = { archers: 0, swordsmen: 5, horsemen: 0, veterancy: 1 };
    // 3 swordsmen (6) vs 5 swordsmen (10): two archers (+4) or two horsemen (+5) are the fewest that win.
    expect(gapToTarget(army, enemy, 0)?.count).toBe(2);
  });
});

describe("the 25 campaigns", () => {
  it("has 25 distinct campaigns on standard rules", () => {
    expect(CAMPAIGNS).toHaveLength(25);
    expect(new Set(CAMPAIGNS.map((campaign) => campaign.id)).size).toBe(25);
    expect(CAMPAIGNS[0].id).toBe("campaign-1-first-muster");
    for (const campaign of CAMPAIGNS) {
      expect(campaign.moveLimit).toBe(MAX_CAMPAIGN_MOVES);
      expect(campaignById(campaign.id)).toBe(campaign);
      expect(campaign.objective.enemyName.length).toBeGreaterThan(0);
      expect(campaign.stars.two).toBeLessThanOrEqual(campaign.stars.three);
    }
  });

  it("gets stronger along the road", () => {
    const power = CAMPAIGNS.map((campaign) => enemyStrength(campaign.objective.army, none));
    expect(power[24]).toBeGreaterThan(power[0] * 20);
    // Win chance (not raw strength) is what falls steadily; balance.test.ts checks it.
  });
});

describe("unlocking by stars", () => {
  const allWith = (count: number, stars: number) => Object.fromEntries(CAMPAIGNS.slice(0, count).map((campaign) => [campaign.id, stars]));

  it("opens the first campaign and needs the previous one won", () => {
    expect(isCampaignUnlocked(1, {})).toBe(true);
    expect(isCampaignUnlocked(2, {})).toBe(false);
    expect(isCampaignUnlocked(2, allWith(1, 1))).toBe(true);
  });

  it("lets two stars on average open every campaign, with a buffer", () => {
    for (let n = 2; n <= 25; n += 1) {
      expect(isCampaignUnlocked(n, allWith(n - 1, 2)), `campaign ${n}`).toBe(true);
      expect(totalStars(allWith(n - 1, 2)) - starsToUnlock(n)).toBeGreaterThanOrEqual(Math.floor(0.2 * (n - 1)));
    }
  });

  it("does not open late campaigns on one star each", () => {
    expect(isCampaignUnlocked(3, allWith(2, 1))).toBe(false);
    expect(isCampaignUnlocked(25, allWith(24, 1))).toBe(false);
  });
});
