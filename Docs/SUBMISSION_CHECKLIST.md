# Submission checklist — Hippo Arcade SDK v2

Follow `developer-kit/HIPPO_ARCADE_DEVELOPER_REFERENCE.md` and `developer-kit/SDK_REFERENCE.md`. It supersedes conflicting integration details in the older portal documents. This checklist separates checks verified locally from the Developer Console steps still required. Game slug: `grow`.

Final release build: **v0.15.0** (supersedes earlier packages). Use the artifact and checksum in [RELEASE_FREEZE.md](RELEASE_FREEZE.md); complete the unchecked portal and provenance steps before publication.

## Code and bundle

- [x] ZIP has `index.html` at its root and contains only permitted static formats.
- [x] ZIP limit is 200 MB; our performance target remains below 50 MB.
- [x] Game assets are relative (`base: "./"`); the hosted SDK uses the serving origin's `/sdk/v2/platform-sdk.js`. No SDK copy is bundled.
- [x] The viewport prevents unwanted mobile zoom; html/body fill the frame without page scrollbars.
- [x] SDK initializes once with telemetry settings, then gets portal identity. No API URL, game ID or token handling is configured in the game.
- [x] `GAME_READY` is sent once: after title-map art or its playable fallback is ready and the first successful scene draw, or, if start-up fails, when the error screen is shown (so the portal's loader never hides it).
- [x] Audio unlocks only after a user gesture.
- [x] No parent/top navigation or blocking alert/confirm/prompt dialogs.
- [x] No inline script blocks. Early fit/watchdog scripts load from bundled, relative, versioned JS files; file-only script-policy browser checks pass.
- [x] Versioned saves retain schema 6 and older-save migrations.
- [x] Cloud writes are at least five seconds apart, including conflict retries and exit checkpoints; browser checkpoints remain immediate.
- [x] Cloud saves are checked against the 64 KB UTF-8 JSON and six-level nesting limits. Every failed write requires a successful reload and reconciliation before retry.
- [x] Cloud load/save denial never blocks play. Guests remain local-only. Registered and PREVIEW progress follows portal identity/capabilities, with isolated preview slots; the game makes no trial/tier assumptions. Browser saves require available local storage.
- [x] Testing switches (`?reset`, `?platform=mock`, `?perf`) are inert on the portal (development and localhost only).
- [x] Errors from outside the game (SDK, browser notices) are reported but never stop play.
- [x] Art, the font and sound are checked: the validator fails on any referenced asset missing from the ZIP; `Tools/qa/assets_audio.py` decodes every bundled file and plays a campaign; players' devices report `asset_problem`.
- [x] Portal access is checked before the iframe loads. The game adds no subscription/favourite/trial access gate or exit-to-portal button.
- [x] Player identity comes from `Platform.getPlayer()`; the Realm board displays and escapes the portal display name.
- [x] Real scores use `Platform.submitScore` at battle end, for signed-in players, at least 30 seconds apart; metadata is below 2 KB. Errors do not interrupt play.
- [x] AI Realm standings are distinct from the portal's real player leaderboard.

## Developer Console — still required

- [ ] Confirm the listing slug is `grow` and orientation is **Landscape** (Ravi, 2026-10-10: laid out for the 1920×1080 frame; `index.html` declares landscape).
- [x] Configure the production board supplied on 2026-10-13: `strongplayer`, Strongest Player, Weekly (Monday 00:00 UTC), Highest Score Wins, no cap; score = distinct campaign wins.
- [ ] Verify signed-in score posting, top ten and own rank against `strongplayer` through test player playback; leaderboard calls are unsupported in developer/admin preview.
- [ ] Select the test console at `https://golive-platform.netlify.app/developer`, upload the latest ZIP and run developer preview. Verify isolated preview progress survives save, close/reopen and a new build; rankings should make no requests.
- [ ] After test validation, upload the same ZIP to the production console at `https://www.hippoarcade.com/developer`. Test saves and uploads do not transfer automatically.
- [ ] Confirm the loading screen clears after `GAME_READY`, art/fonts load, and player identity matches the portal display name.
- [ ] Play as a signed-in player and verify a completed battle posts the score to the configured board.
- [ ] Play as a guest: normal gameplay, no score submission, no cloud save (progress stays in the browser).
- [ ] Play as a free-trial user without saving access: deny cloud save and continue playing normally. Also test a favourite/subscriber account with saving access.
- [ ] For an account without play access, verify the portal prevents launch before loading the iframe. This is a portal check, not game logic.
- [ ] Verify cloud restore, worse-score replays and two-device progress behavior.
- [ ] Test on a device that shows the full 1920×1080 frame, in Safari too, and iframe pause/resume and session end in the actual portal. (Orientation is not a separate test: Ravi, 2026-10-10.)
- [ ] Upload thumbnail `Assets/Art/Store/upload/thumbnail-480x270.jpg` (480x270, 64 KB) and banner `Assets/Art/Store/upload/banner-1280x720.jpg` (1280x720, 309 KB): the v2 key art made in 0.10.2.
- [ ] Complete remaining art-provenance entries in `Assets/Art/PROVENANCE.md` and confirm listing rights.
- [ ] Submit for Review after sandbox verification (Ravi will submit later).

Listing content: `Docs/STORE_LISTING.md`. Leaderboard setup: `Docs/LEADERBOARD.md`. Local verification evidence and limitations: `Docs/QA_RESULTS.md`.
