# Submission checklist

A ticked copy of `common/GAME_SUBMISSION_GUIDE.md` §16 and `common/GAME_DEVELOPER_GUIDE.md` §8, as of v0.3.0 (updated 2026-10-02).

- ✅ Done and verified in code or tests.
- ⬜ Can only be done on the portal, or needs the owner.
- n/a Doesn't apply to this game.

Listing text and images: `Docs/STORE_LISTING.md`. Test evidence: `Docs/QA_RESULTS.md`.

## Build (SUBMISSION §16)

- ✅ `vite.config.ts` has `base: "./"`
- ✅ The built `index.html` uses relative asset paths. The one absolute path is the portal SDK tag, `/api/v1/sdk/platform-sdk.js`, which the portal serves itself (SUBMISSION §5).
- ✅ No localhost URLs in the built output (the validator checks this)
- ✅ `index.html` is at the ZIP root
- ✅ The ZIP is under 50 MB (`release/grow-an-empire-0.3.0.zip`, 15.4 MB; 15.9 MB unpacked)
- ✅ No `alert()`, `confirm()` or `prompt()` (the validator and ESLint `no-alert` check this)
- n/a Unity/Godot threading settings

## SDK integration and saves (SUBMISSION §16, DEVELOPER §8)

- ✅ `Platform.init({ gameId: "grow-an-empire" })`. **The slug must match**; if you have to pick a different slug, change `GAME_ID` in `src/platform/adapters.ts` too.
- ✅ `Platform.login()` is awaited before any player data is used. It times out after 5 s and the game then plays offline.
- ✅ `Platform.getGameProgress()` runs on start. Empty progress falls back to a new game.
- ✅ The save has `schemaVersion` (4), is validated on load, and a frozen fixture test guards backward compatibility
- ✅ `saveGameProgress()` runs at every move, on the muster result, on `visibilitychange`/`pagehide`, and is debounced 2 s otherwise
- ✅ The save is about 2 KB (limit 64 KB): no images or audio
- ✅ `Error("Conflict")` is handled: reload, merge, retry once (`Docs/adr/0002`)
- ✅ `startSession()` runs after login when play begins; `endSession(seconds)` on exit and on `GP_SESSION_END`
- ✅ `track()` sends `game_start`, `level_start`, `level_completed`, `level_failed`, `game_over`, `tutorial_started`, `tutorial_completed`/`tutorial_skipped`, `settings_changed`, `quality_changed` and `load_error`
- ⬜ The upload response shows `sdkAutoInjected: false`

## Hosting (DEVELOPER §8)

- ✅ Under 5 s to playable at 10 Mbps (1.27 s measured)
- ✅ No `X-Frame-Options` is set by the game; the portal serves the bundle
- ✅ The game uses the whole iframe, never navigates the top window, and only posts messages to `window.parent`

## Upload

- ✅ The local validator passes (`pnpm package`). ⬜ Also run the portal's own `tools/validate-game-bundle.js` if you have it. It isn't in `common/`; ours checks the same rules.
- ⬜ `upload-bundle` returns `bundleStoredInDb: true` and a non-null `bundleVerifiedAt`
- ⬜ Upload the thumbnail and banner (the files are ready; see below)

## End-to-end on the portal (SUBMISSION §10): owner

- ⬜ `https://golive-platform.netlify.app/api/v1/games/grow-an-empire/play/index.html` loads with no console errors
- ⬜ In DevTools → Network, every request returns 200 and nothing returns 404
- ⬜ Play start to finish
- ⬜ Close the tab mid-game, reopen it, and check the run is restored
- ⬜ Test inside an iframe: the sandbox, or `Tools/dev/iframe-test.html` pointed at the play URL
- n/a Audio after the first click (the game has no audio)
- ⬜ Layout at 1920×1080, 1280×720 and a phone (✅ the 0.2.1 ZIP was checked locally at 15 sizes on 2026-09-27, including a full campaign in a 1920×1080 iframe and on a 390×844 phone; the 0.2.2 build, with the new campaign map, at 12 sizes plus `campaign_map.py` on 2026-10-01)
- ⬜ Mobile, portrait and landscape on a real phone (see `QA_RESULTS.md` §2). ✅ Emulated locally on 2026-09-27: 390×844, 844×390, 360×780, 780×360, 412×915, 768×1024, 1024×768, including a full campaign at 390×844

