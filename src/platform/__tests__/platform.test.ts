import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { playMove } from "../../game/__tests__/play";
import { SettlementSimulation } from "../../game/settlementSimulation";
import { createGoLivePlatform, jsonDepth, LEADERBOARD_SLUG, normalizeProgress } from "../adapters";
import { belongsToAnotherPlayer, chooseSave, createProgressStore, toSavedGame, type SavedGame } from "../progressStore";
import { createSessionTracker, notifyPortalReady } from "../session";
import type { GoLiveSdk, PlatformAdapter } from "../types";

/** A save of a run with `moves` completed buildings, saved at `minute` past the hour. */
function saveAfter(moves: number, runId: string, minute: number, tutorialComplete = false): SavedGame {
  const sim = new SettlementSimulation();
  // Builds `moves` buildings (gathers don't count as moves here).
  while (sim.state.builtBuildingIds.length < moves) playMove(sim);
  const snapshot = JSON.parse(JSON.stringify(sim.serialize()));
  return { ...snapshot, savedAt: `2026-09-23T10:${String(minute).padStart(2, "0")}:00.000Z`, runId, settings: { tutorialComplete } };
}

const store = new Map<string, string>();
const BROWSER_SAVE_KEY = "grow-an-empire:save:v1";
beforeEach(() => {
  store.clear();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
      removeItem: (key: string) => { store.delete(key); },
    },
  });
  vi.stubGlobal("document", { visibilityState: "visible" });
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("normalizeProgress (the docs disagree on the empty shape)", () => {
  it.each([null, undefined, {}, { progress: null }, { progress: {} }, { progress: [] }])("treats %j as no cloud save", (value) => {
    expect(normalizeProgress(value)).toBeNull();
  });
  it("returns a real progress object", () => {
    expect(normalizeProgress({ progress: { a: 1 }, version: 3 })).toEqual({ a: 1 });
  });
});

describe("toSavedGame", () => {
  it("gives legacy saves (no run id, no settings) safe defaults", () => {
    const { runId: _runId, settings: _settings, ...legacy } = saveAfter(2, "x", 0);
    const game = toSavedGame(legacy, new SettlementSimulation().campaign.id);
    expect(game?.runId).toBe("legacy");
    expect(game?.settings).toEqual({ tutorialComplete: false, muted: false });
  });
  it("rejects another campaign's save and garbage", () => {
    expect(toSavedGame({ ...saveAfter(1, "x", 0), campaignId: "other" }, new SettlementSimulation().campaign.id)).toBeNull();
    expect(toSavedGame({ hello: "world" }, new SettlementSimulation().campaign.id)).toBeNull();
  });
  it("loads a selected campaign from the shared progress slot", () => {
    const save = { ...saveAfter(1, "river", 2), campaignId: "campaign-2-river-watch", completedCampaignIds: ["campaign-1-first-muster"] };
    expect(toSavedGame(save, null)?.campaignId).toBe("campaign-2-river-watch");
    expect(toSavedGame(save, null)?.completedCampaignIds).toEqual(["campaign-1-first-muster"]);
  });
});

describe("chooseSave", () => {
  it("keeps the further-along copy of the same run, even if it's older", () => {
    const ahead = saveAfter(3, "run-a", 1);
    const behind = saveAfter(1, "run-a", 9);
    expect(chooseSave(behind, ahead)?.state.builtBuildingIds).toHaveLength(3);
    expect(chooseSave(ahead, behind)?.state.builtBuildingIds).toHaveLength(3);
  });
  it("lets a newer Restart replace an older, further-along run", () => {
    const oldRun = saveAfter(5, "run-old", 1);
    const restarted = saveAfter(0, "run-new", 9);
    expect(chooseSave(restarted, oldRun)?.runId).toBe("run-new");
  });
  it("keeps the tutorial done if either copy says so", () => {
    expect(chooseSave(saveAfter(1, "r", 1, true), saveAfter(2, "r", 2, false))?.settings.tutorialComplete).toBe(true);
  });
  it("keeps earlier victories when the active campaign changes", () => {
    const first = { ...saveAfter(12, "first", 1), completedCampaignIds: ["campaign-1-first-muster"] };
    const second = { ...saveAfter(2, "second", 2), campaignId: "campaign-2-river-watch", completedCampaignIds: [] };
    expect(chooseSave(first, second)?.completedCampaignIds).toEqual(["campaign-1-first-muster"]);
    expect(chooseSave(first, second)?.campaignId).toBe("campaign-2-river-watch");
  });
  it("keeps the best stars from both copies, and counts old victories as one star", () => {
    const campaignId = new SettlementSimulation().campaign.id;
    const local = { ...saveAfter(1, "r", 1), campaignStars: { [campaignId]: 3, other: 1 } };
    const cloud = { ...saveAfter(2, "r", 2), campaignStars: { [campaignId]: 2, other: 2 } };
    expect(chooseSave(local, cloud)?.campaignStars).toEqual({ [campaignId]: 3, other: 2 });
    const legacy = toSavedGame({ ...saveAfter(1, "r", 1), completedCampaignIds: [campaignId] }, null);
    expect(legacy?.campaignStars).toEqual({ [campaignId]: 1 });
    const garbage = toSavedGame({ ...saveAfter(1, "r", 1), campaignStars: { a: "x", b: 9, c: -2 } }, null);
    expect(garbage?.campaignStars).toEqual({ b: 3, c: 0 });
  });

  it("handles missing copies", () => {
    expect(chooseSave(null, null)).toBeNull();
    expect(chooseSave(saveAfter(1, "r", 1), null)?.runId).toBe("r");
  });
});

