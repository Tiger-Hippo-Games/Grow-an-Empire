# Release freeze: v0.12.4

2026-10-13. Civic spacing update: Dharmashala behind the town center, House and Bazaar farther out to avoid overlapping the mature hall. Building-keyed roads and walking routes follow the new anchors. All preceding campaign, leaderboard and script-policy fixes are included. Not published to the live portal.

- `release/grow-an-empire-0.12.4.zip`: **17,861,770 bytes**, 157 entries.
- SHA-256: `2DBAB625C91D6592174F3A932C57767DAF50D822FAC643C14312E63C094497C9`
- Production game `grow`, board `strongplayer`, settlement schema 6.
- All 24 plots visually reviewed, including mature hall and the newer buildings' construction stages; no art errors.
- TypeScript, lint, 280 tests and 16 upload checks pass. External boot scripts / zero inline blocks retained.

See `Docs/QA_RESULTS.md`. Upload this latest ZIP for live revalidation; older releases remain unchanged. Further changes need a new version and ZIP.

## Historical release freeze: v0.12.3

2026-10-13. Replacement for the portal's inline-script warning. Screen fit and the boot watchdog are external, versioned files; index.html contains zero inline script blocks. All previous campaign/UI/leaderboard changes remain included. Not uploaded or published to the live portal.

- Artifact: `release/grow-an-empire-0.12.3.zip`, **17,861,773 bytes**, 157 entries.
- SHA-256: `B2AE919EBA2508236B677147B38361E1B25CD8A26DE8C1202F04F35829547ED1`
- Production game `grow`, weekly board `strongplayer`, settlement schema 6.
- TypeScript, lint, 280 tests and 16 bundle checks pass.
- Exact ZIP completes the 1920×1080 iframe flow under file-only script policy, with no game errors/warnings/failed requests. Desktop/phone boot, resize and watchdog recovery pass under the same policy.
- Startup 1.75 s at 10 Mbps / 9.13 s on Slow 4G. Full evidence in `Docs/QA_RESULTS.md`.

Upload this ZIP and rerun the Developer Console check. Earlier stored builds are unchanged. Keep this ZIP immutable; further changes require a new version.

## Historical release freeze: v0.12.2

2026-10-13. Ready for Developer Console Sandbox Preview. Includes the complete earlier UI/loading changes, requested campaign lengths and stronger enemies, and production weekly Strongest Player integration. Supersedes intermediate 0.12.0/0.12.1 and earlier releases; their ZIPs remain unchanged. Not published to Netlify.

## Immutable artifact

- `release/grow-an-empire-0.12.2.zip`: **17,861,278 bytes**, 155 entries.
- SHA-256: `191596B2E3B59EB63A4A6A75EC652A45007F54D28AE4CE475F6A51D3055F8CCE`
- Portal game slug **`grow`**, weekly leaderboard **`strongplayer`**, Highest Score Wins, no cap, Monday 00:00 UTC reset.
- Score = distinct campaigns won (0–25); stars still unlock campaigns and rank the separate AI Realm.
- Settlement save schema **6**, v4/v5 migration retained; stored leaderboard entries rederived as schema 2.

## Verified locally

- TypeScript, ESLint and 279 tests in 29 files; all 15 portal bundle checks.
- Campaign limits 12/14/15/16/18/20/25, corresponding recalibration and 25 civic levels. Full 25-move browser run with all 24 buildings and reload at move 14.
- Weekly leaderboard in desktop and both phone layouts: top ten, own rank, correct first-win score, guest/empty/error states, escaped names, HUD clearance and focus return.
- Exact ZIP in a 1920×1080 iframe at 1.5×: complete campaign flow, persistent HUD, one GAME_READY, portal lifecycle and guest safeguards; no game errors/warnings/failed requests.
- Fourteen viewport checks, phone word budgets, throttled loading tips/bar and startup budgets (1.82 s at 10 Mbps; 9.16 s on Slow 4G).

Full evidence and local-test limitations are in `Docs/QA_RESULTS.md`. Live production leaderboard/account checks, Safari, physical-device FPS and listing provenance remain required before publication. Use the supplied `grow` / `strongplayer` configuration rather than the historical board setup below. Keep this ZIP unchanged; further source changes need a new version and ZIP.

## Historical release freeze: v0.11.2

