import { isValidSnapshot, type SettlementSnapshot } from "./settlementSimulation";

const SAVE_KEY = "grow-an-empire:save:v1";

/**
 * Thin localStorage wrapper around the simulation's own snapshot format.
 * Every call is defensive: a browser with storage disabled (private
 * browsing, a locked-down embed) should degrade to "no autosave", not crash
 * the game.
 */
export function loadSavedSnapshot(): SettlementSnapshot | null {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValidSnapshot(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveSnapshot(snapshot: SettlementSnapshot): void {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot));
  } catch {
    // Storage unavailable or full: continue without autosave.
  }
}

export function clearSavedSnapshot(): void {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to do if storage is unavailable.
  }
}
