import { describe, expect, it } from "vitest";
import { searchEndings, winShare } from "../balance";
import { CAMPAIGNS } from "../campaigns";

/**
 * Plays every reachable 12-move game under the real rules (about 21,000
 * endings, a few seconds) and checks the difficulty ladder: Campaign 1 is
 * always winnable, Campaign 25 about 5%, falling steadily in between.
 * If this fails after a rules change, rerun Tools/balance/calibrate.ts.
 */
describe("balance across every build order", () => {
  const { endings, deadEnds } = searchEndings();

  it("never leaves a player with no legal move", () => {
    expect(deadEnds).toBe(0);
    expect(endings.length).toBeGreaterThan(5000);
  });

  it("puts each campaign's win chance on the ladder", () => {
    const shares = CAMPAIGNS.map((campaign) => winShare(endings, campaign.objective.army));
    expect(shares[0]).toBe(1);
    for (const [index, share] of shares.entries()) {
      const target = 1 - (0.95 * index) / 24;
      expect(Math.abs(share - target), `campaign ${index + 1}: ${(share * 100).toFixed(1)}%`).toBeLessThan(0.05);
    }
    expect(shares[24]).toBeGreaterThan(0.01);
    expect(shares[24]).toBeLessThan(0.1);
  });

  it("makes every building and soldier type part of some ending", () => {
    const built = new Set(endings.flatMap((ending) => ending.built));
    expect(built.size).toBe(16);
    expect(endings.some((ending) => ending.horsemen > 0)).toBe(true);
    expect(endings.some((ending) => ending.swaps > 0)).toBe(true);
    expect(endings.some((ending) => ending.gathers > 0)).toBe(true);
  });
}, 60_000);
