import { describeSnapshotProblem, migrateSnapshot, SAVE_SCHEMA_VERSION, type SettlementSnapshot } from "./settlementSimulation";

const SAVE_KEY = "grow-an-empire:save:v1";

/**
 * Storage failures are expected (private browsing, full quota, a locked-down
 * embed) and the game carries on, but they shouldn't be invisible either
 * (CODING_STANDARDS §19–20). Each kind of failure is logged once per page
 * load, so a full quota doesn't print a warning on every autosave.
 */
const warned = new Set<string>();
function warnOnce(kind: string, message: string, error: unknown): void {
  if (warned.has(kind)) return;
  warned.add(kind);
  console.warn(`[Grow an Empire] ${message}; the game keeps running without a local autosave.`, error);
}

/**
 * Thin localStorage wrapper around the simulation's own snapshot format.
 *
 * Every call is defensive: a browser with storage disabled (private browsing,
 * a locked-down embed) or a full quota should degrade to "no autosave", never
 * crash the game.
 */

/**
 * Reads the autosave, or returns `null` if there is none or it can't be used.
 *
 * An unusable save (corrupt JSON, an old schema, unknown building ids) is
 * deleted as well as ignored. Otherwise it would be rejected again on every
 * page load while blocking the slot, and the player could never get past it.
 *
 * The exception is a save from a *newer* version of the game (a player who
 * has already had the update, then got an older cached build). It is left in
 * place, not deleted: see `isFromNewerVersion` and progressStore.ts.
 */
export function loadSavedSnapshot(): SettlementSnapshot | null {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(SAVE_KEY);
  } catch (error) {
    warnOnce("read", "Local storage can't be read", error);
    return null;
  }
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    const migrated = migrateSnapshot(parsed);
    if (migrated) return migrated;
    const problem = describeSnapshotProblem(parsed);
    if (isFromNewerVersion(parsed)) {
      console.warn("[Grow an Empire] The autosave is from a newer version of the game; leaving it untouched.");
      return null;
    }
    console.warn(`Discarding unusable autosave: ${problem}`);
  } catch (error) {
    console.warn("Discarding autosave that is not valid JSON", error);
  }
  clearSavedSnapshot();
  return null;
}

/**
 * Writes the autosave.
 * @returns `false` if storage is unavailable or full (the game keeps running without saving).
 */
export function saveSnapshot(snapshot: SettlementSnapshot): boolean {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot));
    return true;
  } catch (error) {
    warnOnce("write", "Autosave couldn't be written (storage full or disabled)", error);
    return false;
  }
}

/** Deletes the autosave (used by Restart and when a save turns out to be unusable). */
export function clearSavedSnapshot(): void {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch (error) {
    warnOnce("clear", "Autosave couldn't be deleted", error);
  }
}

/**
 * True when `value` looks like a save written by a newer version of the game
 * (a higher `schemaVersion` than this build understands). Such a save must
 * never be deleted or overwritten by this build.
 */
export function isFromNewerVersion(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const version = (value as { schemaVersion?: unknown }).schemaVersion;
  return typeof version === "number" && version > SAVE_SCHEMA_VERSION;
}

/** True if the browser holds a save from a newer version of the game. */
export function hasNewerLocalSave(): boolean {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw !== null && isFromNewerVersion(JSON.parse(raw));
  } catch {
    return false;
  }
}
