# GoLive portal readiness: implementation plan

*Written 2026-09-23 from the 12 portal guideline files in `common/`, audited against the current code.*

## 1. Where we stand

The game already fits the portal well in several ways:

- a static Vite/Three.js bundle;
- runs in an iframe with a full-window canvas;
- no `alert()`/`confirm()`/`prompt()`, no `localhost` URLs, no fullscreen-on-load;
- a versioned save schema with validation;
- robust error handling;
- unit tests;
- content within policy (mild fantasy combat, no real-money or IAP).

**Four problems would block submission today:**

| # | Blocker | Evidence | Source |
|---|---|---|---|
| B1 | **ZIP is 52.0 MB; the upload limit is 50 MB.** | Measured: `dist/` = 96 PNGs (51.9 MB), including 17 files (6 MB) the code never uses. | SUBMISSION §1 ("Max bundle size 50 MB"), §8 (413) |
| B2 | **Absolute asset paths**: the game loads blank on the portal. | `dist/index.html` has `src="/assets/index-….js"`; `vite.config.ts` has no `base`. | SUBMISSION §4 ("most common reason games 404"), CONVERSION §13 |
| B3 | **No Platform SDK integration.** The upload would report `sdkAutoInjected: true`, and nothing is saved to the cloud, tracked, or given a player identity. | No `Platform.*` calls anywhere. | SUBMISSION §5, §16; DEVELOPER §8; CONVERSION §13 |
| B4 | **Saves live only in localStorage**, which is blocked in Safari iframes and private mode. | `src/game/saveGame.ts` | SUBMISSION §1 ("never `localStorage` directly"), §15; ARCHITECTURE §8 |

**Two further hard requirements are failed:**

- **Load time.** The standard is "under 5 s on 10 Mbps" and an "initial bundle under 5 MB". Today 15.8 MB (31 images) downloads before the first move.
- **Store assets.** There is no thumbnail and no banner.

The good news: converting the art to WebP alone takes the whole bundle from about 52 MB to about 7 MB. Measured on a sample, building PNGs drop to 14% of their size and the terrain goes from 3.67 MB to 0.36 MB. That clears B1 and most of the load-time problem in one step.

## 2. Where the portal docs disagree, and what we'll do

The guides were written at different times and contradict each other in places. Rule for the plan: **satisfy the stricter one, or both.**

| Topic | Conflict | Plan |
|---|---|---|
| Thumbnail / banner size | SUBMISSION §9: 400×300 (4:3) and 1280×360. DEVELOPER §8 and CONVERSION §13: 480×270 and 1280×720 (16:9), under 200 KB / 500 KB. | Produce **both** sets. Upload the 16:9 pair (it appears in two docs, with size caps). Keep 400×300 and 1280×360 in `assets/` inside the ZIP, which SUBMISSION's validator looks for. |
| Bundle limit | 50 MB (SUBMISSION) vs 200 MB (DEVELOPER) | Stay under **50 MB**. We expect about 7 MB. |
| SDK loading | "Auto-injected" (DEVELOPER, CONVERSION) vs "add the script tag; `sdkAutoInjected` must be `false`" (SUBMISSION §5, §16) | **Include the tag** `<script src="/api/v1/sdk/platform-sdk.js">` ourselves. It is the one absolute path that is correct, because it points at the platform's own origin. |
| `apiBaseUrl` | "Required" (SDK_REFERENCE) vs "not needed in production" (SUBMISSION) vs `'/api/v1'` (DEVELOPER) | Pass `'/api/v1'` in production. Pass `http://localhost:3000/api/v1` only when a local backend is explicitly configured. |
| Empty progress | `{ progress: {} }` (SDK_REFERENCE, SUBMISSION) vs `{ progress: null }` (DEVELOPER) | Treat `null`, `{}` and a missing `progress` as "no cloud save". |
| Save conflicts | Throws `Error("Conflict")` (SDK_REFERENCE) vs last-write-wins (DEVELOPER) | Handle Conflict: re-fetch, keep the further-progressed run, save again. Harmless if it never fires. |
| Description length | 150–500 characters (SUBMISSION) vs at least 50 (DEVELOPER) | 150–500 characters. |
| Genre list | Differs between docs | `strategy`, which is valid in every list. |
| Event names | `game_start` / `level_complete` (CONVERSION) vs `game_started` / `level_completed` (ARCHITECTURE, SDK) | `startSession()` already sends `game_started`, so we don't send it ourselves. Use the SDK and DEVELOPER names (`level_completed`, `game_over`, …), plus `game_start` because the CONVERSION §13 checklist requires it literally. |
| Session end | CONVERSION §13 requires `beforeunload`; SUBMISSION §5.1 says never rely on unload alone | Both: end the session on `game-complete`, `GP_SESSION_END`, `pagehide`/`beforeunload`, and keep saving on `visibilitychange`. |

