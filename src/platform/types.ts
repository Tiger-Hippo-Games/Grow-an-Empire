/**
 * Types for the GoLive platform integration.
 *
 * `GoLiveSdk` describes `window.Platform` as documented in
 * common/SDK_REFERENCE.md and common/GAME_DEVELOPER_GUIDE.md §5. The docs
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
  startSession(): string | void;
  endSession(durationSeconds?: number): void;
  track(eventName: string, properties?: Record<string, unknown>): void;
}

declare global {
  interface Window {
    /** Injected by the portal's `/api/v1/sdk/platform-sdk.js`; absent when running locally. */
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
  /** The cloud save blob, or `null` if there is none or the cloud is unavailable. */
  loadProgress(): Promise<Record<string, unknown> | null>;
  /**
   * Writes the cloud save. Resolves `"ok"`, `"conflict"` (another device saved
   * a newer version first) or `"error"`. Never throws.
   */
  saveProgress(progress: Record<string, unknown>): Promise<"ok" | "conflict" | "error">;
  startSession(): void;
  endSession(durationSeconds: number): void;
  /** Fire-and-forget analytics. Never throws. */
  track(eventName: string, properties?: Record<string, unknown>): void;
}
