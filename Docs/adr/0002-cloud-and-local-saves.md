# ADR 0002: Cloud save first, with a local copy and a run-aware merge

- **Status:** Accepted, 2026-09-23; amended 2026-10-10 (0.10.2: guests, 5 s spacing, schema 6)
- **Code:** `src/platform/progressStore.ts`, `src/game/saveGame.ts`

## Context

The portal stores progress per player (`saveGameProgress`, 64 KB limit, version conflicts). Players switch devices, close tabs mid-move, and play in Safari, which may drop localStorage (ITP, SUBMISSION_GUIDE §10). A save must never throw the player back to an older state without reason.

## Decision

- Every save writes to **localStorage immediately**. Signed-in players also save to the **cloud**, with writes at least 5 s apart (SDK 1.5.0), retries included. Leaving the page (`pagehide`, hidden tab) or finishing a move asks for an immediate cloud write; if the last write was under 5 s ago, it waits its turn, and the browser copy already holds the move.
- **Guests have no cloud save** (portal rule; Ravi, 2026-10-10). The adapter neither reads nor writes the cloud for an `authType` of `GUEST` (`cloudSaveAllowed()` is false); their progress lives in the browser. A guest who signs in later starts saving to the cloud, and the first write reads and merges the cloud first.
- Each run has a `runId`. On load, `chooseSave(local, cloud)` decides:
  - **same run**: keep the one that is further along (buildings built, plus one if complete), then the newer `savedAt`;
  - **different runs**: keep the newer `savedAt` (so Restart on one device wins on the others);
  - the tutorial-complete flag is OR-merged.
- A cloud version conflict reloads the cloud copy, merges with the same rule, and retries once.
- Saves are the simulation's own versioned snapshot (`SAVE_SCHEMA_VERSION` 6; `migrateSnapshot` converts v4 and v5) plus `runId`, settings, stars and realm, a few KB (checked against the 64 KB limit).

## Consequences

- Offline play, guests and a missing SDK still save locally. Where the browser blocks storage (some Safari and private windows), a guest's progress lasts only for the visit.
- A page closed within 5 s of the previous cloud write may leave the cloud one move behind; the next visit on the same browser restores the newer local copy.
- Two devices playing the *same* run at once can lose the less-advanced branch. That's acceptable for a short single-player run.
- The schema is frozen by a fixture test (`save-v4-mid-construction.json`). Changing it needs a migration.
