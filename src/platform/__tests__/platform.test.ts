import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONSTRUCTION_DURATION_SECONDS } from "../../game/content";
import { SettlementSimulation } from "../../game/settlementSimulation";
import { createGoLivePlatform, normalizeProgress } from "../adapters";
import { chooseSave, createProgressStore, toSavedGame, type SavedGame } from "../progressStore";
import { createSessionTracker } from "../session";
import type { GoLiveSdk, PlatformAdapter } from "../types";

/** A save of a run with `moves` completed buildings, saved at `minute` past the hour. */
function saveAfter(moves: number, runId: string, minute: number, tutorialComplete = false): SavedGame {
  const sim = new SettlementSimulation();
  for (let move = 0; move < moves; move += 1) {
    sim.chooseBuilding(sim.state.availableBuildingIds[0]);
    sim.update(CONSTRUCTION_DURATION_SECONDS);
  }
  const snapshot = JSON.parse(JSON.stringify(sim.serialize()));
  return { ...snapshot, savedAt: `2026-09-23T10:${String(minute).padStart(2, "0")}:00.000Z`, runId, settings: { tutorialComplete } };
}

const store = new Map<string, string>();
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
    expect(game?.settings).toEqual({ tutorialComplete: false });
  });
  it("rejects another campaign's save and garbage", () => {
    expect(toSavedGame({ ...saveAfter(1, "x", 0), campaignId: "other" }, new SettlementSimulation().campaign.id)).toBeNull();
    expect(toSavedGame({ hello: "world" }, new SettlementSimulation().campaign.id)).toBeNull();
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
    ...overrides,
  };
  return { platform, saves, setCloud: (value: Record<string, unknown> | null) => { cloud = value; } };
}

describe("progress store", () => {
  const campaignId = new SettlementSimulation().campaign.id;

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
    expect(calls).toBe(1);
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
