import type { PlatformAdapter } from "./types";

/**
 * Play-session bookkeeping for the portal's analytics.
 *
 * A session starts after sign-in and ends exactly once, whichever comes first:
 * the campaign ends, the portal sends `GP_SESSION_END`, or the page is closed
 * (`pagehide` / `beforeunload`; CONVERSION_GUIDE §13 asks for `beforeunload`
 * literally, SUBMISSION_GUIDE §5.1 warns it's unreliable on mobile, so both).
 * The seconds reported only count time the game was actually being played:
 * visible and not paused.
 */
export interface SessionTracker {
  start(): void;
  /** Ends the current session (no-op if already ended). */
  end(): void;
  /** Call every frame with the real (unscaled) frame time while the game is playing. */
  addPlayTime(seconds: number): void;
  readonly active: boolean;
  readonly playedSeconds: number;
}

export function createSessionTracker(platform: PlatformAdapter): SessionTracker {
  let active = false;
  let playedSeconds = 0;
  return {
    start() {
      if (active) return;
      active = true;
      playedSeconds = 0;
      platform.startSession();
    },
    end() {
      if (!active) return;
      active = false;
      platform.endSession(Math.floor(playedSeconds));
    },
    addPlayTime(seconds) {
      if (active && Number.isFinite(seconds) && seconds > 0 && document.visibilityState === "visible") playedSeconds += seconds;
    },
    get active() { return active; },
    get playedSeconds() { return playedSeconds; },
  };
}

/** Messages the portal sends into the game iframe (CONVERSION_GUIDE §6). */
export type PortalMessage = "GP_PAUSE" | "GP_RESUME" | "GP_SESSION_END";

/**
 * Listens for portal messages. Only messages from the embedding page are
 * accepted, so another frame can't pause or end the game.
 * @returns a function that stops listening.
 */
export function listenForPortalMessages(handler: (message: PortalMessage) => void): () => void {
  const onMessage = (event: MessageEvent): void => {
    if (window.parent === window || event.source !== window.parent) return;
    const type = (event.data as { type?: unknown } | null)?.type;
    if (type === "GP_PAUSE" || type === "GP_RESUME" || type === "GP_SESSION_END") handler(type);
  };
  window.addEventListener("message", onMessage);
  return () => window.removeEventListener("message", onMessage);
}

/**
 * SDK 1.5.0 ready handshake. Sent at most once per page: after the first
 * screen has drawn, or, if start-up fails, when the error screen is shown,
 * so the portal's loading overlay never hides the game's own message. The
 * boot watchdog in index.html sets `__gaeReadySent` when it sends it first.
 */
export function notifyPortalReady(version: string): void {
  const flags = window as unknown as { __gaeReadySent?: boolean };
  if (window.parent === window || flags.__gaeReadySent) return;
  flags.__gaeReadySent = true;
  try {
    window.parent.postMessage({ type: "GAME_READY", gameVersion: version }, "*");
  } catch (error) {
    console.warn("[Grow an Empire] Could not notify the portal that the game is ready.", error);
  }
}
