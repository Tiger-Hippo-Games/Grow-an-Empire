# Release freeze: v0.10.1

2026-10-10. Locally validated release candidate for Sandbox Preview; not yet submitted or approved for publication.

## Immutable artifact

- `release/grow-an-empire-0.10.1.zip`: 15,407,663 bytes, 122 entries.
- SHA-256: `3D998DA98C5A99F4CE89839E1E62DCFD8B9DC72449510222D7F7FA491E1F92FD`
- Save schema 6 (v4/v5 migrations retained). Game slug `grow-an-empire`; leaderboard `campaign-progress`.

Keep this ZIP unchanged. Any necessary fix requires a new patch version, separate ZIP and fresh check/package evidence. The working checkout may change; this checksum identifies the exact frozen artifact.

## Review and frozen scope

The simulation owns resources and moves; rendering/UI react to it. Portal adapters isolate SDK/cloud/leaderboard failures. Save ownership, migration, write throttling, context-loss recovery, asset retries and gesture-gated synthesized audio remain in place.

The 25 campaigns, always-available Gather, default 4x speed slider (1/2/4/8), early Granary, positive move-end reserves, no economy desertion, popup combat, Realm, responsive layouts and tutorial are frozen. Economy numbers and campaign calibration are unchanged from v0.10.0.

This patch fixes a save-safety gap: Gather, Fight, build-placement and uncaught runtime failures pause the run and stop further actions/autosaves from replacing the last good save. Contextual runtime logs are deduplicated and limited to five distinct reports per page. Frame/render failures stop audio and battle playback. Restart restores sound after simulation failure; graphics failures require Reload. Building-art failures remain retryable without committing the choice. Initialization failure disables subsequent saving. Save shape and SDK contracts are unchanged.

## Verified locally

- `pnpm --config.verify-deps-before-run=false check`: TypeScript, ESLint and 216 tests in 22 files pass, including action failure guards, reference build-order balance, all-campaign resource/non-desertion invariants, old save fixtures, platform failure/retry cases, art, combat and audio.
- `pnpm --config.verify-deps-before-run=false package`: production build and all portal bundle-validator checks pass (root index, relative assets, official SDK, static formats, size, prohibited dialogs/navigation).
- Production HTTP preview on isolated port 4177, registered mock player: default 4x speed, campaign entry, Gather with affordable cards, move-2 save restoration, remaining Gather turns, muster, popup Fight, Skip and victory. Mock leaderboard received `campaign-progress: 103`. No captured browser warnings/errors. The manual-test save on 4173 was preserved.

This focused smoke test does not replace actual portal, real-phone/Safari or physical-audio testing. The Python Playwright device matrix was not rerun in this environment. Mock success does not prove real access permissions or leaderboard configuration.

## Before publication

Complete the unchecked steps in `Docs/SUBMISSION_CHECKLIST.md`, following read-only `common/GOLIVE_DEVELOPER_REFERENCE.md`:

1. Configure the exact game slug and activate `campaign-progress`: All-Time, Highest Score Wins, maximum 2575.
2. Upload this exact ZIP to Sandbox Preview. Verify GAME_READY, actual player display name, registered scores, guest play, trial/cloud-denied play, cloud restoration and multi-device behavior.
3. Verify the portal prevents iframe launch for players without game access; the game relies on that portal gate.
4. Verify portal pause/resume/session end, phones in both orientations, Safari and sound/mute on physical speakers.
5. Complete owner confirmations marked TODO in `Assets/Art/PROVENANCE.md` (source/tool and commercial-use rights); upload store artwork.
6. Submit for review after those checks pass.

## Later improvements

Explore strategic Gather paths beyond the exhaustive eight-move test; review campaign-1 generosity (the all-Gather smoke path earns three stars); remove unused legacy city-battle rendering after checking consumers. Use portal playtest analytics to guide tutorial/mobile text changes. None of these follow-ups changes this frozen artifact.
