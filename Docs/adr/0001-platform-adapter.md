# ADR 0001: The portal SDK sits behind one platform adapter

- **Status:** Accepted, 2026-09-23
- **Code:** `src/platform/types.ts`, `src/platform/adapters.ts`

## Context

The GoLive portal injects `window.Platform` (init, login, cloud progress, sessions, analytics). The same game also has to run without it: on the dev server, in tests, and when the SDK script fails to load. `CODING_STANDARDS` and `GAME_ARCHITECTURE` ask for platform code kept out of game rules.

## Decision

Game code talks only to a `PlatformAdapter`: `connect`, `loadProgress`, `saveProgress` (returns `"ok"`, `"conflict"` or `"error"`), `startSession`, `endSession`, `track`. `createPlatform()` picks one of three implementations:

1. `?platform=mock`: a fake SDK that keeps its "cloud" in localStorage and logs every call (`window.__goLiveMock`), for testing portal behaviour locally.
2. `window.Platform` present: the real GoLive adapter. Login times out after 5 s and requests after 8 s, and each kind of failure is warned about once.
3. Otherwise: a local-only adapter (no cloud; saves stay in the browser).

## Consequences

- `src/game/` never imports platform code, so the rules stay testable in isolation.
- A portal outage or missing SDK degrades to local play instead of blocking boot.
- Supporting another portal later means writing one adapter.
- The mock can drift from the real SDK. `common/SDK_SMOKE_TEST.html` and a real portal test (Docs/SUBMISSION_CHECKLIST.md) remain necessary.