## Content and metadata

- ✅ Content policy (§14): mild fantasy combat, no gore, no real money, no crypto. See `STORE_LISTING.md`.
- ✅ Title "Grow an Empire" (the same in `<title>`)
- ✅ Description is 233 characters (150–500 allowed)
- ✅ Genre `strategy`, tags set
- ✅ **Orientation `any`**, declared in the game itself: `index.html` has `<meta name="orientation" content="any">` and `<meta name="screen-orientation" content="any">` (both are in the 0.3.0 ZIP, SUBMISSION §1). The same value is in `STORE_LISTING.md` and its create-listing JSON. The game plays in both: 16:9 stage in large frames, rearranged layout on phones and tablets in portrait or landscape (no "turn sideways" screen).
- ⬜ **Art provenance**: fill in the TODO rows in `Assets/Art/PROVENANCE.md` (tool and commercial-use terms)
- ⬜ Confirm "Grow an Empire" and "Ashfang Raiders" don't copy an existing title or brand

## Portal steps, in order

The base URL is `https://golive-platform.netlify.app/api/v1`. Every request after login needs `Authorization: Bearer <JWT>`; the token is valid for 24 h. Enter your own password; don't commit it or paste it into scripts.

1. **Register** (once): `POST /developer/register` with email, password, name and studioName. **Log in**: `POST /developer/login`, which returns the JWT.
2. **Create the listing**: `POST /developer/games` with the JSON in `Docs/STORE_LISTING.md` (it already sets `"orientation": "any"`). A `400 Slug already in use` means pick another slug and update `GAME_ID`. **If the listing was created earlier with `landscape`**, switch it: `PUT /developer/games/grow-an-empire` with `{"orientation": "any"}` (no review needed).
3. **Build**: `pnpm package`, which produces `release/grow-an-empire-0.2.3.zip` and ends with "Ready to upload". (Already built and checked; no need to rebuild unless the source changes.)
4. **Upload the bundle**:
   ```bash
   curl -X POST "$BASE/developer/games/grow-an-empire/upload-bundle" -H "Authorization: Bearer $TOKEN" -F "file=@./release/grow-an-empire-0.2.3.zip"
   ```
   Expect `bundleStoredInDb: true`, `sdkAutoInjected: false`, and a `bundleVerifiedAt` timestamp.
5. **Upload the images**. The ZIP already contains `assets/thumbnail.jpg` and `assets/banner.jpg`; uploading them as well is harmless.
   ```bash
   curl -X POST "$BASE/developer/games/grow-an-empire/upload-assets" -H "Authorization: Bearer $TOKEN" -F "thumbnail=@./public/assets/thumbnail.jpg" -F "banner=@./public/assets/banner.jpg"
   ```
   If the Developer Console asks for 16:9 images instead (DEVELOPER §8), use `Assets/Art/Store/upload/thumbnail-480x270.jpg` and `banner-1280x720.jpg`.
6. **Test**: work through the end-to-end section above.
7. **Check the status**: `GET /developer/games/grow-an-empire` should show a non-null `iframeUrl` and `bundleVerifiedAt`, and `submissionStatus: "DRAFT"`.
8. **Submit**: `POST /developer/games/grow-an-empire/submit`, which returns `submissionStatus: "PENDING_REVIEW"`. Review takes 2–5 business days. The slug is fixed from this point.

## Known limitations to mention in review notes

- **Safari (ITP)** may clear local storage between visits. Signed-in players keep their progress through the cloud save; guests may lose theirs (SUBMISSION §10).
- **No audio** in v1.
- **Frame rate** has only been measured in a headless browser. Real-device numbers go in `QA_RESULTS.md`.
