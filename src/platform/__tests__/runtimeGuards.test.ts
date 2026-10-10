import { afterEach, describe, expect, it, vi } from "vitest";
import { debugFlagsAllowed } from "../debugFlags";
import { isGameError, isGameRejection } from "../errorFilter";
import { notifyPortalReady } from "../session";

/** The 0.10.2 review fixes: what may pause the game, testing switches, the ready handshake. */

function errorFrom(file: string): Error {
  const error = new Error("boom");
  error.stack = `Error: boom\n    at handler (${file}:1:200)`;
  return error;
}

describe("uncaught errors", () => {
  it("pauses for the game's own errors", () => {
    expect(isGameError("Uncaught TypeError: x is undefined", new TypeError("x is undefined"), "https://cdn.example/game.js?v=0.10.2")).toBe(true);
  });

  it("ignores muted cross-origin errors, the ResizeObserver notice and the SDK", () => {
    expect(isGameError("Script error.", null, "")).toBe(false);
    expect(isGameError("ResizeObserver loop completed with undelivered notifications.", null, "")).toBe(false);
    expect(isGameError("ResizeObserver loop limit exceeded", new Error("x"), "")).toBe(false);
    expect(isGameError("boom", new Error("boom"), "https://golive-platform.netlify.app/sdk/platform-sdk.js")).toBe(false);
    expect(isGameError("a string was thrown", "oops", "game.js")).toBe(false);
  });

  it("pauses only for rejections whose stack runs through the game", () => {
    expect(isGameRejection(errorFrom("https://cdn.example/play/game.js?v=0.10.2"))).toBe(true);
    expect(isGameRejection(errorFrom("http://127.0.0.1:4173/src/main.ts"))).toBe(true);
    expect(isGameRejection(errorFrom("https://golive-platform.netlify.app/sdk/platform-sdk.js"))).toBe(false);
    const fetchFailure = new TypeError("Failed to fetch");
    fetchFailure.stack = "TypeError: Failed to fetch"; // A browser fetch rejection carries no game frames.
    expect(isGameRejection(fetchFailure)).toBe(false);
    expect(isGameRejection("blocked by client")).toBe(false);
  });
});

describe("testing switches", () => {
  it("work in development and on this machine only", () => {
    expect(debugFlagsAllowed(["127", "0", "0", "1"].join("."), false)).toBe(true);
    expect(debugFlagsAllowed("my-pc", false)).toBe(true);
    expect(debugFlagsAllowed("games.golive.example", false)).toBe(false);
    expect(debugFlagsAllowed("games.golive.example", true)).toBe(true);
  });
});

describe("GAME_READY", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("is sent once, however many paths ask (first draw, error screen, watchdog)", () => {
    const postMessage = vi.fn();
    const parent = { postMessage };
    vi.stubGlobal("window", { parent });
    notifyPortalReady("0.10.2");
    notifyPortalReady("0.10.2");
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith({ type: "GAME_READY", gameVersion: "0.10.2" }, "*");
  });

  it("is not sent again when the boot watchdog already sent it", () => {
    const postMessage = vi.fn();
    vi.stubGlobal("window", { parent: { postMessage }, __gaeReadySent: true });
    notifyPortalReady("0.10.2");
    expect(postMessage).not.toHaveBeenCalled();
  });
});
