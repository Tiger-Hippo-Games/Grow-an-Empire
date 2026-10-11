# Release freeze: v0.10.3

2026-10-11. Locally validated release candidate for Sandbox Preview; not yet submitted or approved for publication. Supersedes the v0.10.2 freeze (0.10.3 adds the smoother, less crowded city and wider roads; earlier ZIPs stay in `release/`, unchanged).

## Immutable artifact

- `release/grow-an-empire-0.10.3.zip`: 15,446,780 bytes, 122 entries.
- SHA-256: `B2D1C052FD3B191DE0F942905A2885CF1031D7A8F4FE78E602169E8CD38DE004`
- (Superseded: `grow-an-empire-0.10.2.zip`, SHA-256 `7D8F948E…3B6E`.)
- Save schema 6 (v4/v5 migrations retained). Game slug `grow-an-empire`; leaderboard `campaign-progress` (no maximum score).

Keep this ZIP unchanged. Any further fix needs a new patch version, a separate ZIP and fresh check/package evidence.

## What 0.10.2 and 0.10.3 change

The fixes from the pre-submission review (project doc "Grow an Empire 0.10.1: pre-submission review") and Ravi's decisions of 2026-10-10. Details in `CHANGELOG.md` and `Docs/QA_RESULTS.md`. In short: errors from outside the game no longer pause it; `GAME_READY` is sent on every error screen; testing switches are inert on the portal; a bad save can't block boot; guests keep no cloud save; art, font and sound health checks; UX, accessibility and dead-code cleanup; first screen 1.4 s faster on Slow 4G; landscape listing; new key art. Gameplay numbers, campaign calibration, save shape and the SDK contract are unchanged from v0.10.1.

0.10.3 adds the visual changes only: smoother walking (poses follow distance, a calmer crowd clock), villagers spread in lanes and stops around the Town Hall, and roads 5% wider per move up to 1.6×. Gameplay, save shape and the SDK contract are unchanged from v0.10.2.

## Verified locally

- `pnpm check`: TypeScript, ESLint and 239 tests in 25 files (0.10.3).
- `pnpm package`: production build; all 15 bundle-validator checks pass, including the new check that every asset the code and styles name is in the ZIP.
- Full Python Playwright suite against the production build, all pass: gameplay, platform_sdk (signed-in cloud restore, iframe pause/resume/session end, offline, guest without cloud), viewports (14 sizes), campaign_map, text_budget, context_loss, fault_injection --quick (16 scenarios), assets_audio (119 bundled files decode; images, font and sound load at 1280×720 and 390×844), journey on the release build at the portal path (no errors or warnings).
- Time to playable: 1.7 s at 10 Mbps, 9.1 s on Slow 4G (1.69 MB). The full browser suite was rerun on 0.10.3: all pass.

Not covered locally: the real portal, real phones and Safari, physical speakers.

## Before publication

1. Create and activate `campaign-progress` in the Developer Console: Campaign Progress, All-Time, Highest Score Wins, no maximum score. Confirm the listing slug and orientation **Landscape**.
2. Upload this exact ZIP to Sandbox Preview. Verify GAME_READY, the portal display name, registered scores, guest play (no cloud save), trial/cloud-denied play and cloud restoration.
3. Verify the portal prevents iframe launch for players without game access.
4. Verify portal pause/resume/session end, Safari, a device showing the full 1920×1080 frame, and sound/mute on real speakers.
5. Complete owner confirmations in `Assets/Art/PROVENANCE.md`; upload the v2 thumbnail and banner from `Assets/Art/Store/upload/`.
6. Submit for review (Ravi, later).

## Later improvements

Review campaign-1 generosity (an all-Gather path earns three stars); explore strategic Gather beyond eight moves; use portal playtest analytics (`ux_*`, `asset_problem`) to guide tutorial and mobile text.
