# Release freeze: v0.10.8

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
- Final release ZIP browser verification is in progress; completed evidence will be recorded in `Docs/QA_RESULTS.md` before handover.

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
