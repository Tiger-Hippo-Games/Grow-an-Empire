# Browser QA scripts

Automated Playwright checks behind `Docs/QA_RESULTS.md`. They drive a real Chromium and fail loudly (`ALL PASS` / `pass: false`, console errors listed).

`frame_fit.py` checks 15 real iframe sizes, including 870×668 and portal frames with header space. It checks all 24 production building sprites and all card groups with learner words on/off, plus information dialogs and Controls. Its isolated browser substitutes `Tools/dev/frame-fit-review.ts` for the entry module, uses the real HUD/renderer, and never reads or writes game saves. Results and screenshots: `Tools/qa/out/frame-fit/`.

## Setup (once)

```powershell
pip install playwright
python -m playwright install chromium
```

## Run

Start both servers first, from the project root:

```powershell
pnpm dev                            # http://127.0.0.1:4173 (gameplay, platform_sdk)
pnpm build; pnpm exec vite preview  # http://127.0.0.1:4174 (viewports, load_time, context_loss)
```

| Script | Server | Checks |
|---|---|---|
| `python Tools/qa/gameplay.py` | 4173 | Failed boot, bad save, art failure on a pick (not paid for), then a full Campaign 1 at 8×: tutorial, key 1, reloads mid-game and at the muster, battle, stars saved, Campaign 2 opened |
| `python Tools/qa/platform_sdk.py` | 4173 | Mock SDK call order and cloud restore (signed in), portal pause/resume/session end inside an iframe, offline play, and a guest: plays normally with no cloud read or write |
| `python Tools/qa/assets_audio.py` | 4174 (or `GAE_URL`) | Every file in `dist/assets/` fetched and decoded in the browser; then a campaign at 1280×720 and 390×844: no failed request, every visible image decoded, the Yatra One font loaded, the sound engine running after the first tap and cues played, `window.__gaeAssetHealth` clean |
| `python Tools/qa/viewports.py [tag]` | 4174 | Overlaps, off-screen or clipped UI, tap targets under 44 px, text under 11 px on screen, page scroll, and the stage centred (fixed layout) or filling the frame (fluid layout), at 12 sizes: four desktop, small windows, tablets and phones both ways |
| `python Tools/qa/campaign_map.py` | 4174 | The scrolling campaign map at 1280×720, the 1920×1080 frame and a phone: opens on the selected campaign, mouse wheel, mouse drag (a drag that starts on a stop doesn't select it), touch swipe, arrows and Home, click to select and centre, the chapter rail, the "back to campaign N" button, rotation, and the walked road, stars and fog with campaigns won |
| `python Tools/qa/journey.py [WxH]` | 4175 (`test-release.cmd`) | A walkthrough of the release ZIP: map, Campaign 1 with tutorial and controls, reload, battle, result, Campaign 2 with the market, a defeat on Campaign 3, Continue, Restart. Logs every screen and any error |
| `python Tools/qa/portal_iframe.py` | 4175 (`test-release.cmd`) | Actual 1920×1080 iframe: exact 1.5× stage fit on every screen, one GAME_READY, tutorial, choices, move report, muster, result, campaign unlock, guest saves, asset health, pause/resume and session end. Exits nonzero on failure; screenshots and JSON in `out/portal/`. |
| `python Tools/qa/text_budget.py [WxH ...]` | 4174 | Words a player reads on each phone screen (portrait and landscape by default; the first visit while learning, then icons only) against the budgets in `Docs/MOBILE_UX_PLAN.md`, and no amount of a good written without its icon. Its screenshots double as the five-second-test stimuli (`Docs/playtest/`) |
| `python Tools/qa/load_time.py` | 4174 (or `GAE_URL`) | Time to playable and bytes before it, at 10 Mbps and Slow 4G. The release simulator negotiates gzip for text assets; record whether the measured host compresses responses. |
| `python Tools/qa/context_loss.py` | 4174 | WebGL context loss and recovery |
| `python Tools/qa/fault_injection.py [--quick]` | 4174 | Breaks things on purpose (16 scenarios): broken or stalled art, a portal SDK that throws, hangs or rejects, blocked or full storage, corrupt saves, another player's save, a save from a newer version, portal session end, battle icon art failing at the finale, a zero-size iframe. `--quick` skips the 45 s stall test. |

Screenshots go to `Tools/qa/out/` (git-ignored). The scripts use Chromium's software renderer, so their frame rates don't reflect real devices. Use `?perf` on a phone for that.

The production iframe check uses Chromium's ANGLE SwiftShader option (`--use-angle=swiftshader`). The older `--use-gl=swiftshader` option produced shader/context warnings in Chromium 153 at the full portal size. Run browser suites serially when collecting rendering or startup evidence. The asset/audio check can use the release server's local SDK stand-in via `GAE_URL=http://127.0.0.1:4175/api/v1/games/grow/play/`; this keeps the local test independent of access to the external portal SDK. The packaged HTML retains the official SDK URL.

All scripts share `flow.py` (campaign map → briefing → city, play a move, play to the muster, fight). When the game's flow changes, update it there.

`sdk_v2.py` runs the exact unpacked ZIP against the official hosted SDK client and a simulated same-origin protocol-v2 parent under strict script CSP. Download `https://www.hippoarcade.com/sdk/v2/platform-sdk.js` to `.tmp/hippo-platform-sdk-v2.js`, then select the release server using `GAE_RELEASE_URL`. It checks init/profile order, preview and registered checkpoint save/reopen without the browser save, preview ranking isolation, live top ten/private rank and battle-end `strongplayer` posting, guest local-only behavior, save depth/size and write spacing. It does not establish real portal persistence. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` optionally selects an installed Chromium executable.

`python Tools/qa/ui_tray.py` checks the persistent resource dropdown (including Escape during dialogs), same-row build choices, permanent benefit visibility, speed label, end-of-move countdown and full campaign completion at 1920×1080, 844×390 and 390×844. Uses preview port 4174 or `GAE_URL`. The viewport suite checks 14 sizes; horizontal card scrolling is intentional on narrow phones. Text budgets include permanent HUD labels and requested benefit sentences in v0.11.0.

`python Tools/qa/loading_state.py` tests the exact release at the portal path on a throttled connection (1920×1080 and 390×844): visible building tips above the progress bar, monotonic progress, no early build-card layout/art, and immediate hint removal when ready. Unit tests cover all 24 tips and timer cleanup on success/error. The loader does not hold boot open to display every hint.

`player_leaderboard.py` tests production SDK ids, weekly top-ten UI in desktop/phone layouts, escaped player names, guest/empty/error states, first-win posting and a full 25-move campaign with reload. Use the unpacked release server; all leaderboard responses are injected locally.

### Guided tutorial and character polish

`python Tools/qa/tutorial_polish.py` uses `GAE_URL` (default dev port 4173) and checks the real three-lesson flow at desktop, portrait and landscape sizes, keyboard choice, Gather first, report acknowledgement, coach/tray separation, reading size and replay/skip. Screenshots and results are saved under `out/tutorial-polish/`.
