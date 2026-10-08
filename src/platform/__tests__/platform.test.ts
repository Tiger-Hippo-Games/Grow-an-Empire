import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { playMove } from "../../game/__tests__/play";
import { SettlementSimulation } from "../../game/settlementSimulation";
import { createGoLivePlatform, normalizeProgress } from "../adapters";
import { belongsToAnotherPlayer, chooseSave, createProgressStore, toSavedGame, type SavedGame } from "../progressStore";
import { createSessionTracker } from "../session";
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
    await vi.advanceTimersByTimeAsync(2100);
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
    let fail = true;
    const { platform, saves } = fakePlatform();
    const save = platform.saveProgress;
    const progress = createProgressStore({ ...platform, saveProgress: async (value) => (fail ? "error" : save(value)) }, campaignId);
    await progress.load("p");
    progress.save(saveAfter(4, "r", 5), { immediate: true });
    await progress.flush();
    expect(saves).toHaveLength(0);
    fail = false;
    await progress.flush(); // the retry timer would do this; flush runs it now
    expect(saves).toHaveLength(1);
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

describe("GoLive SDK wrapper", () => {
  function fakeSdk(overrides: Partial<GoLiveSdk> = {}): GoLiveSdk {
    return {
      init: vi.fn(),
      login: async () => ({ player: { id: "1", displayName: "Guest_1" } }),
      getGameProgress: async () => ({ progress: {}, version: 0 }),
      saveGameProgress: async () => ({ version: 1 }),
      startSession: vi.fn(),
      endSession: vi.fn(),
      track: vi.fn(),
      ...overrides,
    };
  }

  it("initializes with the registered slug before signing in", async () => {
    const sdk = fakeSdk();
    await createGoLivePlatform(sdk, "/api/v1").connect();
    expect(sdk.init).toHaveBeenCalledWith({ apiBaseUrl: "/api/v1", gameId: "grow-an-empire" });
  });

  it("never throws: failed login means offline, and nothing is sent", async () => {
    const sdk = fakeSdk({ login: async () => { throw new Error("network"); } });
    const adapter = createGoLivePlatform(sdk, "/api/v1");
    expect(await adapter.connect()).toBeNull();
    expect(await adapter.saveProgress({})).toBe("error");
    adapter.track("x");
    expect(sdk.track).not.toHaveBeenCalled();
  });

  it("reports conflicts distinctly from other errors", async () => {
    const adapter = createGoLivePlatform(fakeSdk({ saveGameProgress: async () => { throw new Error("Conflict"); } }), "/api/v1");
    await adapter.connect();
    expect(await adapter.saveProgress({ a: 1 })).toBe("conflict");
  });

  it("survives a track() that throws", async () => {
    const adapter = createGoLivePlatform(fakeSdk({ track: () => { throw new Error("boom"); } }), "/api/v1");
    await adapter.connect();
    expect(() => adapter.track("x")).not.toThrow();
  });

  it("catches rejected promises from the fire-and-forget calls", async () => {
    const rejected = () => Promise.reject(new Error("offline")) as unknown as void;
    const adapter = createGoLivePlatform(fakeSdk({ track: rejected, startSession: rejected, endSession: rejected }), "/api/v1");
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
      login: async () => { order.push("login"); return { player: { id: "1", displayName: "Guest_1" } }; },
    });
    expect(await createGoLivePlatform(sdk, "/api/v1").connect()).not.toBeNull();
    expect(order).toEqual(["init", "login"]);
  });

  it("treats a login with no player as offline instead of crashing", async () => {
    const adapter = createGoLivePlatform(fakeSdk({ login: async () => null }), "/api/v1");
    expect(await adapter.connect()).toBeNull();
    expect(await adapter.saveProgress({ a: 1 })).toBe("error");
  });

  it("gives up on a login that never answers", async () => {
    vi.useFakeTimers();
    const adapter = createGoLivePlatform(fakeSdk({ login: () => new Promise(() => {}) }), "/api/v1");
    const connecting = adapter.connect();
    await vi.advanceTimersByTimeAsync(5100);
    expect(await connecting).toBeNull();
  });
});

describe("session tracker", () => {
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