/** A scriptable in-memory platform for store tests. */
function fakePlatform(overrides: Partial<PlatformAdapter> = {}) {
  let cloud: Record<string, unknown> | null = null;
  const saves: Array<Record<string, unknown>> = [];
  const platform: PlatformAdapter = {
    kind: "mock",
    connect: async () => ({ id: "p", displayName: "P" }),
    loadProgress: async () => cloud,
    saveProgress: async (progress) => { saves.push(progress); cloud = progress; return "ok"; },
    cloudSaveAllowed: () => true,
    submitScore: async () => "ok",
    readLeaderboard: async () => "unavailable",
    startSession: vi.fn(),
    endSession: vi.fn(),
    track: vi.fn(),
    onLateSignIn: vi.fn(),
    ...overrides,
  };
  return { platform, saves, setCloud: (value: Record<string, unknown> | null) => { cloud = value; } };
}

describe("progress store", () => {
  const campaignId = new SettlementSimulation().campaign.id;

  it("resumes local progress when a cloud read rejects and retries before uploading", async () => {
    vi.useFakeTimers();
    let fail = true;
    const { platform, saves } = fakePlatform({ loadProgress: async () => {
      if (fail) throw new Error("SDK rejected");
      return null;
    } });
    store.set(BROWSER_SAVE_KEY, JSON.stringify(saveAfter(2, "r", 1)));
    const progress = createProgressStore(platform, campaignId);
    expect((await progress.load("p"))?.runId).toBe("r");
    progress.save(saveAfter(3, "r", 2));
    await progress.flush();
    expect(saves).toHaveLength(0);
    fail = false;
    await vi.advanceTimersByTimeAsync(15_000);
    expect((saves.at(-1) as unknown as SavedGame).state.builtBuildingIds).toHaveLength(3);
  });

  it("retains a rejected write and retries with backoff even without another move", async () => {
    vi.useFakeTimers();
    let failures = 2;
    const { platform, saves } = fakePlatform();
    const save = platform.saveProgress;
    platform.saveProgress = async (value) => {
      if (failures-- > 0) throw new Error("network");
      return save(value);
    };
    const progress = createProgressStore(platform, campaignId);
    await progress.load("p");
    progress.save(saveAfter(2, "r", 1));
    await progress.flush();
    await vi.advanceTimersByTimeAsync(15_000);
    expect(saves).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(29_999);
    expect(saves).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(saves).toHaveLength(1);
    expect((saves[0] as unknown as SavedGame).state.builtBuildingIds).toHaveLength(2);
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it("retries rejected writes without losing a newer save queued during the request", async () => {
    vi.useFakeTimers();
    let rejectWrite!: (error: Error) => void;
    const { platform, saves } = fakePlatform();
    const save = platform.saveProgress;
    let first = true;
    platform.saveProgress = (value) => {
      if (!first) return save(value);
      first = false;
      return new Promise((_, reject) => { rejectWrite = reject; });
    };
    const progress = createProgressStore(platform, campaignId);
    await progress.load("p");
    progress.save(saveAfter(2, "r", 1));
    const flushing = progress.flush();
    progress.save(saveAfter(3, "r", 2));
    rejectWrite(new Error("network"));
    await expect(flushing).resolves.toBeUndefined();
    await vi.advanceTimersByTimeAsync(15_000);
    expect(saves).toHaveLength(1);
    expect((saves[0] as unknown as SavedGame).state.builtBuildingIds).toHaveLength(3);
  });

  it.each(["save", "flush", "clear"] as const)("protects a newer-version save arriving in another tab before %s", async (action) => {
    vi.useFakeTimers();
    const { platform, saves } = fakePlatform();
    const progress = createProgressStore(platform, campaignId);
    await progress.load("p");
    progress.save(saveAfter(1, "r", 1));
    const newer = JSON.stringify({ ...saveAfter(2, "r", 2), schemaVersion: 99 });
    store.set(BROWSER_SAVE_KEY, newer);
    if (action === "save") progress.save(saveAfter(3, "r", 3));
    else if (action === "clear") progress.clear();
    else await progress.flush();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(store.get(BROWSER_SAVE_KEY)).toBe(newer);
    expect(saves).toHaveLength(0);
    expect(progress.savingDisabledReason).toContain("newer version");
  });

  it("saves to the browser at once and batches cloud writes", async () => {
    vi.useFakeTimers();
    const { platform, saves } = fakePlatform();
    const progress = createProgressStore(platform, campaignId);
    progress.save(saveAfter(1, "r", 1));
    progress.save(saveAfter(2, "r", 2));
    expect(store.get("grow-an-empire:save:v1")).toContain('"runId":"r"');
    expect(saves).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(5100);
    expect(saves).toHaveLength(1);
    expect((saves[0] as unknown as SavedGame).state.builtBuildingIds).toHaveLength(2);
  });

  it("writes immediately when asked (tab hidden, run ended)", async () => {
    const { platform, saves } = fakePlatform();
    const progress = createProgressStore(platform, campaignId);
    progress.save(saveAfter(1, "r", 1), { immediate: true });
    await progress.flush();
    expect(saves).toHaveLength(1);
  });

  it("resumes the cloud copy when it is further along, and pushes a better local copy up", async () => {
    const { platform, saves, setCloud } = fakePlatform();
    setCloud(saveAfter(4, "r", 1) as unknown as Record<string, unknown>);
    store.set("grow-an-empire:save:v1", JSON.stringify(saveAfter(2, "r", 5)));
    expect((await createProgressStore(platform, campaignId).load())?.state.builtBuildingIds).toHaveLength(4);

    setCloud(saveAfter(1, "r", 1) as unknown as Record<string, unknown>);
    store.set("grow-an-empire:save:v1", JSON.stringify(saveAfter(3, "r", 5)));
    const progress = createProgressStore(platform, campaignId);
    expect((await progress.load())?.state.builtBuildingIds).toHaveLength(3);
    await progress.flush();
    expect((saves.at(-1) as unknown as SavedGame).state.builtBuildingIds).toHaveLength(3);
  });

  it("resolves a save conflict by re-reading the cloud and retrying once", async () => {
    vi.useFakeTimers();
    let first = true;
    const saved: Array<Record<string, unknown>> = [];
    const { platform } = fakePlatform({
      saveProgress: async (value) => {
        if (first) { first = false; return "conflict"; }
        saved.push(value);
        return "ok";
      },
      loadProgress: async () => saveAfter(1, "r", 0) as unknown as Record<string, unknown>,
    });
    const progress = createProgressStore(platform, campaignId);
    progress.save(saveAfter(3, "r", 5), { immediate: true });
    await progress.flush();
    expect(saved).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(saved).toHaveLength(1);
    expect((saved[0] as unknown as SavedGame).state.builtBuildingIds).toHaveLength(3);
  });

  it("does not overwrite a cloud save that is further along after a conflict", async () => {
    let calls = 0;
    const { platform } = fakePlatform({
      saveProgress: async () => { calls += 1; return "conflict"; },
      loadProgress: async () => saveAfter(5, "r", 0) as unknown as Record<string, unknown>,
    });
    const progress = createProgressStore(platform, campaignId);
    progress.save(saveAfter(2, "r", 5), { immediate: true });
    await progress.flush();
    // The cloud is read before the first write, so the further-along copy is never even attempted.
    expect(calls).toBe(0);
    progress.save(saveAfter(3, "r", 6), { immediate: true });
    await progress.flush();
    expect(calls).toBe(0); // and the session stops trying (no save/load every 2 s)
  });

  it("never writes to a cloud it couldn't read: a slow read can't wipe real progress", async () => {
    const real = { ...saveAfter(6, "cloud-run", 0), campaignStars: { [campaignId]: 3, "campaign-2-reedmarsh": 2 } };
    let readable = false;
    const { platform, saves } = fakePlatform({ loadProgress: async () => (readable ? real as unknown as Record<string, unknown> : "unavailable") });
    const progress = createProgressStore(platform, campaignId);
    expect(await progress.load("p")).toBeNull(); // nothing local, cloud unreadable: a fresh game starts
    progress.save(saveAfter(0, "fresh-run", 9), { immediate: true });
    await progress.flush();
    expect(saves).toHaveLength(0);
    // The cloud comes back: the next write reads it first, keeps the further-along run and its stars.
    readable = true;
    progress.save(saveAfter(1, "fresh-run", 10), { immediate: true });
    await progress.flush();
    expect(saves).toHaveLength(0);
    expect(progress.knownStars).toMatchObject({ [campaignId]: 3, "campaign-2-reedmarsh": 2 });
  });

  it("keeps stars won in another tab", async () => {
    const { platform, saves } = fakePlatform();
    const progress = createProgressStore(platform, campaignId);
    await progress.load("p");
    // Another tab wrote a win to the shared browser save after this tab loaded.
    store.set(BROWSER_SAVE_KEY, JSON.stringify({ ...saveAfter(2, "r", 3), playerId: "p", campaignStars: { "campaign-2-reedmarsh": 3 } }));
    progress.save({ ...saveAfter(3, "r", 4), campaignStars: { [campaignId]: 1 } }, { immediate: true });
    await progress.flush();
    const written = saves.at(-1) as unknown as SavedGame;
    expect(written.campaignStars).toEqual({ [campaignId]: 1, "campaign-2-reedmarsh": 3 });
    expect(JSON.parse(store.get(BROWSER_SAVE_KEY) as string).campaignStars).toEqual({ [campaignId]: 1, "campaign-2-reedmarsh": 3 });
  });

  it("puts a failed cloud write back in the queue", async () => {
    vi.useFakeTimers();
    let fail = true;
    const { platform, saves } = fakePlatform();
    const save = platform.saveProgress;
    const progress = createProgressStore({ ...platform, saveProgress: async (value) => (fail ? "error" : save(value)) }, campaignId);
    await progress.load("p");
    progress.save(saveAfter(4, "r", 5), { immediate: true });
    await progress.flush();
    expect(saves).toHaveLength(0);
    fail = false;
    await vi.advanceTimersByTimeAsync(15_000);
    expect(saves).toHaveLength(1);
  });

  it("reloads after an uncertain save and never overwrites a newer cloud run", async () => {
    vi.useFakeTimers();
    const { platform, setCloud } = fakePlatform();
    const reads = vi.fn(platform.loadProgress);
    const writes = vi.fn(async () => "error" as const);
    const progress = createProgressStore({ ...platform, loadProgress: reads, saveProgress: writes }, campaignId);
    await progress.load("p");
    progress.save(saveAfter(2, "r", 2), { immediate: true });
    await progress.flush();
    setCloud(saveAfter(4, "r", 4));
    await vi.advanceTimersByTimeAsync(15_000);
    expect(reads).toHaveBeenCalledTimes(2);
    expect(writes).toHaveBeenCalledTimes(1);
    expect(JSON.parse(store.get(BROWSER_SAVE_KEY)!).state.builtBuildingIds).toHaveLength(2);
  });

  it("keeps cloud writes five seconds apart even at rapid checkpoints and page exit", async () => {
    vi.useFakeTimers();
    const { platform, saves } = fakePlatform();
    const progress = createProgressStore(platform, campaignId);
    await progress.load("p");
    progress.save(saveAfter(1, "r", 1), { immediate: true });
    await progress.flush();
    expect(saves).toHaveLength(1);
    progress.save(saveAfter(2, "r", 2), { immediate: true });
    await progress.flush();
    progress.save(saveAfter(3, "r", 3), { immediate: true });
    await progress.flush();
    expect(JSON.parse(store.get(BROWSER_SAVE_KEY)!).state.builtBuildingIds).toHaveLength(3);
    await vi.advanceTimersByTimeAsync(4999);
    expect(saves).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(saves).toHaveLength(2);
    expect((saves[1] as unknown as SavedGame).state.builtBuildingIds).toHaveLength(3);
  });

  it("keeps working offline: browser save only, no cloud calls", async () => {
    const saveProgress = vi.fn();
    const progress = createProgressStore({ ...fakePlatform().platform, kind: "local", saveProgress }, campaignId);
    progress.save(saveAfter(1, "r", 1), { immediate: true });
    await progress.flush();
    expect(saveProgress).not.toHaveBeenCalled();
    expect(store.has("grow-an-empire:save:v1")).toBe(true);
  });
});

describe("progress store: whose save is it", () => {
  const campaignId = new SettlementSimulation().campaign.id;
  const SAVE_KEY = "grow-an-empire:save:v1";

  it("only treats a save as someone else's when both ids are known and differ", () => {
    const save = { ...saveAfter(1, "r", 1), playerId: "alice" };
    expect(belongsToAnotherPlayer(save, "bob")).toBe(true);
    expect(belongsToAnotherPlayer(save, "alice")).toBe(false);
    expect(belongsToAnotherPlayer(save, null)).toBe(false); // offline
    expect(belongsToAnotherPlayer(saveAfter(1, "r", 1), "bob")).toBe(false); // guest save from before ids
  });

  it("ignores, and never uploads, a browser save that belongs to another player", async () => {
    const { platform, saves, setCloud } = fakePlatform();
    setCloud(saveAfter(1, "bob-run", 1) as unknown as Record<string, unknown>);
    store.set(SAVE_KEY, JSON.stringify({ ...saveAfter(5, "alice-run", 30), playerId: "alice" }));
    const progress = createProgressStore(platform, campaignId);
    const chosen = await progress.load("bob");
    expect(chosen?.runId).toBe("bob-run");
    await progress.flush();
    expect(saves.some((save) => (save as unknown as SavedGame).runId === "alice-run")).toBe(false);
  });

  it("stamps the signed-in player on every save", async () => {
    const { platform, saves } = fakePlatform();
    const progress = createProgressStore(platform, campaignId);
    await progress.load("bob");
    progress.save(saveAfter(1, "r", 1), { immediate: true });
    await progress.flush();
    expect(JSON.parse(store.get(SAVE_KEY) ?? "{}").playerId).toBe("bob");
    expect((saves.at(-1) as unknown as SavedGame).playerId).toBe("bob");
  });

  it("keeps a guest's browser progress when they sign in (no owner recorded yet)", async () => {
    const { platform } = fakePlatform();
    store.set(SAVE_KEY, JSON.stringify(saveAfter(3, "guest-run", 5)));
    expect((await createProgressStore(platform, campaignId).load("bob"))?.runId).toBe("guest-run");
  });
});

describe("progress store: saves from a newer game version", () => {
  const campaignId = new SettlementSimulation().campaign.id;
  const SAVE_KEY = "grow-an-empire:save:v1";
  const newer = (): Record<string, unknown> => ({ ...saveAfter(6, "future", 50), schemaVersion: 99 });

  it("never overwrites a newer cloud save, locally or in the cloud", async () => {
    const { platform, saves, setCloud } = fakePlatform();
    setCloud(newer());
    store.set(SAVE_KEY, JSON.stringify(saveAfter(2, "r", 5)));
    const progress = createProgressStore(platform, campaignId);
    expect(await progress.load("p")).toBeNull();
    expect(progress.savingDisabledReason).toMatch(/newer version/);
    progress.save(saveAfter(3, "r", 6), { immediate: true });
    progress.clear();
    await progress.flush();
    expect(saves).toHaveLength(0);
    expect(JSON.parse(store.get(SAVE_KEY) ?? "{}").state.builtBuildingIds).toHaveLength(2); // untouched
  });

  it("keeps a newer browser save instead of deleting it as unusable", async () => {
    const { platform, saves } = fakePlatform();
    store.set(SAVE_KEY, JSON.stringify(newer()));
    const progress = createProgressStore(platform, campaignId);
    expect(await progress.load("p")).toBeNull();
    expect(JSON.parse(store.get(SAVE_KEY) ?? "{}").schemaVersion).toBe(99);
    progress.save(saveAfter(1, "r", 1), { immediate: true });
    await progress.flush();
    expect(saves).toHaveLength(0);
    expect(JSON.parse(store.get(SAVE_KEY) ?? "{}").schemaVersion).toBe(99);
  });

  it("stops saving if a conflict reveals a newer save on another device", async () => {
    let calls = 0;
    const { platform, setCloud } = fakePlatform({ saveProgress: async () => { calls += 1; return "conflict"; } });
    setCloud(newer());
    const progress = createProgressStore({ ...platform, loadProgress: async () => newer() }, campaignId);
    progress.save(saveAfter(1, "r", 1), { immediate: true });
    await progress.flush();
    expect(calls).toBe(0); // the cloud is read first, and the newer save is never written over
    expect(progress.savingDisabledReason).not.toBeNull();
  });

  it("still deletes an unusable save from an older version", async () => {
    const { platform } = fakePlatform();
    store.set(SAVE_KEY, JSON.stringify({ ...saveAfter(1, "r", 1), schemaVersion: 2 }));
    expect(await createProgressStore(platform, campaignId).load("p")).toBeNull();
    expect(store.has(SAVE_KEY)).toBe(false);
  });
});

  function fakeSdk(overrides: Partial<GoLiveSdk> = {}): GoLiveSdk {
    return {
      init: vi.fn(),
      getPlayer: async () => ({ id: "1", displayName: "Guest_1" }),
      getGameProgress: async () => ({ progress: {}, version: 0 }),
      saveGameProgress: async () => ({ version: 1 }),
      startSession: vi.fn(),
      endSession: vi.fn(),
      track: vi.fn(),
      ...overrides,
    };
  }

describe("Hippo Arcade SDK v2 wrapper", () => {


  it("initializes with client telemetry only before reading portal identity", async () => {
    const sdk = fakeSdk();
    await createGoLivePlatform(sdk).connect();
    expect(sdk.init).toHaveBeenCalledWith({ clientVersion: __APP_VERSION__, platform: "web", timeoutMs: 15_000 });
  });

  it("lets SDK v2 bind routing in the parent portal by default and preserves the portal display name", async () => {
    const sdk = fakeSdk({ getPlayer: async () => ({ id: "p", displayName: "Ananya", authType: "EMAIL" }) });
    expect(await createGoLivePlatform(sdk).connect()).toMatchObject({ id: "p", displayName: "Ananya" });
    expect(sdk.init).toHaveBeenCalledWith({ clientVersion: __APP_VERSION__, platform: "web", timeoutMs: 15_000 });
  });

  it("uses a safe fallback for a malformed display name", async () => {
    const sdk = fakeSdk({ getPlayer: async () => ({ id: "p", displayName: 42 as unknown as string, username: "Raja" }) });
    expect(await createGoLivePlatform(sdk).connect()).toMatchObject({ displayName: "Raja" });
  });

  it("uses the real game's leaderboard slug and metadata", async () => {
    const submitScore = vi.fn().mockResolvedValue({ rank: 1 });
    const sdk = fakeSdk({ submitScore, getPlayer: async () => ({ id: "p", displayName: "Ananya", authType: "EMAIL" }) });
    const adapter = createGoLivePlatform(sdk);
    await adapter.connect();
    expect(await adapter.submitScore(103, { level: 1 })).toBe("ok");
    expect(submitScore).toHaveBeenCalledWith(LEADERBOARD_SLUG, 103, { level: 1 });
  });

  it("never submits guests and survives missing or rejecting leaderboard methods", async () => {
    const submitScore = vi.fn().mockRejectedValue(new Error("Leaderboard deactivated"));
    const guestSdk = fakeSdk({ submitScore, getPlayer: async () => ({ id: "g", displayName: "Guest", authType: "GUEST" }) });
    const guest = createGoLivePlatform(guestSdk);
    await guest.connect();
    expect(await guest.submitScore(103, {})).toBe("unavailable");
    expect(submitScore).not.toHaveBeenCalled();
    const getPlayer = async () => ({ id: "p", displayName: "Player", authType: "EMAIL" });
    const missing = createGoLivePlatform(fakeSdk({ getPlayer }));
    await missing.connect();
    expect(await missing.submitScore(103, {})).toBe("unavailable");
    const rejecting = createGoLivePlatform(fakeSdk({ getPlayer, submitScore }));
    await rejecting.connect();
    expect(await rejecting.submitScore(103, {})).toBe("error");
    expect(await rejecting.submitScore(103, {})).toBe("error");
    expect(console.warn).toHaveBeenCalledTimes(2); // once for each adapter's failure
  });

  it("rejects invalid scores and oversized UTF-8 metadata before contacting the SDK", async () => {
    const submitScore = vi.fn();
    const sdk = fakeSdk({ submitScore, getPlayer: async () => ({ id: "p", displayName: "Player", authType: "EMAIL" }) });
    const adapter = createGoLivePlatform(sdk);
    await adapter.connect();
    for (const score of [-1, NaN, Infinity]) expect(await adapter.submitScore(score, {})).toBe("error");
    expect(await adapter.submitScore(103, { text: "à¤…".repeat(800) })).toBe("error");
    expect(submitScore).not.toHaveBeenCalled();
  });

  it("allows play after trial-save denial and rejects saves over the UTF-8 byte cap", async () => {
    const sdk = fakeSdk({ saveGameProgress: vi.fn().mockRejectedValue(new Error("Trial player cannot save")) });
    const adapter = createGoLivePlatform(sdk);
    expect(await adapter.connect()).not.toBeNull();
    await adapter.loadProgress();
    expect(await adapter.saveProgress({ schemaVersion: 6 })).toBe("error");
    expect(await adapter.saveProgress({ text: "à¤…".repeat(23_000) })).toBe("error");
    expect(sdk.saveGameProgress).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it("never throws: failed login means offline, and nothing is sent", async () => {
    const sdk = fakeSdk({ getPlayer: async () => { throw new Error("network"); } });
    const adapter = createGoLivePlatform(sdk);
    expect(await adapter.connect()).toBeNull();
    expect(await adapter.saveProgress({})).toBe("error");
    adapter.track("x");
    expect(sdk.track).not.toHaveBeenCalled();
  });

  it("reports conflicts distinctly from other errors", async () => {
    const adapter = createGoLivePlatform(fakeSdk({ saveGameProgress: async () => { throw Object.assign(new Error("Stale revision"), { code: "SAVE_CONFLICT", status: 409 }); } }));
    await adapter.connect();
    await adapter.loadProgress();
    expect(await adapter.saveProgress({ a: 1 })).toBe("conflict");
  });

  it("survives a track() that throws", async () => {
    const adapter = createGoLivePlatform(fakeSdk({ track: () => { throw new Error("boom"); } }));
    await adapter.connect();
    expect(() => adapter.track("x")).not.toThrow();
  });

  it("catches rejected promises from the fire-and-forget calls", async () => {
    const rejected = () => Promise.reject(new Error("offline")) as unknown as void;
    const adapter = createGoLivePlatform(fakeSdk({ track: rejected, startSession: rejected, endSession: rejected }));
    await adapter.connect();
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    adapter.track("x");
    adapter.startSession();
    adapter.endSession(12.7);
    await new Promise((resolve) => setTimeout(resolve, 10));
    process.off("unhandledRejection", unhandled);
    expect(unhandled).not.toHaveBeenCalled();
  });

  it("waits for an async init() before signing in", async () => {
    const order: string[] = [];
    const sdk = fakeSdk({
      init: async () => { await new Promise((resolve) => setTimeout(resolve, 5)); order.push("init"); },
      getPlayer: async () => { order.push("getPlayer"); return { id: "1", displayName: "Guest_1" }; },
    });
    expect(await createGoLivePlatform(sdk).connect()).not.toBeNull();
    expect(order).toEqual(["init", "getPlayer"]);
  });

  it("treats a login with no player as offline instead of crashing", async () => {
    const adapter = createGoLivePlatform(fakeSdk({ getPlayer: async () => null as never }));
    expect(await adapter.connect()).toBeNull();
    expect(await adapter.saveProgress({ a: 1 })).toBe("error");
  });

  it("gives up on a login that never answers", async () => {
    vi.useFakeTimers();
    const adapter = createGoLivePlatform(fakeSdk({ getPlayer: () => new Promise(() => {}) }));
    const connecting = adapter.connect();
    await vi.advanceTimersByTimeAsync(5100);
    expect(await connecting).toBeNull();
  });

  it("initializes once even when multiple consumers connect", async () => {
    const sdk = fakeSdk();
    const adapter = createGoLivePlatform(sdk);
    await Promise.all([adapter.connect(), adapter.connect()]);
    expect(sdk.init).toHaveBeenCalledTimes(1);
  });

  it("requires a successful load before saving and again after any save error", async () => {
    const saveGameProgress = vi.fn().mockRejectedValueOnce(Object.assign(new Error("Outcome unknown"), { code: "PORTAL_TIMEOUT" })).mockResolvedValue({ version: 2 });
    const adapter = createGoLivePlatform(fakeSdk({ saveGameProgress }));
    await adapter.connect();
    expect(await adapter.saveProgress({ a: 1 })).toBe("error");
    expect(saveGameProgress).not.toHaveBeenCalled();
    await adapter.loadProgress();
    expect(await adapter.saveProgress({ a: 1 })).toBe("error");
    expect(await adapter.saveProgress({ a: 2 })).toBe("error");
    expect(saveGameProgress).toHaveBeenCalledTimes(1);
    await adapter.loadProgress();
    expect(await adapter.saveProgress({ a: 2 })).toBe("ok");
  });

  it("never treats a failed or malformed load as an empty save", async () => {
    const saveGameProgress = vi.fn();
    const getGameProgress = vi.fn().mockRejectedValueOnce(new Error("Offline")).mockResolvedValueOnce({ progress: {}, version: -1 }).mockResolvedValueOnce({ progress: {}, version: 0 });
    const adapter = createGoLivePlatform(fakeSdk({ getGameProgress, saveGameProgress }));
    await adapter.connect();
    for (let i = 0; i < 2; i++) {
      expect(await adapter.loadProgress()).toBe("unavailable");
      expect(await adapter.saveProgress({ a: 1 })).toBe("error");
    }
    expect(saveGameProgress).not.toHaveBeenCalled();
    expect(await adapter.loadProgress()).toBeNull();
    expect(await adapter.saveProgress({ a: 1 })).toBe("ok");
  });

  it("serializes progress operations without acquiring browser locks", async () => {
    let finishRead!: (value: { progress: Record<string, unknown>; version: number }) => void;
    const saveGameProgress = vi.fn(async () => ({ version: 1 }));
    const request = vi.fn().mockRejectedValue(new Error("Locks denied"));
    vi.stubGlobal("navigator", { locks: { request } });
    const adapter = createGoLivePlatform(fakeSdk({ getGameProgress: () => new Promise(resolve => { finishRead = resolve; }), saveGameProgress }));
    await adapter.connect();
    const read = adapter.loadProgress();
    const write = adapter.saveProgress({ a: 1 });
    await Promise.resolve();
    expect(saveGameProgress).not.toHaveBeenCalled();
    finishRead({ progress: {}, version: 0 });
    await read;
    expect(await write).toBe("ok");
    expect(request).not.toHaveBeenCalled();
  });

  it("keeps preview browser and cloud progress separate from the live save and rankings", async () => {
    const live = saveAfter(3, "live-run", 3);
    store.set(BROWSER_SAVE_KEY, JSON.stringify(live));
    const sdk = fakeSdk({ getPlayer: async () => ({ id: "preview-reviewer", displayName: "Preview", authType: "PREVIEW" }), submitScore: vi.fn(), getLeaderboard: vi.fn(), getMyRank: vi.fn() });
    const adapter = createGoLivePlatform(sdk);
    const player = await adapter.connect();
    const progress = createProgressStore(adapter, campaignId);
    expect(await progress.load(player?.id)).toBeNull();
    expect(adapter.cloudSaveAllowed()).toBe(true);
    progress.save(saveAfter(1, "preview-run", 5), { immediate: true });
    await progress.flush();
    expect(JSON.parse(store.get(BROWSER_SAVE_KEY)!)).toEqual(live);
    expect(JSON.parse(store.get(adapter.localSaveKey!)!).runId).toBe("preview-run");
    expect(await adapter.submitScore(1, {})).toBe("unavailable");
    expect(await adapter.readLeaderboard()).toBe("unavailable");
    expect(sdk.submitScore).not.toHaveBeenCalled();
    expect(sdk.getLeaderboard).not.toHaveBeenCalled();
    expect(sdk.getMyRank).not.toHaveBeenCalled();
    expect((await createProgressStore(adapter, campaignId).load(player?.id))?.runId).toBe("preview-run");
  });

  it("requires reload if preview identity arrives after local practice has booted", async () => {
    vi.useFakeTimers();
    let identify!: (player: { id: string; displayName: string; authType: string }) => void;
    const adapter = createGoLivePlatform(fakeSdk({ getPlayer: () => new Promise(resolve => { identify = resolve; }) }));
    const late = vi.fn();
    const status = vi.fn();
    adapter.onLateSignIn(late);
    adapter.onStatusChange?.(status);
    const connecting = adapter.connect();
    await vi.advanceTimersByTimeAsync(5100);
    expect(await connecting).toBeNull();
    identify({ id: "preview", displayName: "Preview", authType: "PREVIEW" });
    await vi.advanceTimersByTimeAsync(1);
    expect(late).not.toHaveBeenCalled();
    expect(adapter.cloudSaveAllowed()).toBe(false);
    expect(status).toHaveBeenLastCalledWith(expect.stringContaining("Reload"));
  });

  it("stops cloud operations and asks for reload when the portal account changes", async () => {
    const getGameProgress = vi.fn().mockRejectedValue(Object.assign(new Error("Changed"), { code: "SESSION_CHANGED" }));
    const adapter = createGoLivePlatform(fakeSdk({ getGameProgress }));
    const status = vi.fn();
    adapter.onStatusChange?.(status);
    await adapter.connect();
    expect(await adapter.loadProgress()).toBe("unavailable");
    expect(adapter.cloudSaveAllowed()).toBe(false);
    expect(status).toHaveBeenCalledWith(expect.stringContaining("Reload"));
    await adapter.loadProgress();
    expect(getGameProgress).toHaveBeenCalledTimes(1);
  });

  it("keeps schema-6 move reports and final battles within the v2 size/depth limits", async () => {
    const sim = new SettlementSimulation();
    while (sim.state.mode !== "muster") playMove(sim);
    sim.muster();
    const save = { ...JSON.parse(JSON.stringify(sim.serialize())), runId: "r", settings: { tutorialComplete: true } };
    expect(jsonDepth(save)).toBeLessThanOrEqual(6);
    const saveGameProgress = vi.fn(async () => ({ version: 1 }));
    const adapter = createGoLivePlatform(fakeSdk({ saveGameProgress }));
    await adapter.connect();
    await adapter.loadProgress();
    expect(await adapter.saveProgress(save)).toBe("ok");
    expect(saveGameProgress).toHaveBeenCalledWith(save);
    const deep = { a: { b: { c: { d: { e: { f: {} } } } } } };
    expect(await adapter.saveProgress(deep)).toBe("error");
    expect(saveGameProgress).toHaveBeenCalledTimes(1);
  });
});

describe("session tracker", () => {
  it("sends the SDK v2 GAME_READY handshake to the embedding portal", () => {
    const parent = { postMessage: vi.fn() };
    vi.stubGlobal("window", { parent, location: { origin: "https://www.hippoarcade.com" } });
    notifyPortalReady("0.7.0");
    expect(parent.postMessage).toHaveBeenCalledWith({ type: "GAME_READY", gameVersion: "0.7.0" }, "https://www.hippoarcade.com");
  });
  it("reports played seconds once and only once", () => {
    const { platform } = fakePlatform();
    const session = createSessionTracker(platform);
    session.start();
    session.addPlayTime(1.5);
    session.addPlayTime(2.5);
    session.end();
    session.end();
    expect(platform.startSession).toHaveBeenCalledTimes(1);
    expect(platform.endSession).toHaveBeenCalledTimes(1);
    expect(platform.endSession).toHaveBeenCalledWith(4); // whole seconds
  });

  it("doesn't count time while the tab is hidden", () => {
    const { platform } = fakePlatform();
    const session = createSessionTracker(platform);
    session.start();
    vi.stubGlobal("document", { visibilityState: "hidden" });
    session.addPlayTime(10);
    expect(session.playedSeconds).toBe(0);
  });
});

describe("guests keep no cloud save (portal rule)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("the SDK adapter neither reads nor writes the cloud for a guest", async () => {
    const getGameProgress = vi.fn(async () => ({ progress: {}, version: 0 }));
    const saveGameProgress = vi.fn(async () => ({ version: 1 }));
    const sdk = {
      init: vi.fn(), startSession: vi.fn(), endSession: vi.fn(), track: vi.fn(),
      getPlayer: async () => ({ id: "g", displayName: "Guest_1", authType: "GUEST" }),
      getGameProgress, saveGameProgress,
    } as unknown as GoLiveSdk;
    const guest = createGoLivePlatform(sdk);
    await guest.connect();
    expect(guest.cloudSaveAllowed()).toBe(false);
    expect(await guest.loadProgress()).toBe("unavailable");
    expect(await guest.saveProgress({ schemaVersion: 6 })).toBe("error");
    expect(getGameProgress).not.toHaveBeenCalled();
    expect(saveGameProgress).not.toHaveBeenCalled();
  });

  it("the progress store saves a guest's run in the browser only", async () => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", { localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); }, removeItem: (k: string) => { store.delete(k); } } });
    vi.stubGlobal("document", { visibilityState: "visible" });
    const saveProgress = vi.fn(async () => "ok" as const);
    const platform: PlatformAdapter = {
      kind: "golive", connect: async () => null, loadProgress: async () => "unavailable", saveProgress,
      cloudSaveAllowed: () => false, submitScore: async () => "unavailable", readLeaderboard: async () => "unavailable", startSession() {}, endSession() {}, track() {}, onLateSignIn() {},
    };
    const progress = createProgressStore(platform, null);
    await progress.load(null);
    progress.save(saveAfter(2, "guest-run", 2), { immediate: true });
    await progress.flush();
    expect(saveProgress).not.toHaveBeenCalled();
    expect(store.size).toBeGreaterThan(0); // The browser copy was written.
  });
});


