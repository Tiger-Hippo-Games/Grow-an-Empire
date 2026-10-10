import { describe, expect, it } from "vitest";
import { searchEndings, winShare } from "../balance";
import { CAMPAIGNS, ENEMY_MIX, campaignTier, targetWinShare } from "../campaigns";
import { CAMPAIGN_FIELD } from "../realm";
import { bestMargin } from "../balance";

/**
 * Plays every reachable 12-move game under the reference build-first policy
 * endings, a few seconds) and checks the difficulty plan: in every chapter
 * easy → medium ×3 → hard, each chapter harder than the last, Campaign 1
 * always winnable and Campaign 25 about 5%.
 * If this fails after a rules change, rerun Tools/balance/calibrate.ts.
 */
describe("balance across every reference build order", () => {
  const { endings, deadEnds } = searchEndings();

  it("never leaves a player with no legal move", () => {
    expect(deadEnds).toBe(0);
    expect(endings.length).toBeGreaterThan(5000);
  });

  it("explores strategic Gather on every turn of an eight-move campaign", () => {
    const campaign = { ...CAMPAIGNS[0], moveLimit: 8 };
    const strategic = searchEndings({ campaign, gatherPolicy: "every-turn" });
    expect(strategic.deadEnds).toBe(0);
    expect(strategic.endings.some(ending => ending.gathers === 8 && ending.built.length === 0)).toBe(true);
    expect(strategic.endings.some(ending => ending.gathers === 7 && ending.built[0] === "woodcutter")).toBe(true);
    expect(strategic.endings.some(ending => ending.gathers === 0)).toBe(true);
    expect(strategic.endings.every(ending => ending.gathers + ending.built.length === 8)).toBe(true);
  });

  it("puts each campaign's win chance on the plan", () => {
    const shares = CAMPAIGNS.map((campaign) => winShare(endings, campaign.objective.army));
    expect(shares[0]).toBe(1);
    for (const [index, share] of shares.entries()) {
      expect(Math.abs(share - targetWinShare(index + 1)), `campaign ${index + 1}: ${(share * 100).toFixed(1)}%`).toBeLessThan(0.05);
    }
    expect(shares[24]).toBeGreaterThan(0.01);
    expect(shares[24]).toBeLessThan(0.1);
    // Within each chapter the hard campaign is the hardest and the easy one the easiest.
    for (let chapter = 0; chapter < 5; chapter += 1) {
      const five = shares.slice(chapter * 5, chapter * 5 + 5);
      expect(five[0], `chapter ${chapter + 1} easy`).toBeGreaterThanOrEqual(Math.max(...five.slice(1)));
      expect(five[4], `chapter ${chapter + 1} hard`).toBeLessThan(Math.min(...five.slice(0, 4)));
    }
  });

  it("keeps the rival field's shares in step with the rules", () => {
    for (const [index, campaign] of CAMPAIGNS.entries()) {
      const margins = endings.map((ending) => bestMargin(ending, campaign.objective.army));
      const reach = (margin: number) => margins.filter((m) => m > 0 && m >= margin - 1e-9).length / margins.length;
      const [win, two, three] = CAMPAIGN_FIELD[index];
      expect(Math.abs(reach(0) - win), `campaign ${index + 1} win`).toBeLessThan(0.005);
      expect(Math.abs(reach(campaign.stars.two) - two), `campaign ${index + 1} two stars`).toBeLessThan(0.005);
      expect(Math.abs(reach(campaign.stars.three) - three), `campaign ${index + 1} three stars`).toBeLessThan(0.005);
    }
  });

  it("labels the tiers easy, medium, medium, medium, hard", () => {
    expect(CAMPAIGNS.slice(0, 10).map((campaign) => campaign.tier)).toEqual(
      ["easy", "medium", "medium", "medium", "hard", "easy", "medium", "medium", "medium", "hard"]);
    expect(CAMPAIGNS.every((campaign) => campaign.tier === campaignTier(campaign.number))).toBe(true);
  });

  it("varies the enemy between swordsmen, archers and horsemen", () => {
    const seen = new Set<string>();
    for (const [index, campaign] of CAMPAIGNS.entries()) {
      const { swordsmen, archers, horsemen } = campaign.objective.army;
      const mix = `${swordsmen ? "S" : ""}${archers ? "A" : ""}${horsemen ? "H" : ""}`;
      expect(mix, `campaign ${index + 1}`).toBe(ENEMY_MIX[index]);
      const key = `${swordsmen}/${archers}/${horsemen}`;
      expect(seen.has(key), `campaign ${index + 1} repeats an army`).toBe(false);
      seen.add(key);
    }
    for (const kind of ["S", "A", "H"]) expect(ENEMY_MIX.filter((mix) => mix.includes(kind)).length).toBeGreaterThan(8);
    for (let chapter = 0; chapter < 5; chapter += 1) expect(new Set(ENEMY_MIX.slice(chapter * 5, chapter * 5 + 5)).size).toBe(5);
  });

  it("makes every building and soldier type part of some ending", () => {
    const built = new Set(endings.flatMap((ending) => ending.built));
    expect(built.size).toBe(16);
    expect(endings.some((ending) => ending.horsemen > 0)).toBe(true);
    expect(endings.some((ending) => ending.swaps > 0)).toBe(true);
    expect(endings.some((ending) => ending.gathers > 0)).toBe(true);
  });
}, 60_000);
