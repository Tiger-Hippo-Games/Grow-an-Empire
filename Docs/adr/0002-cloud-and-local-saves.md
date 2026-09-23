# ADR 0002: Cloud save first, with a local copy and a run-aware merge

- **Status:** Accepted, 2026-09-23
- **Code:** `src/platform/progressStore.ts`, `src/game/saveGame.ts`

## Context

The portal stores progress per player (`saveGameProgress`, 64 KB limit, version conflicts). Players switch devices, close tabs mid-move, and play in Safari, which may drop localStorage (ITP, SUBMISSION_GUIDE §10). A save must never throw the player back to an older state without reason.

## Decision

- Every save writes to **localStorage immediately**, and to the **cloud debounced by 2 s**. Leaving the page (`pagehide`, hidden tab) or finishing a move forces an immediate cloud write.
- Each run has a `runId`. On load, `chooseSave(local, cloud)` decides:
  - **same run**: keep the one that is further along (buildings built, plus one if complete), then the newer `savedAt`;
  - **different runs**: keep the newer `savedAt` (so Restart on one device wins on the others);
  - the tutorial-complete flag is OR-merged.
- A cloud version conflict reloads the cloud copy, merges with the same rule, and retries once.
- Saves are the simulation's own versioned snapshot (`SAVE_SCHEMA_VERSION` 4) plus `runId` and settings, about 2 KB.

## Consequences

- Offline play and a missing SDK still save locally.
- Two devices playing the *same* run at once can lose the less-advanced branch. That's acceptable for a short single-player run.
- The schema is frozen by a fixture test (`save-v4-mid-construction.json`). Changing it needs a migration.
