# QA results

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
