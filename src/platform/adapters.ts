import type { GoLiveSdk, LiveLeaderboard, PlatformAdapter, PlayerInfo } from "./types";
import { isRegisteredPlayer } from "../game/leaderboard";

/** The portal's guest player (signed out): may play, can't save to the cloud or post scores. */
const isGuest = (authType: string | undefined | null): boolean => typeof authType === "string" && authType.toUpperCase() === "GUEST";
import { debugFlagsAllowed } from "./debugFlags";

/**
 * The three platform backends.
 *
 * - `createGoLivePlatform` wraps the real SDK when the portal has loaded it.
 * - `createLocalPlatform` is the offline fallback: no cloud, no identity, no
 *   analytics. The game still saves to the browser (see progressStore.ts).
 * - `createMockPlatform` imitates the SDK for local testing (`?platform=mock`,
 *   plus `&auth=email` for a signed-in rather than a guest player):
 *   a "cloud" kept in localStorage, a guest player, and console logging of every
 *   call, so the whole integration can be exercised without the portal backend.
 */

/** Production weekly Highest Score Wins board; resets Monday at 00:00 UTC. */
export const LEADERBOARD_SLUG = "strongplayer";
export const MAX_CLOUD_SAVE_BYTES = 64 * 1024;
const MAX_SCORE_METADATA_BYTES = 2 * 1024;

/** Allow local practice to boot while a slow portal connection finishes. */
const LOGIN_TIMEOUT_MS = 5000;
const REQUEST_TIMEOUT_MS = 16_000;

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
  return errorCode(error) === "SAVE_CONFLICT" || (error as { status?: number } | null)?.status === 409;
}

function errorCode(error: unknown): string | undefined {
  return error && typeof error === "object" ? (error as { code?: string }).code : undefined;
}

