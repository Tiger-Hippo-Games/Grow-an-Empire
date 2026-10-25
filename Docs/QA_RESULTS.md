# QA results

## v0.15.0 (2026-10-25): victory and campaign care stars

- TypeScript, ESLint and **351 tests / 34 files** pass. Coverage includes independent bonus combinations, defeat gating, narrow and overwhelming victories, blocked production/recruitment, unpaid upkeep before camp supplies, excluded low reserves/spending/partial output, resets, reloads and v4/v5/v6 migrations. The protected v4 fixture is unchanged. Log: `Tools/qa/out/rating-check.txt`.
- Real simulation witnesses verify legal shortage-free three-star paths for **all 25 campaigns**, including every longer move limit. Existing army strengths and reference calibration remain unchanged. Witnesses: `src/game/__tests__/fixtures/three-star-routes.json`; search evidence: `Tools/qa/out/clean-route-search.txt`.
- `Tools/qa/campaign_rating.py`: actual clean campaign plus isolated population-only, resource-only, both-issue, migrated unfinished and defeat cases all pass. Checks include 3/2/2/1/1/0 result stars, each earned/missed goal, forecast, keeping a previous best of three, schema 7 persistence and on-screen goal bounds at 1280×720, 844×390, 390×844, 375×667 and 960×540. No uncaught page errors. Screenshots and results: `Tools/qa/out/campaign-rating/`.
- Existing phone word budgets pass at 390×844 and 844×390, including visible result criteria: **24/28** and **21/28** words. Evidence: `Tools/qa/out/rating-text-budget.txt`.
- Legacy completed reports and best ratings remain intact. Older unfinished runs lack full history and receive only the victory star until a fresh replay. Portal SDK, leaderboard distinct-win scoring, civilian cap and army representation are unchanged.


- `pnpm package`: **16 bundle checks pass**, **18,416,915 bytes**, **159 entries**. ZIP matches the verified production build byte for byte. SHA-256 `15B16D8A572107E666A71FB536C978270D113F40C0E0257E1469895FB4E01C59`. Evidence: `Tools/qa/out/rating-package.txt`, `Tools/qa/out/campaign-rating/release.json`.

## v0.14.1 (2026-10-25): one civilian per completed building; army exempt

- `pnpm check`: **312 tests / 32 files**, TypeScript and ESLint pass. Four new renderer tests cover empty/growing/all-24 cities, duplicate building IDs, restart/combat visibility, a focused woodcutter replacing its site's commuter, and **42 retained garrison soldiers with only two civilian building workers**. Log: `Tools/qa/out/density-check.txt`.
- `Tools/qa/city_motion.py`: real all-catalog art-review scene shows **24 civilians assigned to 24 distinct completed buildings**, with **42 army sprites retained**. All 24 civilians move during the one-second step; pause/step/resume, image loads and requests pass with no page errors. Evidence: `Tools/qa/out/civilian-density/browser-results.json`, `city-before.png`, `city-after.png`.
- Civilian density no longer follows population, and extra supply/trade actors no longer spawn. The active construction site keeps its single crew; the focused harvesting woodcutter replaces the commuter for that same building. No simulation, recruitment, army strength, save or battle rule changes.
- Production-preview campaigns pass at **844×390, 390×844 and 1920×1080**, through all moves, reports, muster, fight and results, without uncaught errors. `pnpm package`: **16 bundle checks pass**, **18,415,750 bytes**, **159 entries**. SHA-256 `F18FD07B7BD8A1C09E9F51A2EA5FC0EF19E76C50A71DA6DBD4B143C3BF1C6F94`. Every ZIP entry matches the tested build. Evidence: `Tools/qa/out/density-package.txt`, `Tools/qa/out/civilian-density/release.json`, `Tools/qa/out/ui-tray/`.

## v0.14.0 (2026-10-24): applicable Sanctuary-inspired city polish

- `pnpm check`: **308 tests / 31 files**, TypeScript and ESLint pass. Includes unchanged campaign calibration and new shared-road coverage/deduplication, cached polyline sampling, persistent trips, fixed-step pause behavior and a **ten-minute virtual run with all 80 citizens completing multiple visits**. Waiting never advances stride. Log: `Tools/qa/out/city-polish-check.txt`.
- `Tools/qa/character_atlases.py`: three runtime sheets decode at **1024×1360**, with **eight directions × eight distinct authored pose images each** (192 total), transparent gutters and registered feet. Contact/GIF evidence and results: `Tools/qa/out/city-polish/`. Merchant draft grids were rejected and are excluded from the build. Technical export removes clipped neighboring-cell fragments; accepted PNG masters remain unchanged.
- `Tools/qa/city_motion.py`: actual all-catalog renderer with **80 citizens and 42 soldiers**, pause/step/resume, **78 citizens visibly moving during a one-second step**, loaded images, no failed requests and no uncaught errors. This isolated art-review fixture never reads/writes saves. Evidence: `Tools/qa/out/city-polish/browser-results.json`, `city-before.png`, `city-after.png`, `motion-*.png`.
- `Tools/qa/ui_tray.py`: real production-preview campaigns complete at **844×390, 390×844 and 1920×1080**, through choices, reports, muster, animated fight and results. All pass with no uncaught errors; screenshot evidence: `Tools/qa/out/ui-tray/`.
- `Tools/qa/load_time.py` against the final production build at the nested portal path, with local SDK stand-in and HTTP gzip: first playable **2.78 s at 10 Mbps**, **9.91 s at Slow 4G / 1.6 Mbps**, **1.86 MB / 13 requests**. Log: `Tools/qa/out/city-polish-load.txt`. Slow-network headroom is narrow; these are local measurements, not a live portal or physical-device guarantee.
- Scope: [SANCTUARY_POLISH.md](SANCTUARY_POLISH.md). Existing full-city camera, choice tray, simulation construction/speed, economy, campaign/battle rules, SDK contract and save schema 6 remain. This pass does not establish live portal publication or real-device frame rate.
- `pnpm package`: **16 portal bundle checks pass**, **18,415,687 bytes**, **159 entries**. SHA-256 `7758087E3079D8C34CD97798F50D523C4AC2CF0344C1D5BCBC7CE875B1045D13`. All ZIP entries match the tested production build. Evidence: `Tools/qa/out/city-polish-package.txt`, `Tools/qa/out/city-polish/release.json`.

## v0.13.1 (2026-10-22): complete city and iframe UI fit

- `pnpm check`: **302 tests / 30 files**, TypeScript and ESLint pass. New camera tests cover contain-fit at ten frame sizes and the complete 24-building layout. Log: `Tools/qa/out/frame-check.txt`.
- `Tools/qa/frame_fit.py`: isolated real-HUD/renderer fixture with all **24 painted building sprites**, **15 frame sizes**, **240 card sets** (all buildings with learner words on/off), information dialogs and Controls. Checks sprite corners, noncollapsed world extent and complete name/cost/benefit/action bounds without vertical card scrolling. Includes the user's 870×668 preview and portal heights 1036/916. Evidence: `Tools/qa/out/frame-fit/`.
- Production preview browser regressions: guided tutorial at four sizes; **14 viewport layouts**; complete campaigns at **844×390, 390×844 and 1920×1080** through reports, muster, animated combat and result. No uncaught errors. Logs: `Tools/qa/out/polish-tutorial_polish.txt`, `polish-viewports.txt`, `polish-ui_tray.txt` (rerun for this release).
- Camera now contains outer plots and roofs in measured uncovered screen space. Cards keep main content visible, unlock details use a focus-trapped dialog, and Controls remain reachable while choosing. Economy, balance, SDK contract and save schema are unchanged. This local layout pass does not establish live portal upload/publication.
- `pnpm package`: **16 portal checks pass**, **17,767,011 bytes**, **159 entries**. SHA-256 `5BDEE45F9725177B3B0FC77A92B41813096CCA7C1EE590113A76533B5384D8E5`. All ZIP entries match the production-build snapshot. Logs: `Tools/qa/out/frame-package.txt`, `frame-release.json`.

## v0.13.0 (2026-10-22): guided tutorial, readable UI and character polish

- `pnpm check`: **291 tests / 29 files**, TypeScript and ESLint pass. Log: `Tools/qa/out/polish-check.txt`.
- `Tools/qa/tutorial_polish.py`: real three-lesson onboarding at 1280×720, 390×844, 844×390 and 375×667; keyboard first choice, Gather first, report acknowledgement, replay/skip, guide/tray separation and 15.2-stage-pixel coach copy. No uncaught errors. Results/screenshots: `Tools/qa/out/tutorial-polish/`. The final Gather caption is deliberately neutral when no producer exists: “Gather move complete.”
- `Tools/qa/viewports.py`: **all 14 viewports pass**, fixed/fluid stage fit, contained panels, no overlapping controls, no tiny text, readable tutorial fit and no page scroll. Final log/screenshots: `Tools/qa/out/polish-viewports.txt`, `vp_polish-final_*`.
- `Tools/qa/ui_tray.py`: complete campaigns at **844×390, 390×844 and 1920×1080**. Benefit text, resources, countdowns, all move reports, muster, animated fight and result pass with no uncaught errors. Added bounds checks verify that the popup clears the Resources/Move control, the battlefield fits and Skip does not cover it. Visual review corrected the compact battle into two columns and removed the final-move toast from combat. Evidence: `Tools/qa/out/polish-ui_tray.txt`, `Tools/qa/out/ui-tray/`.
- `Tools/qa/assets_audio.py`: every bundled asset decodes; real desktop and portrait campaigns have no bad requests/broken images; Yatra One loads, audio unlocks after a tap and cues play; asset health is clean. Log: `Tools/qa/out/polish-assets_audio.txt`.
- `Tools/qa/text_budget.py`: both phone orientations pass all screen budgets; welcome **40/44 words**, battle **16/20 words**. Log: `Tools/qa/out/polish-text_budget.txt`.
- `Tools/qa/boot_csp.py`: desktop/phone boot and resize under file-only script policy, blocked-module error screen and reload recovery pass. Log: `Tools/qa/out/polish-boot_csp.txt`. The harness now accepts `GAE_URL` so it can target the built preview as well as a nested release server.
- `pnpm package`: **16 portal checks pass**, **17,766,476 bytes**, **159 entries**. SHA-256 `1EE681D252C716B7E4F29C8F16276E804758F02F74194637C9D18989EA1F9E73`. Every ZIP entry's SHA-256 matches the snapshot of the production build used for browser QA. Logs: `Tools/qa/out/polish-package.txt`, `polish-release.json`.

