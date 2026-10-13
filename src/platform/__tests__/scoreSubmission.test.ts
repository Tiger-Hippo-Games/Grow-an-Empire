import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CAMPAIGNS } from "../../game/campaigns";
import { leaderboardEntry } from "../../game/leaderboard";
import { createLocalPlatform } from "../adapters";
import { createScoreSubmission, leaderboardWeek } from "../scoreSubmission";

const player = { id: "p", displayName: "Ananya", authType: "EMAIL" };
const entry = (count: number) => leaderboardEntry(Object.fromEntries(CAMPAIGNS.slice(0, count).map(c => [c.id, 1])));

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("completed-result score submission", () => {
  it("posts the best pending result at least 30 seconds after the previous attempt", async () => {
    const submitScore = vi.fn().mockResolvedValue("ok");
    const queue = createScoreSubmission({ ...createLocalPlatform(), submitScore });
    queue.submit(entry(1), player);
    await Promise.resolve();
    queue.submit(entry(2), player);
    queue.submit(entry(3), player);
    expect(submitScore).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(29_999);
    expect(submitScore).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(submitScore).toHaveBeenLastCalledWith(3, expect.objectContaining({ level: 3, completedCampaigns: 3 }));
    queue.submit(entry(2), player);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(submitScore).toHaveBeenCalledTimes(2);
  });

  it("allows an unchanged score in a new UTC week, preserving rate limits", async () => {
    vi.setSystemTime(new Date("2026-10-11T23:59:50Z"));
    expect(leaderboardWeek()).toBe("2026-10-05");
    const submitScore = vi.fn().mockResolvedValue("ok");
    const queue = createScoreSubmission({ ...createLocalPlatform(), submitScore });
    queue.submit(entry(2), player);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(leaderboardWeek()).toBe("2026-10-12");
    queue.submit(entry(2), player);
    await vi.advanceTimersByTimeAsync(19_999);
    expect(submitScore).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(submitScore).toHaveBeenCalledTimes(2);
  });

  it("doesn't post for guests, unknown identities, or an empty campaign record", () => {
    const submitScore = vi.fn();
    const queue = createScoreSubmission({ ...createLocalPlatform(), submitScore });
    queue.submit(entry(3), null);
    queue.submit(entry(3), { ...player, authType: "GUEST" });
    queue.submit(entry(0), player);
    expect(submitScore).not.toHaveBeenCalled();
  });

  it("catches unexpected rejection and retries only when another battle result arrives", async () => {
    const submitScore = vi.fn().mockRejectedValue(new Error("portal unavailable"));
    const queue = createScoreSubmission({ ...createLocalPlatform(), submitScore });
    queue.submit(entry(3), player);
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(submitScore).toHaveBeenCalledTimes(1);
    queue.submit(entry(3), player);
    await Promise.resolve();
    expect(submitScore).toHaveBeenCalledTimes(2);
    expect(console.warn).toHaveBeenCalledTimes(1);
  });
});