2026-10-13. Ready for Sandbox Preview, including the full UI/gameplay update and loading bar with 24 building tips. Supersedes intermediate v0.11.0/v0.11.1 and v0.10.8; their ZIPs remain unchanged. Not published to the live portal.

## Immutable artifact

- `release/grow-an-empire-0.11.2.zip`: **17,859,610 bytes**, 155 entries.
- SHA-256: `83BD50EDB8AE4B3A6F790C16AB8D2685109A73BE39EC0F64E8F7F98CE65110A1`
- Save schema **6**, v4/v5 migrations retained. Game slug `grow-an-empire`; leaderboard `campaign-progress`.

## Verified locally

- TypeScript, ESLint and 266 tests in 28 files; all 15 bundle checks.
- Persistent resource/move HUD, horizontal cards, permanent benefits, speed label, move briefing/countdown, watchtower formations, correct battle stopping and Burj prerequisites.
- 14-size UI sweep; desktop and both phone-orientation campaign journeys; final phone word budgets.
- Exact ZIP in a 1920×1080 iframe at 1.5×: full campaign flow, completed-city inspection, one GAME_READY, guest behavior and portal lifecycle; no game errors/warnings/failed requests.
- Loading tips/bar at desktop and phone sizes under throttling, including pre-boot card hiding and immediate tip cleanup.
- Compressed startup: 1.75 s at 10 Mbps, 9.15 s on Slow 4G; 1.7 MB / 11 requests.

Full evidence and local-test limitations are in `Docs/QA_RESULTS.md`. Real portal, Safari and physical-device checks remain required before publication. Follow the existing Developer Console and provenance steps below. Keep this ZIP unchanged; further changes require a new version and ZIP.

## Historical release freeze: v0.10.8

2026-10-12. Release candidate for Sandbox Preview; not yet submitted or approved for publication. Includes the completed painted buildings and elephant, smaller runtime building textures and a full iframe/UI readiness pass. Supersedes v0.10.6 and the intermediate v0.10.7 QA package. Earlier ZIPs stay in `release/`, unchanged.

## Immutable artifact

- `release/grow-an-empire-0.10.8.zip`: 17,856,956 bytes, 155 entries.
- SHA-256: `DDD466FCC422041641CB8A95B4DB74C35EFB767B5AA5E8F65EE1C17C8740932F`
- Superseded 0.10.6: 24,036,318 bytes; SHA-256 `8E9B8C49C1CA93638ED1FF65786AAA367B6D3EF6B4E4D8C3BB7DD9454EFB9EFA`.
- Superseded 0.10.5: 16,488,976 bytes; SHA-256 `C108EE8467A05E90EB8980191252786F6CB571A60C36D787915F802019D7475E`.
- (Superseded: `grow-an-empire-0.10.4.zip`, SHA-256 `4FC57AE0…0529`; `grow-an-empire-0.10.3.zip`, SHA-256 `B2D1C052…E004`; `grow-an-empire-0.10.2.zip`, SHA-256 `7D8F948E…3B6E`.)
- Save schema 6 (v4/v5 migrations retained). Game slug `grow-an-empire`; leaderboard `campaign-progress` (no maximum score).

Keep this ZIP unchanged. Any further fix needs a new patch version, a separate ZIP and fresh check/package evidence.

## What 0.10.2 to 0.10.8 change

The fixes from the pre-submission review (project doc "Grow an Empire 0.10.1: pre-submission review") and Ravi's decisions of 2026-10-10. Details in `CHANGELOG.md` and `Docs/QA_RESULTS.md`: errors from outside the game no longer pause it; `GAME_READY` is sent on every error screen; testing switches are inert on the portal; a bad save can't block boot; guests keep no cloud save; art, font and sound health checks; UX, accessibility and dead-code cleanup; faster first screen on Slow 4G; landscape listing; new key art. Save schema 6 and the SDK contract are retained. Gameplay and calibration changed in 0.10.4/0.10.5 as described below.

0.10.3 adds the visual changes only: smoother walking (poses follow distance, a calmer crowd clock), villagers spread in lanes and stops around the Town Hall, and roads 5% wider per move up to 1.6×. Gameplay, save shape and the SDK contract are unchanged from v0.10.2.

0.10.4 adds four buildings (Baoli, Prakara, Gajashala with war elephants, Dharma Stambha) with procedural stand-in art, retunes the offer rules and recalibrates all 25 campaigns and the Realm field. Save schema 6 and the SDK contract are unchanged; 0.10.3 saves load.

