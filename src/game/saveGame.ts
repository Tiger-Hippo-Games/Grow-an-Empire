import { describeSnapshotProblem, type SettlementSnapshot } from "./settlementSimulation";

const SAVE_KEY = "grow-an-empire:save:v1";

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
 */
export function loadSavedSnapshot(): SettlementSnapshot | null {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(SAVE_KEY);
  } catch {
    return null; // Storage unavailable.
  }
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    const problem = describeSnapshotProblem(parsed);
    if (!problem) return parsed as SettlementSnapshot;
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
  } catch {
    return false;
  }
}

/** Deletes the autosave (used by Restart and when a save turns out to be unusable). */
export function clearSavedSnapshot(): void {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to do if storage is unavailable.
  }
}
