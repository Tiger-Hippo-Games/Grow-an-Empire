import { isRegisteredPlayer, type LeaderboardEntry } from "../game/leaderboard";
import type { PlatformAdapter, PlayerInfo } from "./types";

const SCORE_INTERVAL_MS = 30_000;

/** Posts completed battle results, coalescing fast replays to the best score. */
export function createScoreSubmission(platform: PlatformAdapter) {
  let lastAttempt = -Infinity;
  let postedScore = -1;
  let pending: LeaderboardEntry | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let sending = false;
  let warned = false;

  async function send(): Promise<void> {
    timer = null;
    if (sending || !pending) return;
    const wait = SCORE_INTERVAL_MS - (Date.now() - lastAttempt);
    if (wait > 0) { timer = setTimeout(() => { void send(); }, wait); return; }
    const entry = pending;
    pending = null;
    lastAttempt = Date.now();
    sending = true;
    try {
      const result = await platform.submitScore(entry.score, {
        level: entry.level, campaignId: entry.campaignId,
        totalStars: entry.totalStars, reachedAt: entry.reachedAt,
      });
      if (result === "ok") postedScore = Math.max(postedScore, entry.score);
      // A rejection is non-fatal. The next battle can try again; do not
      // repeatedly retry a missing/deactivated board or a forbidden account.
    } catch (error) {
      if (!warned) {
        warned = true;
        console.warn("[Grow an Empire] Leaderboard submission failed unexpectedly; play continues.", error);
      }
    } finally {
      sending = false;
      schedulePending();
    }
  }

  function schedulePending(): void {
    // Read afresh: another completed battle can enqueue while send awaits.
    if (!pending) return;
    if (pending.score <= postedScore) pending = null;
    else timer = setTimeout(() => { void send(); }, Math.max(0, SCORE_INTERVAL_MS - (Date.now() - lastAttempt)));
  }

  return {
    /** Call on match end, including a defeat with earlier earned progress. */
    submit(entry: LeaderboardEntry, player: PlayerInfo | null): void {
      if (!player || !isRegisteredPlayer(player.authType) || !Number.isFinite(entry.score) || entry.score <= 0 || entry.score <= postedScore) return;
      if (!pending || entry.score > pending.score) pending = entry;
      if (!sending && !timer) void send();
    },
  };
}
