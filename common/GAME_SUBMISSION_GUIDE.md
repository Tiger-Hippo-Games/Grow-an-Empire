# GoLive Platform — Game Submission Guide

> **This document is for game developers.** It covers everything you need to know to prepare, package, and submit your HTML5 game to the GoLive Platform.
>
> Share this file with your development team along with [`SDK_REFERENCE.md`](./SDK_REFERENCE.md) and [`API_REFERENCE.md`](./API_REFERENCE.md) before starting integration.
>
> Use [`SDK_SMOKE_TEST.html`](./SDK_SMOKE_TEST.html) to verify your SDK integration is working correctly.[`API_REFERENCE.md`](./API_REFERENCE.md) before starting integration.

---

## Table of Contents

1. [Before You Start](#1-before-you-start)
2. [Register as a Developer](#2-register-as-a-developer)
3. [Create Your Game Listing](#3-create-your-game-listing)
4. [Building Your Game Bundle](#4-building-your-game-bundle)
5. [Integrating the Platform SDK](#5-integrating-the-platform-sdk)
   - [5.1 Ensuring Player Progress & State Retention Across Game Updates](#51-ensuring-player-progress--state-retention-across-game-updates)
6. [Testing Locally Before Upload](#6-testing-locally-before-upload)
7. [Validate Your Bundle](#7-validate-your-bundle)
8. [Upload Your Game Bundle](#8-upload-your-game-bundle)
9. [Upload Thumbnail & Banner Images](#9-upload-thumbnail--banner-images)
10. [Test Your Game End-to-End on the Platform](#10-test-your-game-end-to-end-on-the-platform)
11. [Submit for Review](#11-submit-for-review)
12. [Review Process & What Happens Next](#12-review-process--what-happens-next)
13. [After Approval — Updating Your Game](#13-after-approval--updating-your-game)
14. [Content Policy](#14-content-policy)
15. [Common Mistakes & Fixes](#15-common-mistakes--fixes)
16. [Full Pre-Submission Checklist](#16-full-pre-submission-checklist)
17. [Quick API Reference](#17-quick-api-reference)

---

## 1. Before You Start

### What the platform supports

| Supported | Not supported |
|-----------|---------------|
| HTML5 games (canvas, WebGL, CSS) | Native executables (`.exe`, `.apk`) |
| Three.js, Phaser, PixiJS, Babylon.js | Flash / SWF |
| Unity WebGL (single-threaded export only — see §4) | Games requiring their own server process |
| Godot Web export (single-threaded) | WebSocket game servers you host |
| Vanilla JavaScript, Webpack, Vite, Rollup bundles | Games requiring SharedArrayBuffer / COOP headers |
| Any framework that outputs a static HTML5 bundle | |

### Technical requirements at a glance

| Item | Requirement |
|------|-------------|
| Bundle format | `.zip` |
| Max bundle size | **50 MB** (contact us for larger games) |
| Required file | `index.html` at the ZIP root (or in one top-level subfolder — auto-flattened) |
| Rendering target | Runs inside an `<iframe>` — no top-level navigation allowed |
| Asset paths | **Must be relative** (e.g. `./assets/sprite.png`) — never absolute (`/assets/...`) |
| Orientation | Landscape, portrait, or both — declare in `index.html` metadata |
| Audio | Autoplay muted; unmute on first user interaction (browser autoplay policy) |
| Build base path | Must be set to `./` (not `/`) in Vite, Webpack, CRA — see §4 |

### iframe environment — what your game runs inside

Your game runs in a cross-origin `<iframe>`. The portal grants the following permissions:

| Permission | Granted? | Notes |
|------------|----------|-------|
| `autoplay` | ✅ Yes | Muted autoplay; unmute after user interaction |
| `fullscreen` | ✅ Yes | Use the Fullscreen API normally |
| `gamepad` | ✅ Yes | Gamepad API works |
| `microphone` | ✅ Yes | Requires user permission prompt |
| `clipboard-write` | ❌ No | Do not build clipboard copy features |
| `clipboard-read` | ❌ No | |
| `camera` | ❌ No | |
| `pointer-lock` | ❌ No | Do not build FPS-style mouse-lock controls |
| `payment` | ❌ No | No in-game payments via browser API |

### Browser APIs that behave differently inside iframes

These are common sources of "works on my machine, broken in production" bugs:

| API | Behaviour inside cross-origin iframe |
|-----|--------------------------------------|
| `alert()` / `confirm()` / `prompt()` | **Silently blocked** in all modern browsers — dialogs never appear |
| `localStorage` | **Blocked in Safari** (ITP) and all browsers in private/incognito mode — do not use for critical game state; use the Platform SDK instead |
| `sessionStorage` | Available, but isolated per iframe instance |
| `document.cookie` | Blocked in Safari (ITP) |
| `window.top.location` | Throws `SecurityError` — do not navigate the parent frame |
| `window.open()` | Opens a new tab but may be blocked by popup blockers |
| `screen.orientation.lock()` | Not available without additional iframe permissions |
| `navigator.geolocation` | Not granted |

> **Key takeaway**: Use the **Platform SDK** for player identity and game state — never `localStorage` directly. The SDK handles cross-browser storage correctly.

---

## 2. Register as a Developer

Developer tokens are separate from player tokens. Register once per studio:

```http
POST /api/v1/developer/register
Content-Type: application/json

{
  "email":      "studio@example.com",
  "password":   "YourSecurePassword123!",
  "name":       "Your Name",
  "studioName": "Awesome Game Studio"
}
```

**Password rules**: minimum 8 characters, at least one uppercase, one number.

Save the returned `accessToken` — you'll use it in all subsequent API calls:
```
Authorization: Bearer <your-developer-token>
```

**Developer tokens expire after 24 hours.** Log in again to get a new token:
```http
POST /api/v1/developer/login
Content-Type: application/json

{ "email": "studio@example.com", "password": "YourSecurePassword123!" }
```

---

## 3. Create Your Game Listing

Create the game record **before** uploading files. This returns a `gameId` and `slug`.

```http
POST /api/v1/developer/games
Authorization: Bearer <token>
Content-Type: application/json

{
  "title":       "My Awesome Game",
  "slug":        "my-awesome-game",
  "description": "A 150–500 character description shown on the game's detail page.",
  "genre":       "arcade",
  "orientation": "landscape"
}
```

**Valid genres**: `idle`, `strategy`, `platformer`, `puzzle`, `arcade`, `rpg`, `simulation`, `sports`

**Valid orientations**: `landscape`, `portrait`, `any`

**Response:**
```json
{
  "id":               "game-uuid-here",
  "slug":             "my-awesome-game",
  "submissionStatus": "DRAFT"
}
```

> **Slug rules**: lowercase letters, numbers, and hyphens only. Maximum 60 characters. Must be globally unique — if a slug is already taken you'll receive `400 { "error": "Slug already in use" }`. Choose another.
>
> **The slug cannot be changed after your game is submitted.** It becomes part of the permanent game URL.

---

## 4. Building Your Game Bundle

Your game must be packaged as a single `.zip` file that can run self-contained in a browser.

### Required structure

```
my-game.zip
├── index.html          ← REQUIRED — the entry point the platform loads
├── game.js
├── style.css
└── assets/
    ├── sprites.png
    ├── audio.ogg
    ├── thumbnail.png   (optional — 400×300 px)
    └── banner.jpg      (optional — 1280×360 px)
```

### The server auto-flattens one level of nesting

If your build tool wraps output in a single named subfolder, that's fine — the server detects it and flattens it:

```
my-game.zip
└── dist/               ← single top-level folder — auto-detected and flattened
    ├── index.html      ← moved to ZIP root automatically
    ├── bundle.js
    └── assets/
```

**This is rejected** (multiple top-level folders — ambiguous):
```
my-game.zip
├── src/
│   └── index.html      ← rejected
└── dist/
    └── index.html
```

### ⚠️ Critical: Set your build base path to `"./"`

This is the **most common reason games 404 in production**. When your game runs at:
```
/api/v1/games/my-game/play/index.html
```

An asset referenced as `/assets/sprite.png` (absolute) resolves to the domain root — which has no such file. Assets **must use relative paths**:

| Reference in code | Resolves to | Works? |
|-------------------|-------------|--------|
| `./assets/sprite.png` | game-relative URL | ✅ |
| `assets/sprite.png` | game-relative URL | ✅ |
| `/assets/sprite.png` | domain root — 404 | ❌ |
| `http://localhost:3000/...` | dead localhost URL | ❌ |

**Set the base path in your build tool** — this is usually one line:

```js
// vite.config.js
export default defineConfig({
  base: './',    // ← this one change fixes all asset paths
})

// webpack.config.js
module.exports = {
  output: {
    publicPath: './',   // ← same fix for Webpack
  }
}

// create-react-app — add to package.json:
{
  "homepage": "./"
}
```

After building, verify that your built `index.html` references assets with relative paths (e.g. `src="./assets/..."` or `src="assets/..."`), not starting with `/`.

### Build tool step-by-step

**Vite / Vue / React (Vite):**
```bash
# 1. Set base: './' in vite.config.js (see above)
npm run build       # outputs to dist/
# 2. Zip the contents of dist/, not dist/ itself:
cd dist && zip -r ../my-game.zip .
# Windows PowerShell:
# Compress-Archive -Path dist\* -DestinationPath my-game.zip
```

**Create React App:**
```bash
# 1. Add "homepage": "./" to package.json
npm run build       # outputs to build/
cd build && zip -r ../my-game.zip .
```

**Vanilla JS / no bundler:**
```bash
# Just zip your project folder contents:
cd my-project-folder
zip -r ../my-game.zip . --exclude "*.git*" --exclude "node_modules/*"
```

**Unity WebGL — important limitations:**

Unity's WebGL export has specific requirements for our platform:

1. **Disable multithreading** (Player Settings → Publishing Settings → uncheck "Enable Exceptions" and disable "Multithreading"). The platform does not set COOP/COEP headers required by SharedArrayBuffer — threaded builds will crash.
2. **Disable Brotli compression** or ensure your server can decompress it. Use Gzip compression instead (Player Settings → Publishing Settings → Compression Format: Gzip).
3. After export, zip the contents of the Build folder (not the folder itself).
4. Unity builds are typically large — keep your ZIP under 50 MB by compressing textures and audio.
5. Unity sets its asset paths correctly by default — no `base` path change needed.

**Godot Web export — important limitations:**

1. **Disable threads** in Export settings (uncheck "Use Threads") for the same reason as Unity above.
2. Godot exports have all correct relative asset paths by default.
3. After export, zip the exported folder's contents (where `index.html` is at the top level).

**Phaser / Three.js / PixiJS:**

These output standard JS — set `base: './'` in Vite/Webpack and zip normally.

---

## 5. Integrating the Platform SDK

The SDK provides: **player authentication**, **cloud saves**, **analytics tracking**, and **session management**.

> **If you skip the SDK**, the server injects a minimal stub that makes the game playable — but progress will not be saved, leaderboards won't work, and analytics won't be tracked. Integrate the SDK properly for the full feature set.

### Option A — Script tag (recommended)

Add this to your `index.html` `<head>`, before your game scripts:

```html
<!-- GoLive Platform SDK -->
<script src="/api/v1/sdk/platform-sdk.js"></script>
<script>
  window.addEventListener('DOMContentLoaded', async function () {

    // 1. Initialize first — always
    Platform.init({
      gameId: 'my-awesome-game',  // ← your game's exact slug
    });

    // 2. Authenticate the player
    // Creates a guest account on first visit; restores session on return.
    // On Safari in private mode the session is ephemeral (cannot persist).
    const { player } = await Platform.login();
    console.log('[MyGame] Playing as:', player.displayName);

    // 3. Load saved progress
    const { progress } = await Platform.getGameProgress();
    // progress is your own JSON blob — e.g. { level: 3, coins: 800, inventory: [...] }

    // 4. Start session tracking
    Platform.startSession();

    // 5. Start your game with the restored state
    window.startGame(progress || {});  // always guard against empty progress on first play
  });
</script>
```

**During gameplay** — save at checkpoints, on level completion, before exit:
```js
try {
  await Platform.saveGameProgress({ level: currentLevel, coins, inventory });
  Platform.track('level_completed', { level: currentLevel, score, duration });
} catch (e) {
  if (e.message.includes('Conflict')) {
    // Another device saved a newer version — reload before retrying
    const { progress } = await Platform.getGameProgress();
    mergeAndSave(progress);
  }
}
```

**When the game ends** (player exits, game over screen, etc.):
```js
Platform.endSession(Math.floor(secondsPlayed));
```

### Option B — ES Module (Vite / Webpack bundlers)

```js
import Platform from '@gaming-platform/sdk';

Platform.init({ gameId: 'my-awesome-game' });
const { player } = await Platform.login();
const { progress } = await Platform.getGameProgress();
Platform.startSession();
```

### Production vs local API base URL

In production (running inside the portal iframe), the SDK automatically uses the correct base URL — **no `apiBaseUrl` needed**.

For local testing only, add `apiBaseUrl`:
```js
Platform.init({
  gameId: 'my-awesome-game',
  apiBaseUrl: 'http://localhost:3000/api/v1',  // only during local dev
});
```

> **Full SDK API reference**: [`SDK_REFERENCE.md`](./SDK_REFERENCE.md)

### 5.1 Ensuring Player Progress & State Retention Across Game Updates

The GoLive Platform retains player progress records permanently in server-side PostgreSQL (`game_progress` table) linked to your game's unique ID. **When you upload an updated game ZIP, player save records are preserved on the server.**

However, because the **new game build** must parse and interpret save data written by **previous game builds**, game developers MUST follow these guidelines to prevent players from losing or corrupting their progress:

#### 1. Always Version Your Save State Schema (`schemaVersion`)
Never write unversioned save objects. Always include an integer `schemaVersion`. When loading progress on startup via `Platform.getGameProgress()`, run a lightweight migration if the save state is from an older version:

```javascript
function loadAndMigrateProgress(rawProgress) {
  const CURRENT_SCHEMA_VERSION = 2;
  
  // Guard against first-time players (empty progress)
  if (!rawProgress || Object.keys(rawProgress).length === 0) {
    return {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      level: 1,
      score: 0,
      coins: 100,
      inventory: ['starter_pack'],
      unlockedWorlds: ['world_1'], // Added in v2
      settings: { sound: true, music: true },
    };
  }

  const state = { ...rawProgress };

  // Example migration: migrating from v1 -> v2
  if (!state.schemaVersion || state.schemaVersion < 2) {
    console.log('[Game] Migrating save state from v1 to v2...');
    state.unlockedWorlds = state.unlockedWorlds || ['world_1'];
    state.inventory = Array.isArray(state.inventory) ? state.inventory : [];
    state.schemaVersion = 2;
  }

  // Ensure safe defaults for any newly introduced properties
  return {
    level: state.level ?? 1,
    score: state.score ?? 0,
    coins: state.coins ?? 0,
    inventory: state.inventory ?? [],
    unlockedWorlds: state.unlockedWorlds ?? ['world_1'],
    settings: {
      sound: state.settings?.sound ?? true,
      music: state.settings?.music ?? true,
    },
    ...state,
  };
}

// In initialization:
const { progress } = await Platform.getGameProgress();
const playerState = loadAndMigrateProgress(progress);
window.startGame(playerState);
```

#### 2. Backward Compatibility Is Mandatory
- **Never rename or delete existing progress keys** across game updates without migration fallback code. If `coins` was used in v1, do not rename it to `gold` in v2 unless you add `state.gold = state.gold ?? state.coins ?? 0`.
- **Never change data types** without checking (e.g. converting `inventory` from an array of strings `['sword']` to an array of objects `[{ id: 'sword', count: 1 }]` must include a conversion loop).

#### 3. Save at Strategic Milestones (Never Rely on `onunload` Alone)
Mobile browsers (iOS Safari, Android Chrome) terminate background iframes without firing `window.onbeforeunload` or `window.onunload`. 

**When to call `Platform.saveGameProgress()`**:
- ✅ Upon completing a level, wave, or mission.
- ✅ When reaching a checkpoint.
- ✅ After key economy actions (spending gems, purchasing items).
- ✅ When the player minimizes the browser or switches tabs using the `visibilitychange` event:

```javascript
document.addEventListener('visibilitychange', () => {
  if (document.hidden && window.currentGameState) {
    // Player switched tabs or minimized browser — persist immediately
    Platform.saveGameProgress(window.currentGameState).catch(err => {
      console.warn('[Game] Background save error:', err);
    });
  }
});
```

#### 4. Respect Save Size Limits & Data Sanitization
- Cloud save payloads must be **under 64 KB**.
- **What to store**: Level number, quest flags, high scores, equipped inventory IDs, player position coordinates, custom game settings.
- **What NEVER to store**: Base64 screenshots/images, binary canvas blobs, audio buffers, or complete tilemap grids. Keep save states compact and declarative.

#### 5. Handle Optimistic Concurrency Conflicts
`Platform.saveGameProgress()` automatically handles versioning. If a player plays across multiple devices and a conflict occurs (`Error("Conflict")`), catch the error, re-fetch with `Platform.getGameProgress()`, merge the highest score or highest level reached, and save:

```javascript
async function safeSaveProgress(updatedState) {
  try {
    await Platform.saveGameProgress(updatedState);
  } catch (err) {
    if (err.message && err.message.includes('Conflict')) {
      console.warn('[Game] Save conflict detected. Resolving...');
      const { progress: serverState } = await Platform.getGameProgress();
      // Keep whichever state has higher progression
      const mergedState = {
        ...updatedState,
        level: Math.max(updatedState.level || 1, serverState.level || 1),
        score: Math.max(updatedState.score || 0, serverState.score || 0),
        coins: Math.max(updatedState.coins || 0, serverState.coins || 0),
      };
      await Platform.saveGameProgress(mergedState);
    } else {
      console.error('[Game] Save failed:', err);
    }
  }
}
```

---

## 6. Testing Locally Before Upload

Test your game locally before uploading to catch integration issues early.

### Step 1 — Serve your game over HTTP (not `file://`)

The SDK requires HTTP — it will not work when opening `index.html` directly from your filesystem. Use a local dev server:

```bash
# Option A — npx serve (any directory):
npx serve ./dist

# Option B — Python:
cd dist && python -m http.server 8080

# Option C — VS Code Live Server extension
```

Open `http://localhost:8080` in your browser.

### Step 2 — Test inside an iframe locally

Your game runs inside an iframe on the portal. Test it the same way locally to catch iframe-specific issues:

```html
<!-- Create a test.html file anywhere and open it in a browser -->
<!DOCTYPE html>
<html>
<head><title>iframe Test</title></head>
<body style="margin:0;background:#111">
  <iframe
    src="http://localhost:8080"
    width="1280"
    height="720"
    style="border:none;display:block;margin:auto"
    allow="autoplay; fullscreen; gamepad; microphone">
  </iframe>
</body>
</html>
```

Open `test.html` in a browser (you can use Live Server for this too). Issues to watch for:

- Game loads fully with no console errors
- Assets load (no 404s in DevTools → Network)
- Audio plays after a click
- `alert()` / `confirm()` calls are silently ignored — replace with custom UI
- If `localStorage` access fails silently, your logic must fall back to SDK

### Step 3 — Test SDK authentication locally

Initialize the SDK with `apiBaseUrl: 'http://localhost:3000/api/v1'` and confirm in DevTools → Console:
```
[GoLive SDK] Player active: { id: "...", displayName: "Guest_xxxx", ... }
```

Test that progress saves and reloads — close and reopen the page and verify state is restored.

---

## 7. Validate Your Bundle

Run the validator **before uploading** — it runs the exact same checks as the server:

```bash
# From the browser-gaming-backend/ repo root:
node tools/validate-game-bundle.js path/to/my-game.zip

# With full file listing:
node tools/validate-game-bundle.js path/to/my-game.zip --verbose
```

**Sample passing output:**
```
GoLive Platform — Game Bundle Validator

── Step 0 — File Presence ───────────────────────────────────
  ✔ PASS  ZIP file exists on disk
  ✔ PASS  File size ≤ 200 MB (12.40 MB)

── Step 1 — ZIP Integrity ───────────────────────────────────
  ✔ PASS  File is a valid ZIP archive
  ✔ PASS  ZIP archive is not empty (47 entries found)

── Step 2 — Security ────────────────────────────────────────
  ✔ PASS  No path traversal detected

── Step 3 — index.html Detection ────────────────────────────
  ✔ PASS  index.html at ZIP root

── Step 4 — index.html Content ──────────────────────────────
  ✔ PASS  index.html has <!DOCTYPE html>
  ✔ PASS  GoLive Platform SDK integrated

── Step 5 — Game Assets ─────────────────────────────────────
  ℹ INFO  Thumbnail found: assets/thumbnail.png
  ℹ INFO  Banner found: assets/banner.jpg

  ALL CHECKS PASSED (14/14)
```

Fix any `✖ FAIL` before uploading. `⚠ WARN` items won't block upload but review them.

> The validator does **not** check relative vs absolute asset paths — you must verify this manually by opening your built `index.html` and confirming all `src=` and `href=` attributes use relative paths.

---

## 8. Upload Your Game Bundle

```http
POST /api/v1/developer/games/{gameIdOrSlug}/upload-bundle
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <your-game.zip>
```

**cURL example:**
```bash
curl -X POST \
  "https://golive-platform.netlify.app/api/v1/developer/games/my-awesome-game/upload-bundle" \
  -H "Authorization: Bearer YOUR_DEV_TOKEN" \
  -F "file=@./my-game.zip"
```

**Successful response:**
```json
{
  "message": "HTML5 game bundle uploaded, verified, and stored successfully.",
  "iframeUrl": "/api/v1/games/my-awesome-game/play/index.html",
  "bundleStoredInDb": true,
  "sdkAutoInjected": false,
  "filesCount": 47,
  "game": {
    "iframeUrl": "/api/v1/games/my-awesome-game/play/index.html",
    "bundleVerifiedAt": "2026-09-23T00:00:00.000Z"
  }
}
```

**Interpret these fields:**

| Field | Expected | If wrong |
|-------|----------|----------|
| `bundleStoredInDb` | `true` | Re-upload — database write failed |
| `sdkAutoInjected` | `false` | `true` means SDK was missing — integrate it properly (§5) |
| `bundleVerifiedAt` | non-null timestamp | Never null on successful upload; null means something failed |

**Upload error codes:**

| HTTP | Error code | Cause | Fix |
|------|-----------|-------|-----|
| 400 | `ERR_INVALID_ZIP` | Not a valid ZIP file | Check your build output |
| 400 | `ERR_ZIP_EMPTY` | Archive has no files | Your build pipeline produced nothing |
| 400 | `ERR_MISSING_INDEX_HTML` | No `index.html` found | Check §4 — wrong folder level |
| 400 | `ERR_PATH_TRAVERSAL` | Unsafe `../` paths in ZIP | Malicious or broken build tool |
| 400 | `ERR_BUNDLE_DB_STORE_FAILED` | Storage write failed | Transient — retry upload |
| 413 | *(no body)* | ZIP exceeds server body limit | Split large assets; keep ZIP under 50 MB |

---

## 9. Upload Thumbnail & Banner Images

Upload your game's visuals. You can include them in the ZIP as `assets/thumbnail.*` / `assets/banner.*`, or upload separately:

```http
POST /api/v1/developer/games/{gameIdOrSlug}/upload-assets
Authorization: Bearer <token>
Content-Type: multipart/form-data

thumbnail: <image-file>   (PNG, JPEG, or WebP)
banner:    <image-file>   (PNG, JPEG, or WebP)
```

**cURL example:**
```bash
curl -X POST \
  "https://golive-platform.netlify.app/api/v1/developer/games/my-awesome-game/upload-assets" \
  -H "Authorization: Bearer YOUR_DEV_TOKEN" \
  -F "thumbnail=@./thumbnail.png" \
  -F "banner=@./banner.jpg"
```

| Asset | Recommended size | Ratio | Used for |
|-------|-----------------|-------|---------|
| Thumbnail | 400 × 300 px | 4:3 | Game catalog cards, search results |
| Banner | 1280 × 360 px | ~3.5:1 | Game detail page hero, featured carousel |

Both fields are optional per request — upload just one if needed.

---

## 10. Test Your Game End-to-End on the Platform

After uploading, test before submitting. **Do not submit without completing all steps here.**

### Step 1 — Test the live serve URL

Open in a browser (no login required):
```
https://golive-platform.netlify.app/api/v1/games/my-awesome-game/play/index.html
```

Your game should load and run completely. Open DevTools → **Network** tab — every request must return `200`. Any `404` means an asset has an absolute path — fix it (see §4).

### Step 2 — Test inside an iframe

Use this test page (save as `iframe-test.html` and open in a browser):
```html
<!DOCTYPE html>
<html>
<head>
  <title>GoLive iframe Test</title>
  <style>
    body { margin: 0; background: #111; display: flex;
           align-items: center; justify-content: center; min-height: 100vh; }
    iframe { border: none; }
  </style>
</head>
<body>
  <iframe
    src="https://golive-platform.netlify.app/api/v1/games/my-awesome-game/play/index.html"
    width="1280"
    height="720"
    allow="autoplay; fullscreen; gamepad; microphone"
    allowfullscreen>
  </iframe>
</body>
</html>
```

Check:
- [ ] Game loads without console errors
- [ ] No asset 404s in DevTools → Network
- [ ] All game features work (controls, audio, saves)
- [ ] Any `alert()` calls you made — confirm they're silently swallowed; replace with in-game UI
- [ ] Fullscreen button works (if your game has one)

### Step 3 — Test SDK persistence

1. Load the game and play for 30 seconds
2. Trigger a save (checkpoint, level complete, etc.)
3. Close the tab completely
4. Reopen the same URL
5. Confirm game resumes from saved state

**If using Safari**: progress will not persist across sessions in Safari's Intelligent Tracking Prevention mode. This is a browser limitation — the SDK handles it gracefully by falling back to a fresh guest session. Document this limitation for your players.

### Step 4 — Test at multiple resolutions

| Target | Resolution | How to test |
|--------|-----------|-------------|
| Desktop standard | 1280 × 720 | Default browser window |
| Desktop HD | 1920 × 1080 | Resize browser |
| Mobile (portrait) | 375 × 667 | DevTools device emulation |
| Mobile (landscape) | 667 × 375 | DevTools device emulation |

### Step 5 — Verify API readiness before submitting

```bash
curl https://golive-platform.netlify.app/api/v1/developer/games/my-awesome-game \
  -H "Authorization: Bearer YOUR_DEV_TOKEN"
```

All three must be true:
- `"iframeUrl"` — not null
- `"bundleVerifiedAt"` — not null  
- `"submissionStatus"` — `"DRAFT"`

---

## 11. Submit for Review

Once all testing is done:

```http
POST /api/v1/developer/games/{gameIdOrSlug}/submit
Authorization: Bearer <token>
```

**Success response:**
```json
{
  "message": "Game submitted for review successfully!",
  "game": {
    "submissionStatus": "PENDING_REVIEW",
    "submittedAt": "2026-09-23T00:00:00.000Z"
  }
}
```

**If submission is blocked** the API returns `400` with a specific message:

| Error message | Fix |
|--------------|-----|
| "You must upload an HTML5 game package (ZIP) before submitting" | Upload bundle first (§8) |
| "Your game bundle upload did not complete successfully. Please re-upload" | Re-upload ZIP — previous upload had storage error |
| "Game bundle not found in storage. Please re-upload your ZIP package" | Re-upload ZIP |

> Once submitted you cannot make changes until the review is complete. If your game is rejected, you can re-upload and re-submit after reading the reviewer's feedback.

---

## 12. Review Process & What Happens Next

After submission your game enters **PENDING_REVIEW**. Platform reviewers will:

1. Load your game in a browser
2. Play through the core gameplay loop
3. Verify it loads correctly inside the portal iframe
4. Check content against the [Content Policy (§14)](#14-content-policy)
5. Approve or reject with written feedback

**Typical review time**: 2–5 business days.

Check your submission status at any time:
```http
GET /api/v1/developer/games/{gameIdOrSlug}
Authorization: Bearer <token>
```

| `submissionStatus` | Meaning |
|--------------------|---------|
| `DRAFT` | Not submitted — you can still edit |
| `PENDING_REVIEW` | Under review — no changes allowed |
| `APPROVED` | Live for all players |
| `REJECTED` | Read `reviewFeedback` field and fix issues before re-submitting |

---

## 13. After Approval — Updating Your Game

To ship a bug fix or new version:

1. Upload the new bundle (`POST .../upload-bundle`) — overwrites the stored ZIP
2. Test the new version at the play URL
3. Re-submit (`POST .../submit`) — status returns to `PENDING_REVIEW`

**The currently approved version remains live** for players while the new version is under review. The new bundle goes live only after the second approval.

> **Metadata updates** (title, description, genre) can be done via `PUT /api/v1/developer/games/{id}` at any time — metadata changes do not require a new review cycle.

> [!IMPORTANT]
> **Player Progress Retention Across Updates**:
> Player progress records are tied to your game's unique ID and stored permanently in the platform database. When you push an update, existing players' save files are **not wiped or deleted**.
> Your new build **must** be backward-compatible with the save state JSON written by your previous version. Always follow the migration and schema versioning guidelines in [§5.1](#51-ensuring-player-progress--state-retention-across-game-updates) before deploying an update.

---

## 14. Content Policy

Games submitted to GoLive must comply with the following policy. Violations result in rejection.

### ✅ Accepted content

- Cartoon violence (no gore or graphic injury depictions)
- Mild fantasy combat
- Competitive and strategy games
- Puzzle, idle, and simulation games
- Sports and racing games
- Games with in-game economies (coins, gems, upgrades) — no real-money transactions
- Appropriate for ages 13+

### ❌ Not accepted

| Category | Detail |
|----------|--------|
| **Adult / explicit content** | Sexual content, nudity, or adult themes |
| **Graphic violence** | Gore, realistic injury, torture mechanics |
| **Hate content** | Any content targeting race, religion, gender, nationality, etc. |
| **Real-money gambling** | Games that use or simulate real-money gambling mechanics |
| **Misleading content** | Games that impersonate other titles or brands |
| **Malware / exploits** | Any attempt to escape the iframe, fingerprint users, or access unauthorised data |
| **Cryptocurrency** | Mining, wallets, NFTs, or token economies |
| **Unlicensed IP** | Games using copyrighted characters, music, or assets without rights |

> If you're unsure whether your game's content is acceptable, email us before investing significant development time.

---

## 15. Common Mistakes & Fixes

### ❌ Absolute asset paths — games load but assets 404

**Symptom**: Game loads (index.html serves), but images/audio/WASM are all 404.  
**Fix**: Set `base: './'` in Vite, `publicPath: './'` in Webpack, or `"homepage": "./"` in CRA's `package.json`. See §4.

### ❌ Missing `index.html` at root

**Symptom**: `400 ERR_MISSING_INDEX_HTML` on upload.  
**Fix**: Zip the *contents* of your dist folder, not the dist folder itself. `index.html` must be at the ZIP root or in exactly one top-level subfolder.

### ❌ Zipping the folder instead of its contents

**Symptom**: Validator passes but game doesn't load — nested `my-project/index.html` instead of `index.html`.
```bash
# WRONG — zips the folder, creating my-project/index.html inside:
zip -r my-game.zip ./dist

# RIGHT — zips the contents, index.html at root:
cd dist && zip -r ../my-game.zip .
```

### ❌ Hardcoded `localhost` URLs

**Symptom**: Game works locally, broken on the platform — assets or API calls go to `localhost`.  
**Fix**: Grep for `localhost:3000` in your built output. Use the SDK for all API calls — it auto-detects the base URL in production.

### ❌ Using `alert()` / `confirm()` / `prompt()`

**Symptom**: Dialogs that worked locally are silently ignored on the platform.  
**Fix**: These APIs are blocked in cross-origin iframes. Build custom in-canvas UI for all dialogs.

### ❌ `localStorage` used for game state — broken on Safari

**Symptom**: Progress saves fine in Chrome/Firefox but is lost every session in Safari.  
**Fix**: Never use `localStorage` directly for game progress. Use `Platform.saveGameProgress()` — the SDK handles cross-browser persistence correctly.

### ❌ Unity WebGL multithreading enabled

**Symptom**: Unity game crashes immediately in the iframe with a `SharedArrayBuffer` error.  
**Fix**: In Unity Player Settings → Publishing Settings, disable multithreading. Re-export and re-upload.

### ❌ SDK not initialised before calling login

**Symptom**: `Error: Platform not initialized` in console.  
**Fix**: `Platform.init()` must be called before any other SDK method. Always call it first in `DOMContentLoaded`.

### ❌ No fallback for empty progress on first play

**Symptom**: Game crashes on first play because `progress` is `{}`.  
**Fix**: Always guard against empty progress:
```js
const { progress } = await Platform.getGameProgress();
startGame(progress || defaultState);  // always provide defaults
```

### ❌ Breaking player saves when updating game (missing schema migration)

**Symptom**: After deploying a new game build, returning players lose their items or the game crashes reading undefined properties.  
**Fix**: Never assume newly introduced keys exist in saved state. Include `schemaVersion` and write migration fallbacks (see [§5.1](#51-ensuring-player-progress--state-retention-across-game-updates)).

### ❌ Saving only on window.onunload (progress lost on mobile)

**Symptom**: Desktop saves work, but players on phones lose progress when switching apps or closing tabs.  
**Fix**: Mobile browsers do not reliably fire `onunload`. Save incrementally at checkpoints, on level completion, and listen to `document.addEventListener('visibilitychange')`.

### ❌ Storing large binary or base64 assets in saveGameProgress()

**Symptom**: `413 Payload Too Large` error or slow network save times.  
**Fix**: `saveGameProgress()` is strictly for game progression metadata (levels, scores, inventory IDs). Keep payloads under 64 KB. Never store base64 images or canvas dumps.

### ❌ Game too small or overflows iframe

**Symptom**: Game is a tiny box, or scroll bars appear inside the iframe.  
**Fix**: Use fluid layout. On your game canvas:
```css
canvas {
  width: 100vw;
  height: 100vh;
  display: block;
}
body { margin: 0; overflow: hidden; }
```

### ❌ Audio plays immediately on load (blocked)

**Symptom**: No audio on Chrome/Firefox/Safari without a user interaction.  
**Fix**: Defer audio start until after a click or keypress:
```js
document.addEventListener('click', () => {
  if (audioContext.state === 'suspended') audioContext.resume();
}, { once: true });
```

---

## 16. Full Pre-Submission Checklist

Copy this into your team's tracker and complete every item.

### Build
```
[ ] vite.config.js has base: './'  (or webpack publicPath: './', or CRA homepage: './')
[ ] Built index.html uses relative asset paths (src="./assets/..." not src="/assets/...")
[ ] No hardcoded localhost:3000 or any localhost URLs in built output
[ ] ZIP structure: index.html is at root (or in exactly one top-level subfolder)
[ ] ZIP is under 50 MB
[ ] No alert() / confirm() / prompt() calls remain in the game code
[ ] Unity: multithreading is disabled before export
[ ] Godot: threads disabled in export settings
```

### SDK Integration & Save State Retention
```
[ ] Platform.init() called with correct gameId (your exact slug)
[ ] Platform.login() called — player object confirmed in DevTools console
[ ] Platform.getGameProgress() called to restore save state
[ ] Empty progress guarded: progress || defaultState
[ ] Save state includes schemaVersion and supports backward-compatible migrations
[ ] Platform.saveGameProgress() called at checkpoints, level completion, and on visibilitychange
[ ] Save payload verified under 64 KB (no base64 images or audio buffers)
[ ] Optimistic concurrency conflict handled gracefully if Error("Conflict") occurs
[ ] Platform.startSession() called when gameplay begins
[ ] Platform.endSession(seconds) called when gameplay ends
[ ] Platform.track() called for key game events
[ ] Upload response shows: sdkAutoInjected: false
```

### Upload
```
[ ] tools/validate-game-bundle.js passes all checks (✔ PASS, no ✖ FAIL)
[ ] upload-bundle response: bundleStoredInDb: true
[ ] upload-bundle response: bundleVerifiedAt is a timestamp (not null)
[ ] Thumbnail uploaded (400×300 PNG/JPEG/WebP)
[ ] Banner uploaded (1280×360 PNG/JPEG/WebP)
```

### End-to-end testing
```
[ ] Game loads at https://.../api/v1/games/<slug>/play/index.html — no console errors
[ ] All assets return HTTP 200 (zero 404s in DevTools Network tab)
[ ] Game plays through start-to-finish
[ ] Progress saves correctly — confirmed by closing tab and reopening (state restored)
[ ] Tested inside an iframe — not just the direct URL
[ ] Audio works after first user click
[ ] Game layout correct at 1280×720 (desktop)
[ ] Game layout correct at 375×667 (mobile via DevTools emulation)
```

### Content & metadata
```
[ ] Game content complies with Content Policy (§14) — no adult/gore/hate/gambling content
[ ] Title is final and correct
[ ] Description is 150–500 characters
[ ] Genre is set correctly
[ ] Orientation is set correctly (landscape / portrait / any)
[ ] No unlicensed copyrighted music, characters, or brand assets in the game
```

### Final gate
```
[ ] GET /api/v1/developer/games/<slug> shows:
    - iframeUrl is not null
    - bundleVerifiedAt is not null
    - submissionStatus is "DRAFT"
[ ] POST /api/v1/developer/games/<slug>/submit returns: submissionStatus: "PENDING_REVIEW"
```

---

## 17. Quick API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/v1/developer/register` | None | Create developer account |
| `POST` | `/api/v1/developer/login` | None | Get developer JWT (valid 24h) |
| `POST` | `/api/v1/developer/games` | Dev JWT | Create game listing |
| `GET` | `/api/v1/developer/games` | Dev JWT | List your games |
| `GET` | `/api/v1/developer/games/:id` | Dev JWT | Get game details + status |
| `PUT` | `/api/v1/developer/games/:id` | Dev JWT | Update metadata (no review) |
| `POST` | `/api/v1/developer/games/:id/upload-bundle` | Dev JWT | Upload ZIP bundle |
| `POST` | `/api/v1/developer/games/:id/upload-assets` | Dev JWT | Upload thumbnail & banner |
| `POST` | `/api/v1/developer/games/:id/submit` | Dev JWT | Submit for review |
| `GET` | `/api/v1/games/:slug/play/index.html` | None | Test your live game |
| `GET` | `/api/v1/games/:slug/play/:file` | None | Serve any file from bundle |

---

*Also see: [`sdk.md`](./sdk.md) — full SDK API reference · [`API_REFERENCE.md`](./API_REFERENCE.md) — complete REST API reference*