## 3. Decisions needed from you

These have recommended defaults. The plan proceeds with the default unless you say otherwise.

| Decision | Recommended default | Why it matters |
|---|---|---|
| Slug / `gameId` | `grow-an-empire` | It can't be changed after submission (SUBMISSION §3). |
| Genre / orientation | `strategy` / **`any`** (after Phase 4); `landscape` if we skip portrait work | Portrait currently clips the city (see Phase 4). |
| Title and description | "Grow an Empire", plus a 150–500 character description (a draft is in Phase 5) | The current `<title>` still reads "Nine Settlement Levels". |
| Art format | WebP at the current resolution first; consider 1x resolution later | WebP alone meets every size target. 1x would halve memory, but needs a visual sign-off. |
| Save conflicts between devices | Keep the run that is further along (more moves), then the newest `savedAt` | This is a single 8-move run; there is no economy to merge. |
| Restart | Also overwrites the cloud save with the fresh run | Otherwise the old run would come back on the next device. |
| Audio | **Ship without audio for v1** | No doc requires audio; the rules only apply "where audio exists". Adding it later means a mute toggle, unlock-on-gesture, and settings in the save. |
| Art provenance | You record which tool or licence produced each art family | ART_PIPELINE §41: "must have a known provenance category". The content policy bans unlicensed IP. |
| Thumbnail / banner art | Compose from existing art (terrain, Town Hall, buildings) plus the title | Needed before submission. |

## 4. Implementation phases

Sizes: **S** is under half a day, **M** is 1–2 days, **L** is 3 or more days. Phases 1–2 are the minimum to submit; Phases 3–5 are needed to pass review and the hard requirements; Phase 6 is standards housekeeping; Phase 7 is QA and submission.

### Phase 1: Build and packaging (fixes B1, B2), about 1–2 days

| Task | Size | Details |
|---|---|---|
| 1.1 Relative base path | S | `base: "./"` in `vite.config.ts`. Verify `dist/index.html` and runtime asset URLs are relative. Vite emits `new URL(…, import.meta.url)` for glob `?url` imports. |
| 1.2 Stop bundling unused art | S | Narrow the globs in `render/assetCatalog.ts` so they only match what the code loads: SE/SW sheets only (not NE/NW), no log-stockpile, no felled/notched/falling tree, no campsite, no `woodcutter-level-2`, terrain v2 only. Saves 6 MB. Add a unit test that every filename the code asks for is in the manifest, and that nothing unreferenced is. |
| 1.3 WebP runtime art pipeline | M | `Tools/ArtPipeline/export_webp.py`: `Runtime2x/*.png` becomes `RuntimeWeb/*.webp` (quality about 82, alpha kept; terrain as opaque WebP). Keep PNG masters untouched. Switch filenames in `buildingFilename()`, `civicCenter`, `workerAnimation`, `cityLayout` and the globs. Visual A/B screenshot check. Expected full bundle about 7 MB. |
| 1.4 Packaging script | S | `pnpm package`: build, then zip the **contents** of `dist/` to `release/grow-an-empire-<version>.zip`. `index.html` sits at the ZIP root. |
| 1.5 Pre-upload validator | S | `Tools/dev/validate-bundle.mjs`, which reproduces the checks in SUBMISSION §7 and §16 (we don't have the portal's own validator): valid ZIP, `index.html` at root with `<!DOCTYPE html>`, SDK tag present, size under 50 MB, no `src="/`/`href="/` except the SDK tag, no `localhost`, no `alert(`/`confirm(`/`prompt(`, thumbnail and banner present. Part of `pnpm package`. |
| 1.6 Version stamp | S | Inject `__APP_VERSION__` from `package.json` via Vite `define`; send it with analytics (ARCHITECTURE §22). |

