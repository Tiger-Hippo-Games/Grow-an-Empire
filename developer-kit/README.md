# Hippo Arcade Platform developer kit — SDK v2

Start with the [Developer Reference](HIPPO_ARCADE_DEVELOPER_REFERENCE.md) and
[SDK Reference](SDK_REFERENCE.md). Load `/sdk/v2/platform-sdk.js` before your game script; no SDK file is needed in
your game ZIP. The parent portal supplies routing and authentication; no API URL or tokens
belong in game code.

For AI-assisted integration, give your coding assistant the complete public guide:
[Hippo Arcade Platform SDK v2 documentation](https://www.hippoarcade.com/docs/sdk/v2.md).
This endpoint is published with the portal deployment and requires no login.

| Environment | Developer console |
|---|---|
| Test | https://golive-platform.netlify.app/developer |
| Production | https://www.hippoarcade.com/developer |

Test uploads and saves do not transfer to production.

## Example AI integration prompt

Copy this prompt into your coding assistant while your game project is open:

```text
Integrate the Hippo Arcade Platform SDK v2 into this game. Read and follow:
https://www.hippoarcade.com/docs/sdk/v2.md

Inspect the existing game and implement the integration. Load
/sdk/v2/platform-sdk.js from the game's serving origin before game code runs;
do not embed or bundle an SDK copy. Use window.Platform, initialize once, and
await initialization before SDK calls. Preserve gameplay and existing saves.

Connect player identity and cloud progress where appropriate. Load successfully
before saving, show “Saved” only after confirmation if applicable, and handle failures without
overwriting cloud progress.

If the project has a leaderboard, preserve existing leaderboard integration; ask for
the configured leaderboard name in HippoArcade if adding one. Let the portal handle authentication
and routing—do not add tokens, API URLs, or game IDs to game code.

Remove obsolete SDK imports and copy steps. Build an uploadable ZIP, run the
available checks, and provide portal-preview test steps for loading, saving,
and reopening the game. Clearly distinguish tests run from tests still needed.
If you cannot read the documentation, ask me for it rather than guessing the API.
```

The public documentation and hosted SDK routes must be deployed before using this
prompt. If the assistant cannot access the URL, provide this kit's Developer
Reference and SDK Reference instead.

## Minimal example

`examples/minimal-game/` demonstrates loading and saving a counter. The downloadable
kit includes `minimal-game.zip`, ready to upload to the test developer console.
To package it manually, ZIP the example's `index.html` and `game.js` with
`index.html` at the root. The example loads the hosted v2 SDK.
Launch through preview, save, close and reopen to verify persistence. Standalone
pages cannot connect to the portal bridge. After a save error, reopen the example
to reload authoritative cloud progress before trying again.

## Platform maintainers

From `browser-gaming-backend/`:

```sh
npm run build:developer-kit
node --test scripts/test-sdk-portal-config.cjs
```

Share `browser-gaming-backend/dist/developer-kit.zip`. The build regenerates the
package SDK and hosted API bundle from `packages/sdk/src/`, then
packages the guides and runnable example. Older reference locations link here;
historical guides are excluded.

Portal development, portal builds, and developer-kit builds generate
`apps/portal/public/docs/sdk/v2.md` from this kit's Developer Reference, SDK Reference,
and README. Edit these sources; never maintain a separate hosted copy by hand.

When an API contract changes, update affected SDK source, portal bridge, preview
handlers and these references together, then regenerate `platform-sdk.js` and the
ZIP. Never hand-edit generated JavaScript. If the bridge fully absorbs an internal
API change, document why the SDK contract is unchanged and still regenerate and
verify the kit. Update the SDK version and migration guidance for public contract
changes. Validate affected player, developer-preview and admin-preview operations.

Building the kit does not deploy services or replace SDKs bundled in published
games. Distribute the updated kit and have developers rebuild and re-upload when
their bundled SDK needs updating.

The fixed release in `apps/api/src/modules/platform/sdk-releases/2.0.0.generated.ts`
is an immutable snapshot of the generated SDK, excluded from routine regeneration.
Keep it when updating the v2 bundle; publish future fixed releases as new snapshots
and explicit routes. The v2 route must continue serving v2 when a v3 is introduced.
This hosting change does not change SDK methods or the portal bridge protocol.

SDK 2.1.0 adds `window.HippoArcadeSDK`; `window.Platform` and the legacy
`window.GoLiveSDK` continue to work. The kit contains documentation and examples,
with no SDK JavaScript copy. See [migration guidance](SDK_REFERENCE.md#branding-update--sdk-210).