Seven selected character PNG masters and their WebP derivatives are current; overwritten masters were archived outside the runtime bundle. Prompts, source-window coordinates, tool provenance and selected output IDs are in `Assets/Art/Production/Characters/POLISH_0_13_0.md`. The image tool retains its originals in its managed C: location; game assets, backups and generated project files are on D:.

This pass leaves campaign balance, settlement schema 6 and SDK integration unchanged. Browser QA uses the local SDK stub; prior v0.12.7 real-client bridge evidence is historical. No portal upload/publication, fresh human comprehension study, physical-device FPS or Safari certification is claimed. Existing publication checklist items remain applicable.

## v0.12.7 (2026-10-18): verified Hippo Arcade SDK v2 release

Includes the complete SDK migration described below. Browser timing inspection found that measuring from before SDK dispatch could produce a 4.97-second call interval. The cloud guard now measures from the settled attempt, preserving at least five seconds even when SDK dispatch is delayed. The v0.12.6 candidate stays immutable and is superseded.

- `pnpm check`: TypeScript, ESLint and **290 tests in 29 files pass**, including the delayed-SDK-write regression and original save migrations. Log: `Tools/qa/out/sdk-v2-check.txt`.
- `pnpm package`: **16 portal checks pass**, **17,862,329 bytes**, **157 entries**. SHA-256 `C6DB54E7D9E716E75CE154850419DE4C06A394DCCEB1AB1FBAB0508EAEAEA3F0`. Exact ZIP served from `.tmp/release-0.12.7` on port 4177. Log: `Tools/qa/out/sdk-v2-package-final.txt`.
- Exact ZIP, official hosted **SDK 2.1.0** client, local same-origin protocol-v2 parent and strict file-only script CSP: **PREVIEW, EMAIL and GUEST all pass**. Preview and registered profiles save a completed move, remove their browser copy, close/reopen the frame and restore from the simulated cloud. Preview never calls rankings or touches the live browser save; guests never call progress/private rank. Registered player completes campaign 1 and posts **1** to **strongplayer**, with matching completed-campaign metadata. Top ten/own rank, versioned writes, 64 KB/six-level limits, one initial GAME_READY and game-side save-call spacing pass; no uncaught errors. Logs: `Tools/qa/out/sdk-v2-browser.txt`, `Tools/qa/out/sdk-v2/results.json`.
- Current source of portal guidelines is the unchanged `developer-kit/`; historical `common/` SDK instructions are superseded. Test is Netlify; production is Hippo Arcade. No SDK copy, API URL, game-ID initialization or token handling is in the game ZIP. Game rules, live browser keys and settlement schema 6 remain unchanged.

The bridge parent and persistence backend above are simulated. Real preview save/reopen still needs testing in the test developer console, and live rankings need test player playback because preview does not support them. Upload the verified ZIP to `https://www.hippoarcade.com/developer` separately for production; test uploads/saves do not transfer. No upload or publication was performed. The full viewport/asset/audio/Safari/device evidence and limitations remain in earlier entries.

## v0.12.6 (2026-10-18): intermediate SDK v2 migration candidate (superseded)

Superseded by v0.12.7 after browser timing checks found the write guard needed to account for SDK dispatch delays. The supplied `developer-kit/` supersedes historical v1 SDK instructions. The ZIP loads the serving origin's `/sdk/v2/platform-sdk.js`, with no bundled SDK copy or hardcoded backend/game-ID configuration. Initialization is followed by `getPlayer()`. Cloud load/save is serialized; all failed writes invalidate the loaded revision and require reload/reconciliation before another write. Preview saves use separate browser slots, and PREVIEW never requests or submits rankings. Existing game rules, `strongplayer`, live browser keys and schema-6 saves are retained. See ADR 0003.

- `pnpm check`: TypeScript, ESLint and **289 tests in 29 files pass**. New coverage checks single initialization, load-before-save, failed/malformed reads, uncertain-write recovery against a newer cloud save, denied browser locks, preview browser/cloud isolation, late preview identity, account changes and actual final-battle save size/depth. Original v4/v5 fixtures still load. The kit's example code is excluded from game linting; kit files are unchanged.
- `pnpm package`: **16 portal checks pass**, **17,862,321 bytes**, **157 entries**. SHA-256 `4FF27EBBD8299BD3D4A00E01422C2B408A8C11D33E5581F0260489A68EDB0594`. Exact ZIP unpacked to `.tmp/release-0.12.6` and served locally on port 4177. External scripts, relative game assets, all referenced media and official same-origin SDK route pass validation. Log: `Tools/qa/out/sdk-v2-package.txt`.
- Official production-hosted SDK downloaded into D: scratch reports **2.1.0**. `Tools/qa/sdk_v2.py` uses those actual client bytes with a simulated same-origin protocol-v2 parent and `script-src 'self'` (no unsafe-inline/unsafe-eval). Preview and registered profiles complete a move, save, remove the browser copy, close/reopen the iframe and restore the checkpoint from the simulated cloud. Guest makes no progress/private-rank calls; preview makes no leaderboard calls or live-browser save. Profile, top-ten/private-rank UI, once-per-frame GAME_READY, save versions and size/depth checks pass without uncaught errors. Logs: `Tools/qa/out/sdk-v2-browser.txt` and `Tools/qa/out/sdk-v2/results.json`.

This is local game/client integration evidence. It does not establish deployment or persistence in either live environment. Test preview save/reopen in the Netlify test console and leaderboard operations through test player playback (preview does not support them). Production submission uses `https://www.hippoarcade.com/developer`; test uploads/saves do not transfer there. No upload or publication was performed. Prior viewport, full asset/audio and physical-device limitations remain as recorded below.

## v0.12.5 (2026-10-14): final portal release build

Version-only production release of the complete v0.12.4 game; gameplay, assets, layout and settlement schema 6 are unchanged. Earlier archives remain intact.

- `pnpm check` passed TypeScript and ESLint; its first test run encountered four default five-second timeouts. The complete Vitest suite then passed **280 tests in 29 files** with `--maxWorkers=1 --fileParallelism=false --testTimeout=30000`. No assertions were weakened or source tests changed. Log: `Tools/qa/out/final-0.12.5/unit-tests.txt`.
- `pnpm package`: **all 16 portal checks pass**, **17,861,770 bytes**, **157 entries**. SHA-256 `4F597C688F5E9D8ED4A234444FD235EECEB2BCDCC6852CCE2C53455E4EA5A0BA`. Exact ZIP unpacked to `.tmp/release-0.12.5` and served at the production-style `grow/play/` path on local port 4176; packaged official SDK URL retained, local server supplies its stand-in.
- Exact-ZIP strict script policy (`script-src 'self'`, no unsafe-inline/unsafe-eval): desktop 1920×1080 and phone 390×844 boot, layout scaling, landscape resize, blocked-game watchdog and Reload recovery all pass with zero CSP violations. Log: `Tools/qa/out/final-0.12.5/boot_csp.txt`.
- Fresh full iframe QA did **not** complete: Chromium stalled taking Realm screenshots; capture-free retry also exceeded a 240-second bound. This is incomplete browser evidence, not a passing iframe result. Prior full iframe/UI/leaderboard evidence below remains historical; no such fresh pass is claimed for this version. The bounded runner lives in `.tmp/final-release-qa.py`.
- The fresh asset/audio browser run also exceeded its 240-second bound and is incomplete. Unit asset freshness/dimension checks and the ZIP's referenced-asset validator passed; they do not replace a complete browser decode/audio run.

Live production accounts, leaderboard persistence, Safari, physical-device checks and owner art-provenance confirmations remain on `Docs/SUBMISSION_CHECKLIST.md`. This ZIP is built locally and has not been uploaded or published.

## v0.12.4 (2026-10-13): clearer civic-center spacing

Dharmashala moves behind the Town Hall on the north approach, from plan (1010, 900) to (1000, 270). House moves left/down from (788, 587) to (700, 625); Bazaar moves right/down from (1124, 580) to (1200, 650). Positions remain keyed by building identity, so roads, construction sprites, villagers and restored cities follow the same anchors without a save migration.

- Visual review shows all 24 finished buildings around the largest level-8 civic art, plus construction stages for the eight newer buildings. The central hall, House and Bazaar are visually separated; Dharmashala is clearly behind the hall. No browser errors, warnings or broken images. Screenshot: `Tools/qa/out/art-optimized/all-plots.png`; log: `Tools/qa/out/city-spacing-final.txt`.
- Updated existing reserved-anchor expectations. TypeScript, lint and **280 tests in 29 files** pass, including functional routes and the exhaustive early route/offer proof.
- Versioned package passes **all 16 upload checks**, retaining the external boot scripts and zero inline script blocks. ZIP: **17,861,770 bytes**, 157 entries, SHA-256 `2DBAB625C91D6592174F3A932C57767DAF50D822FAC643C14312E63C094497C9`. Preview server serves this exact unpacked ZIP. Broader browser/CSP/leaderboard validation from the preceding releases is retained below; this change is limited to three plot positions.

