# 🔧 GoLive Platform — Game Conversion Guide (HTML5 / Three.js → Platform-Ready)

**Version**: 1.1 · **Audience**: Game developers with existing HTML5 / Three.js games  
**Companion to**: `GAME_DEVELOPER_GUIDE.md`

> **Purpose of this document**  
> You have a working HTML5/Three.js game. This guide tells you *exactly* what to change to make it run correctly inside the GoLive platform's iframe panel, connect to the Platform SDK, and pass the submission checklist — with the minimum possible code changes.

> **Platform URLs**  
> - **Portal (players)**: https://golive-platform.netlify.app  
> - **Developer Console**: https://golive-platform.netlify.app/developer  
> - **Admin Console** *(internal only)*: https://golive-platform.netlify.app/admin  
> - **API** (same-origin, no CDN prefix needed): `/api/v1`

---

## Table of Contents

1. [How the Portal Hosts Your Game](#1-how-the-portal-hosts-your-game)
2. [The Viewport & Layout Contract](#2-the-viewport--layout-contract)
3. [Step-by-Step Conversion Checklist](#3-step-by-step-conversion-checklist)
4. [SDK Integration — Minimal Drop-In Template](#4-sdk-integration--minimal-drop-in-template)
5. [Three.js Specific Adaptations](#5-threejs-specific-adaptations)
6. [postMessage Events Reference](#6-postmessage-events-reference)
7. [Responsive Canvas: Fill the iframe Perfectly](#7-responsive-canvas-fill-the-iframe-perfectly)
8. [Save Data Design for Your Game Type](#8-save-data-design-for-your-game-type)
9. [Analytics Events Cheatsheet](#9-analytics-events-cheatsheet)
10. [Common Conversion Problems & Fixes](#10-common-conversion-problems--fixes)
11. [Before-and-After: index.html Diff](#11-before-and-after-indexhtml-diff)
12. [Local Testing Workflow](#12-local-testing-workflow)
13. [Final Submission Checklist](#13-final-submission-checklist)

---

## 1. How the Portal Hosts Your Game

Your game runs inside a `<iframe>` that fills the portal's game panel. Here is the exact nesting:

```
Player's Browser Window
  └── GoLive Platform  (https://golive-platform.netlify.app)
        ├── Top Nav bar         ← 44 px tall, belongs to the portal
        └── Game Panel          ← 100% of remaining viewport height
              └── <iframe src="https://golive-platform.netlify.app/games/<slug>/index.html">
                    └── YOUR GAME (index.html + Three.js canvas + SDK)
```

**Key facts:**
- The iframe has `width: 100%` and `height: 100%` — it fills its container completely.
- The iframe container itself fills `100dvh − 44px` (the 44 px is the portal's top bar).
- Your game does **not** control the surrounding chrome (nav, back button, player name). Those are rendered by the portal.
- The portal communicates with your game exclusively via `window.postMessage`.
- There is **no shared DOM** — your game runs in its own browsing context.

---

## 2. The Viewport & Layout Contract

### What space does your game actually get?

| Context              | Width             | Height           |
|----------------------|-------------------|------------------|
| Desktop              | Full browser width | `100dvh − 44px` |
| Mobile (landscape)   | Full screen width  | `100dvh − 44px` |
| Mobile (portrait)    | Full screen width  | `100dvh − 44px` |

> **Rule**: Design your game canvas/viewport to **always fill 100% of `window.innerWidth` × `window.innerHeight`** inside the iframe. The portal has already subtracted its chrome.

### CSS baseline every game must have

```css
/* Required: remove all margin/padding that would cause scroll bars or offsets */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body {
  width: 100%;
  height: 100%;
  overflow: hidden;      /* NO scroll bars inside the iframe */
  background: #000;      /* Prevents white flash while loading */
}

/* If you have a canvas element */
canvas {
  display: block;        /* Removes 4px bottom gap from inline display */
  width: 100% !important;
  height: 100% !important;
}
```

---

## 3. Step-by-Step Conversion Checklist

Work through these steps **in order**. Each step has a checkbox you can tick off.

### Step 1 — Register your game in the Developer Console

- [ ] Log in to https://golive-platform.netlify.app/developer
- [ ] Click **"✨ Submit New HTML5 Game"** to open the submission wizard
- [ ] Fill in game title, slug (e.g. `chess-empire`), genre, and orientation
- [ ] Your game is saved as a **DRAFT** automatically

> **Note on publishing**: Developers cannot publish games directly.
> The workflow is: **DRAFT → Submit for Review → Admin Reviews → PUBLISHED**.
> After submitting, a platform admin test-plays the game and approves or rejects it.
> You will see feedback in the Developer Console under "My Games".

### Step 2 — Add the Platform SDK script

The Platform SDK (`platform-sdk.js`) is **automatically injected** into your game bundle when you upload your ZIP file. You do not need to manually add a CDN script tag.

For local development and testing, self-host the SDK file alongside your `index.html`:

```html
<head>
  ...
  <!-- For local development only — SDK is auto-injected in production -->
  <script src="platform-sdk.js"></script>
  <!-- Your game scripts follow below -->
</head>
```

Full SDK reference: see [`docs/sdk.md`](../browser-gaming-backend/docs/sdk.md)

### Step 3 — Fix your HTML/CSS for iframe

Open `index.html` and verify:

- [ ] `<html>` and `<body>` have no fixed pixel heights that could cause scroll
- [ ] No `X-Frame-Options` meta tag (these block iframe embedding)
- [ ] `<canvas>` element (if present) fills the body with no overflow
- [ ] Add the CSS baseline from Section 2 above

### Step 4 — Wrap your game init with Platform lifecycle

See the full template in Section 4.

- [ ] `Platform.init({ apiBaseUrl, gameId })` called first
- [ ] `await Platform.login()` called before any player-specific code
- [ ] `Platform.startSession()` called after login
- [ ] `Platform.getGameProgress()` called to restore saved state
- [ ] `Platform.saveGameProgress(state)` called at key checkpoints
- [ ] `Platform.endSession(seconds)` called on game over / exit

### Step 5 — Make your renderer fill the iframe

- [ ] Renderer size = `window.innerWidth × window.innerHeight` on init
- [ ] Add a `resize` listener that updates renderer + camera on window resize

### Step 6 — Upload ZIP and test in Developer Sandbox

- [ ] Zip your game folder (`index.html` + assets at the root of the ZIP)
- [ ] Upload via Developer Console → Submit Wizard → Step 2
- [ ] Use the **built-in sandbox** (Step 3 of wizard) to test-play inside the real portal frame
- [ ] Test on mobile viewport (Chrome DevTools → Toggle Device Toolbar)

### Step 7 — Submit for Review

- [ ] Verify the Final Submission Checklist (Section 13)
- [ ] Click **"Submit for Review"** in the Developer Console
- [ ] A platform admin will review and publish within 48 hours

---

## 4. SDK Integration — Minimal Drop-In Template

Paste the `initPlatform()` function into your game and call it before your existing `init()` or `main()` function.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>My Game</title>

  <!-- 1. Platform SDK — auto-injected in production; self-host for local dev -->
  <script src="platform-sdk.js"></script>

  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #000; }
    canvas { display: block; width: 100% !important; height: 100% !important; }
  </style>
</head>
<body>

  <!-- Your game's canvas or container -->
  <canvas id="game-canvas"></canvas>

  <!-- 2. Your existing game scripts -->
  <script src="game.js"></script>

  <script>
    // 3. Platform integration — add this block
    const GAME_ID = 'your-game-slug'; // CHANGE THIS to your slug from Admin Console

    let secondsPlayed = 0;
    let sessionTimer = null;

    async function initPlatform() {
      // A. Initialize SDK
      Platform.init({
        apiBaseUrl: '/api/v1',   // Same-origin — works on both localhost and production
        gameId: GAME_ID,
      });

      // B. Authenticate (auto-creates guest on first visit, restores on return)
      //    The portal pushes a token via postMessage automatically.
      //    login() handles the full handshake — just await it.
      let player;
      try {
        ({ player } = await Platform.login());
        console.log('[Platform] Logged in as:', player.displayName, '|', player.authType);
      } catch (err) {
        console.warn('[Platform] Login failed, continuing as offline guest:', err);
        // Do NOT block the game — let it run without cloud saves if auth fails
      }

      // C. Load cloud save (may be null on first play)
      let savedProgress = null;
      try {
        const result = await Platform.getGameProgress();
        savedProgress = result.progress; // Your previously saved JSON, or {}
      } catch (err) {
        console.warn('[Platform] Could not load save:', err);
      }

      // D. Start session (required for DAU/MAU analytics)
      Platform.startSession();

      // E. Start counting play time
      sessionTimer = setInterval(() => { secondsPlayed++; }, 1000);

      // F. NOW start your game, passing the restored save
      startYourGame(savedProgress); // call your existing game init here
    }

    // 4. Call this at checkpoints (level complete, after purchase, etc.)
    async function saveProgress(stateObject) {
      try {
        await Platform.saveGameProgress(stateObject);
      } catch (err) {
        if (err.message && err.message.includes('Conflict')) {
          // Another device has newer save — reload and merge
          const { progress } = await Platform.getGameProgress();
          await Platform.saveGameProgress({ ...progress, ...stateObject });
        } else {
          console.warn('[Platform] Save failed:', err);
        }
      }
    }

    // 5. End session — call on game over, exit button, or unload
    function endGameSession() {
      clearInterval(sessionTimer);
      Platform.endSession(secondsPlayed);
    }

    // Listen for portal's session-end signal (player navigates away in portal)
    window.addEventListener('message', (e) => {
      if (e.data && e.data.type === 'GP_SESSION_END') {
        endGameSession();
      }
    });

    // Also end session on tab/window close
    window.addEventListener('beforeunload', endGameSession);

    // 6. Boot everything
    initPlatform().catch(err => {
      console.error('[Platform] Init failed:', err);
      // Graceful fallback: start game without platform features
      startYourGame(null);
    });
  </script>
</body>
</html>
```

### Connecting saveProgress() to your game

```javascript
// BEFORE (old localStorage save)
localStorage.setItem('my_game_save', JSON.stringify(gameState));

// AFTER (platform cloud save — also keep localStorage as offline fallback)
localStorage.setItem('my_game_save', JSON.stringify(gameState)); // keep as fallback
saveProgress(gameState); // add this line
```

### Connecting endGameSession() to your game

```javascript
// Wherever your game has a "Game Over" or "Exit" state:
function onGameOver(finalScore) {
  Platform.track('game_over', { final_score: finalScore, level_reached: currentLevel });
  endGameSession();
  showGameOverScreen(finalScore);
}
```

---

## 5. Three.js Specific Adaptations

### 5.1 Renderer Setup — fill the iframe

```javascript
import * as THREE from 'three';

const renderer = new THREE.WebGLRenderer({
  canvas: document.getElementById('game-canvas'),
  antialias: true,
});

// Always use window dimensions — the iframe IS the window
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // cap at 2x for perf

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,  // aspect from window, not hardcoded
  0.1,
  1000
);
```

### 5.2 Resize Handler — critical for orientation changes

```javascript
function onWindowResize() {
  // Update camera
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  // Update renderer
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // If you have an EffectComposer or post-processing passes, resize those too:
  // composer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener('resize', onWindowResize);
```

### 5.3 Removing a fixed-size container div

Many standalone Three.js games wrap the canvas in a fixed-size `div`. Remove that and let the canvas fill the body:

```html
<!-- BEFORE (standalone game) -->
<div id="app" style="width: 800px; height: 600px;">
  <canvas id="game-canvas"></canvas>
</div>

<!-- AFTER (platform-ready) — remove the wrapper div entirely -->
<canvas id="game-canvas"></canvas>
```

And in your CSS:
```css
/* Remove any fixed pixel dimensions from canvas or its parent */
#game-canvas {
  display: block;
  width: 100%;
  height: 100%;
  /* Remove: width: 800px; height: 600px; */
}
```

### 5.4 Pointer Lock and Fullscreen

The portal's iframe already has the required `allow` attribute:

```html
<iframe allow="fullscreen; autoplay; microphone; gamepad" ...>
```

Pointer lock and fullscreen both work. You do NOT need to change your existing code.

> WARNING: Do NOT call `document.documentElement.requestFullscreen()` on load automatically. Browsers block unprompted fullscreen. Only call it in response to a user gesture (click/tap).

### 5.5 Audio Context

Keep your existing click-to-start-audio pattern:

```javascript
// Resume audio context on first user interaction
document.addEventListener('click', () => {
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
}, { once: true });
```

---

## 6. postMessage Events Reference

### Messages the Portal sends TO your game

| event.data.type   | When                                          | Payload                         |
|-------------------|-----------------------------------------------|---------------------------------|
| GP_TOKEN          | Response to SDK token request                 | { accessToken, refreshToken }   |
| GP_SESSION_END    | Player navigated away from game in portal     | (none)                          |
| GP_PAUSE          | Portal wants to pause (e.g. modal opened)     | (none) — optional to handle     |
| GP_RESUME         | Portal signals game can resume                | (none) — optional to handle     |

### Messages your game can send TO the Portal

| type              | When to send                                  | Payload                         |
|-------------------|-----------------------------------------------|---------------------------------|
| GP_REQUEST_TOKEN  | On startup (handled automatically by SDK)     | (none)                          |
| GP_GAME_READY     | Optional — when your game has fully loaded    | (none)                          |

### Listening for portal messages

```javascript
window.addEventListener('message', (event) => {
  switch (event.data && event.data.type) {
    case 'GP_SESSION_END':
      endGameSession();
      break;
    case 'GP_PAUSE':
      pauseGame();
      break;
    case 'GP_RESUME':
      resumeGame();
      break;
  }
});
```

---

## 7. Responsive Canvas: Fill the iframe Perfectly

### Pattern A — Full-window canvas (most Three.js games)

Your canvas is the entire viewport. Follow Section 5.

### Pattern B — Fixed-aspect-ratio canvas with letterboxing

If your game is designed for a fixed ratio (e.g. 16:9) and you want black bars rather than stretching:

```javascript
function resizeToFit(targetAspect) {
  targetAspect = targetAspect || (16 / 9);
  const windowAspect = window.innerWidth / window.innerHeight;
  let w, h;

  if (windowAspect > targetAspect) {
    // Window is wider than game — pillarbox (black bars on sides)
    h = window.innerHeight;
    w = Math.round(h * targetAspect);
  } else {
    // Window is taller than game — letterbox (black bars top/bottom)
    w = window.innerWidth;
    h = Math.round(w / targetAspect);
  }

  renderer.setSize(w, h);
  renderer.domElement.style.position = 'absolute';
  renderer.domElement.style.left = ((window.innerWidth - w) / 2) + 'px';
  renderer.domElement.style.top  = ((window.innerHeight - h) / 2) + 'px';

  camera.aspect = targetAspect;
  camera.updateProjectionMatrix();
}

window.addEventListener('resize', resizeToFit);
resizeToFit(); // call on init
```

### Pattern C — 2D Canvas game (non-Three.js)

```javascript
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

function resize() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  redraw(); // re-draw if needed
}

window.addEventListener('resize', resize);
resize();
```

---

## 8. Save Data Design for Your Game Type

Design your save object to match your genre. Keep it under **64 KB** and include `schemaVersion`.

### Puzzle / Level-based game
```json
{
  "schemaVersion": 1,
  "currentLevel": 12,
  "levelsCompleted": [1,2,3,4,5,6,7,8,9,10,11],
  "totalScore": 45200,
  "stars": { "1": 3, "2": 3, "3": 2 },
  "settings": { "sfx": 1.0, "music": 0.7 }
}
```

### Action / Arcade game
```json
{
  "schemaVersion": 1,
  "highScore": 99500,
  "lastScore": 4200,
  "totalGamesPlayed": 42,
  "unlockedCharacters": ["hero", "ninja"],
  "settings": { "sfx": 1.0, "music": 0.7, "difficulty": "normal" }
}
```

### Strategy / Idle game
```json
{
  "schemaVersion": 1,
  "resources": { "gold": 5200, "wood": 1200, "stone": 800 },
  "buildings": [
    { "id": "farm", "level": 3, "position": [2, 4] }
  ],
  "lastOnline": "2026-08-27T12:00:00Z",
  "playtimeSeconds": 7200
}
```

### Racing / Sports game
```json
{
  "schemaVersion": 1,
  "bestLapTimes": { "track_1": 92.4, "track_2": 118.7 },
  "unlockedTracks": ["track_1", "track_2"],
  "unlockedCars": ["car_basic", "car_sport"],
  "totalRaces": 15,
  "settings": { "sfx": 1.0, "music": 0.7, "graphics": "high" }
}
```

---

## 9. Analytics Events Cheatsheet

Fire these with `Platform.track(eventName, properties)`.

```javascript
// Game lifecycle
Platform.track('game_start',        { mode: 'solo', difficulty: 'normal' });
Platform.track('tutorial_start',    {});
Platform.track('tutorial_complete', { duration_seconds: 90 });
Platform.track('game_over',         { final_score: 4200, level_reached: 7, reason: 'time_up' });

// Level flow
Platform.track('level_start',     { level: 5, attempt: 1 });
Platform.track('level_complete',  { level: 5, score: 1200, time_seconds: 87, stars: 3 });
Platform.track('level_fail',      { level: 5, reason: 'fell_off', attempt: 2 });
Platform.track('checkpoint_hit',  { level: 5, checkpoint: 'midpoint' });

// Player actions
Platform.track('item_purchased',  { item: 'shield', currency: 'coins', amount: 300 });
Platform.track('item_used',       { item: 'potion', remaining: 2 });
Platform.track('powerup_picked',  { type: 'speed_boost', level: 3 });

// Engagement
Platform.track('settings_changed', { setting: 'music', value: 0.5 });
Platform.track('share_attempt',    { screen: 'game_over' });
Platform.track('ad_watched',       { placement: 'revive', reward: 'extra_life' });
```

---

## 10. Common Conversion Problems & Fixes

### Problem: White/grey flash before game loads
**Cause**: `body` background defaults to white.  
**Fix**: Add `body { background: #000; }` to your CSS.

---

### Problem: Scrollbars appear inside the iframe
**Cause**: Canvas or body overflows the iframe bounds.  
**Fix**: Add `html, body { overflow: hidden; }`. Check for any element with a fixed pixel height larger than the window.

---

### Problem: Canvas is only 300x150 (default browser size)
**Cause**: Three.js `renderer.setSize()` not called, or called before DOM is ready.  
**Fix**: Call `renderer.setSize(window.innerWidth, window.innerHeight)` inside `DOMContentLoaded` or after your script runs at end of `<body>`.

---

### Problem: Game appears stretched after browser resize
**Cause**: No `resize` event listener on `window`.  
**Fix**: Add the resize handler from Section 5.2.

---

### Problem: `Platform.login()` hangs / never resolves
**Cause**: SDK waits up to 3 seconds for portal to send token via postMessage. If tested outside the portal, token never arrives but SDK falls back to guest after timeout.  
**Fix**: Always test in the portal's preview. For direct testing, use the DRAFT mode preview link in the Admin Console.

---

### Problem: Game runs standalone but blank inside portal
**Causes and fixes:**
1. **Mixed content** — Your game is on HTTP, portal is on HTTPS. Fix: use HTTPS.
2. **X-Frame-Options header** — Your server blocks iframe. Fix: remove `X-Frame-Options: DENY` or `SAMEORIGIN`.
3. **CSP frame-ancestors** — Your Content-Security-Policy blocks the portal. Fix: add `frame-ancestors 'self' https://portal.gameportal.example`.
4. **CORS blocking assets** — Fonts, sounds, or images block. Fix: set correct `Access-Control-Allow-Origin` on your CDN.

---

### Problem: `Platform.saveGameProgress()` throws "Conflict"
**Cause**: Two devices or tabs saved simultaneously.  
**Fix**:
```javascript
try {
  await Platform.saveGameProgress(myState);
} catch (err) {
  if (err.message.includes('Conflict')) {
    const { progress } = await Platform.getGameProgress();
    await Platform.saveGameProgress({ ...progress, ...myState }); // merge
  }
}
```

---

### Problem: requestPointerLock fails inside iframe
**Confirmation**: The portal's iframe already has `allow="fullscreen; autoplay; microphone; gamepad"`. Pointer lock should work.  
**If still failing**: Ensure pointer lock is triggered by a direct user gesture (click/keypress), not from a setTimeout or Promise resolution.

---

### Problem: Audio does not play
**Cause**: Browser autoplay policy blocks audio context before interaction.  
**Fix**: Create your `AudioContext` inside a user gesture handler, or call `audioContext.resume()` on the first click/tap.

---

### Problem: Game resolution looks blurry on high-DPI screens
**Cause**: Renderer pixel ratio not set.  
**Fix**:
```javascript
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
```

---

## 11. Before-and-After: index.html Diff

### BEFORE (standalone game)

```html
<!DOCTYPE html>
<html>
<head>
  <title>My Awesome Game</title>
  <style>
    body { margin: 0; }
    canvas { display: block; }
  </style>
</head>
<body>
  <script src="three.min.js"></script>
  <script src="game.js"></script>
  <script>
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(800, 600);                    // FIXED SIZE - problem
    document.body.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(60, 800/600, 0.1, 1000); // FIXED ASPECT - problem

    function init() {
      const savedData = JSON.parse(localStorage.getItem('save') || '{}');
      startGame(savedData);
    }

    init();
  </script>
</body>
</html>
```

### AFTER (platform-ready)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <title>My Awesome Game</title>

  <!-- ADDED: Platform SDK -->
  <script src="https://cdn.gameportal.example/sdk/platform-sdk.js"></script>

  <style>
    /* UPDATED: CSS for iframe-fill */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #000; }
    canvas { display: block; width: 100% !important; height: 100% !important; }
  </style>
</head>
<body>
  <script src="three.min.js"></script>
  <script src="game.js"></script>
  <script>
    // UPDATED: Dynamic size instead of fixed
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);   // DYNAMIC
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.body.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,   // DYNAMIC ASPECT
      0.1, 1000
    );

    // ADDED: Resize handler
    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // ADDED: Platform integration
    const GAME_SLUG = 'my-awesome-game';  // your slug
    let secondsPlayed = 0;

    async function initPlatform() {
      Platform.init({ apiBaseUrl: 'https://api.gameportal.example/api/v1', gameId: GAME_SLUG });
      try { await Platform.login(); } catch(e) { console.warn('Auth failed, continuing offline'); }
      const result = await Platform.getGameProgress().catch(() => ({ progress: null }));
      Platform.startSession();
      setInterval(() => secondsPlayed++, 1000);

      // UPDATED: use cloud save instead of (or in addition to) localStorage
      const savedData = (result && result.progress) || JSON.parse(localStorage.getItem('save') || '{}');
      startGame(savedData);
    }

    window.addEventListener('message', e => {
      if (e.data && e.data.type === 'GP_SESSION_END') Platform.endSession(secondsPlayed);
    });
    window.addEventListener('beforeunload', () => Platform.endSession(secondsPlayed));

    initPlatform().catch(() => startGame({})); // graceful fallback
  </script>
</body>
</html>
```

---

## 12. Local Testing Workflow

### Option A — Test standalone first

1. Open `index.html` directly in Chrome (or run `npx serve .`)
2. Verify the canvas fills the window and resizes correctly
3. Open DevTools Console — no errors should appear

### Option B — Test inside the portal (recommended)

1. Start your game on a local server: `npx serve . -p 8080`
2. In the Admin Console, set your game's Iframe URL to `http://localhost:8080`
3. Open the portal at `http://localhost:5199` (or your portal dev URL)
4. Navigate to your game — it loads inside the portal's iframe
5. Open DevTools on the **portal page** to see postMessage events

### Option C — Simulate portal postMessage locally

If you cannot run the portal locally, simulate the token handoff:

```javascript
// Add this to your game's index.html ONLY during local dev testing
// REMOVE BEFORE DEPLOYING TO PRODUCTION
if (window.location.hostname === 'localhost') {
  setTimeout(() => {
    window.dispatchEvent(new MessageEvent('message', {
      data: {
        type: 'GP_TOKEN',
        accessToken: 'dev-test-token-replace-with-real',
        refreshToken: 'dev-refresh-token',
      }
    }));
  }, 100);
}
```

---

## 13. Final Submission Checklist

Before setting your game to **PUBLISHED**, every item must be checked.

### Layout & Viewport
- [ ] Canvas fills 100% x 100% of the iframe (no scroll bars, no white borders)
- [ ] `html, body { overflow: hidden }` is set
- [ ] Resize handler updates renderer size AND camera aspect ratio
- [ ] Game tested on 1920x1080, 1366x768, and 390x844 (iPhone) viewports
- [ ] No white/grey flash on load (`body { background: #000 }`)

### Platform SDK
- [ ] `Platform.init()` called first with correct `gameId` (must match Admin Console slug exactly)
- [ ] `await Platform.login()` resolves before any player-specific code
- [ ] `Platform.startSession()` called after login
- [ ] `Platform.getGameProgress()` called on startup to restore save
- [ ] `Platform.saveGameProgress(state)` called at level complete / checkpoints
- [ ] `Platform.endSession(seconds)` called on game over, exit, and `beforeunload`
- [ ] `GP_SESSION_END` postMessage handled to call `Platform.endSession()`
- [ ] `Platform.track('game_start', ...)` fired when game begins
- [ ] `Platform.track('game_over', ...)` fired when game ends

### Hosting
- [ ] Served over HTTPS (or `http://localhost:*` for DRAFT)
- [ ] No `X-Frame-Options: DENY` or `SAMEORIGIN` header
- [ ] `Content-Security-Policy: frame-ancestors` includes `https://golive-platform.netlify.app`
- [ ] Initial page load under 5 seconds on 10 Mbps

### Developer Console Submission
- [ ] Game slug is lowercase, hyphenated, URL-safe (set in wizard Step 1)
- [ ] Game ZIP uploaded (Step 2) — `index.html` must be at the root of the ZIP
- [ ] Thumbnail uploaded: **480×270 px**, 16:9, JPEG/PNG under 200 KB
- [ ] Banner uploaded: **1280×720 px**, 16:9, JPEG/PNG under 500 KB
- [ ] Genre, orientation (`landscape` / `portrait` / `any`), description, and tags are set
- [ ] Sandbox test (Step 3) — game runs correctly inside the platform iframe
- [ ] "Submit for Review" clicked — admin will approve or provide feedback

### Functional
- [ ] Guest player can start and play without signing in
- [ ] Progress saves and is restored correctly on page refresh
- [ ] No unhandled errors in browser DevTools Console
- [ ] Game works on Chrome, Safari (WebKit), and Firefox
- [ ] Mobile touch input works (if your game supports it)

---

## Quick Reference Card

```
YOUR GAME IFRAME
├── Size:         window.innerWidth x window.innerHeight
│                 (portal has already removed its 44px top bar)
├── No scroll:    html, body { overflow: hidden }
├── No flash:     body { background: #000 }
├── Resize:       window.addEventListener('resize', updateRendererAndCamera)
│
├── SDK CALLS (in order)
│   1. Platform.init({ apiBaseUrl, gameId })
│   2. await Platform.login()
│   3. Platform.startSession()
│   4. await Platform.getGameProgress()    -> restore save
│   5. Platform.saveGameProgress(state)   -> at checkpoints
│   6. Platform.endSession(seconds)       -> on game over / exit
│
└── postMessage to handle
    ├── GP_TOKEN       -> handled by SDK automatically
    └── GP_SESSION_END -> you call Platform.endSession()
```

---

## Platform Business Rules (Developer Reference)

Understand these rules so you can design your game experience accordingly:

### Access States

Every player has an **access state** for each game that determines whether they can play:

| Access State | API field | What it means |
|---|---|---|
| `TRY_AVAILABLE` | `accessState: 'TRY_AVAILABLE'` | Player has one free trial play remaining |
| `REPLAY_DENIED` | `accessState: 'REPLAY_DENIED'` | Free trial used — player must Favourite or subscribe |
| `FAVOURITE` | `accessState: 'FAVOURITE'` | Player added this as a Favourite — unlimited play |
| `SUBSCRIPTION_ACCESS` | `accessState: 'SUBSCRIPTION_ACCESS'` | Active subscription covers this game |

### 6-Month Favourite Lock

When a player adds a game as a Favourite, **they cannot change it for 6 calendar months**. Design your game experience knowing that:
- Favouriting is a meaningful, long-term commitment by the player
- Players are motivated to Favourite games they genuinely intend to play regularly
- The lock is enforced server-side — cannot be bypassed

### Daily Bonus

Players earn Gems from daily logins (3-day cycle: 100→150→250 Gems). Gems accumulate toward free Mini-Pack redemptions. Your game does not need to implement this — it is handled by the platform.

---

*Last updated: September 2026 · GoLive Platform Team*  
*Related documents: `GAME_DEVELOPER_GUIDE.md` (full SDK reference), `docs/sdk.md` (SDK API)*