0.10.5 adds the Burj, Sarai, Koshagar and Dharmashala (stand-in art), strengthens the Baoli, changes the offer refill to rotate between land, town and war families, and recalibrates again. Save schema 6 and the SDK contract are unchanged.

0.10.6 replaces the eight buildings' procedural art with 32 painted construction/completion sprites, and the battle elephant SVG with an eight-pose painted atlas. Original stand-ins are archived, generation records retained, and a dev-only art review shows the real city layout without touching saves. Gameplay, save shape, plot positions and the SDK contract are unchanged from 0.10.5.

0.10.8 caps runtime building textures at 768 px wide while preserving proportions and the full-resolution painted masters. The 32 new building sprites shrink from 201.3 MB to 50.3 MB as decoded RGBA images (mipmaps excluded); the ZIP falls from 24.04 MB to 17.86 MB. Gameplay, balance, saves, plot positions and the SDK contract remain unchanged from 0.10.6. Adds a release-ZIP iframe check for stage fit, all campaign screens, Realm focus, Details, report shortcut guards and portal lifecycle. The v0.10.7 ZIP is a preserved intermediate QA artifact.

## Verified locally in 0.10.8

- `pnpm check`: TypeScript, ESLint and 257 tests in 27 files; the new texture-size test checks the actual WebP headers and source proportions.
- Runtime exporter `--check`: no stale exports.
- `pnpm package`: all 15 bundle-validator checks pass; ZIP 17.86 MB.
- Exact ZIP at the portal path: real 1920×1080 iframe passes all campaign screens and portal lifecycle; desktop and phone journeys complete with no game errors/warnings/failed requests; all 152 assets decode and art/font/audio checks pass.
- All 14 viewport checks pass after resizing. Optimized painted art verified at all four stages, the eight-building view and all 24 plots. Baseline gameplay, SDK/guest/cloud, campaign-map, text-budget, context-recovery and 16 quick failure checks also pass.
- Startup with HTTP compression: 2.38 s at 10 Mbps, 9.15 s on Slow 4G, 1.69 MB / 11 requests. Uncompressed delivery takes 12.26 s on Slow 4G; verify portal compression. Physical-device FPS remains unmeasured.
- Local launcher reliability: generated QA/unpacked ZIP paths no longer crash Vite's Windows watcher. Release test server supports negotiated gzip; UTF-8 QA logs and deterministic ANGLE rendering verified. See `Docs/QA_RESULTS.md` for evidence and limitations.

## Historical 0.10.5 validation

- `pnpm check`: TypeScript, ESLint and 255 tests in 26 files (0.10.5).
- `pnpm package`: production build; all 15 bundle-validator checks pass, including the new check that every asset the code and styles name is in the ZIP.
- Full Python Playwright suite against the production build, all pass: gameplay, platform_sdk (signed-in cloud restore, iframe pause/resume/session end, offline, guest without cloud), viewports (14 sizes), campaign_map, text_budget, context_loss, fault_injection --quick (16 scenarios), assets_audio (119 bundled files decode; images, font and sound load at 1280×720 and 390×844), journey on the release build at the portal path (no errors or warnings).
- Time to playable: 1.7 s at 10 Mbps, 9.1 s on Slow 4G (1.69 MB). The full browser suite was rerun on 0.10.5: all pass (151 bundled files decode).

Not covered locally: the real portal, real phones and Safari, physical speakers.

## Before publication

1. Create and activate `campaign-progress` in the Developer Console: Campaign Progress, All-Time, Highest Score Wins, no maximum score. Confirm the listing slug and orientation **Landscape**.
2. Upload this exact ZIP to Sandbox Preview. Verify GAME_READY, the portal display name, registered scores, guest play (no cloud save), trial/cloud-denied play and cloud restoration.
3. Verify the portal prevents iframe launch for players without game access.
4. Verify portal pause/resume/session end, Safari, a device showing the full 1920×1080 frame, and sound/mute on real speakers.
5. Complete owner confirmations in `Assets/Art/PROVENANCE.md`; upload the v2 thumbnail and banner from `Assets/Art/Store/upload/`. The painted building set is now included.
6. Submit for review (Ravi, later).

## Later improvements

Review campaign-1 generosity (an all-Gather path earns three stars); explore strategic Gather beyond eight moves; use portal playtest analytics (`ux_*`, `asset_problem`) to guide tutorial and mobile text.