## v0.12.3 (2026-10-13): live portal script-policy fix

The reported two inline scripts were still present in 0.12.2. Screen sizing and boot-error recovery now live in `public/boot-stage.js` and `public/boot-watchdog.js`, loaded as ordered, versioned external files before the SDK/game. The packaged HTML has **zero inline script blocks**; all four scripts load from files, and both new files are byte-identical to their packaged copies. The official SDK tag stays intact.

- TypeScript, ESLint and **280 tests in 29 files** pass. The bundle validator now rejects inline scripts, including module and misleading data-src tags, and catches missing external boot files. **All 16 bundle checks pass**.
- Exact ZIP, complete 1920×1080 iframe campaign with **script-src 'self'** (no unsafe-inline or unsafe-eval, local SDK stand-in): 1.5× stage, one GAME_READY for 0.12.3, no game errors/warnings/failed requests, portal pause/resume/session end, clean asset/font/audio health. `portal_iframe.py` now enforces this header for future checks.
- Strict-policy boot checks at 1920×1080 and 390×844 pass with zero policy violations. Resize to phone landscape still switches layout correctly. Deliberately aborting game.js shows the external watchdog's error screen; Reload recovers after the fault is removed. `boot_csp.py` uses DOM selector polling because string-based browser-test polling can itself invoke eval under CSP.
- Startup remains within budget: **1.75 s at 10 Mbps**, **9.13 s on Slow 4G**, 1.7 MB / 13 requests before playable. Earlier UI, campaign and leaderboard behavior is retained; v0.12.2's broader viewport evidence is below.
- Immutable ZIP: **17,861,773 bytes**, 157 entries; SHA-256 `B2AE919EBA2508236B677147B38361E1B25CD8A26DE8C1202F04F35829547ED1`. Upload this replacement ZIP to resolve the stored portal build's warning; its existing uploaded bytes have not been changed here. Live portal revalidation remains pending upload.

## v0.12.2 (2026-10-13): extended campaigns and production weekly leaderboard

- `pnpm check`: TypeScript, ESLint and **279 tests in 29 files** pass. Distinct campaign scores, legacy score migration, production SDK ids, guest reads/posting guards, weekly rollover with 30-second spacing, longer save round trips and old-muster offer refill are covered. Settlement schema remains 6, including original v4/v5 fixtures.
- Campaign move schedule: **1–5: 12; 6–10: 14; 11–15: 15; 16–20: 16; 21–22: 18; 23–24: 20; 25: 25**. Enemies, star thresholds and AI Realm field are recalibrated for each length. Campaigns 1–5 retain the exhaustive reference; each longer length uses 4,096 reproducible build-first journeys, not an exhaustive enumeration. Every sampled run reaches its muster without a dead end; difficulty tracks the chapter targets, with the final campaign near 5% in that reference. The final enemy has 80 swordsmen, 80 archers and 80 horsemen. Rendering caps representative crowds at 80 citizens and 14 per trained kind, retaining exact simulation/HUD counts.
- Exact final ZIP, locally injected SDK: `grow` initializes before login; `strongplayer` is used for score posting, top ten and own rank. First win posts **1**, not the prior stars-based 103. Leaderboard UI passes at **1920×1080, 390×844 and 844×390**: names escaped, ten rows, guest read access, Monday reset wording, empty/error recovery, HUD clearance, styled 44 px refresh controls and focus return. A full campaign 25 journey reaches all 25 moves and builds all 24 building types, reloading at move 14 without losing progress. Its defeat posts **24** earlier campaign wins, adding no point for the loss. No uncaught errors.
- Exact ZIP in a **1920×1080 portal iframe**, fixed layout at **1.5×**: map, AI Realm, briefing/Details/tutorial, choices/report, muster/result, completed-city inspection and progress map pass; resource/move HUD remains visible. One GAME_READY reports **0.12.2**, portal pause/resume/session end work, and the guest makes no cloud/score calls. No game errors, warnings or failed requests; asset/font/audio health clean. Local sandbox notices are recorded separately.
- Final **14-viewport** UI/map sweep and both phone word budgets pass. Loading bar/tips pass under throttling on desktop and portrait phone, including monotonic progress, hidden pre-boot cards and immediate tip cleanup. Compressed startup: **1.82 s at 10 Mbps**, **9.16 s on Slow 4G (1.6 Mbps)**.
- `pnpm package`: **all 15 validator checks pass**, **17,861,278 bytes**, **155 entries**. SHA-256 **`191596B2E3B59EB63A4A6A75EC652A45007F54D28AE4CE475F6A51D3055F8CCE`**. Deliver v0.12.2; earlier ZIPs, including intermediate 0.12.0/0.12.1, remain unchanged.

The SDK behavior above is tested with local stand-ins; this does not establish live Netlify score persistence, real prizes, Safari behavior or physical-device FPS. Upload to production game `grow` and verify the already-configured weekly `strongplayer` board in Developer Console Sandbox Preview before publication.

## v0.11.2 (2026-10-13): UI, army, moves and loading tips

- `pnpm check`: TypeScript, ESLint and **266 tests in 28 files** pass. Coverage includes all 24 loading hints, progress/timer cleanup, premature Burj offers restored during choices/construction, the last surviving actor, empty armies and combat stopping on defeat. Original v4/v5 save migration fixtures still load (schema 6).
- v0.11 UI sweep: **14 viewports** pass, including map headers/Realm controls, speed/HUD/tray overlap, bounds, touch targets, text and stage fit. Full first-campaign journeys at 1920×1080, 844×390 and 390×844 validate persistent resources during every phase, horizontal choices, visible benefits and the move countdown. Final phone word-budget checks pass in both orientations with the requested permanent wording.
- Exact final ZIP, real **1920×1080 iframe**: fixed stage at **1.5×**, no scroll or offscreen panels, persistent HUD on all screens; map/Realm, briefing/Details/tutorial, choices/report, muster/result and completed-city inspection pass. GAME_READY arrives once with gameVersion 0.11.2; portal pause/resume/session end work; guest cloud/score calls remain absent. No game errors, warnings or failed requests; art, font and audio health clean. Harness sandbox notices are recorded separately.
- Exact ZIP on a throttled connection (desktop and phone): building tips rotate above the progress bar, all 24 tips have catalog-backed unit coverage, progress is monotonic, build cards stay hidden until boot, and tips stop immediately on readiness. No added art downloads or minimum loading delay.
- Startup with negotiated HTTP gzip: **1.75 s at 10 Mbps**, **9.15 s on Slow 4G (1.6 Mbps)**, **1.7 MB / 11 requests** before playable. v0.11.1 briefly exposed lazy card art before boot and measured 10.59 s / 1.98 MB on Slow 4G; v0.11.2 restores the first-screen download budget with a stronger pre-boot selector.
- All 25 campaigns and the AI Realm field recalibrated after Burj began requiring three completed war-family buildings (including Prakara). Trained troops now form beside the watchtower; battle sprites preserve the final survivor and stop striking when one army falls. Briefing explains build/Gather moves and Fight; remaining moves appear centrally after each completed move.
- `pnpm package`: all **15 validator checks** pass; **17,859,610 bytes**, 155 ZIP entries. SHA-256 `83BD50EDB8AE4B3A6F790C16AB8D2685109A73BE39EC0F64E8F7F98CE65110A1`. Intermediate 0.11.0 and 0.11.1 ZIPs are preserved; deliver 0.11.2.

The release simulator supplies a local SDK stand-in and compressed text responses; the packaged HTML retains the official SDK URL. Real portal accounts/leaderboard, Safari and physical-device FPS remain outside this local QA. Earlier art/SDK/failure validation is recorded below.

## v0.10.8 (2026-10-12): final iframe and UI readiness pass

- Runtime building textures are capped at 768 px wide, with source proportions and full-resolution PNG masters preserved. The 32 new sprites use **50.3 MB decoded RGBA instead of 201.3 MB** (75% less, before mipmaps). Export revision 3; all runtime art is fresh. The release shrinks from 24.04 MB to **17.86 MB**. Gameplay, campaign balance, save schema 6 and plot positions are unchanged.
- `pnpm check`: TypeScript and ESLint clean; **257 tests in 27 files pass**, including a new check of actual WebP dimensions and source proportions. `pnpm package`: **17,856,956 bytes**, 155 entries, all **15 bundle checks pass**. SHA-256: `DDD466FCC422041641CB8A95B4DB74C35EFB767B5AA5E8F65EE1C17C8740932F`.
- The exact ZIP was unpacked under the project on D: and served at `/api/v1/games/grow-an-empire/play/`. New `portal_iframe.py` passes inside a real **1920×1080 iframe**: 1.5× stage fit, no page scroll or off-screen panels on the map, Realm, briefing/Details, tutorial, choices, report, muster, result and progress map. Realm Tab focus and focus return, Details, report shortcut guards, one `GAME_READY` with version 0.10.8, guest without cloud/score calls, pause/resume and session end all pass. No game errors, game warnings or failed requests. The local harness's two same-origin sandbox warnings are recorded separately.
- Release journeys at **1920×1080** and **390×844** complete: tutorial, controls, reload, battle/results, campaign progression, defeat/retry, Continue and Restart. Both logs end with `ERRORS: []`, `WARNINGS: []`, `FAILED: []`.
- Asset/audio checks against the exact release pass: **all 152 bundled assets decode**; desktop and phone campaign playthroughs have no failed requests or broken images, Yatra One loaded, audio running and cues played.
- Before runtime resizing, the full readiness baseline also passed gameplay, SDK/cloud/guest scenarios, campaign map, mobile text budgets, graphics context recovery and all 16 quick fault-injection scenarios. After resizing, all **14 viewports** pass again: no overlap, clipping, small targets, tiny text or page scroll; fixed/fluid stages fill and center correctly. Optimized-art review renders all 24 plots and the eight new buildings in all four stages with no warnings/errors or broken images; city silhouettes and spacing remain clear.
- Final release startup with negotiated HTTP gzip: **2.38 s at 10 Mbps**, **9.15 s at Slow 4G (1.6 Mbps)**, **1.69 MB in 11 requests** before playable. Both startup budgets pass. The local release server now negotiates gzip for HTML/JS/CSS/JSON and leaves compressed images untouched; raw and gunzipped responses were compared byte-for-byte. Without HTTP compression, the same ZIP measures 2.18 s / 12.26 s and 2.31 MB, so check compression in the actual portal before applying the Slow 4G result there.
- Local launch regression fixed: Vite excludes `.tmp/`, release archives and QA screenshots from its file watcher. Previously unpacking a ZIP could raise Windows `EBUSY` and stop Vite; repeating the unpack with the fix leaves the dev server responding HTTP 200. All source/assets/builds and project-specific QA files stay on D:; bundled tool runtimes stay in their existing locations. `check` and `package` used the existing `verify-deps-before-run=false` runner override after dependencies were restored from the D: cache.
- QA runner fixes: shared `flow.speed8` now supports Frames; Chromium uses `--use-angle=swiftshader` after the older GL flag caused shader/context warnings; iframe layout snapshots await finite entrance animations; viewport checks now exit nonzero for layout failures; journey output/logs use UTF-8 on Windows. These fixes affect development QA only. The official SDK URL stays in the packaged HTML; the release test server supplies a local stand-in.