### Phase 2: Platform SDK integration (fixes B3, B4), about 3–4 days

Design: a thin **platform adapter** is the only code allowed to touch `window.Platform`, as ARCHITECTURE §4 and CODING §16–17 ask. Gameplay code never calls the SDK directly. Every SDK call is guarded, so the game always starts even if the platform is down (ARCHITECTURE §18; CONVERSION: "Do NOT block the game").

| Task | Size | Details |
|---|---|---|
| 2.1 `src/platform/` adapter | M | `PlatformAdapter` interface with `init`, `login`, `loadProgress`, `saveProgress`, `startSession`, `endSession`, `track` and `onPortalMessage`. It has three implementations: **`GoLivePlatform`** wraps `window.Platform` with try/catch, timeouts and the Conflict retry; **`LocalPlatform`** is the offline fallback that uses localStorage the way we do today; **`MockPlatform`** is for dev and tests, and logs calls to the console as `[GoLive mock]`. Selection: `window.Platform` exists → GoLive; otherwise `?platform=mock` → Mock; otherwise Local. Add typed declarations for `window.Platform` from SDK_REFERENCE. |
| 2.2 SDK script tag | S | Add `<script src="/api/v1/sdk/platform-sdk.js"></script>` to `index.html` `<head>` before the game script, with a comment explaining why it is absolute. Exempt it from the boot watchdog: on localhost it 404s, and that must not show "The game didn't start". In local dev the adapter falls back to Local or Mock. |
| 2.3 Boot order | M | `initialize()` becomes: `init({ gameId, apiBaseUrl: '/api/v1' })` → `await login()` (3 s timeout, then continue as guest/offline) → `loadProgress()`, **in parallel with the art download** so load time isn't hurt → validate and migrate → hydrate or start fresh → `startSession()` → `track('game_start', { resumed, version })` → `GP_GAME_READY` to the parent. Follows ARCHITECTURE §6. |
| 2.4 Cloud save payload and migration | M | Save the existing `SettlementSnapshot` (v2) as the cloud blob, about 1 KB against the 64 KB cap. Add `migrateSnapshot(raw)`: schema v1 or missing becomes v2 defaults (SUBMISSION §5.1). The existing `describeSnapshotProblem()` rejects anything unusable. Add a `settings` block for the tutorial-seen flag and speed, and move the tutorial flag out of its own localStorage key. Only additive changes from here on (never rename keys). Test: v2 saves written by today's build must load in every future build. |
| 2.5 Save triggers | S | Save on every move checkpoint (`construction-complete`, `choices-ready`), on a building choice, on `game-complete`, on `visibilitychange` (hidden) and on `pagehide`. Debounce cloud writes to at most one per 2 s. Always write the local cache synchronously, then the cloud asynchronously. |
| 2.6 Restore and merge | S | Load the cloud and local copies, drop either if invalid, then keep the one further along (`builtBuildingIds.length`, then `savedAt`). If local was newer, push it to the cloud. Covers the Safari/ITP case, where the cloud session is ephemeral. |
| 2.7 Conflict handling | S | On `Error("Conflict")`: re-fetch, apply the same merge rule, retry once, and log it. Never loop. |
| 2.8 Session lifecycle | S | Count played seconds only while playing and the tab is visible. Call `endSession(seconds)` on `game-complete`, on `GP_SESSION_END`, and on `pagehide`/`beforeunload`, at most once per session. After Restart, start a new session. |
| 2.9 Portal messages | S | Handle `GP_PAUSE`/`GP_RESUME` with the existing pause (the same path the tutorial modal uses) and `GP_SESSION_END` as in 2.8. Check `event.source === window.parent`. |
| 2.10 Analytics events | S | `game_start {resumed, version}`; `tutorial_started`; `tutorial_completed {step_count, time_seconds}`; `level_start {level: move, building}` when construction starts; `level_completed {level: move, building, time_seconds}`; `game_over {final_score, level_reached: 8, reason: outcome, outcome}`; `level_failed {reason: 'Settlement Lost'}` when the run is lost; `settings_changed {setting, value}` for speed and grid; `load_error {file}`. `track()` never throws, but wrap it anyway. |
| 2.11 Local testing | S | `?platform=mock` for the mock SDK. `Tools/dev/iframe-test.html` served by Vite, which embeds the game at 1280×720 with the portal's `allow=` attributes and buttons that send `GP_PAUSE`/`GP_RESUME`/`GP_SESSION_END` (SUBMISSION §6). Optional `VITE_PLATFORM_API=http://localhost:3000/api/v1` for a local backend. |
| 2.12 Tests | M | Adapter unit tests: fallback when the SDK is missing, login timeout, Conflict retry, merge rule, empty progress in all three shapes, migration, debounce, `endSession` fired once. Extend the Playwright harness: a mock-SDK playthrough, a reload that restores, and an iframe run. |

