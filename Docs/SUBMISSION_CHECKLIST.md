# Submission checklist — SDK 1.5.0

Follow `common/GOLIVE_DEVELOPER_REFERENCE.md`. It supersedes conflicting integration details in the older portal documents. This checklist separates checks verified locally from the Developer Console steps still required. Game slug: `grow-an-empire`.

Frozen candidate: **v0.10.2** (supersedes the v0.10.1 freeze). Use the artifact and checksum in [RELEASE_FREEZE.md](RELEASE_FREEZE.md); complete the unchecked portal and provenance steps before publication.

## Code and bundle

- [x] ZIP has `index.html` at its root and contains only permitted static formats.
- [x] ZIP limit is 200 MB; our performance target remains below 50 MB.
- [x] Game assets are relative (`base: "./"`); the sole external script is the official `https://golive-platform.netlify.app/sdk/platform-sdk.js`.
- [x] The viewport prevents unwanted mobile zoom; html/body fill the frame without page scrollbars.
- [x] SDK initialization uses the game slug before login; API host selection defaults to the SDK, suitable for CDN hosting.
- [x] `GAME_READY` is sent once: after title-map art or its playable fallback is ready and the first successful scene draw, or, if start-up fails, when the error screen is shown (so the portal's loader never hides it).
- [x] Audio unlocks only after a user gesture.
- [x] No parent/top navigation or blocking alert/confirm/prompt dialogs.
- [x] Versioned saves retain schema 6 and older-save migrations.
- [x] Cloud writes are at least five seconds apart, including conflict retries and exit checkpoints; browser checkpoints remain immediate.
- [x] Cloud saves are checked against the 64 KB UTF-8 JSON limit.
- [x] Cloud load/save denial never blocks play. Guests have no cloud save at all (the game neither reads nor writes it for them); trials may play but cannot cloud-save unless the portal grants saving access; browser saves work only when local storage is available.
- [x] Testing switches (`?reset`, `?platform=mock`, `?perf`) are inert on the portal (development and localhost only).
- [x] Errors from outside the game (SDK, browser notices) are reported but never stop play.
- [x] Art, the font and sound are checked: the validator fails on any referenced asset missing from the ZIP; `Tools/qa/assets_audio.py` decodes every bundled file and plays a campaign; players' devices report `asset_problem`.
- [x] Portal access is checked before the iframe loads. The game adds no subscription/favourite/trial access gate or exit-to-portal button.
- [x] Player identity comes from portal login; the Realm board displays and escapes the portal display name.
- [x] Real scores use `Platform.submitScore` at battle end, for signed-in players, at least 30 seconds apart; metadata is below 2 KB. Errors do not interrupt play.
- [x] AI Realm standings are distinct from the portal's real player leaderboard.

## Developer Console — still required

- [ ] Confirm the listing slug is `grow-an-empire` and orientation is **Landscape** (Ravi, 2026-10-10: laid out for the 1920×1080 frame; `index.html` declares landscape).
- [ ] Create/activate the game's `campaign-progress` board: Campaign Progress, All-Time, Highest Score Wins, **no maximum score**. If using an existing board, change `LEADERBOARD_SLUG` to its actual slug before packaging.
- [ ] Upload the latest ZIP and run the Developer Console Sandbox Preview.
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
