/**
 * Decides whether an error nobody caught came from the game's own code.
 *
 * Only the game's own failures may pause a run (main.ts `failSimulation`).
 * Errors from elsewhere are logged and reported, and play goes on:
 * - muted cross-origin errors ("Script error.", `error` null), e.g. from the
 *   portal SDK, which is loaded without `crossorigin`;
 * - the browser's benign "ResizeObserver loop …" notice (the HUD and the map
 *   both observe their own size);
 * - anything thrown inside the SDK file;
 * - promise rejections whose stack doesn't run through the game's bundle
 *   (an SDK analytics request blocked by an ad blocker, for example).
 */

/** Script files that belong to the game: the built bundle, or the dev server's sources. */
const GAME_SCRIPT = /\/game(?:-[\w-]+)?\.js|\/src\//;
const BENIGN_MESSAGE = /^(?:ResizeObserver loop|Script error)/i;

/** True when an uncaught `error` event should pause the game. */
export function isGameError(message: string | undefined, error: unknown, filename: string | undefined): boolean {
  if (BENIGN_MESSAGE.test(message ?? "")) return false;
  if (!(error instanceof Error)) return false;
  if ((filename ?? "").includes("platform-sdk")) return false;
  return true;
}

/** True when an `unhandledrejection` should pause the game: its stack shows the game's own code. */
export function isGameRejection(reason: unknown): boolean {
  if (!(reason instanceof Error)) return false;
  const stack = reason.stack ?? "";
  if (stack.includes("platform-sdk")) return false;
  return GAME_SCRIPT.test(stack);
}