The immutable v0.10.7 ZIP is an intermediate QA artifact, superseded by v0.10.8. Still required before publication: real portal accounts/leaderboard and cloud checks, Safari and physical-device frame rate/speakers, and owner provenance confirmations. Software-renderer QA does not establish a real-device FPS guarantee.

## v0.10.6 (2026-10-12): painted buildings and elephant

- Delivered 32 transparent 1536×1024 building masters for all eight new buildings, plus an eight-pose elephant combat atlas. Original procedural masters archived. Prompts and provenance recorded; WebP exports replace the existing runtime filenames.
- Browser art review uses the real scene, sprite sizes and plot coordinates. Inspected all four construction stages, the eight-building view and an all-24-plot spacing stress view with the level-8 civic centre. New art fits the assigned plots; no positions or gameplay numbers changed. Gajashala stage images and the elephant atlas decode in the browser; no art-review warnings or errors. Production build opens the campaign map.
- `pnpm check`: TypeScript and ESLint clean; **256 tests in 27 files pass**, including current balance, save compatibility, runtime asset presence and source freshness. The asset audit now includes the elephant sheet.
- `pnpm package`: **24,036,318 bytes**, 155 ZIP entries, all **15 bundle checks pass**; under the project's 50 MB target. Runtime art totals about 23.6 MB and remains loaded on demand.
- This art pass did not rerun the full Python browser suite or measure startup on throttled networks; previous 0.10.5 results below remain historical evidence. Portal/Safari/device checks and owner provenance confirmations remain publication tasks.

## v0.10.5 (2026-10-11): all eight new buildings, and a strategy check

Ravi: "build all the 8 buildings and the respective logic and lets see if they excite players with enough strategic options… for now just have placeholders." The eight are the proposal's set with the Dharma Stambha in place of the Mandir; 0.10.4 added four, this adds the Burj, Sarai, Koshagar and Dharmashala.

- **Rules:** Burj (militia at full strength, cap 14); Sarai (swaps at 1.5×, +1 Bazaar sale); Koshagar (+1 gold per 5 stored, at most 6 a move; +2 sellswords); Dharmashala (+6 people, +2 a move, +4 militia, every 4th soldier needs no villager). Baoli raised to +2/+3/+4 with one more food-processor cycle, because at +1 it changed no ending at all.
- **Offers:** with 24 buildings the old ranking starved several (Koshagar 0.6%, Sarai 0.6%, Royal Kitchen 1.1% of paths). New refill order: must-haves (Granary after a Farm, Lohar Forge, Bow Hall, Ashvashala, Dharma Stambha) → direct follow-ups of the building just finished → the land/town/war family whose turn it is → offer move → priority. The Bazaar now opens from any food or soma processor. Every building is offered on at least 5% of paths (lowest: Koshagar 5.5%, Dharma Stambha 6.5%, Bakery 9.1%); the Lohar Forge and Bow Hall stay at 99%, the Ashvashala 82%.
- **Balance:** 188,430 reference endings, no dead ends; all 25 campaigns re-sized, every win share within 5 points of the plan; Realm field regenerated.
- **Strategy check** (all endings, all campaigns): about 6 army styles reach three stars per campaign (4–8; fewer in the hard ones). Share of 3-star builds containing each new building: Prakara 61%, Burj 57%, Sarai 10%, Koshagar 9%, Gajashala 7%, Dharmashala 4%, Baoli 1%, Dharma Stambha under 1%. Sellswords are in 75% of 3-star builds and the Ghee House in 90%. Economy-only buildings (Baoli, Dharmashala, Mango Grove, Soma Press, House) rarely change a battle because trainers, the militia cap and the sellsword cap bound the army. Follow-up options are in the proposal doc.
- **City:** plots for the Burj (north approach), Sarai (between fields and grove), Koshagar (between Bazaar and forge) and Dharmashala (south of the square, below the garrison), with roads, supply routes and worker roles; checked in a 24-building city at the muster.

Validation: TypeScript and ESLint clean; **255 tests** in 26 files (new: rules for the four, offer families). Full browser suite on the 0.10.5 build, all pass: gameplay, platform_sdk, viewports, campaign_map, text_budget, context_loss, fault_injection --quick, assets_audio (151 bundled files decode), journey on the release build (no errors or warnings), load time 1.7 s at 10 Mbps and 9.1 s on Slow 4G. The ZIP is 16.49 MB, 154 entries, and passes all 15 validator checks.

## v0.10.4 (2026-10-11): Baoli, Prakara, Gajashala, Dharma Stambha

Ravi's choices of 2026-10-11 (project doc "Grow an Empire: new buildings proposal", updated): Baoli helps all food producers a little more as moves pass; Prakara watchtower removes 25% of the attacking army before it reaches ours; no temple; Gajashala sends one elephant warrior every 6 moves (fights like 4 soldiers, the first on completion); Dharma Stambha +20% army power, only after every war building including the Gajashala (trainers only, not the Prakara). Stand-in art now, painted art from `Docs/BUILDING_ART_BRIEF.md` later.

- **Rules:** Baoli +1/+2/+3 grain, mangoes and cattle per producer (moves 1–3/4–6/7+); Prakara fells round(25%) of the enemy head count, spread by largest remainder; elephants fight as 4 swordsmen for strength and for the enemy's counters, fall last before militia, eat 2 rations; Stambha ×1.2 player strength. Muster forecast, battle, report, explanations and "what would have won" all use the same `battleSetup()`.
- **Offers:** with 20 buildings and about 14 cards a run, the rules were retuned so every building is offered on at least 5% of build-order paths (share of paths offering it, uniform choices): Prakara 61%, Gajashala 52%, Butchery 50%, Baoli 26%, Bazaar 25%, House 22%, Soma Press 21%, Dharma Stambha 17%, Royal Kitchen 5% (0.10.3: House 46%, Bazaar 47%, Royal Kitchen 13%, Soma Press 1.5%).
- **Balance:** 124,419 reference endings (was 89,954), no dead ends; all 25 campaigns re-sized and every win share within 5 points of the plan; Realm field (`CAMPAIGN_FIELD`) regenerated; campaign 1 still 100%.
- **City:** plots for all four (Baoli north of the fields, Prakara on the south-west approach clear of the garrison, Gajashala by the forge yard, Stambha toward the forest road), roads and supply routes (Baoli → Farm, Ashvashala → Gajashala, Quarry → Prakara), worker roles. Checked in a 20-building city at the muster: all four visible, none covered by the garrison or the Town Hall.
- **Saves:** schema 6 unchanged; `elephants` is optional, so 0.10.3 saves load with none (test).

Validation: TypeScript and ESLint clean; **249 tests** in 26 files (new: `newBuildings.test.ts`, 10 rule tests; 20-building balance and layout checks). Full browser suite on the 0.10.4 build, all pass: gameplay, platform_sdk, viewports, campaign_map, text_budget, context_loss, fault_injection --quick, assets_audio (135 bundled files decode), journey on the release build (no errors or warnings); journey, gameplay and load time rerun after the last plot move. Time to playable 1.6 s at 10 Mbps, 9.1 s on Slow 4G (1.69 MB). The ZIP is 15.98 MB, 138 entries, and passes all 15 validator checks.

## v0.10.3 (2026-10-11): smoother, less crowded city; wider roads

Ravi: smoother worker animations, less clutter around the Town Hall, roads 5% wider each move (compounding, capped), new buildings as a proposal first (project doc "Grow an Empire: new buildings proposal").

- **Motion:** walk poses follow the distance walked (`strideFrame`), so feet keep pace at every speed; a smooth step bob replaces the one-frame hop; commuters run on a √speed clock (at 4× the pose changes about 9 times a second instead of 28); work loops run on the same clock.
- **Crowding:** each villager walks in its own lane beside the road's centre line and stops at its own distance (1.5–3.6 units) short of the Town Hall instead of on it; nearer villagers draw in front. Compared at the muster in a 12-move city, the hall plaza is clear and the crowd forms short queues along the approaches.
- **Roads:** ×1.05 per completed move, capped at 1.6× (reached around move 10), eased in over about half a second; lanes widen with them. Checked at move 7 and at the muster: no road covers a building.
- **Smoother sheets:** `walk64` (8 poses) and `work16` (16 frames) sheets are used automatically once exported; brief in `Docs/ANIMATION_COMMISSION_BRIEF.md`.