### Phase 3: Load time and performance, about 3–4 days

Requirements: "under 5 s on 10 Mbps", an initial bundle under 5 MB, and MOBILE_PERFORMANCE §5, whose one hard rule is "Every game **must** have an explicit budget".

| Task | Size | Details |
|---|---|---|
| 3.1 Performance budget doc | S | `Docs/PERFORMANCE_BUDGET.md`. Proposed targets: 60 fps goal and 30 fps floor on a mid-range phone; first-playable download ≤ 3 MB; total bundle ≤ 10 MB; decoded texture memory ≤ 150 MB; ≤ 150 draw calls; 0 particles; boot ≤ 5 s at 10 Mbps. |
| 3.2 Lighter boot | M | Only civic level 0 loads at boot; level N+1 preloads during move N. Only the foundation stage of the three opening buildings loads at boot; the other stages load when that building is chosen. Terrain and the SE/SW walk sheets load first. With WebP, boot is expected to fall from 15.8 MB to about 1 MB. |
| 3.3 Real loading progress | S | Count loaded images and show "Loading… x / y" in the loading screen. Make the index.html watchdog progress-aware: it only fires if nothing has loaded for 20 s, instead of at a fixed 45 s. On slow 4G the fixed 45 s would wrongly show "The game didn't start". |
| 3.4 Stop rendering when idle | S | Skip `renderer.render()` while paused, behind the tutorial modal, and when the scene hasn't changed (MOBILE §48). |
| 3.5 Remove per-frame waste | S | Only call `hud.updateHud()` when events fire, not every frame. Only call `setStatus()` when the label or percentage changes. Only set `material.needsUpdate` when the clip changes. Hoist the per-frame allocations in the muster. Make the muster movement time-based instead of frame-based (THREEJS §15). |
| 3.6 Cheaper CSS | S | Remove `backdrop-filter: blur()` from the 5 always-visible panels and shrink the large box-shadows. The panels are already about 90% opaque, so the look is nearly unchanged. |
| 3.7 Quality tiers | S | A low tier (DPR 1–1.5, no MSAA) picked by a quick frame-time probe or `?quality=low`. Default: `antialias: false` at DPR ≥ 2, where it adds little for sprites. |
| 3.8 WebGL context loss | S | Handle `webglcontextlost`/`webglcontextrestored`: pause, show a message, resume (THREEJS §48, QA §30). |
| 3.9 Draw-call reduction (optional) | M | Share geometry and materials for roads and ground discs, and stop cloning the forest material. From about 130 draw calls to about 60. Only needed if 3.1 measurements say so. |
| 3.10 Dev performance overlay | S | `?perf` shows FPS, frame time, `renderer.info` draw calls and texture count. Dev only. |

