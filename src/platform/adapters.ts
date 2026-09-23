import type { GoLiveSdk, PlatformAdapter, PlayerInfo } from "./types";

/**
 * The three platform backends.
 *
 * - `createGoLivePlatform` wraps the real SDK when the portal has loaded it.
 * - `createLocalPlatform` is the offline fallback: no cloud, no identity, no
 *   analytics. The game still saves to the browser (see progressStore.ts).
 * - `createMockPlatform` imitates the SDK for local testing (`?platform=mock`):
 *   a "cloud" kept in localStorage, a guest player, and console logging of every
 *   call, so the whole integration can be exercised without the portal backend.
 */

/** Slug registered in the Developer Console. Must match it exactly (DEVELOPER_GUIDE §8). */
export const GAME_ID = "grow-an-empire";

/** Portal login falls back to a guest within ~3 s; we stop waiting after this. */
const LOGIN_TIMEOUT_MS = 5000;
const REQUEST_TIMEOUT_MS = 8000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms} ms`)), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error: unknown) => { clearTimeout(timer); reject(error); },
    );
  });
}

/** Treats `null`, `{}` and a missing `progress` field as "no cloud save" (the docs disagree on which one). */
export function normalizeProgress(result: unknown): Record<string, unknown> | null {
  if (!result || typeof result !== "object") return null;
  const progress = (result as { progress?: unknown }).progress;
  if (!progress || typeof progress !== "object" || Array.isArray(progress)) return null;
  return Object.keys(progress).length > 0 ? (progress as Record<string, unknown>) : null;
}

function isConflict(error: unknown): boolean {
  return error instanceof Error && /conflict|409/i.test(error.message);
}

/**
 * Calls a "fire-and-forget" SDK method safely. The docs type these as
 * returning nothing, but an SDK build may return a promise; a rejected one
 * would otherwise surface as an unhandled rejection. Catches both.
 */
function callQuietly(call: () => unknown, onError: (error: unknown) => void): void {
  try {
    const result = call();
    if (result && typeof (result as PromiseLike<unknown>).then === "function") {
      Promise.resolve(result).catch(onError);
    }
  } catch (error) {
    onError(error);
  }
}

/** Wraps `window.Platform`. Every call is guarded so the SDK can never break the game. */
export function createGoLivePlatform(sdk: GoLiveSdk, apiBaseUrl: string): PlatformAdapter {
  let connected = false;
  const warnOnce = new Set<string>();
  const warn = (key: string, message: string, error: unknown): void => {
    if (warnOnce.has(key)) return;
    warnOnce.add(key);
    console.warn(`[GoLive] ${message}`, error);
  };

  return {
    kind: "golive",
    async connect(): Promise<PlayerInfo | null> {
      try {
        // init() may be sync or async depending on the SDK build. init and
        // login share one time budget, because boot waits for them.
        const signIn = async () => {
          await sdk.init({ apiBaseUrl, gameId: GAME_ID });
          return sdk.login();
        };
        const result = await withTimeout(signIn(), LOGIN_TIMEOUT_MS, "Platform.init()/login()");
        const player = result?.player;
        if (!player || typeof player.id !== "string") throw new Error("Platform.login() returned no player");
        connected = true;
        console.info("[GoLive] Player active", { id: player.id, displayName: player.displayName, authType: player.authType });
        return player;
      } catch (error) {
        warn("connect", "Could not sign in; playing offline with browser saves only.", error);
        return null;
      }
    },
    async loadProgress() {
      if (!connected) return null;
      try {
        return normalizeProgress(await withTimeout(sdk.getGameProgress(), REQUEST_TIMEOUT_MS, "Platform.getGameProgress()"));
      } catch (error) {
        warn("load", "Could not load the cloud save; using the browser save.", error);
        return null;
      }
    },
    async saveProgress(progress) {
      if (!connected) return "error";
      try {
        await withTimeout(sdk.saveGameProgress(progress), REQUEST_TIMEOUT_MS, "Platform.saveGameProgress()");
        return "ok";
      } catch (error) {
        if (isConflict(error)) return "conflict";
        warn("save", "Cloud save failed; progress is still saved in this browser.", error);
        return "error";
      }
    },
    startSession() {
      if (!connected) return;
      callQuietly(() => sdk.startSession(), (error) => warn("session", "startSession failed", error));
    },
    endSession(durationSeconds) {
      if (!connected) return;
      const seconds = Number.isFinite(durationSeconds) ? Math.max(0, Math.floor(durationSeconds)) : 0;
      callQuietly(() => sdk.endSession(seconds), (error) => warn("session-end", "endSession failed", error));
    },
    track(eventName, properties) {
      if (!connected) return;
      // Analytics must never affect play; failures are reported once.
      callQuietly(() => sdk.track(eventName, properties), (error) => warn("track", "track() failed", error));
    },
  };
}

/** Offline fallback: the game plays and saves locally, nothing else. */
export function createLocalPlatform(): PlatformAdapter {
  return {
    kind: "local",
    connect: async () => null,
    loadProgress: async () => null,
    saveProgress: async () => "error",
    startSession() {},
    endSession() {},
    track() {},
  };
}

/** Everything the mock recorded; exposed as `window.__goLiveMock` for tests and debugging. */
export interface MockPlatformLog {
  calls: Array<{ method: string; args: unknown[] }>;
  /** Makes the next `saveProgress` report a conflict, to exercise the merge path. */
  failNextSaveWithConflict: boolean;
}

const MOCK_CLOUD_KEY = "grow-an-empire:mock-cloud";

/** SDK stand-in for local testing. The "cloud" lives in localStorage so it survives reloads. */
export function createMockPlatform(): PlatformAdapter {
  const log: MockPlatformLog = { calls: [], failNextSaveWithConflict: false };
  (window as unknown as { __goLiveMock: MockPlatformLog }).__goLiveMock = log;
  const record = (method: string, ...args: unknown[]): void => {
    log.calls.push({ method, args });
    console.info(`[GoLive mock] ${method}`, ...args);
  };
  const readCloud = (): Record<string, unknown> | null => {
    try {
      const raw = window.localStorage.getItem(MOCK_CLOUD_KEY);
      return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  };

  return {
    kind: "mock",
    async connect() {
      record("init", { gameId: GAME_ID });
      record("login");
      return { id: "mock-player", displayName: "Guest_mock", authType: "GUEST" };
    },
    async loadProgress() {
      record("getGameProgress");
      return readCloud();
    },
    async saveProgress(progress) {
      record("saveGameProgress", { bytes: JSON.stringify(progress).length });
      if (log.failNextSaveWithConflict) {
        log.failNextSaveWithConflict = false;
        return "conflict";
      }
      try {
        window.localStorage.setItem(MOCK_CLOUD_KEY, JSON.stringify(progress));
        return "ok";
      } catch {
        return "error";
      }
    },
    startSession: () => record("startSession"),
    endSession: (seconds) => record("endSession", seconds),
    track: (eventName, properties) => record("track", eventName, properties),
  };
}

/**
 * Picks the backend: the real SDK when the portal injected it, the mock when
 * the URL has `?platform=mock`, otherwise offline.
 */
export function createPlatform(): PlatformAdapter {
  const params = new URLSearchParams(window.location.search);
  if (params.get("platform") === "mock") return createMockPlatform();
  if (window.Platform && typeof window.Platform.init === "function") {
    const apiBaseUrl = (import.meta.env.VITE_PLATFORM_API as string | undefined) || "/api/v1";
    return createGoLivePlatform(window.Platform, apiBaseUrl);
  }
  return createLocalPlatform();
}