describe("production Strongest Player leaderboard", () => {
  it("reads the top ten and the registered player's rank using the production slug", async () => {
    const getLeaderboard = vi.fn().mockResolvedValue({ entries: [{ rank: 1, displayName: "Raja <one>", score: 12 }] });
    const getMyRank = vi.fn().mockResolvedValue({ rank: 4, score: 8 });
    const sdk = fakeSdk({ getLeaderboard, getMyRank, getPlayer: async () => ({ id: "p", displayName: "Player", authType: "EMAIL" }) });
    const adapter = createGoLivePlatform(sdk);
    await adapter.connect();
    expect(await adapter.readLeaderboard()).toEqual({ entries: [{ rank: 1, displayName: "Raja <one>", score: 12 }], me: { rank: 4, score: 8 } });
    expect(getLeaderboard).toHaveBeenCalledWith("strongplayer", 10);
    expect(getMyRank).toHaveBeenCalledWith("strongplayer");
    expect(sdk.init).toHaveBeenCalledWith({ clientVersion: __APP_VERSION__, platform: "web", timeoutMs: 15_000 });
  });

  it("lets guests read rankings without requesting a private rank", async () => {
    const getMyRank = vi.fn();
    const adapter = createGoLivePlatform(fakeSdk({ getLeaderboard: async () => ({ entries: [] }), getMyRank, getPlayer: async () => ({ id: "g", displayName: "Guest", authType: "GUEST" }) }));
    await adapter.connect();
    expect(await adapter.readLeaderboard()).toEqual({ entries: [], me: null });
    expect(getMyRank).not.toHaveBeenCalled();
  });

  it("handles missing methods, malformed responses and portal failures without blocking play", async () => {
    const missing = createGoLivePlatform(fakeSdk());
    await missing.connect();
    expect(await missing.readLeaderboard()).toBe("unavailable");
    for (const raw of [null, {}, { entries: "bad" }]) {
      const adapter = createGoLivePlatform(fakeSdk({ getLeaderboard: async () => raw }));
      await adapter.connect();
      expect(await adapter.readLeaderboard()).toBe("unavailable");
    }
    const adapter = createGoLivePlatform(fakeSdk({ getLeaderboard: async () => { throw new Error("offline"); } }));
    await adapter.connect();
    expect(await adapter.readLeaderboard()).toBe("unavailable");
  });
});
