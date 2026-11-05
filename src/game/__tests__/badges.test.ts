import { describe, expect, it } from "vitest";
import { awardBadges, BADGES, featBadges, mergeBadges, progressBadges, readBadges } from "../badges";
import { CAMPAIGNS } from "../campaigns";
import type { ArmyReport } from "../settlementSimulation";

const report = (overrides: Partial<ArmyReport> = {}): ArmyReport => ({
  outcome: "Victory", win: true, stars: 3, playerStrength: 30, enemyStrength: 10, margin: 2,
  units: { militia: 0, spearmen: 0, archers: 4, swordsmen: 4, horsemen: 0, mercenaries: 0 }, totalUnits: 8,
  sellswords: { archers: 0, swordsmen: 0 }, enemy: { archers: 1, swordsmen: 1, horsemen: 0, veterancy: 1 }, enemyCount: 2,
  rounds: [], goldAvailable: 0, goldSpent: 0, explanations: [], gap: null, ...overrides,
} as ArmyReport);

describe("badges", () => {
  it("has unique ids, names and an earning rule for every medal", () => {
    expect(new Set(BADGES.map((badge) => badge.id)).size).toBe(BADGES.length);
    expect(new Set(BADGES.map((badge) => badge.name)).size).toBe(BADGES.length);
    for (const badge of BADGES) expect(badge.how.length).toBeGreaterThan(8);
  });

  it("derives progress badges from the star table alone", () => {
    expect(progressBadges({})).toEqual([]);
    const first = CAMPAIGNS[0].id;
    expect(progressBadges({ [first]: 1 })).toEqual(["first-victory"]);
    expect(progressBadges({ [first]: 3 })).toContain("three-stars");
    const chapterOne = Object.fromEntries(CAMPAIGNS.filter((c) => c.chapter === 0).map((c) => [c.id, 2]));
    expect(progressBadges(chapterOne)).toContain("chapter-1");
    const all = Object.fromEntries(CAMPAIGNS.map((c) => [c.id, 3]));
    expect(progressBadges(all)).toEqual(expect.arrayContaining(["stars-25", "stars-50", "stars-75", "chapter-5", "hard-win"]));
  });

  it("awards feats only for victories", () => {
    const campaign = CAMPAIGNS[7];
    const won = report({ margin: 0.1, units: { militia: 0, spearmen: 0, archers: 0, swordsmen: 2, horsemen: 6, mercenaries: 0, elephants: 1 }, felled: { archers: 1, swordsmen: 0, horsemen: 0 } });
    const built = ["farm", "woodcutter", "quarry", "sawmill", "granary", "bakery", "house", "blacksmith", "weapons-workshop", "barracks", "stable", "gajashala", "dharma-stambha", "quarry", "marketplace", "koshagar", "sarai", "prakara"];
    expect(featBadges({ campaign, report: won, builtBuildingIds: built }).sort()).toEqual(["ashvapati", "close-call", "dharma", "gajapati", "master-builder", "no-sellswords", "watchtower"].sort());
    expect(featBadges({ campaign, report: report({ win: false, outcome: "Settlement Lost", margin: -0.2 }), builtBuildingIds: built })).toEqual([]);
    // Early campaigns don't count for Self-Reliant; sellswords disqualify it.
    expect(featBadges({ campaign: CAMPAIGNS[0], report: report(), builtBuildingIds: [] })).not.toContain("no-sellswords");
    expect(featBadges({ campaign, report: report({ sellswords: { archers: 1, swordsmen: 0 } }), builtBuildingIds: [] })).not.toContain("no-sellswords");
  });

  it("cleans, merges and reports only new badges", () => {
    expect(readBadges(["dharma", "nope", 3, "first-victory", "dharma"])).toEqual(["first-victory", "dharma"]);
    expect(readBadges("x")).toEqual([]);
    expect(mergeBadges(["dharma"], undefined, ["first-victory"])).toEqual(["first-victory", "dharma"]);
    const first = CAMPAIGNS[0];
    const award = awardBadges(["first-victory"], { [first.id]: 3 }, { campaign: first, report: report(), builtBuildingIds: [] });
    expect(award.all).toEqual(expect.arrayContaining(["first-victory", "three-stars"]));
    expect(award.fresh).not.toContain("first-victory");
    expect(award.fresh).toContain("three-stars");
  });
});
