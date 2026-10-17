# Hippo Arcade Platform SDK v2 — portal bridge

The package SDK and `/sdk/v2/platform-sdk.js` are built from the same source.
The legacy `/api/v1/sdk/platform-sdk.js` URL remains supported.
Games communicate with their parent portal using bridge protocol v2. Only the portal
knows the API URL and handles player authentication and token renewal.

## Environments

| Environment | Portal | Developer console |
|---|---|---|
| **Test** | https://golive-platform.netlify.app/ | https://golive-platform.netlify.app/developer |
| **Production** | https://www.hippoarcade.com/ | https://www.hippoarcade.com/developer |

Netlify is the test environment, not production. Use the test console for validation
and the production console for production submissions. Do not assume uploads or saves
transfer between environments. The same bundled game uses its parent portal's routing;
no environment-specific API URL belongs in game code.

## Boot and save

Load the hosted v2 SDK before your external game script:

```html
<script src="/sdk/v2/platform-sdk.js" defer></script>
<script src="./game.js" defer></script>
```

This URL receives compatible v2 updates without rebuilding games. For an immutable
release, use `/sdk/2.0.0/platform-sdk.js`. See the
[loading and migration guidance](HIPPO_ARCADE_DEVELOPER_REFERENCE.md#1-include-the-sdk-in-your-game).

```js
// Hosted script exposes window.Platform; no package import is needed.

await Platform.init(); // initFromPortal() is an equivalent alias
const player = await Platform.getPlayer();
const saved = await Platform.getGameProgress();
const state = saved.progress; // {} and version 0 mean no existing save

// At a checkpoint, after updating your state:
await Platform.saveGameProgress(state);
// Only now show “Saved”.
```

Bundling `platform-sdk.js` from the SDK build output remains optional.
It exposes the same object as `window.HippoArcadeSDK` and `window.Platform`.
`window.GoLiveSDK` remains a compatibility alias for existing games.
Place boot logic in an external script to satisfy published-game CSP.

Initialization options are optional `clientVersion`, `platform`, and `timeoutMs`
(default 15 seconds per request). There is no server URL or game ID to configure.
The portal binds the SDK to the game actually launched. Standalone pages fail with
`NOT_IN_IFRAME`; use the local portal or developer preview for integration testing.

## Branding update — SDK 2.1.0

The SDK is now named **Hippo Arcade Platform SDK**. Hosted v2 games can use
`window.HippoArcadeSDK` or keep using `window.Platform`. The old `window.GoLiveSDK`
alias remains supported; all three names share the same instance. No game changes
are required. The package name remains `@gaming-platform/sdk`.

The `/sdk/v2/platform-sdk.js` URL receives this compatible update after deployment.
The immutable `/sdk/2.0.0/platform-sdk.js` release is unchanged and does not include
the new alias. Bundled games must rebuild to adopt it. Bridge protocol v2, SDK
operations, and player/developer/admin preview behavior are unchanged.

## Breaking migration from v1

- Replace `init({ apiBaseUrl, gameId })` with `await init()`.
- Replace `requestTokenFromParent()` / `acceptToken()` with `await getPlayer()`.
- Remove game-side token storage, refresh calls, direct REST calls, and URL discovery.
- Always successfully load progress before saving, including the first save.
- Rebuild all game bundles. There is no legacy direct-network fallback.
- Account registration, logout, upgrades, purchases and redemption belong in portal UI.
  The SDK no longer exposes token methods or the old simulated payment/ad success helpers.
- `getLeaderboard(name, limit)`, `submitScore(name, score, metadata)` and
  `getMyRank(name)` now consistently address console-created leaderboard names
  in both package and hosted builds. Omit the name for the default leaderboard
  (`submitScore(score)` also works).

## Cloud-save behavior

Progress is an opaque JSON object, capped at 64 KB with at most six nesting levels.
Loads return `{ gameId, progress, version, updatedAt? }`.
Saves return `{ gameId, version, updatedAt }` after the server acknowledges persistence.
The SDK remembers the loaded version (including zero) and serializes load/save calls.
The backend checks versions atomically to reject stale concurrent writes.

A failed load never becomes an empty successful save. A failed, timed-out or conflicting
save invalidates the SDK's loaded version. Load again and reconcile your game state
before retrying; do not blindly replace the new cloud state with an old snapshot.
There is no automatic write retry after an uncertain network/server failure.

`ApiError` carries `status` and `code`. Common errors:

| Code | Meaning / action |
|---|---|
| `NOT_IN_IFRAME` | Launch through the portal or preview. |
| `NOT_INITIALIZED` | Await initialization. |
| `PORTAL_TIMEOUT` | Host unavailable or operation outcome uncertain; reload progress. |
| `PROGRESS_NOT_LOADED` | Successfully load before saving. |
| `SAVE_CONFLICT` | Another session changed the save; reload and reconcile. |
| `SESSION_CHANGED` | Signed-in player changed; reload the game. |
| `AUTH_REQUIRED` / `UNAUTHORIZED` | Sign in through the portal. |
| `ENTITLEMENT_RESTRICTION` | Server policy denies a live save. |
| `PREVIEW_UNSUPPORTED_OPERATION` | Capability is not provided by isolated preview. |

`login()` checks the portal identity and returns `{ status, player }`, where status
is `ok`, `auth_required`, or `session_unknown`. It never creates an account or exposes tokens.
`getPlayer()` returns a profile or throws; `currentPlayer()` returns the cached profile.

## Developer and admin previews

All three playback surfaces use the same iframe bridge. Preview does not require a
separate player login: the existing preview capability authorizes an isolated test profile.

Preview progress is persisted in `preview_progress`, keyed by game ID, reviewer role
(developer/admin), and reviewer ID. Closing/reopening the preview, refreshing its token,
or uploading another build of the same game retains that reviewer's save. Other reviewers
and games have independent saves. Preview saves never enter real player progress or leaderboards.

Preview supports initialization, profile, load/save progress and play/access checks.
Telemetry is acknowledged without entering production analytics. Other capabilities
currently return `PREVIEW_UNSUPPORTED_OPERATION`, including leaderboard and economy writes.
Expired preview capabilities require closing and reopening the preview.

## Other live capabilities

- Leaderboards: `submitScore`, `getLeaderboard`, `getMyRank`.
- Access: `getGameAccess`, `authorizeAndPlay`.
- Catalog: `getGames`, `getRecentGames`, `getMyGames`.
- Favourites: `addFavourite`, `removeFavourite` (current game only).
- Economy reads/actions: `getGems`, `getDailyBonusStatus`, `claimDailyBonus`,
  `getSubscription` (entitlements response), `getProducts`.
- Configuration: `config.getAll()`, `config.get(key, fallback)`,
  `flags.getAll()`, `flags.isEnabled(key, fallback)`.
- Telemetry: `track`, `flushEvents`, `reportError`, `startSession`, `endSession`.
  Telemetry is best effort; await `flushEvents()` before controlled navigation.

## Platform contract

Requests contain a protocol version, request ID, named operation and arguments.
The host validates the exact iframe window and expected origin, rejects arbitrary
URLs/HTTP methods, and scopes game operations to the host's game. Games receive no
player, developer or admin access tokens. Requests have timeouts, concurrency limits,
and duplicate-ID protection; errors retain their server status/code.

Same-origin hosting is required. Reviewed, trusted games use `allow-same-origin`
in the shared frame policy; they share the portal's browser trust boundary.
Namespace local storage and Web Lock names by game ID. Keep browser-denial fallbacks.
The API may be hosted elsewhere because only the portal calls it.

## Build, test, deploy

From `browser-gaming-backend/`:

```sh
npm run prisma:generate
npm run build:developer-kit
node --test scripts/test-sdk-portal-config.cjs
npm run test --workspace=@gaming-platform/api -- --runInBand progress.service.spec preview-bridge.service.spec game-preview.controller.spec
npm run typecheck
npm run build:api
```

The developer-kit build regenerates the hosted SDK bundle and creates
`dist/developer-kit.zip` with the current guides and an uploadable example. API contract
changes require updating affected SDK/bridge code and documentation, regenerating these
artifacts, and verifying player and both preview flows. See [kit maintenance](README.md).

The API prebuild regenerates `sdk-bundle.generated.ts` from the package source.
Apply Prisma migration `20261016120000_preview_progress` before deploying preview-save
support, deploy the matching portal/API, and upload freshly rebuilt game packages.
Existing player saves stay in their existing table and retain their game/player keys.

## Progress cache policy

Live progress responses use `private, no-store` and disable CDN caching. The portal
bridge loads progress with `cache: 'no-store'` so a previous browser response cannot
supply a stale save revision. This is a portal/API fix; the SDK v2 operations and
progress envelopes are unchanged, and bundled games need no SDK update for it.
Deploy the matching portal and API changes and reopen player playback to use them.