### Phase 4: Mobile and layout, about 2 days

| Task | Size | Details |
|---|---|---|
| 4.1 Fit the camera in portrait | M | Today the view is fixed at 40 world units tall, so a 390×844 phone sees only ±9.2 units of a city spanning about −11 to +12, which clips the farms, quarry and forest. Compute the frustum so the whole city fits in both orientations (CODING §28: "Never assume a fixed screen size"). This is what makes `orientation: any` honest. |
| 4.2 Safe areas and viewport | S | `viewport-fit=cover`; `env(safe-area-inset-*)` on the HUD, controls and build panel; `100dvh`; a ResizeObserver on `#viewport`. |
| 4.3 Touch hygiene | S | `touch-action: manipulation` on the UI and `none` on the canvas; `-webkit-touch-callout: none` and `user-select: none` on cards and buttons, so the iOS long-press image popup doesn't appear. |
| 4.4 Touch targets and text | S | Controls and Close at least 44 px tall; minimum text size about 11 px (some labels are 8–9 px today); check contrast of the level-track label over the terrain. |
| 4.5 Landscape phones | S | Height-based media queries (about 844×390): no overlap between the HUD, build panel and tutorial coach. |
| 4.6 Portal viewport test | S | Screenshot matrix at 1920×1080, 1366×768, 1280×720, 390×844, 375×667 and 667×375, minus the portal's 44 px bar (CONVERSION §13; SUBMISSION §10). |
| 4.7 Dialog accessibility | S | Move focus into the tutorial dialog, trap it there, and close on Esc (QA §13). |

### Phase 5: Store listing and content, about 1 day (plus art time)

| Task | Size | Details |
|---|---|---|
| 5.1 Thumbnail and banner | M | Compose from the terrain, Grand Town Hall and a few buildings, plus the title wordmark. Export 480×270 (under 200 KB) and 1280×720 (under 500 KB) for upload, and 400×300 and 1280×360 as `assets/thumbnail.png` and `assets/banner.jpg` in the ZIP. Keep the sources in `Assets/Art/Store/`. |
| 5.2 Metadata | S | Slug `grow-an-empire`; title "Grow an Empire"; genre `strategy`; orientation `any`; tags `city-builder, strategy, medieval, short-session`. Fix `<title>` and the meta description. Draft description (243 characters): *"Found a village and grow it into a walled town in just eight decisions. Every building you choose keeps working for the rest of the game, so the order you build in shapes your economy and the army you raise. Can your town hold off the raiders?"* |
| 5.3 Provenance record | S | `Assets/Art/PROVENANCE.md`: tool, licence and human edits per art family (ART_PIPELINE §41–42). **Needs your input.** |
| 5.4 Content policy check | S | Mild fantasy combat and an army-muster score: fine. No gore, no real money, no crypto. Confirm the "Ashfang Raiders" name and art aren't borrowed IP. |

### Phase 6: Coding standards housekeeping, about 1–2 days (can overlap)

| Task | Size | Details |
|---|---|---|
| 6.1 `CLAUDE.md` and `AGENTS.md` | S | Entry point, state owner, frame loop, build/test/package commands, and pointers to `common/` and `Docs/` (CODING §3; ARCHITECTURE §24). |
| 6.2 Lint | S | Add ESLint (flat config, TypeScript rules) and include it in `pnpm check` (CODING §39). |
| 6.3 Silent catches | S | Log a warning with context the first time a save fails or storage is unavailable (CODING §19–20). |
| 6.4 Dead code | S | Remove unused catalog fields (`productionSeconds`, `productionAmount`, …) and unused HUD exports, or mark them as reserved (CODING §42). Fix the stale TECHNICAL_IMPLEMENTATION section on production timing. |
| 6.5 Balance config | M, optional | Move economy and scoring constants into `game/balance.ts` (CODING §22). The exhaustive 6,561-path test keeps this safe. It also paves the way for platform remote config. |
| 6.6 Scene ownership and dispose | M, optional | One `THREE.Group` per render system, `dispose()` methods, and handles returned from `loadForest` / `loadEmptyTerrain` (THREEJS §4–5, CODING §25). |
| 6.7 Architecture decision records | S | `Docs/adr/`: platform adapter; cloud-primary save with local cache; WebP runtime art. |

