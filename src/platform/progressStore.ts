import { describeSnapshotProblem, type SettlementSnapshot } from "../game/settlementSimulation";
import { clearSavedSnapshot, hasNewerLocalSave, isFromNewerVersion, loadSavedSnapshot, saveSnapshot } from "../game/saveGame";
import type { PlatformAdapter } from "./types";

/**
 * Player progress, saved in two places:
 *
 * 1. **The browser** (localStorage), synchronously on every save. Fast, works
 *    offline, but blocked in Safari iframes and private windows.
 * 2. **The GoLive cloud** (`Platform.saveGameProgress`), debounced to at most
 *    one write per 2 s, and flushed immediately when the tab is hidden, the
 *    page closes, or a run ends. This is the primary copy on the portal
 *    (GAME_SUBMISSION_GUIDE §5.1; GAME_ARCHITECTURE §8).
 *
 * The saved blob is the simulation's own versioned snapshot plus a run id and
 * player settings, about 2 KB against the portal's 64 KB cap. Only add fields
 * from here on; never rename or remove one. Old builds' saves must keep loading.
 */

/** Player preferences that follow the save (not tied to one run). */
export interface SavedSettings {
  tutorialComplete: boolean;
}

/** What is stored locally and in the cloud. */
export type SavedGame = SettlementSnapshot & {
  /** Identifies one playthrough; a Restart starts a new run id. */
  runId: string;
  settings: SavedSettings;
  /**
   * The portal player this save belongs to, when known. The browser copy is
   * shared by everyone using that browser, so a copy owned by someone else
   * must never be loaded, or pushed into another player's cloud save.
   */
  playerId?: string;
};

export const DEFAULT_SETTINGS: SavedSettings = { tutorialComplete: false };
const CLOUD_DEBOUNCE_MS = 2000;

/** A fresh run id. */
export function newRunId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

/**
 * Reads unknown data (from localStorage or the cloud) as a SavedGame, or
 * `null` if it can't be used. Saves from before run ids and settings existed
 * get defaults, so they still load (the portal keeps saves across updates).
 */
export function toSavedGame(raw: unknown, campaignId: string): SavedGame | null {
  if (describeSnapshotProblem(raw) !== null) return null;
  const snapshot = raw as SavedGame;
  if (snapshot.campaignId !== campaignId) return null;
  const settings = (snapshot.settings && typeof snapshot.settings === "object") ? snapshot.settings : DEFAULT_SETTINGS;
  const game: SavedGame = {
    ...snapshot,
    runId: typeof snapshot.runId === "string" && snapshot.runId ? snapshot.runId : "legacy",
    settings: { tutorialComplete: settings.tutorialComplete === true },
  };
  if (typeof snapshot.playerId !== "string" || !snapshot.playerId) delete game.playerId;
  return game;
}

/**
 * True if the browser copy belongs to a different player than the one signed
 * in. Unknown on either side (offline, or a save from before player ids) is
 * not a mismatch: a guest's browser progress should follow them when they sign in.
 */
export function belongsToAnotherPlayer(save: SavedGame | null, playerId: string | null): boolean {
  return Boolean(save?.playerId && playerId && save.playerId !== playerId);
}

/** How far a run has got: completed buildings, plus one once the campaign is over. */
function progressOf(save: SavedGame): number {
  return save.state.builtBuildingIds.length + (save.state.mode === "complete" ? 1 : 0);
}

function savedAtOf(save: SavedGame): number {
  const time = Date.parse(save.savedAt);
  return Number.isFinite(time) ? time : 0;
}

/**
 * Picks which copy to keep when the browser and the cloud disagree.
 *
 * - Same run on both: keep the one that is further along, then the newer one.
 *   (Playing on two devices never loses a completed move.)
 * - Different runs: keep the newer one. (A Restart replaces the old run, even
 *   if the old run was further along.)
 * Settings are merged: once the tutorial is done on either copy, it stays done.
 */
export function chooseSave(local: SavedGame | null, cloud: SavedGame | null): SavedGame | null {
  if (!local || !cloud) return local ?? cloud;
  let winner: SavedGame;
  if (local.runId === cloud.runId) {
    const byProgress = progressOf(local) - progressOf(cloud);
    winner = byProgress > 0 ? local : byProgress < 0 ? cloud : (savedAtOf(local) >= savedAtOf(cloud) ? local : cloud);
  } else {
    winner = savedAtOf(local) >= savedAtOf(cloud) ? local : cloud;
  }
  return {
    ...winner,
    settings: { tutorialComplete: local.settings.tutorialComplete || cloud.settings.tutorialComplete },
  };
}