/** JSON container nesting, including the root; leaf values don't add a level. */
export function jsonDepth(value: unknown): number {
  if (!value || typeof value !== "object") return 0;
  return 1 + Math.max(0, ...Object.values(value).map(jsonDepth));
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
export function createGoLivePlatform(sdk: GoLiveSdk): PlatformAdapter {
  let connected = false;
  let activePlayer: PlayerInfo | null = null;
  let loaded = false;
  let connecting: Promise<PlayerInfo | null> | null = null;
  let operations: Promise<unknown> = Promise.resolve();
  const statusListeners: Array<(message: string) => void> = [];
  const status = (message: string): void => { for (const listener of statusListeners) listener(message); };
  const failedProgress = (error: unknown): void => {
    loaded = false;
    if (errorCode(error) === "SESSION_CHANGED") {
      connected = false;
      status("Your portal account changed. Reload the game to reconnect; this run stays in this browser.");
    } else {
      status("Cloud progress could not be confirmed. This run stays in this browser; reconnect or reload to sync.");
    }
  };
  // Never depend on Web Locks: denied locks must not stop cloud progress.
  const serial = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = operations.then(operation);
    operations = result.catch(() => {});
    return result;
  };
  const warnOnce = new Set<string>();
  const warn = (key: string, message: string, error: unknown): void => {
    if (warnOnce.has(key)) return;
    warnOnce.add(key);
    console.warn(`[Grow an Empire] ${message}`, error);
  };

  const lateListeners: Array<(player: PlayerInfo) => void> = [];
  const validPlayer = (player: PlayerInfo): PlayerInfo => {
    if (!player || typeof player.id !== "string" || !player.id) throw new Error("Platform.getPlayer() returned no player");
    return {
      ...player,
      displayName: typeof player.displayName === "string" && player.displayName.trim()
        ? player.displayName.trim() : typeof player.username === "string" && player.username.trim() ? player.username.trim() : "Guest",
    };
  };

  return {
    kind: "golive",
    get isPreview() { return activePlayer?.authType?.toUpperCase() === "PREVIEW"; },
    get localSaveKey() {
      return activePlayer?.authType?.toUpperCase() === "PREVIEW"
        ? `grow-an-empire:preview:${encodeURIComponent(activePlayer.id)}:save:v1` : undefined;
    },
    onStatusChange(listener) { statusListeners.push(listener); },
    connect(): Promise<PlayerInfo | null> {
      if (connecting) return connecting;
      connecting = connect();
      return connecting;
    },
    cloudSaveAllowed: () => connected && !isGuest(activePlayer?.authType),
    loadProgress() {
      return serial(async () => {
        loaded = false;
        if (!connected || isGuest(activePlayer?.authType)) return "unavailable" as const;
        try {
          const result = await withTimeout(sdk.getGameProgress(), REQUEST_TIMEOUT_MS, "Platform.getGameProgress()");
          if (!result || !Number.isInteger(result.version) || result.version < 0 || !result.progress || typeof result.progress !== "object" || Array.isArray(result.progress)) {
            throw new Error("Malformed cloud progress envelope");
          }
          loaded = true;
          return normalizeProgress(result);
        } catch (error) {
          failedProgress(error);
          warn("load", "Could not load cloud progress; browser progress is retained and cloud writes wait for a successful read.", error);
          return "unavailable" as const;
        }
      });
    },
    saveProgress(progress) {
      return serial(async () => {
        if (!connected || isGuest(activePlayer?.authType) || !loaded) return "error" as const;
        try {
          if (jsonDepth(progress) > 6) throw new Error("Cloud save exceeds six nesting levels");
          if (new TextEncoder().encode(JSON.stringify(progress)).byteLength > MAX_CLOUD_SAVE_BYTES) throw new Error("Cloud save exceeds the 64 KB limit");
          await withTimeout(sdk.saveGameProgress(progress), REQUEST_TIMEOUT_MS, "Platform.saveGameProgress()");
          return "ok" as const;
        } catch (error) {
          failedProgress(error);
          if (isConflict(error)) return "conflict" as const;
          warn("save", "Cloud save failed; reload and reconcile progress before retrying. Browser saving continues.", error);
          return "error" as const;
        }
      });
    },
    async submitScore(score, metadata) {
      if (!connected || !isRegisteredPlayer(activePlayer?.authType)) return "unavailable";
      try {
        if (typeof sdk.submitScore !== "function") {
          warn("score-sdk", "Leaderboard capability is unavailable.", undefined);
          return "unavailable";
        }
        if (!Number.isFinite(score) || score < 0) throw new Error("Leaderboard score must be a finite non-negative number");
        if (new TextEncoder().encode(JSON.stringify(metadata)).byteLength > MAX_SCORE_METADATA_BYTES) {
          throw new Error("Leaderboard metadata exceeds the 2 KB limit");
        }
        await withTimeout(sdk.submitScore(LEADERBOARD_SLUG, score, metadata), REQUEST_TIMEOUT_MS, "Platform.submitScore()");
        return "ok";
      } catch (error) {
        warn("score", "Score was not posted; gameplay continues. Check the board slug, sign-in and portal access.", error);
        return "error";
      }
    },
    async readLeaderboard() {
      if (!connected || activePlayer?.authType?.toUpperCase() === "PREVIEW" || typeof sdk.getLeaderboard !== "function") return "unavailable";
      try {
        const [raw, own] = await Promise.all([
          withTimeout(sdk.getLeaderboard(LEADERBOARD_SLUG, 10), REQUEST_TIMEOUT_MS, "Platform.getLeaderboard()"),
          isRegisteredPlayer(activePlayer?.authType) && typeof sdk.getMyRank === "function"
            ? withTimeout(sdk.getMyRank(LEADERBOARD_SLUG), REQUEST_TIMEOUT_MS, "Platform.getMyRank()").catch((error: unknown) => { warn("rank", "Your rank could not be loaded.", error); return null; })
            : Promise.resolve(null),
        ]);
        if (!raw || typeof raw !== "object" || !Array.isArray((raw as { entries?: unknown }).entries)) throw new Error("Malformed leaderboard response");
        const entries: LiveLeaderboard["entries"] = [];
        for (const value of (raw as { entries: unknown[] }).entries.slice(0, 10)) {
          if (!value || typeof value !== "object") continue;
          const row = value as Record<string, unknown>;
          if (!Number.isInteger(row.rank) || (row.rank as number) < 1 || typeof row.score !== "number" || !Number.isFinite(row.score) || row.score < 0) continue;
          entries.push({ rank: row.rank as number, score: row.score, displayName: typeof row.displayName === "string" ? row.displayName : "Player" });
        }
        const rank = own && typeof own === "object" ? own as Record<string, unknown> : null;
        return { entries, me: rank ? {
          rank: Number.isInteger(rank.rank) && (rank.rank as number) > 0 ? rank.rank as number : null,
          score: typeof rank.score === "number" && Number.isFinite(rank.score) && rank.score >= 0 ? rank.score : null,
        } : null };
      } catch (error) {
        warn("board", "Weekly leaderboard could not be loaded; play continues.", error);
        return "unavailable";
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
      callQuietly(() => sdk.track(eventName, properties), (error) => warn("track", "track() failed", error));
    },
    onLateSignIn(listener) { lateListeners.push(listener); },
  };

  async function connect(): Promise<PlayerInfo | null> {
      const signIn = (async () => {
        await sdk.init({ clientVersion: __APP_VERSION__, platform: "web", timeoutMs: 15_000 });
        return validPlayer(await sdk.getPlayer());
      })();
      try {
        const player = await withTimeout(signIn, LOGIN_TIMEOUT_MS, "Platform.init()/getPlayer()");
        connected = true;
        activePlayer = player;
        console.info("[GoLive] Player active", { authType: player.authType }); // No id or name in logs.
        return player;
      } catch (error) {
        warn("connect", "Could not sign in; playing offline with browser saves only.", error);
        status("Portal connection unavailable. This run stays in this browser; reconnect or reload to sync.");
        // A slow portal may still sign the player in: switch the cloud on then.
        signIn.then((player) => {
          if (connected) return;
          // Practice may already be using the live browser slot. Never upload
          // that run into an isolated preview that connected late.
          if (player.authType?.toUpperCase() === "PREVIEW") {
            status("Preview connected. Reload to restore its separate preview progress.");
            return;
          }
          connected = true;
          activePlayer = player;
          console.info("[GoLive] Signed in late; cloud saves resume", { authType: player.authType });
          for (const listener of lateListeners) {
            try { listener(player); } catch (listenerError) { console.warn("[GoLive] Late sign-in handler failed", listenerError); }
          }
        }, () => { /* Already reported above. */ });
        return null;
      }
  }
}

/** Offline fallback: the game plays and saves locally, nothing else. */
export function createLocalPlatform(): PlatformAdapter {
  return {
    kind: "local",
    connect: async () => null,
    loadProgress: async () => "unavailable",
    saveProgress: async () => "error",
    cloudSaveAllowed: () => false,
    submitScore: async () => "unavailable",
    readLeaderboard: async () => "unavailable",
    startSession() {},
    endSession() {},
    track() {},
    onLateSignIn() {},
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

  let registered = false;
  let mockScore: number | null = null;
  return {
    kind: "mock",
    async connect() {
      record("init", { clientVersion: __APP_VERSION__, platform: "web", timeoutMs: 15_000 });
      record("getPlayer");
      // ?platform=mock&auth=email signs in as a registered player (the leaderboard path).
      const auth = new URLSearchParams(window.location.search).get("auth");
      registered = Boolean(auth && auth.toUpperCase() !== "GUEST");
      return auth && auth.toUpperCase() !== "GUEST"
        ? { id: "mock-player-registered", displayName: "Mock Player", authType: auth.toUpperCase() }
        : { id: "mock-player", displayName: "Guest_mock", authType: "GUEST" };
    },
    async submitScore(score, metadata) {
      if (!registered) return "unavailable";
      record("submitScore", LEADERBOARD_SLUG, score, metadata);
      mockScore = Math.max(mockScore ?? 0, score);
      return "ok";
    },
    async readLeaderboard() {
      record("getLeaderboard", LEADERBOARD_SLUG, 10);
      if (registered) record("getMyRank", LEADERBOARD_SLUG);
      return { entries: mockScore === null ? [] : [{ rank: 1, displayName: "Mock Player", score: mockScore }], me: registered ? { rank: mockScore === null ? null : 1, score: mockScore } : null };
    },
    cloudSaveAllowed: () => registered,
    async loadProgress() {
      // Like the portal: a guest has no cloud save (sign in with &auth=email to test cloud saves).
      if (!registered) return "unavailable";
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
    onLateSignIn() {},
  };
}

/**
 * Picks the backend: the real SDK when the portal injected it, the mock when
 * the URL has `?platform=mock` (development and localhost only), otherwise offline.
 */
export function createPlatform(): PlatformAdapter {
  const params = new URLSearchParams(window.location.search);
  // The mock is a testing switch: never on the portal (platform/debugFlags.ts).
  if (debugFlagsAllowed() && params.get("platform") === "mock") return createMockPlatform();
  if (window.Platform && typeof window.Platform.init === "function") {
    return createGoLivePlatform(window.Platform);
  }
  return createLocalPlatform();
}
