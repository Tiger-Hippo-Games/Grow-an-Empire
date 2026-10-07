import { migrateSnapshot, type SettlementSnapshot } from "../game/settlementSimulation";
import { clearSavedSnapshot, hasNewerLocalSave, isFromNewerVersion, loadSavedSnapshot, saveSnapshot } from "../game/saveGame";
import { readLeaderboardEntry, type LeaderboardEntry } from "../game/leaderboard";
import { mergeRealmStates, readRealmState, type RealmState } from "../game/realm";
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
  /** Sound off. Missing in saves from before sound existed (= sound on). */
  muted?: boolean;
}

/** What is stored locally and in the cloud. */
export type SavedGame = SettlementSnapshot & {
  /** Identifies one playthrough; a Restart starts a new run id. */
  runId: string;
  settings: SavedSettings;
  /** Victories that unlock the next stop on the campaign map. */
  completedCampaignIds?: string[];
  /** Best stars (1–3) earned in each campaign, by campaign id. Stars unlock later campaigns. */
  campaignStars?: Record<string, number>;
  /**
   * The portal player this save belongs to, when known. The browser copy is
   * shared by everyone using that browser, so a copy owned by someone else
   * must never be loaded, or pushed into another player's cloud save.
   */
  playerId?: string;
  /**
   * The player's leaderboard standing (game/leaderboard.ts): highest campaign
   * won, its id, total stars and score. Recomputed on every save from
   * `campaignStars`; the portal reads it from the cloud save, which is stored
   * against the player id (Docs/LEADERBOARD.md).
   */
  leaderboard?: LeaderboardEntry;
  /** The rival realm's seasons and the player's last rank (game/realm.ts). Optional: older saves start a fresh realm. */
  realm?: RealmState;
};

export const DEFAULT_SETTINGS: SavedSettings = { tutorialComplete: false, muted: false };
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
export function toSavedGame(raw: unknown, campaignId: string | null): SavedGame | null {
  const migrated = migrateSnapshot(raw);
  if (!migrated) return null;
  const snapshot = { ...(raw as SavedGame), ...migrated };
  if (campaignId !== null && snapshot.campaignId !== campaignId) return null;
  const settings = (snapshot.settings && typeof snapshot.settings === "object") ? snapshot.settings : DEFAULT_SETTINGS;
  const game: SavedGame = {
    ...snapshot,
    runId: typeof snapshot.runId === "string" && snapshot.runId ? snapshot.runId : "legacy",
    settings: { tutorialComplete: settings.tutorialComplete === true, muted: settings.muted === true },
    completedCampaignIds: Array.isArray(snapshot.completedCampaignIds)
      ? snapshot.completedCampaignIds.filter((id): id is string => typeof id === "string") : [],
    campaignStars: readStars(snapshot.campaignStars, snapshot.completedCampaignIds),
  };
  if (typeof snapshot.playerId !== "string" || !snapshot.playerId) delete game.playerId;
  const leaderboard = readLeaderboardEntry(snapshot.leaderboard);
  if (leaderboard) game.leaderboard = leaderboard;
  else delete game.leaderboard;
  if (snapshot.realm !== undefined) game.realm = readRealmState(snapshot.realm);
  else delete game.realm;
  return game;
}

/**
 * Cleans a stored star table. Victories saved before stars existed count as
 * one star, so a returning player keeps every campaign they had opened.
 */
function readStars(raw: unknown, completed: unknown): Record<string, number> {
  const stars: Record<string, number> = {};
  if (Array.isArray(completed)) for (const id of completed) if (typeof id === "string") stars[id] = 1;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof value === "number" && Number.isFinite(value)) stars[id] = Math.max(stars[id] ?? 0, Math.min(3, Math.max(0, Math.floor(value))));
    }
  }
  return stars;
}

/** Keeps the best stars from both tables. */
export function mergeStars(a: Record<string, number> = {}, b: Record<string, number> = {}): Record<string, number> {
  const merged = { ...a };
  for (const [id, value] of Object.entries(b)) merged[id] = Math.max(merged[id] ?? 0, value);
  return merged;
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
    settings: { ...winner.settings, tutorialComplete: local.settings.tutorialComplete || cloud.settings.tutorialComplete },
    completedCampaignIds: [...new Set([...(local.completedCampaignIds ?? []), ...(cloud.completedCampaignIds ?? [])])],
    campaignStars: mergeStars(local.campaignStars, cloud.campaignStars),
    ...(local.realm || cloud.realm ? { realm: mergeRealmStates(local.realm, cloud.realm) } : {}),
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
  /** Best stars seen this session, from any copy (this tab, other tabs, the cloud). */
  readonly knownStars: Record<string, number>;
}