export interface ProgressStore {
  /**
   * Loads both copies and returns the one to resume, or `null` for a fresh start.
   * @param playerId the signed-in portal player, or `null` if unknown (offline).
   */
  load(playerId?: string | null): Promise<SavedGame | null>;
  /** Saves locally now and to the cloud soon (or now, with `immediate`). */
  save(game: SavedGame, options?: { immediate?: boolean }): void;
  /** Sends any pending cloud write right away (tab hidden, page closing). */
  flush(): Promise<void>;
  /** Deletes the browser copy (Restart, `?reset`). The cloud copy is replaced by the next save. */
  clear(): void;
  /**
   * Set when a save from a newer version of the game was found. This build
   * then saves nothing, so it can't overwrite that progress; the message
   * explains why to the player.
   */
  readonly savingDisabledReason: string | null;
}

const NEWER_SAVE_MESSAGE = "Your progress was saved by a newer version of the game. Reload to update; progress in this older version won't be saved.";

export function createProgressStore(platform: PlatformAdapter, campaignId: string): ProgressStore {
  let pending: SavedGame | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight: Promise<void> | null = null;
  let savingDisabledReason: string | null = null;
  /** Owner stamped on every save: the signed-in player, else whoever owned the loaded save. */
  let ownerId: string | undefined;

  const disableSaving = (): void => {
    if (savingDisabledReason) return;
    savingDisabledReason = NEWER_SAVE_MESSAGE;
    pending = null;
    if (timer) { clearTimeout(timer); timer = null; }
    console.warn("[Grow an Empire] A save from a newer game version exists; this session won't save.");
  };

  /** Starts a cloud write in the background. It never rejects; a failure here is only logged. */
  const flushInBackground = (): void => {
    flush().catch((error: unknown) => console.warn("[GoLive] Cloud save failed unexpectedly", error));
  };

  async function writeCloud(game: SavedGame): Promise<void> {
    const result = await platform.saveProgress(game as unknown as Record<string, unknown>);
    if (result !== "conflict") return;
    // Another device saved first. Re-read, keep the better copy, retry once.
    const rawCloud = await platform.loadProgress();
    if (isFromNewerVersion(rawCloud)) {
      disableSaving();
      return;
    }
    const cloud = toSavedGame(rawCloud, campaignId);
    const keep = chooseSave(game, cloud);
    const oursWins = !cloud || (keep !== null && keep.runId === game.runId && keep.savedAt === game.savedAt);
    if (keep && oursWins) {
      const retry = await platform.saveProgress(keep as unknown as Record<string, unknown>);
      if (retry !== "ok") console.warn("[GoLive] Save conflict could not be resolved; the browser copy is kept.");
    } else {
      console.info("[GoLive] Another device has further progress in the cloud; it will be offered on next load.");
    }
  }

  async function flush(): Promise<void> {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (inFlight) await inFlight;
    if (!pending || savingDisabledReason) return;
    const game = pending;
    pending = null;
    inFlight = writeCloud(game).finally(() => { inFlight = null; });
    await inFlight;
  }

  return {
    async load(playerId = null) {
      let local = toSavedGame(loadSavedSnapshot(), campaignId);
      const rawCloud = await platform.loadProgress();
      if (hasNewerLocalSave() || isFromNewerVersion(rawCloud)) {
        disableSaving();
        return null;
      }
      if (belongsToAnotherPlayer(local, playerId)) {
        console.info("[Grow an Empire] The browser save belongs to another player; it is ignored and not uploaded.");
        local = null;
      }
      const cloud = toSavedGame(rawCloud, campaignId);
      const chosen = chooseSave(local, cloud);
      ownerId = playerId ?? chosen?.playerId;
      // If the browser copy won (or the cloud had none), bring the cloud up to date.
      if (chosen && platform.kind !== "local" && (!cloud || chosen.runId !== cloud.runId || progressOf(chosen) !== progressOf(cloud))) {
        pending = withOwner(chosen);
        flushInBackground();
      }
      return chosen;
    },
    save(game, options = {}) {
      if (savingDisabledReason) return;
      const owned = withOwner(game);
      saveSnapshot(owned);
      if (platform.kind === "local") return;
      pending = owned;
      if (options.immediate) {
        flushInBackground();
      } else if (!timer) {
        timer = setTimeout(() => { timer = null; flushInBackground(); }, CLOUD_DEBOUNCE_MS);
      }
    },
    flush,
    clear() {
      // Never delete progress a newer version wrote.
      if (!savingDisabledReason) clearSavedSnapshot();
    },
    get savingDisabledReason() { return savingDisabledReason; },
  };

  function withOwner(game: SavedGame): SavedGame {
    return ownerId ? { ...game, playerId: ownerId } : game;
  }
}
