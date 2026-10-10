/**
 * Types for the GoLive platform integration.
 *
 * `GoLiveSdk` describes `window.Platform` as documented in
 * common/GOLIVE_DEVELOPER_REFERENCE.md (SDK 1.5.0). The older docs
 * disagree on a few details (e.g. empty progress is `{}` in one and `null` in
 * another), so these types are deliberately loose where the docs are.
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
  init(config: { apiBaseUrl?: string; gameId: string; storagePrefix?: string }): void | Promise<unknown>;
  login(): Promise<{ player: PlayerInfo; accessToken?: string } | null | undefined>;
  getGameProgress(gameId?: string): Promise<{ progress?: Record<string, unknown> | null; version?: number } | null | undefined>;
  saveGameProgress(progress: Record<string, unknown>, gameId?: string): Promise<unknown>;
  /** Optional only so a stale SDK degrades safely; SDK 1.5.0 provides it. */
  submitScore?(leaderboardSlug: string, score: number, metadata?: Record<string, unknown>): Promise<unknown>;
  startSession(): string | void;
  endSession(durationSeconds?: number): void;
  track(eventName: string, properties?: Record<string, unknown>): void;
}

declare global {
  interface Window {
    /** Loaded from the official /sdk/platform-sdk.js URL. */
    Platform?: GoLiveSdk;
  }
}

/** Which backend is active. Shown in the console at boot. */
export type PlatformKind = "golive" | "local" | "mock";

/**
 * Everything the game needs from "the platform". Every method is safe to call
 * in any state: failures are caught inside the adapter and reported by return
 * value, never thrown, because the game must keep running if the platform is
 * down (GAME_ARCHITECTURE §18).
 */
export interface PlatformAdapter {
  readonly kind: PlatformKind;
  /** Initializes and signs the player in (guest on first visit). Resolves `null` if unavailable. */
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
  /** Real portal leaderboard submission; failure never blocks gameplay. */
  submitScore(score: number, metadata: Record<string, unknown>): Promise<"ok" | "error" | "unavailable">;
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