Validation: TypeScript and ESLint clean; **239 tests** (new: road growth, lanes and stops, stride poses, 8-pose atlas indexing). Full browser suite against the production build, all pass: gameplay, platform_sdk, viewports (no overlap or clipping), campaign_map, text_budget, context_loss, fault_injection --quick, assets_audio, journey on the release build (no errors or warnings). Time to playable 1.7 s at 10 Mbps, 9.1 s on Slow 4G. The ZIP is 15.45 MB and passes all 15 validator checks.

## v0.10.2 (2026-10-10): pre-submission review fixes, asset checks, new key art

Everything from the final review (project doc "Grow an Empire 0.10.1: pre-submission review") plus Ravi's decisions of 2026-10-10: listing orientation landscape, no maximum on the `campaign-progress` board, guests keep no cloud save, art/audio load checks, new thumbnail and banners.

- **Failure handling:** only the game's own uncaught errors pause a run; muted cross-origin errors, the ResizeObserver notice and SDK rejections are reported as `*_external` and play goes on. `GAME_READY` is sent once on every path, including the WebGL, boot, first-draw and watchdog error screens. `?reset`, `?platform=mock` and `?perf` are inert off localhost. A save with an unknown `selectedBuildingId` is rejected (and a stale one outside construction dropped) instead of failing every boot. Player wording on the boot error screen. A click on a card, Gather or Fight undoes a portal pause. Gather checks a pending selection itself.
- **Guests:** no cloud read or write for `authType` GUEST (`cloudSaveAllowed()`); progress stays in the browser.
- **Asset health:** `platform/assetHealth.ts` (`window.__gaeAssetHealth`, `asset_problem` analytics) for images, the Yatra One font and the sound engine; the validator fails on any `assets/…` file the code or styles name but the ZIP lacks (117 checked).
- **UX and accessibility:** first move report with words after a completed tutorial, plus a learner line; one Gather wording and icon; Enter (not 1–3) leaves the report and focus moves to Choose; speed slider hidden under dialogs; shortcut guards for the Realm board, lists and the slider; dialogs named by their heading, focus returned on close, the battle starts focused on its heading, double-click guard; steppers disable at their limits; aria-labels moved off generic elements; text ≥ 0.78rem, report reopen 44 px, Medium chip and Gather contrast ≥ 4.5:1; battle ranks no longer clip; no build panel behind the briefing; toasts wait for dialogs; background inert under the map; Realm board says "1,008 rival rajas + you".
- **Code:** old city battle (`battleField.ts`, `battleHud.ts`, the old `playBattle`) and its CSS removed; duplicate CSS merged; desertion fields marked legacy and the dead event removed; 8–12 moves documented; escaped card text and raja names; long-press listener leak fixed; no player id in logs.
- **Performance:** the opening cards' pictures no longer load during boot: Slow 4G time to playable 10.5 s → **9.1 s**, 10 Mbps **1.7 s**, 1.69 MB in 11 requests before playable.
- **Store art v2:** 1280×720 banner (309 KB), 480×270 thumbnail (64 KB), 1280×360 and 400×300 in-ZIP copies, from a new capture of the finished city plus the game's own combat sprites; title in Yatra One.

Validation: TypeScript and ESLint clean; **235 tests** pass (24 files; new: runtime guards, asset health, guest saves, bad selection, v0.10 rules incl. old desertion saves, camp supplies on the final move, the 1-ration floor, three campaigns at eight moves; validator asset check). Full browser suite against the production build, all pass: `gameplay.py`, `platform_sdk.py` (incl. the new guest scenario), `viewports.py` (14 sizes, no overlap/clipping/small targets), `campaign_map.py`, `text_budget.py` (report: 1 word), `context_loss.py`, `fault_injection.py --quick` (16), new `assets_audio.py` (all 119 bundled files decode; 95/95 images loaded, font loaded, audio running, 52 cues played at 1280×720 and 390×844, no failed request) and `journey.py` on the release build at the portal path (no errors or warnings). QA helper fix: `flow.speed8` (the S shortcut cycles from the 4× default, so three presses had been landing on 2×); `gameplay.py` uses the Granary (offered right after the Farm since 0.8.0). The ZIP is 15.45 MB and passes all 15 validator checks.

Still open (portal side): create the `campaign-progress` board, Sandbox Preview with guest, trial and subscribed accounts, a real device and Safari.

## v0.10.1 (2026-10-10): release freeze and exception safety

Gather, Fight, build-placement and uncaught runtime failures now pause the run and prevent subsequent actions/autosaves from replacing the last good save. Runtime logs include context and are deduplicated/bounded. Simulation/render failures stop sound and battle playback. Building-art failures remain retryable. Gameplay numbers, save schema and SDK contracts are unchanged.

TypeScript, ESLint and 216 tests pass; the production ZIP passes the bundle validator. Production preview verified Gather, save restoration, muster, popup Fight/Skip/result and registered mock leaderboard score 103, with no captured warnings/errors. `RELEASE_FREEZE.md` records the exact checksum, review findings and remaining real-portal/device/art-rights gates. This is a local release candidate, not portal approval.

## v0.10.0 (2026-10-10): basic reserves and no economy desertion

Every completed build or Gather move ends with at least 4 wood, 2 stone, 2 grain and 1 ration. Camp supplies top up only shortfalls after processing, training, trade, upkeep and spoilage, and appear in the report ledger. The wood/stone floor covers the Granary's cost once it is offered. These supplies are a reserve, not a fixed bonus added to an already stocked city.

Existing soldiers never desert for lack of food. Recruitment requires enough rations to feed the resulting army; insufficient food stalls training without spending its materials. Existing soldiers consume available rations and stay. Population never decreases during an economy move. Historical desertion fields remain readable for old saves; new moves record zero desertion. Battle casualties remain part of combat.

Validation includes basic reserves and nondecreasing population/army on every move across all 25 campaigns, Granary affordability after a processor-heavy move, training pause/resume with food, ledger accounting and the unchanged v4 save fixture. Live testing resumed an isolated saved city: wood stayed at 4, rations at 1, the report credited Camp supplies, the Bow Hall paused for food, and all five existing archers reached the muster. No browser warnings/errors were captured. The user's manual-test save was preserved. Older depleted runs receive the reserve after their next completed move, including Gather.

Final validation: TypeScript, ESLint and all 214 tests pass. Campaign armies, star margins and the Realm field are recalibrated against the declared build-first reference policy; finer veterancy steps keep every campaign within its target tolerance. The v0.10.0 ZIP is 15.41 MB and passes the portal bundle validator. Real portal Sandbox Preview, real phones/Safari and physical-speaker checks remain outstanding.

## v0.9.1 (2026-10-10): strategic Gather on every turn

Gather is available beside affordable cards on every build-choice turn, including move 1 and the final move. It spends one move, runs existing production/training/upkeep and retains the offered cards. Construction, muster and completed runs reject Gather. The G shortcut uses the same action. Panel headings, tutorial and report continuation now describe building or gathering; keyboard focus still prefers an affordable card, with Gather as the fallback.

Difficulty calibration retains its declared build-first reference policy, so enemy strengths and the Realm field are unchanged. `searchEndings({ gatherPolicy: "every-turn", campaign })` explores optional strategic Gather paths. Tests exhaustively cover an eight-move campaign under that policy, including all-Gather, mixed and all-build endings with no dead ends. The full twelve-move strategic tree is not part of the regular suite.

Validation: TypeScript, ESLint and 210 tests pass. Live isolated-origin checks clicked Gather on move 1 with all three cards affordable, confirmed move 2 with the same stockpile and offers, and used G to advance to move 3. Reload restored move 3 and its Gather report; no browser warnings/errors were captured. The manual-test save was preserved. No save schema or platform integration changes are required. The v0.9.1 ZIP is 15.41 MB and passes the portal bundle validator.

## v0.9.0 (2026-10-10): popup combat and UX/audio polish

- Fight stays in the army dialog. Formations approach, animate attacks and show casualties for each resolved round; army chips and the strength meter update with exact survivors. Skip and Escape show the result. Militia use existing painted action sprites.
- Playback pauses while hidden, during portal pause/session end, or during WebGL context loss. Reduced-motion playback avoids continuous animation. Animation failures log with context and fall back to the resolved result.
- Dialogs reset scroll and focus the primary action; Choose focuses Gather when no building is affordable. Buttons have restrained press feedback and Skip stays in reach in a scrolling popup.
- Softer build, training, coin and battle sounds; a new Gather cue; a layered conch cue. Audio stays gesture-gated, limits repeated cues, and cancels active voices on mute, backgrounding or portal pause. Optional audio failures remain nonfatal and log once.

Validation: TypeScript, ESLint and 208 tests passed, including six popup playback cases and two audio gesture/voice lifecycle cases. Live isolated-origin testing verified muster to popup battle with army totals and animation, plus progression after automatic completion. The manual-test server's save was preserved.

Physical-speaker balance, real mobile devices/Safari, the full Python browser QA suite and real GoLive Sandbox Preview remain unverified. Existing portal configuration and submission checks still apply.

## v0.8.0 (2026-10-09): speed, early storage and Gather