const NEWER_SAVE_MESSAGE = "Your progress was saved by a newer version of the game. Reload to update; progress in this older version won't be saved.";

export function createProgressStore(platform: PlatformAdapter, campaignId: string | null): ProgressStore {
  let pending: SavedGame | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let inFlight: Promise<void> | null = null;
  let savingDisabledReason: string | null = null;
  /** Owner stamped on every save: the signed-in player, else whoever owned the loaded save. */
  let ownerId: string | undefined;
  /**
   * True once the cloud has been read successfully. Until then nothing is
   * written to it: after a failed or slow read, "no cloud save" and "couldn't
   * tell" look the same, and writing would replace real progress.
   */
  let cloudRead = false;
  /** Another device's run is further along: leave the cloud to it until the next load. */
  let cloudAhead = false;
  /**
   * The run was chosen without seeing the cloud (it was unreadable at load).
   * Its run id then says nothing about which copy the player meant to keep,
   * so the first reconcile goes by progress, not by which run is newer.
   */
  let choseBlind = false;
  /**
   * Every star, victory and finished tutorial seen this session (browser,
   * cloud, conflict re-reads). Each save is merged with it, so a stale tab or
   * a conflict can never take stars away.
   */
  let known: Pick<SavedGame, "campaignStars" | "completedCampaignIds"> & { tutorialComplete: boolean } =
    { campaignStars: {}, completedCampaignIds: [], tutorialComplete: false };
  let failedWrites = 0;
  const warned = new Set<string>();
  const warnOnce = (operation: string, error: unknown): void => {
    if (warned.has(operation)) return;
    warned.add(operation);
    console.warn(`[Grow an Empire] Cloud ${operation} failed unexpectedly; keeping browser progress and retrying later.`, error);
  };
  const readCloud = async (): ReturnType<PlatformAdapter["loadProgress"]> => {
    try {
      return await platform.loadProgress();
    } catch (error) {
      warnOnce("read", error);
      return "unavailable";
    }
  };

  const remember = (game: SavedGame | null): void => {
    if (!game) return;
    known = {
      campaignStars: mergeStars(known.campaignStars, game.campaignStars),
      completedCampaignIds: [...new Set([...(known.completedCampaignIds ?? []), ...(game.completedCampaignIds ?? [])])],
      tutorialComplete: known.tutorialComplete || game.settings.tutorialComplete,
    };
  };
  const withKnown = (game: SavedGame): SavedGame => {
    remember(game);
    return {
      ...game,
      campaignStars: { ...known.campaignStars },
      completedCampaignIds: [...(known.completedCampaignIds ?? [])],
      settings: { ...game.settings, tutorialComplete: game.settings.tutorialComplete || known.tutorialComplete },
    };
  };

  const disableSaving = (): void => {
    if (savingDisabledReason) return;
    savingDisabledReason = NEWER_SAVE_MESSAGE;
    pending = null;
    if (timer) { clearTimeout(timer); timer = null; }
    if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
    console.warn("[Grow an Empire] A save from a newer game version exists; this session won't save.");
  };

  /** Starts a cloud write in the background. It never rejects; a failure here is only logged. */
  const flushInBackground = (): void => {
    flush().catch((error: unknown) => console.warn("[GoLive] Cloud save failed unexpectedly", error));
  };

  /** Puts a write that didn't happen back in the queue (unless a newer one is waiting) and tries again later. */
  const retryLater = (game: SavedGame): void => {
    if (savingDisabledReason || cloudAhead) return;
    pending = pending ?? game;
    failedWrites += 1;
    if (retryTimer) return;
    const delay = Math.min(120_000, 15_000 * 2 ** Math.min(3, failedWrites - 1));
    retryTimer = setTimeout(() => { retryTimer = null; flushInBackground(); }, delay);
  };

  /**
   * Reads the cloud and decides what to do with `game`: the copy to write, or
   * null to leave the cloud alone (unreadable, newer version, or another
   * device's run is further along).
   */
  async function reconcile(game: SavedGame): Promise<SavedGame | null | "retry"> {
    const rawCloud = await readCloud();
    if (rawCloud === "unavailable") return "retry";
    cloudRead = true;
    if (isFromNewerVersion(rawCloud)) {
      disableSaving();
      return null;
    }
    const cloud = toSavedGame(rawCloud, campaignId);
    remember(cloud);
    const blind = choseBlind;
    choseBlind = false;
    if (blind && cloud && cloud.runId !== game.runId && progressOf(cloud) > progressOf(game)) {
      cloudAhead = true;
      console.info("[GoLive] The cloud has a run further along than the one started while it was unreachable; it will be offered on next load.");
      return null;
    }
    const keep = chooseSave(game, cloud);
    const oursWins = !cloud || (keep !== null && keep.runId === game.runId && keep.savedAt === game.savedAt);
    if (keep && oursWins) return withKnown(keep);
    cloudAhead = true;
    console.info("[GoLive] Another device has further progress in the cloud; it will be offered on next load. This session keeps saving in the browser.");
    return null;
  }

  async function writeCloud(game: SavedGame): Promise<void> {
    let toWrite: SavedGame | null | "retry" = game;
    if (!cloudRead) toWrite = await reconcile(game);
    if (toWrite === "retry") { retryLater(game); return; }
    if (!toWrite) return;
    const result = await platform.saveProgress(toWrite as unknown as Record<string, unknown>);
    if (result === "ok") { failedWrites = 0; return; }
    if (result === "error") { retryLater(toWrite); return; }
    // Another device saved first. Re-read, keep the better copy, retry once.
    const resolved = await reconcile(toWrite);
    if (resolved === "retry") { retryLater(toWrite); return; }
    if (!resolved) return;
    const retry = await platform.saveProgress(resolved as unknown as Record<string, unknown>);
    if (retry === "ok") failedWrites = 0;
    else if (retry === "error") retryLater(resolved);
    else console.warn("[GoLive] Save conflict could not be resolved; the browser copy is kept.");
  }

  async function flush(): Promise<void> {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (inFlight) await inFlight;
    if (hasNewerLocalSave()) disableSaving();
    if (!pending || savingDisabledReason || cloudAhead) return;
    const game = pending;
    pending = null;
    inFlight = writeCloud(game).catch((error: unknown) => {
      warnOnce("write", error);
      retryLater(game);
    }).finally(() => { inFlight = null; });
    await inFlight;
  }

  // A player signed in after boot gave up waiting: stamp their id from now on.
  // The cloud hasn't been read yet, so the next write reads and merges it first.
  platform.onLateSignIn((player) => {
    ownerId = player.id;
    if (pending) flushInBackground();
  });

  return {
    async load(playerId = null) {
      let local = toSavedGame(loadSavedSnapshot(), campaignId);
      const rawCloud = await readCloud();
      const cloudAvailable = rawCloud !== "unavailable";
      if (hasNewerLocalSave() || (cloudAvailable && isFromNewerVersion(rawCloud))) {
        disableSaving();
        return null;
      }
      if (belongsToAnotherPlayer(local, playerId)) {
        console.info("[Grow an Empire] The browser save belongs to another player; it is ignored and not uploaded.");
        local = null;
      }
      cloudRead = cloudAvailable;
      choseBlind = !cloudAvailable && platform.kind !== "local";
      const cloud = cloudAvailable ? toSavedGame(rawCloud, campaignId) : null;
      remember(local);
      remember(cloud);
      const chosen = chooseSave(local, cloud);
      ownerId = playerId ?? chosen?.playerId;
      // If the browser copy won (or the cloud had none), bring the cloud up to
      // date. Not when the cloud couldn't be read: the first write reads it first.
      if (chosen && cloudAvailable && platform.kind !== "local" && (!cloud || chosen.runId !== cloud.runId || progressOf(chosen) !== progressOf(cloud))) {
        pending = withOwner(withKnown(chosen));
        flushInBackground();
      }
      return chosen;
    },
    save(game, options = {}) {
      // Another tab may have upgraded since this session loaded.
      if (hasNewerLocalSave()) disableSaving();
      if (savingDisabledReason) return;
      // Another tab may have won stars since this one loaded: keep them.
      const stored = toSavedGame(loadSavedSnapshot(), null);
      if (stored && !belongsToAnotherPlayer(stored, ownerId ?? null)) remember(stored);
      const owned = withOwner(withKnown(game));
      saveSnapshot(owned);
      if (platform.kind === "local" || cloudAhead) return;
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
      if (hasNewerLocalSave()) disableSaving();
      if (!savingDisabledReason) clearSavedSnapshot();
    },
    get savingDisabledReason() { return savingDisabledReason; },
    get knownStars() { return { ...known.campaignStars }; },
  };

  function withOwner(game: SavedGame): SavedGame {
    return ownerId ? { ...game, playerId: ownerId } : game;
  }
}
