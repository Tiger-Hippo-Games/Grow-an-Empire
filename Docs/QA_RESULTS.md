# QA results

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