- Speed is a visible four-stop slider from the opening map through construction and choices: 1×, 2×, 4×, 8×, default 4×. The S shortcut still cycles the same speeds; the slider supports keyboard arrows, Home and End.
- Farm or Mango Grove makes the Granary eligible from move 2, with the Granary offered immediately after either producer when not already built/offered. Cost: 4 wood and 2 stone, paid up front, with no Carpenter's Yard or Quarry prerequisite. Its existing painted completion and three construction stages are reused; no new runtime art is needed. It sits beside the approach to the Farm at plan position (398, 335), adds one grain per move and keeps surplus grain.
- Gather is a prominent button whenever no card is directly affordable, including when a Bazaar swap is an alternative. It advances one move, preserves the offered cards and runs production, training and army upkeep. The button remains in reach in a scrolling build panel.
- The stage clips overflow without becoming a scroll container, preventing card focus from shifting the entire stage and clipping the speed slider on compact screens.
- Recalibrated all 25 campaign armies/star margins and matching Realm field probabilities using the exhaustive balance search, including Gather alternatives beside Bazaar swaps. Campaign ids and save schema are unchanged.

Validation: TypeScript, ESLint and 200 tests pass, including three new early-storage/Gather regression cases and the exhaustive offer paths, campaign balance, art freshness and legacy-save tests. Browser checks verified the default speed and every slider stop, plus Farm → Granary at move 2 with the displayed 4 wood / 2 stone cost and retained grain above the spoil cap. Compact portrait and landscape checks use the isolated local test origin, preserving the manual-test server's save.

Portal Sandbox Preview, real-device/Safari checks and the Developer Console configuration in `Docs/SUBMISSION_CHECKLIST.md` remain required. Existing ZIP releases remain untouched.

Final local verification: clicked Gather with all three cards unaffordable; move 9 advanced to move 10 and the report showed production, training, upkeep and deserters. The highlighted 54-pixel button stayed within the landscape panel's visible bottom while its cards scrolled; the speed dock stayed at the top and the stage scroll offset stayed zero. No browser warnings/errors were captured. The v0.8.0 ZIP is 15.41 MB and passes all bundle-validator checks.

## v0.7.0 (2026-10-08): current GoLive developer reference

Updated the SDK integration against `common/GOLIVE_DEVELOPER_REFERENCE.md`: official SDK URL and default API host, `GAME_READY` after the first screen is ready, portal display names, real signed-in leaderboard submissions, save/score rate limits, UTF-8 payload limits, and nonfatal cloud/leaderboard failures. Access remains the portal's responsibility before iframe launch; guests and trial players can continue playing when cloud saving is denied. AI Realm standings remain distinct from real portal scores.

Validation: TypeScript, ESLint and 197 tests pass (20 new regression cases). Local iframe testing confirmed initialization before login, cloud loading and `GAME_READY`. The signed-in mock player's display name appeared in the Realm board with rivals identified as AI. The production ZIP `release/grow-an-empire-0.7.0.zip` is 15.41 MB and passed the bundle validator, including official SDK, relative assets, mobile viewport, permitted formats and navigation checks. Existing release ZIPs remain untouched.

Catalog upload images were verified at 480×270 / 60,258 bytes and 1280×720 / 320,280 bytes, below the reference limits.

A full signed-in mock campaign reached the three-star Victory screen and recorded `submitScore campaign-progress 103`; no browser warnings or errors were captured. This verifies the game-to-adapter path, not the real portal board.

