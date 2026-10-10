# Changelog

Every build handed over gets a new version and its own ZIP in `release/` (never rebuilt over). Newest first. Test evidence for each version is in `Docs/QA_RESULTS.md`.

| Version | Date | What changed |
|---|---|---|
| 0.10.2 | 2026-10-10 | Pre-submission review. Errors from outside the game (SDK, ResizeObserver notice) no longer pause a run; `GAME_READY` is sent on every error screen too; `?reset`/`?platform=mock`/`?perf` work only in development and on localhost; a save with an unknown selected building can't block every boot; player-facing boot error text; a click undoes a portal pause; guests have no cloud save; art, font and sound health checks (`asset_problem`, `__gaeAssetHealth`, validator asset check, `Tools/qa/assets_audio.py`); first move report shown with words after the tutorial; clearer Gather wording and one Gather icon; keys 1–3 no longer leave the report; speed slider hidden under dialogs; shortcut guards for the Realm board, lists and the slider; dialog names, focus return and double-click guard; accessibility (labels, 0.78rem text, 44 px targets, contrast); battle formations no longer clip; old city-battle code and CSS removed; desertion fields marked legacy; 8–12 move range documented; listing orientation landscape; leaderboard with no maximum; new key art (thumbnail and banners). |
| 0.10.1 | 2026-10-10 | Action guard: Gather and Fight run through one guard that refuses them while the game can't act and turns a throw into a safe pause. |
| 0.10.0 | 2026-10-10 | Safe economy: every move ends with at least 4 wood, 2 stone, 2 grain and 1 ration (camp supplies, in the report); no desertion from the economy; recruitment needs rations for the whole army; recalibrated armies and the Realm field. |
| 0.9.1 | 2026-10-10 | Gather on every choice turn (G shortcut), offers kept. |
| 0.9.0 | 2026-10-10 | The battle plays out in the muster popup (formations, rounds, survivors, Skip, pause, reduced motion); dialog focus and press feedback; softer sounds, a Gather cue, a conch. |
| 0.8.0 | 2026-10-09 | Speed slider (1×/2×/4×/8×, default 4×); Granary offered right after a Farm or Mango Grove; Gather when nothing is affordable; recalibration. |
| 0.7.0 | 2026-10-08 | GoLive SDK 1.5.0 contract: official SDK URL, `GAME_READY`, display names, real `campaign-progress` scores for signed-in players, save and score rate limits. |
| 0.6.7 | 2026-10-08 | Reliability: cloud read/write fallbacks and retries, newer-save protection across tabs, render and audio failure handling; exclusive ZIP writes. |
| 0.6.4–0.6.6 | 2026-10-07 | Interim builds (kept, superseded by 0.6.7). |
| 0.6.3 | 2026-10-06 | Fills the portal iframe edge to edge; map rank chip; Realm board Close in its corner. |
| 0.6.2 | 2026-10-06 | Move report before each choice. |
| 0.6.1 | 2026-10-06 | Battle centred for the 1920×1080 frame. |
| 0.6.0 | 2026-10-05 | Bharatvarsha look and lore, the Rival Realm (1,008 AI rajas), easy/medium/hard difficulty with swordsman/archer/horsemen mixes. |
| 0.5.0 | 2026-10-03 | Review items: desertion warning, Bazaar change, defeat hint, render-loop allocations. |
| 0.4.0 | 2026-10-03 | Icons only after the tutorial; portal UX analytics. |
| 0.3.0 | 2026-10-03 | Icons and fewer words on phones. |
| 0.2.x | 2026-09-24 to 10-02 | Economy, responsive layouts, campaign map, leaderboard standing, review fixes. |
| 0.1.0 | 2026-09-23 | First portal build. |
