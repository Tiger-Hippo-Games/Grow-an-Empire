/**
 * Asset health: did the art, the display font and the sound engine actually
 * load on this player's device?
 *
 * The game already copes when something is missing (a card falls back to its
 * name, a failed boot image shows a Reload screen, sound is optional). This
 * module makes those quiet fallbacks visible: each problem is reported once
 * to analytics by main.ts (`asset_problem`), and the live record is readable
 * as `window.__gaeAssetHealth` for the browser QA (`Tools/qa/assets_audio.py`)
 * and for support ("open the console and type __gaeAssetHealth").
 */

export type AudioStatus = "locked" | "running" | "suspended" | "muted" | "unavailable";
export type FontStatus = "pending" | "loaded" | "fallback" | "unsupported";

export interface AssetHealth {
  /** Images requested through the texture loader, and how many arrived. */
  imagesRequested: number;
  imagesLoaded: number;
  /** Files that failed (texture loader or an <img> on screen), first 20. */
  imagesFailed: string[];
  /** The display font (Yatra One): loaded, or the fallback serif is showing. */
  font: FontStatus;
  /** The synthesized sound engine's state. "locked" until the first tap or key. */
  audio: AudioStatus;
  /** Sound cues actually started (0 means the player has heard nothing). */
  soundsPlayed: number;
}

export type AssetProblem = { kind: "image"; file: string; detail: string } | { kind: "font"; detail: string } | { kind: "audio"; detail: string };

const health: AssetHealth = { imagesRequested: 0, imagesLoaded: 0, imagesFailed: [], font: "pending", audio: "locked", soundsPlayed: 0 };
const listeners = new Set<(problem: AssetProblem) => void>();
const reported = new Set<string>();

if (typeof window !== "undefined") {
  Object.defineProperty(window, "__gaeAssetHealth", { configurable: true, get: () => ({ ...health, imagesFailed: [...health.imagesFailed] }) });
}

function emit(problem: AssetProblem): void {
  const key = problem.kind === "image" ? `image:${problem.file}` : problem.kind;
  if (reported.has(key)) return;
  reported.add(key);
  for (const listener of listeners) {
    try { listener(problem); } catch (error) { console.warn("[Grow an Empire] Asset problem listener failed", error); }
  }
}

/** A copy of the current record. */
export function assetHealth(): AssetHealth {
  return { ...health, imagesFailed: [...health.imagesFailed] };
}

/** Called once for each problem (each failed file, the font, the audio). Returns an unsubscribe function. */
export function onAssetProblem(listener: (problem: AssetProblem) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function recordImageRequested(): void { health.imagesRequested += 1; }
export function recordImageLoaded(): void { health.imagesLoaded += 1; }

/** `file` is the bundled name (or URL) that failed. */
export function recordImageFailed(file: string, detail: string): void {
  const name = file.split("/").pop()?.split("?")[0] || file;
  if (!health.imagesFailed.includes(name) && health.imagesFailed.length < 20) health.imagesFailed.push(name);
  emit({ kind: "image", file: name, detail: detail.slice(0, 160) });
}

export function recordAudio(status: AudioStatus, detail?: string): void {
  health.audio = status;
  if (status === "unavailable") emit({ kind: "audio", detail: detail ?? "no Web Audio" });
}

export function recordSoundPlayed(): void { health.soundsPlayed += 1; }

/**
 * Checks the display font once the page's fonts have settled. A fallback is
 * not an error (the game reads fine in Georgia), but it is worth knowing.
 */
export async function checkFont(family: string, fonts: FontFaceSet | undefined = typeof document === "undefined" ? undefined : document.fonts): Promise<FontStatus> {
  if (!fonts || typeof fonts.load !== "function") {
    health.font = "unsupported";
    return health.font;
  }
  try {
    await fonts.load(`1em "${family}"`);
    health.font = fonts.check(`1em "${family}"`) ? "loaded" : "fallback";
  } catch (error) {
    health.font = "fallback";
    console.warn(`[Grow an Empire] The ${family} font didn't load; using the fallback`, error);
  }
  if (health.font === "fallback") emit({ kind: "font", detail: `${family} unavailable` });
  return health.font;
}

/** Test helper: forget everything recorded so far. */
export function resetAssetHealthForTests(): void {
  Object.assign(health, { imagesRequested: 0, imagesLoaded: 0, imagesFailed: [], font: "pending", audio: "locked", soundsPlayed: 0 });
  reported.clear();
}
