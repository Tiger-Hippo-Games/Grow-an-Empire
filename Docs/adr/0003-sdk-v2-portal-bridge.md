# ADR 0003: Hippo Arcade SDK v2 portal bridge

Date: 2026-10-18. Supersedes SDK loading, identity and save-retry details in ADRs 0001/0002 and the historical portal implementation plan.

The supplied `developer-kit/HIPPO_ARCADE_DEVELOPER_REFERENCE.md` and `developer-kit/SDK_REFERENCE.md` are the current integration contract. `common/` remains an unchanged historical reference. The production portal is `https://www.hippoarcade.com/`; Netlify is the test environment. Uploads, accounts and saves do not transfer between them.

The game loads `/sdk/v2/platform-sdk.js` from its serving origin before its external game module. The compatible v2 route currently serves SDK 2.1.0. The ZIP contains no SDK copy. `Platform.init({clientVersion, platform, timeoutMs})` runs once, followed by `Platform.getPlayer()`. No API host, game identifier, token handoff or direct-network fallback is configured in game code. The portal binds the launched game and handles authentication. Standalone development keeps the existing local practice mode.

Cloud operations are serialized with an in-memory promise queue and never require Web Locks. A successful progress-envelope load, including `{progress:{},version:0}`, precedes saving. After every failed save, the adapter invalidates its read state and the progress store reloads and reconciles before a delayed retry. A newer cloud run is preserved; an uncertain outcome cannot trigger a blind overwrite. Structured `SAVE_CONFLICT`/HTTP 409 are recognized. `SESSION_CHANGED` disables platform operations until reload. Failures keep browser progress where storage is available and show a reconnect/reload message.

The simulation's schema-6 snapshot remains unchanged. Move ledgers and final battle rounds fit the six-container nesting limit. The actual JSON payload is checked for six nesting levels and 64 KB UTF-8 before reaching the SDK. Existing v4/v5 migrations remain in place.

`PREVIEW` profiles use isolated cloud persistence provided by the portal, plus a separate browser save key per preview profile. They never post or request leaderboards; the ranking view explains that rankings require player playback. A preview connection arriving after local practice has booted asks for reload, avoiding upload of the live browser run into preview. Live browser save keys are unchanged. Guests remain browser-only under the established game contract. Saving permissions otherwise come from the server, with no subscription/trial rules hardcoded in the game.

The existing `strongplayer` weekly leaderboard and distinct-campaign score are retained for live registered players. The 30-second score cadence, five-second cloud-write cadence measured after each attempt settles and 2 KB score metadata cap remain. The portal owns play authorization; the game adds no access/paywall UI. `GAME_READY` is sent once after drawing, targeting the game's origin, including watchdog/error paths.

`Tools/qa/sdk_v2.py` can run the exact unpacked ZIP with a downloaded official SDK and a simulated same-origin v2 bridge. This verifies the game/client contract, not live backend persistence. Test real preview save/reopen separately in the test developer console, live rankings through test player playback, and then upload the same verified ZIP to the production developer console.
