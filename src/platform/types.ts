/**
 * Types for the Hippo Arcade portal-bridge integration.
 *
 * `GoLiveSdk` describes `window.Platform` as documented in
 * developer-kit/SDK_REFERENCE.md (SDK v2). Routing, game binding and
 * authentication belong to the parent portal; games never receive tokens.
 *
 * `PlatformAdapter` is what the rest of the game uses. Gameplay code never
 * touches `window.Platform` directly (GAME_ARCHITECTURE §4, CODING_STANDARDS §16).
 */

export interface PlayerInfo {
  id: string;
  username?: string;
  displayName: string;
  authType?: string;
}

/** The documented surface of `window.Platform` that this game uses. */
export interface GoLiveSdk {
  init(config?: { clientVersion?: string; platform?: string; timeoutMs?: number }): Promise<unknown> | void;
  getPlayer(): Promise<PlayerInfo>;
  getGameProgress(): Promise<{ progress: Record<string, unknown>; version: number }>;
  saveGameProgress(progress: Record<string, unknown>): Promise<unknown>;
  /** Optional to degrade safely if a capability is unavailable. */
  submitScore?(leaderboardSlug: string, score: number, metadata?: Record<string, unknown>): Promise<unknown>;
  getLeaderboard?(leaderboardSlug: string, limit: number): Promise<unknown>;
  getMyRank?(leaderboardSlug: string): Promise<unknown>;
  startSession(): string | void;
  endSession(durationSeconds?: number): void;
  track(eventName: string, properties?: Record<string, unknown>): void;
}

declare global {
  interface Window {
    /** Loaded from the serving origin's /sdk/v2/platform-sdk.js. */
    Platform?: GoLiveSdk;
  }
}

/** Which backend is active. Shown in the console at boot. */
export type PlatformKind = "golive" | "local" | "mock";

export interface PlayerRanking { rank: number; displayName: string; score: number }
export interface LiveLeaderboard {
  entries: PlayerRanking[];
  me: { rank: number | null; score: number | null } | null;
}

/**
 * Everything the game needs from "the platform". Every method is safe to call
 * in any state: failures are caught inside the adapter and reported by return
 * value, never thrown, because the game must keep running if the platform is
 * down (GAME_ARCHITECTURE §18).
 */
export interface PlatformAdapter {
  readonly kind: PlatformKind;
  /** Initializes the bridge and reads portal identity. Resolves `null` if unavailable. */
  connect(): Promise<PlayerInfo | null>;
  /**
   * The cloud save blob, `null` if the player has none, or `"unavailable"` if
   * it couldn't be read (offline, timed out, SDK error). The difference
   * matters: progressStore never writes to a cloud it couldn't read, so a slow
   * read can't replace real progress with a fresh game.
   */
  loadProgress(): Promise<Record<string, unknown> | null | "unavailable">;
  /**
   * Writes the cloud save. Resolves `"ok"`, `"conflict"` (another device saved
   * a newer version first) or `"error"`. Never throws.
   */
  saveProgress(progress: Record<string, unknown>): Promise<"ok" | "conflict" | "error">;
  /**
   * False when this player can't have a cloud save: guests (the portal keeps
   * none for them) and offline play. Their progress stays in the browser; a
   * guest who signs in later starts saving to the cloud from then on.
   */
  cloudSaveAllowed(): boolean;
  /** Isolated browser cache for preview profiles; live saves retain their existing key. */
  readonly localSaveKey?: string;
  /** Connection/save failures that need a visible retry/reload message. */
  onStatusChange?(listener: (message: string) => void): void;
  readonly isPreview?: boolean;
  /** Real portal leaderboard submission; failure never blocks gameplay. */
  submitScore(score: number, metadata: Record<string, unknown>): Promise<"ok" | "error" | "unavailable">;
  readLeaderboard(): Promise<LiveLeaderboard | "unavailable">;
  startSession(): void;
  endSession(durationSeconds: number): void;
  /** Fire-and-forget analytics. Never throws. */
  track(eventName: string, properties?: Record<string, unknown>): void;
  /**
   * Called if sign-in finishes after `connect()` gave up waiting (slow
   * portal), so the session can still use the cloud and the leaderboard.
   */
  onLateSignIn(listener: (player: PlayerInfo) => void): void;
}