Still required: create/activate the `campaign-progress` leaderboard (or configure an existing board's exact slug), then run Developer Console Sandbox Preview with guest, trial and subscribed/favourite accounts. Local mocks cannot establish real portal compliance. Python Playwright is unavailable in the bundled runtime, so the full automated viewport and fault-injection scripts were not rerun. See `Docs/SUBMISSION_CHECKLIST.md` for the remaining portal and provenance checks.

## v0.6.7 (2026-10-08): reliability review

- Cloud read exceptions fall back to browser progress. Rejected writes retain the queue and retry with backoff, preserving newer queued moves and logging once per operation.
- A newer-schema save arriving from another tab disables saving and clearing, including delayed cloud flushes.
- Valid saves survive scene/HUD restoration errors. Autosaving stops after simulation/rendering failures to preserve the last safe snapshot.
- Battle animation updates are covered by the render guard; failed rendering blocks simulation updates and Play.
- Optional audio failures log once; partially initialized contexts are closed.
- Refreshed the stale campaign-map WebP. The exporter now removes orphaned WebPs absent from its manifest, including the unused v5 map.
- ZIP creation uses exclusive writes so existing releases cannot be overwritten.

Validation: TypeScript, ESLint and 177 tests pass (8 new cloud/audio regression cases), including exhaustive balance and offer-path checks. Browser smoke testing on the production preview covered map, briefing, tutorial dismissal, one build, speed controls, move report and reload at move 2; no captured browser warnings/errors. The refreshed map was visually inspected.

Limits: Python Playwright is unavailable in the bundled runtime, so the full fault-injection, campaign-map, viewport and context-loss scripts were not rerun. Real devices, Safari and player comprehension remain unverified. Interim 0.6.4 through 0.6.6 ZIPs were kept untouched; use 0.6.7 for this handover.

## v0.5.0 (2026-10-03): the remaining review items

Build: **v0.5.0**, `release/grow-an-empire-0.5.0.zip`. Headless Chromium in a cloud workspace.

| Change | Notes |
|---|---|
| Desertion warning | The rule is kept (Ravi, 2026-10-03: one ration feeds 4 soldiers, so each missing ration sends 4 away). The "rations last N moves" warning now comes 3 moves ahead instead of 2, and the muster shows how many soldiers deserted |
| Marketplace swap change | Goods sell in whole units, so a swap can raise more gold than it needs; the change (whole gold) is now kept and shown on the card (+[gold]). Balance tests unchanged |
| Defeat hint | Suggests only soldiers the city could train (their building stands), or, if none, ones whose building the campaign offers, naming it: "5 more horsemen (from a Stable) would have won" |
| Dead code | The unused end-of-campaign villager formation (`beginArmyMuster`, `renderMuster`, its config and helper) is removed |
| Per-frame allocations | The render loop no longer builds strings, arrays or vectors every frame: cached status lines and survey routes, in-place route measuring, garrison counts without `filter`, a reused garrison target, the route cache keyed without `join` |
| Card tags | "no spoiling", "training", "sellswords" are learning-only words now; the Marketplace shows [market][sword] |
| 1024×600 | The "Move complete" toast no longer shows through the build panel (checked: hidden while a choice is open) |
| Tests | 154 (3 new in `rulesPolish.test.ts`: swap change, the defeat hint, the 3-move ration warning) |

## v0.4.0 (2026-10-03): icons only after the tutorial; testing with portal players

Build: **v0.4.0**, `release/grow-an-empire-0.4.0.zip` (validator: ready to upload). Headless Chromium in a cloud workspace. Decisions and rules: `Docs/MOBILE_UX_PLAN.md`.

| Check | Result | Notes |
|---|---|---|
| `text_budget.py` | ✅ Pass | 390×844 and 844×390, 10 screens each. After the tutorial: first choice 7 words, move 6 14, muster 9, battle 10, result 14, map 14, briefing 7 |
| `viewports.py` | ✅ Pass | 12 sizes: no overlaps, clipping, page scroll, buttons under 44 px or small text, with the icon controls |
| `gameplay.py`, `platform_sdk.py`, `fault_injection.py --quick` (16), `campaign_map.py`, `context_loss.py` | ✅ All pass | `platform_sdk.py` and `fault_injection.py` read the Play/Pause button's `aria-label` (it is an icon now) |
| `journey.py` (0.4.0 ZIP at the portal path) | ✅ Pass | No console errors, warnings or failed requests |
| UX analytics (mock portal, phone) | ✅ Pass | `ux_card_info`, `ux_choice` (moves 1–3), `ux_clarity_vote`, `ux_details_opened` sent with `layout`, `learning`, `campaign_number` |
| Long press | ✅ Pass | A 450 ms touch press opens the card's details and doesn't build it (1280×720 and 390×844) |
| `pnpm check` | ✅ Pass | 152 tests |

Not yet done: the five-second test with portal players (`Docs/PLAYTEST_PORTAL.md`), real phones and Safari, painted icons.

## v0.3.0 (2026-10-03): icons and fewer words on phones

Build: **v0.3.0**, `release/grow-an-empire-0.3.0.zip` (validator: ready to upload). Headless Chromium in a cloud workspace. The plan and the before/after numbers are in `Docs/MOBILE_UX_PLAN.md`.

| Check | Result | Notes |
|---|---|---|
| `text_budget.py` (new) | ✅ Pass | 390×844 and 844×390: every screen within its word budget, no amount of a good written without its icon. Campaign 1 on a phone: 449 words read in v0.2.4, 186 now |
| `viewports.py` | ✅ Pass | 12 sizes: no overlaps, clipping, page scroll, buttons under 44 px (the card's "i" button is 44 × 44) or small text |
| `gameplay.py`, `platform_sdk.py`, `fault_injection.py --quick` (16), `campaign_map.py`, `context_loss.py` | ✅ All pass | `fault_injection.py` now counts the cards, not every button in the panel (each card has an "i" button) |
| `journey.py` (0.3.0 ZIP at the portal path) | ✅ Pass | Full journey at 1920×1080, 390×844 and 844×390; no console errors, warnings or failed requests |
| `pnpm check` | ✅ Pass | 150 tests (3 new in `src/ui/__tests__/icons.test.ts`) |

Not yet done: the five-second test with real players, and real phones and Safari.

## v0.2.4 (2026-10-02): error and exception handling review

Build: **v0.2.4**, `release/grow-an-empire-0.2.4.zip` (121 files, 15.37 MB, validator: ready to upload). Headless Chromium in a cloud workspace.

### Fixed

| Area | Problem | Fix |
|---|---|---|
| Cloud save | If the portal couldn't be read at boot, the first autosave overwrote the player's cloud progress with a fresh run | `loadProgress()` tells "unavailable" from "no save"; nothing is written to the cloud until a read succeeds |
| Cloud save | Two tabs (or two devices) overwrote each other's stars | Every save merges the best stars, completed campaigns and tutorial flag already known; a cloud copy further along stops this session's cloud writes (it keeps saving locally and the other run is offered next load) |
| Cloud save | A failed write was dropped; conflicts retried on every move | Failed writes go back in the queue with backoff (15 s, doubling, max 2 min) |
| Sign-in | A login slower than 5 s left the whole session offline | A late login connects the cloud, flushes the queue and reports the leaderboard |
| Saves | Validation checked shape only: negative gold, a move past 12, a building both built and offered, a damaged battle report or move summary could crash the HUD or result dialog | All of these are checked. A damaged report in a finished city is re-fought, a damaged summary is dropped, the construction timer is clamped, instead of losing the city |
| Portal pause | Closing a dialog while the portal had paused the game resumed it; resuming while a dialog was open unpaused under it | Portal pause and dialog pause are tracked separately |
| WebGL | No WebGL showed a blank page; a lost context kept rendering | A clear message on the loading screen; frames skip while the context is lost |
| Art | A missing character sheet was re-requested every frame; textures arriving after the timeout, and partly loaded building stages, leaked | Retries wait 30 s; late and partial textures are disposed |
| UI | Restart left an open result dialog on screen; Tab escaped the campaign dialogs; focus fell to the page when its target was folded away; a mouse released outside the map kept dragging it | Fixed; summary text is escaped before display |
| Rules | A failed swap kept the trade; `muster(null)` threw; campaign unlock accepted 2.5 or 99 | Trade undone; null means no sellswords; unlock rejects them |
| Tools | The validator didn't check that the files `index.html` loads are in the ZIP; the release server crashed on a read error | Both fixed |

### Not changed (design decisions)

- Desertion is 4 soldiers per missing ration, as in the economy prototype. It's harsh (30 deserters in a weak run) but changing it means recalibrating every enemy.
- Gold left over from a Marketplace swap is lost. Keeping it would change the balance search.
- The defeat hint can suggest horsemen when no Stable was built.

### Checks

| Check | Result |
|---|---|
| `pnpm check` | ✅ 147 tests (9 new in `saveValidation.test.ts`, 3 new platform tests) |
| `platform_sdk.py`, `gameplay.py`, `fault_injection.py --quick` (16 scenarios), `campaign_map.py`, `context_loss.py` | ✅ All pass |
| `viewports.py` | ✅ 12 sizes, no issues |
| `journey.py` (0.2.4 ZIP at the portal path) | ✅ Full journey; no console errors, warnings or failed requests |

## v0.2.3 (2026-10-02): leaderboard standing

| Check | Result | Notes |
|---|---|---|
| `leaderboard.test.ts` (7 tests) | ✅ Pass | Level = highest campaign won; score = level × 100 + stars, so a higher campaign always ranks above more stars on a lower one; `reachedAt` kept until the score improves; unknown ids ignored, stars capped at 3; old saves without the field still load; EMAIL/GOOGLE count as signed in, GUEST doesn't |
| Mock portal, signed in (`?platform=mock&auth=email`) | ✅ Pass | Winning Campaign 1 sends one `leaderboard_score` (player id, level 1, `campaign-1-first-muster`, 3 stars, score 103), and the cloud save holds `playerId` and `leaderboard`; a reload sends one `visit` event with the same `reached_at` |
| Mock portal, guest | ✅ Pass | The cloud save holds `leaderboard`; no event is sent |
| `pnpm check` | ✅ Pass | 135 tests |

## v0.2.2 (2026-10-01): scrolling campaign map

Build: **v0.2.2**, `release/grow-an-empire-0.2.2.zip` (15.91 MB unpacked, validator: ready to upload). Headless Chromium in a cloud workspace.

The campaign map is one tall painting (`southern-road-map-v6`, composed from four campaign paintings; 605 KB WebP) that the player scrolls up: camps (campaign 1) at the bottom, river villages, the mountain pass, the royal castle, and the enemy fortress (campaign 25) at the top, in five chapters.

| Check | Result | Notes |
|---|---|---|
| `campaign_map.py` (new) | ✅ Pass | 1280×720, 1920×1080 frame (1.5×), 390×844 phone: opens centred on the selected campaign with the art loaded; mouse wheel; mouse drag follows the pointer at 1× and 1.5× (a drag starting on a stop scrolls and doesn't select it); touch swipe both ways; click selects and centres; ↑ next, ↓ previous, Home first; chapter rail jumps and lights the chapter in view (the last one at the top); "back to campaign N" appears when the selection is scrolled away and brings it back; rotating the phone keeps the selection in view; with 9 campaigns won the walked road, stars and fog are drawn; launch opens the briefing. No page errors |
| `viewports.py` | ✅ Pass | 12 sizes (4 fixed, 8 fluid): no overlaps, off-screen or clipped UI, small buttons or text, or page scroll. The check now ignores panels the game has faded out on purpose (the bars slide away while a choice is open) |
| `gameplay.py`, `platform_sdk.py`, `context_loss.py`, `fault_injection.py --quick` | ✅ Pass | The scripts now set the speed with the S shortcut: the control bar is hidden while a choice is open, so clicking it timed out |
| `load_time.py` | ✅ | Slow 4G: playable in 7.7 s (unchanged; the map art loads after the game is playable, over a parchment background) |
| `pnpm check` | ✅ Pass | 128 tests |

| `journey.py` (new, 2026-10-02) | ✅ Pass | The 0.2.2 ZIP at the portal path, at 1920×1080, 390×844 and 844×390: map (a locked campaign can't start) → Campaign 1 with the full tutorial, pause/play, sound, View city → reload at move 6 (same move, stockpile and people) → muster → watched battle → Victory ★★★ → battle report → Next → Campaign 2 with sellswords hired → map (2 won, 22 locked) → Campaign 3 played badly → defeat, Try again → replay offered on Campaign 1 → Continue settlement → Restart. A save with all 25 won shows 75 ★, no fog, the whole road walked. No console errors, warnings or failed requests; the SDK gets init, login, getGameProgress, saves and tracks |
| Fixes from the journey | ✅ | The result said "Trained over the campaign: 0 archers…" next to "30 soldiers deserted": deserters are taken off the army, so with desertions the line now reads "Still in the ranks", and the desertion line says a Bakery or Butchery feeds the army. Restart now asks once in place ("Restart? Press again", 4 s) instead of throwing the run away on one tap |

Not yet done: real phones and tablets (touch scrolling momentum, Safari).

## v0.2.1 (2026-09-25): responsive layout for phones and tablets

Build: **v0.2.1**, `release/grow-an-empire-0.2.1.zip` (15.71 MB unpacked, 121 files, validator: ready to upload). Headless Chromium in a cloud workspace.

| Check | Result | Notes |
|---|---|---|
| `viewports.py` + release ZIP check (2026-09-27) | ✅ Pass | The shipped `grow-an-empire-0.2.1.zip`, served at the portal path in an iframe, at 15 sizes: 1920×1080 frame and window (fixed stage, 1.5×, 1920×1080 canvas), 1536×864, 1440×900, 1366×768, 1280×720, 1024×600, tablets 1024×768 and 768×1024, phones 390×844, 844×390, 360×780, 780×360, 412×915 (fluid layout, portrait and landscape). No console errors, failed requests, overlaps, clipping, page scroll, buttons under 44 px or text under 11 px. Full Campaign 1 with a reload at move 6 at 1920×1080 and 390×844: state restored, Victory ★★★. Cosmetic only: at about 1024×600 the "Move complete" note shows faintly through the build panel; on upright phones the campaign map's painted label is empty and has dark bands above and below |
| Phone flow (844×390, 390×844) | ✅ Pass | Map → briefing → tutorial → 12 moves at 8× → muster → battle → result, with screenshots at each step; no page errors |
| Rotation and resizing | ✅ Pass | Portrait ↔ landscape and fixed ↔ fluid mid-game: stage, canvas and camera follow; the campaign map keeps the selected stop in view |
| Portal path in an iframe | ✅ Pass | ZIP unpacked under `/api/v1/games/grow-an-empire/play/` in 1920×1080, 844×390 and 390×844 iframes: right layout, no failed requests |
| `gameplay.py`, `platform_sdk.py`, `context_loss.py`, `fault_injection.py --quick` | ✅ Pass | |
| `load_time.py` | ✅ | Slow 4G: playable in 7.7 s, 1.03 MB, 9 requests |
| `pnpm check` | ✅ Pass | 128 tests |

Not yet done: the same on real phones and tablets (Safari and Chrome), including notches and the browser bars appearing and hiding.

## v0.2.0 (2026-09-24): economy, 25 campaigns, stars, market, battle strip

Build: **v0.2.0**, `release/grow-an-empire-0.2.0.zip` (15.7 MB unpacked, 121 files). Headless Chromium in a cloud workspace. The v0.1.0 results below are kept for history; where they disagree, this section is current.

| Check | Result | Details |
|---|---|---|
| `pnpm check` | ✅ Pass | tsc and ESLint clean; 128/128 vitest tests, including the balance search over every build order (20,927 endings, 0 dead ends, each campaign within 5 points of its win-share target) and the frozen v4 save fixture played to the end under the new rules |
| Bundle validator (`pnpm package`) | ✅ Pass | index.html at the root, SDK tag, relative paths, no localhost, no `alert()`, thumbnail and banner. No unused art (runtimeAssets test) |
| Portal path in an iframe | ✅ Pass | ZIP unpacked under `/games/grow-an-empire/` behind a host page: boots, styles and scripts load, the 16:9 stage is centred at 1920×1080 (exactly 1.5×), 1280×720, 1366×768 and 1600×1000 (bars top and bottom). No console errors |
| `gameplay.py` | ✅ Pass (4/4) | Failed boot keeps the save; unusable save starts fresh; art failure on a pick is not committed or paid for, and retry works; full Campaign 1 at 8× with the tutorial, key 1 choosing a card, reload mid-game and at the muster, battle, result ★★★, stars saved, Campaign 2 opened |
| `platform_sdk.py` | ✅ Pass (3/3) | SDK call order, cloud restore, iframe pause/resume/session end, offline play |
| `fault_injection.py --quick` | ✅ Pass (16/16) | Includes battle icon art failing at the end of a full game (the result still shows) |
| `context_loss.py` | ✅ Pass | Lost and restored WebGL context, play continues |
| `load_time.py` | ✅ Pass | Playable in 1.4 s at 10 Mbps and 7.7 s on Slow 4G; 1.02 MB before playable |
| `viewports.py` | ⚠️ See note | No overlaps, clipping or page scroll at 1920×1080, 1600×900, 1366×724, 1280×720, 960×540 or 667×375; the stage is centred at every size; upright phones get the "turn sideways" screen. At 1280×720 and up, text is at least 12.5 px and buttons 44 px. In small frames the whole stage scales down, so at 960×540 text is about 9.4 px and buttons 33 px, and at 667×375 smaller still. That is the fixed-stage design; the portal's 1920×1080 frame is unaffected |

Not yet done: the manual device matrix (section 2 below) on a real phone and desktop, including sound and full screen inside the real portal frame.

---

Build: **v0.1.0**, `release/grow-an-empire-0.1.0.zip` (7.76 MB, with the battle art). Run on 2026-09-23.

This file has two parts:

- **Automated.** Headless Chromium, run in a cloud workspace. It proves behaviour, but it can't prove how the game feels on a real phone.
- **Manual.** The device matrix from QA_CHECKLIST §7 and the release-candidate list from §42. **Nobody has run this on a real device yet.** Fill it in before submitting.

## 1. Automated results

Rerun with the scripts in `Tools/qa/` (see its README), plus `pnpm check` and `pnpm package`.

| Check | Result | Details |
|---|---|---|
| Typecheck, lint, unit tests (`pnpm check`) | ✅ Pass | tsc clean, ESLint clean, 103/103 vitest tests. Includes the exhaustive proof over every 12-move offer path and the frozen v4 save fixture. |
| Bundle validator (`pnpm package`) | ✅ Pass | 7.76 MB; index.html at the root; SDK tag present; relative paths; no localhost; no `alert()`; thumbnail and banner found |
| Full playthrough (`gameplay.py`) | ✅ Pass | Fresh start shows the tutorial. All 12 moves were played, then the battle (5 swordsmen and 7 archers against 5 raiders): "Victory". Reloading mid-game resumes exactly; reopening a finished game replays the battle, then shows the same result. No console or page errors. |
| Portal SDK (`platform_sdk.py`) | ✅ Pass | Mock SDK calls arrive in order: `init` → `login` → `getGameProgress`. The cloud save restores on a fresh browser. Inside the iframe, `GP_PAUSE` pauses, `GP_RESUME` resumes and `GP_SESSION_END` ends the session. With no SDK the game plays offline and saves locally. |
| Save conflict | ✅ Pass (unit) | A version conflict reloads the cloud copy, merges and retries once (`platform.test.ts`) |
| WebGL context loss (`context_loss.py`) | ✅ Pass | Shows a message, recovers, and play continues |
| Layout (`viewports.py`) | ✅ Pass | 1280×720, 1920×1080, 1366×724, 390×800, 375×667, 667×375: no overlaps, no off-screen or clipped UI, no text under 11 px, no page scroll. Tutorial dialog fits or scrolls. |
| Time to playable (`load_time.py`) | ✅ Pass | **1.27 s** at 10 Mbps (limit 5 s); **6.89 s** on Slow 4G (1.6 Mbps). 1.24 MB and 21 requests before the first move. |
| Rendering while paused | ✅ Pass | No frames drawn while paused or behind the tutorial |
| Keyboard | ✅ Pass | Tutorial: focus starts on the start button, Tab and Esc work even after a click on the backdrop, and focus moves to the first card (or How to play) when the dialog closes |
| Audio | n/a | The game has no audio in v1 |

### Fault injection (`fault_injection.py`), rerun 2026-09-23 after the error-handling pass: 16/16 pass

| Fault | What the game does |
|---|---|
| A card's art fails to download | Says "Couldn't load the … artwork", re-enables the cards; choosing again retries and works |
| A card's art stalls forever | After 45 s it reports the failure and re-enables the cards (before: panel stayed disabled for good) |
| Boot art fails | Error screen naming the file, with a Reload button; the save is kept |
| Portal SDK throws / login hangs / login returns nothing | Boots offline (under 9 s with a hung login) and saves in the browser |
| SDK analytics calls reject | No unhandled promise rejections |
| Storage blocked, or full | Plays normally without a local autosave; warns once in the console |
| Corrupt or impossible save | Starts a new settlement with a message; the bad save is removed |
| Save from a newer game version | Left untouched, never overwritten; the player is told to reload |
| Browser save belongs to another player | Not loaded, and never uploaded to the signed-in player's cloud |
| Portal sends `GP_SESSION_END` | Pauses, saves, ends the session; `GP_RESUME` starts a new session |
| Battle art fails at the finale | Skips the battle animation and shows the result |
| Loaded in a 0×0 iframe | Renders correctly once shown (smoke check; the game recovered on resize before the fix too) |

## 2. Device matrix (QA_CHECKLIST §7): to do

For each row, play a full run with `?perf` and record the steady FPS during the muster (worst case: 203 draw calls). The budget is 60 fps, with a floor of 30 (`Docs/PERFORMANCE_BUDGET.md`).

| Device class | Device / OS | Browser | Orientation | Loads | Full run | FPS at muster | Resume after background | Notes |
|---|---|---|---|---|---|---|---|---|
| High-end phone | iPhone 13+ / iOS 17+ | Safari | Portrait + landscape | | | | | |
| Mid-range phone | e.g. Pixel 6a / Galaxy A54 | Chrome | Portrait + landscape | | | | | |
| Low-end phone | e.g. Galaxy A1x, 3–4 GB RAM | Chrome | Portrait | | | | | If under 30 fps, check that it drops to the low tier |
| Tablet | iPad | Safari | Landscape | | | | | |
| Desktop | Windows | Chrome | 1280×720 and 1920×1080 | | | | | |
| Desktop | Windows | Firefox | 1280×720 | | | | | |
| Desktop | macOS | Safari | 1280×720 | | | | | Progress may not persist across sessions under ITP (SUBMISSION §10); the cloud save covers signed-in players |

Also check, from QA_CHECKLIST §6–8 and §29 and MOBILE_PERFORMANCE §54:

- [ ] **A 30-minute session** (play, then leave the finished city running) with no slowdown and no memory growth (Chrome DevTools → Memory).
- [ ] **Background and resume**: switch apps mid-construction for 1 minute, then return. The game should resume where it was, and the save should be intact.
- [ ] **Touch**: cards, Stockpile, Speed and Restart work with one tap; no accidental zoom or text selection.
- [ ] **Slow network on a phone**: the loading screen progresses and never reports "stalled" while bytes are still arriving.
- [ ] **Close and reopen on the portal**: close the tab mid-game, reopen the play URL, and check the same run comes back (from the cloud).
- [ ] **Two devices**: start on a phone, continue on desktop with the same account.

## 3. Release-candidate list (QA_CHECKLIST §42)

| Area | Item | Status |
|---|---|---|
| Functionality | Smoke test, core gameplay, progression, restart, save/load | ✅ Automated |
| Functionality | Major edge cases (reload at every stage, corrupt save, no storage) | ✅ Unit and automated |
| Platform | Authentication, platform APIs, analytics, error states | ✅ Against the mock SDK. **Recheck on the real portal sandbox.** |
| Platform | Monetization, rewards | n/a |
| Mobile | iOS Safari, Android Chrome, device classes, touch, orientation | ⬜ Section 2 |
| Mobile | Slow network | ✅ Emulated; ⬜ on a real phone |
| Performance | Startup and asset budgets | ✅ |
| Performance | Frame rate, memory, frame-time spikes | ⬜ Section 2 |
| Visual | No missing assets, no rendering issues, UI readable | ✅ Automated screenshots; ⬜ on devices |
| Visual | Final copy correct | ⬜ Owner read-through |
| Audio | Audio works | n/a (no audio) |

## 2026-09-24 art and runtime code review

- `pnpm check`: TypeScript, ESLint, and all 112 tests passed, including the runtime-art manifest and stale-WebP checks.
- `pnpm package`: 121-entry portal bundle validated at 15.16 MB, below the 50 MB limit.
- Live desktop preview: campaign map artwork, village markers, selected highlight, countdown, and transition into the settlement rendered correctly. Browser warning/error log was empty after reload and campaign launch.
- Fixed during review: failed campaign-map art now logs and shows a usable fallback; shared texture loading rejects zero-size decodes; province buttons and highlight share placement data; map launch keeps keyboard focus; horsemen no longer count as villagers after battle; levels 13–14 reveal civic ground details; later-campaign text consistently describes the southern approach.
- Remaining visual QA: verify small landscape and touch layouts on real devices, and inspect the full 14-move and final combat sequences visually. The painted Town Hall art reaches its final form at level 8; later levels add ground details rather than new hall sprites.

Final local checks: compact 390×844 portrait and 844×390 landscape move reports kept Choose in reach and the speed dock visible. No browser warnings/errors were captured. The v0.9.0 ZIP is 15.41 MB and passes the portal bundle validator. Popup combat was inspected at desktop size; compact combat still needs manual visual testing.