**Deliberately not planned.** These are examples or preferences in the docs, not requirements, and changing them costs more than it gains:

- Renaming art files to snake_case. ART §11 is a preference, and the rename would touch code and manifests.
- Converting the factory modules to classes. CODING §12 lists class names only as "good examples".
- Renaming booleans such as `playing` to `isPlaying`. A "prefer", not a rule.
- Menus or settings screens. No doc requires them.

### Phase 7: QA and submission, about 2 days

1. Run the device and browser matrix and record the results in `Docs/QA_RESULTS.md`:
   - browsers: iOS Safari, Android Chrome, desktop Chrome, Safari and Firefox;
   - device classes: high, mid and low end;
   - networks: fast, 4G and slow 4G;
   - also a 30-minute session and a background/resume test (QA §6–8, §29; MOBILE §54).
2. Work through SUBMISSION §16 and DEVELOPER §8 line by line; keep the ticked copy in `Docs/SUBMISSION_CHECKLIST.md`.
3. Portal flow:
   1. Register as a developer.
   2. Create the listing: `POST /developer/games`.
   3. `pnpm package`.
   4. Upload: `upload-bundle`. Expect `bundleStoredInDb: true`, `sdkAutoInjected: false` and a `bundleVerifiedAt` timestamp.
   5. `upload-assets`.
   6. Check the play URL for zero 404s.
   7. Test in the sandbox iframe, including the close-tab-and-reopen persistence test.
   8. `GET` the game and confirm it is `DRAFT` and verified.
   9. `submit`.
4. Document the Safari limitation for players: progress may not persist across sessions under ITP (SUBMISSION §10). Our local cache softens this.

## 5. Order and estimate

| Order | Phase | Estimate | Unblocks |
|---|---|---|---|
| 1 | Phase 1: build and packaging | 1–2 days | Upload is possible at all |
| 2 | Phase 2: SDK integration | 3–4 days | Cloud saves, analytics, validator pass |
| 3 | Phase 3: load time and performance | 3–4 days | The 5 s / 5 MB requirement, and the budget MUST |
| 4 | Phase 4: mobile and layout | 2 days | Orientation `any`; mobile review |
| 5 | Phase 5: store listing | 1 day, plus art | Listing complete |
| 6 | Phase 6: housekeeping | 1–2 days (parallel) | Standards compliance |
| 7 | Phase 7: QA and submission | 2 days | Submission |

**Total: about 2–3 weeks of focused work.** The minimum viable submission is Phases 1, 2, 5 and the essential parts of 3.2, 3.3 and 4.1–4.3: about 1–1.5 weeks.

## 6. Risks

- **We can't test against the real portal from here.** The SDK file, backend and validator (`browser-gaming-backend`) aren't in this repo. The mock adapter and our own validator reproduce the documented behaviour, but the first real sandbox upload is the true test. Do a throwaway DRAFT upload as early as Phase 2 is done.
- **WebP visual quality.** Quality 82 is usually indistinguishable for painted art, but edges on transparent sprites need a visual check (ART §34: don't optimize "at the expense of unacceptable visual quality").
- **Save compatibility is permanent once live.** After the first approved release, every future build must load v2 snapshots. Freeze the schema before submission and add a regression test with a stored v2 fixture.
- **Parallel edits.** The terrain and grid work happened concurrently with the last pass. Coordinate who owns `main.ts`, `cityLayout.ts` and `hud.ts` while this plan is executed.
