import { describe, expect, it } from "vitest";
import { CAMPAIGNS } from "../campaigns";
import { isRegisteredPlayer, leaderboardEntry, readLeaderboardEntry, SCORE_PER_LEVEL } from "../leaderboard";
import { toSavedGame } from "../../platform/progressStore";
import { SettlementSimulation } from "../settlementSimulation";

const id = (number: number): string => CAMPAIGNS[number - 1].id;
const NOW = new Date("2026-10-02T10:00:00Z");
const LATER = new Date("2026-10-03T10:00:00Z");

describe("leaderboard standing", () => {
  it("is empty before the first win", () => {
    expect(leaderboardEntry({}, null, NOW)).toMatchObject({ level: 0, campaignId: null, totalStars: 0, score: 0, reachedAt: null });
  });

  it("levels by the highest campaign won and adds the stars", () => {
    const entry = leaderboardEntry({ [id(1)]: 3, [id(2)]: 2, [id(3)]: 1 }, null, NOW);
    expect(entry).toMatchObject({ level: 3, campaignId: id(3), campaignName: CAMPAIGNS[2].name, totalStars: 6, score: 3 * SCORE_PER_LEVEL + 6 });
    expect(entry.reachedAt).toBe(NOW.toISOString());
  });

  it("ranks a higher campaign above any number of stars on a lower one", () => {
    const allStarsOnTwentyFour = Object.fromEntries(CAMPAIGNS.slice(0, 24).map((campaign) => [campaign.id, 3]));
    const oneStarEachToTwentyFive = Object.fromEntries(CAMPAIGNS.map((campaign) => [campaign.id, 1]));
    expect(leaderboardEntry(oneStarEachToTwentyFive).score).toBeGreaterThan(leaderboardEntry(allStarsOnTwentyFour).score);
    expect(leaderboardEntry(Object.fromEntries(CAMPAIGNS.map((campaign) => [campaign.id, 3]))).score).toBe(25 * SCORE_PER_LEVEL + 75);
  });

  it("keeps the time a score was reached until it improves", () => {
    const first = leaderboardEntry({ [id(1)]: 2 }, null, NOW);
    expect(leaderboardEntry({ [id(1)]: 2 }, first, LATER).reachedAt).toBe(NOW.toISOString());
    expect(leaderboardEntry({ [id(1)]: 3 }, first, LATER).reachedAt).toBe(LATER.toISOString());
  });

  it("ignores unknown campaign ids and caps stars at 3", () => {
    expect(leaderboardEntry({ "campaign-99-nowhere": 3, [id(1)]: 7 }).totalStars).toBe(3);
  });

  it("survives a save round trip, and old saves without it still load", () => {
    const snapshot = new SettlementSimulation().serialize();
    const entry = leaderboardEntry({ [id(1)]: 3 }, null, NOW);
    const withEntry = toSavedGame(JSON.parse(JSON.stringify({ ...snapshot, runId: "r", settings: { tutorialComplete: true }, campaignStars: { [id(1)]: 3 }, leaderboard: entry })), null);
    expect(withEntry?.leaderboard).toEqual(entry);
    const old = toSavedGame(JSON.parse(JSON.stringify({ ...snapshot, runId: "r", settings: { tutorialComplete: true } })), null);
    expect(old).not.toBeNull();
    expect(old?.leaderboard).toBeUndefined();
    expect(readLeaderboardEntry({ score: "lots" })).toBeNull();
  });

  it("counts email and Google accounts as signed in, guests and unknowns not", () => {
    expect(isRegisteredPlayer("EMAIL")).toBe(true);
    expect(isRegisteredPlayer("google")).toBe(true);
    expect(isRegisteredPlayer("GUEST")).toBe(false);
    expect(isRegisteredPlayer("guest")).toBe(false);
    expect(isRegisteredPlayer(undefined)).toBe(false);
  });
});
