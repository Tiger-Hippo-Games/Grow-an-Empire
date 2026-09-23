# 🎮 GoLive Platform — Game Developer Integration Guide

**Version**: 1.1 · **Audience**: Game Developers publishing on GoLive Platform

> **Platform URLs**: Portal → https://golive-platform.netlify.app · Developer Console → https://golive-platform.netlify.app/developer

---

## Table of Contents

1. [Platform Overview](#1-platform-overview)
2. [Onboarding Steps](#2-onboarding-steps)
3. [Hosting Requirements](#3-hosting-requirements)
4. [SDK Integration](#4-sdk-integration)
5. [SDK API Reference](#5-sdk-api-reference)
6. [Analytics & Events](#6-analytics--events)
7. [Save Data Format](#7-save-data-format)
8. [Game Submission Checklist](#8-game-submission-checklist)
9. [FAQ](#9-faq)

---

## 1. Platform Overview

GoLive Platform is a browser-based gaming platform that hosts HTML5 / Three.js / WebGL games inside an iframe. Games are hosted directly on the platform's CDN (Netlify) and embedded into the portal.

```
Player Browser
 └── GoLive Platform (https://golive-platform.netlify.app)
      └── <iframe src="https://golive-platform.netlify.app/games/your-game/index.html">
           └── Your Game (index.html + assets)
```

**What the platform provides:**
- 🔐 Player identity (guest + registered accounts)
- ☁️ Cloud saves (per-player, per-game JSON blob)
- 📊 Session & analytics tracking
- 🏆 Leaderboard-ready infrastructure
- 💰 In-game offer delivery (optional)
- 🎯 A/B experiments & feature flags (optional)

---

## 2. Onboarding Steps

> **Developer Console**: https://golive-platform.netlify.app/developer

### Step 1 — Register as a Developer

1. Go to https://golive-platform.netlify.app/developer
2. Click **"Register Studio"** and fill in your name, studio name, and email
3. After logging in, your Developer API Key is shown in the header

### Step 2 — Create a New Game Submission

1. Click **"✨ Submit New HTML5 Game"** to open the wizard
2. Fill in:
   | Field | Required | Notes |
   |-------|----------|-------|
   | Title | ✅ | Display name on the portal |
   | Slug | ✅ | Unique URL-safe identifier. Used in URLs: `/games/your-slug` |
   | Genre | ✅ | action, strategy, puzzle, idle, platformer, racing, sports |
   | Description | ✅ | Min 50 chars. Shown on game detail page |
   | Orientation | ✅ | `landscape` / `portrait` / `any` |
   | Tags | — | Comma-separated. e.g. `multiplayer, 1v1` |

3. Your game is saved as **DRAFT** automatically after Step 1 of the wizard.

### Step 3 — Upload Your Game ZIP

- Zip your game folder: `index.html` must be at the **root** of the ZIP
- Upload via wizard Step 2 (max 200MB)
- Optionally upload thumbnail (**480×270 px**, 16:9) and banner (**1280×720 px**, 16:9)
- The Platform SDK (`platform-sdk.js`) is **automatically injected** into your bundle

### Step 4 — Test in the Developer Sandbox

- Step 3 of the wizard shows a live sandbox iframe of your game
- Verify: game loads, SDK connects, saves work, mobile layout is correct
- Check the SDK event log panel for any errors

### Step 5 — Submit for Review

- Click **"Submit for Review"** when satisfied
- A platform admin will test-play and either **approve** (game goes PUBLISHED) or **reject** (with written feedback)
- You will see the status in the **My Games** tab

> **Publishing**: Developers cannot publish games directly. All games go through admin review.
> Typical review time: within 48 hours.

---

## 3. Hosting Requirements

### 3.1 HTTPS (Required)

Your game **must** be served over `https://`. HTTP URLs are blocked by browsers due to mixed-content policy — the portal runs on HTTPS and cannot embed HTTP iframes.

```
✅  https://cdn.yourdomain.com/games/chess-empire/index.html
❌  http://cdn.yourdomain.com/games/chess-empire/index.html
```

### 3.2 Hosting Requirements

The platform hosts your game directly on Netlify CDN after you upload your ZIP. You do **not** need to self-host your game separately.

For **local development** only: run your game on `http://localhost:PORT`, upload to the platform as DRAFT, and use the sandbox in the Developer Console to test.

If you choose to **self-host** (advanced):

### 3.3 CORS Headers

Your server/CDN must allow cross-origin requests from the portal:

```
Access-Control-Allow-Origin: https://golive-platform.netlify.app
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type
```

### 3.4 iframe Embedding (X-Frame-Options / CSP)

Do **NOT** set headers that block iframe embedding:

```
# ❌ These will break your game in the portal:
X-Frame-Options: DENY
X-Frame-Options: SAMEORIGIN

# ✅ Use Content Security Policy instead to allow only trusted origins:
Content-Security-Policy: frame-ancestors 'self' https://golive-platform.netlify.app
```

### 3.5 Asset Size & Load Time

- Keep initial bundle under **5 MB** for a good mobile experience
- Use progressive loading for large assets
- Supported formats: HTML5, WebGL, Three.js, Phaser, Unity WebGL, Godot Web

---

## 4. SDK Integration

The Platform SDK is **automatically injected** into your game bundle when you upload a ZIP file. For local development, download `platform-sdk.js` from the Developer Console and include it in your game.

Full SDK reference: [`browser-gaming-backend/docs/sdk.md`](../browser-gaming-backend/docs/sdk.md)

### 4.1 Local Development Setup

```html
<!-- For local development only — SDK is auto-injected in production -->
<script src="platform-sdk.js"></script>
```

### 4.2 Full Integration Example

```javascript
(async () => {
  // 1. Initialize — call once at game start
  Platform.init({
    apiBaseUrl: '/api/v1',   // Same-origin — works on localhost and production
    gameId: 'your-game-slug',   // Must match the slug set in the Developer Console
  });

  // 2. Authenticate — resolves once the portal sends the player token
  //    This is non-blocking: if the portal doesn't respond in 3s, falls back to guest.
  const { player } = await Platform.login();
  console.log('Playing as:', player.displayName, '| authType:', player.authType);

  // 3. Load cloud save for this player
  const { progress } = await Platform.getGameProgress();
  if (progress) {
    // Restore game state from cloud
    loadGameState(progress); // your function
  } else {
    startFreshGame(); // no save found
  }

  // 4. Start session tracking (required for analytics)
  Platform.startSession();

  // 5. During gameplay — auto-save at checkpoints
  await Platform.saveGameProgress({
    level: 5,
    score: 1200,
    inventory: ['sword', 'shield'],
    checkpoint: 'world_2_boss',
  });

  // 6. Track events (optional — powers AI analytics)
  Platform.track('level_completed', { level: 5, score: 1200, time_seconds: 142 });

  // 7. On game exit / tab close — end session
  window.addEventListener('beforeunload', () => {
    Platform.endSession(secondsPlayed); // pass total seconds played this session
  });

  // Also end session when the portal sends a message (player navigates away)
  window.addEventListener('message', (e) => {
    if (e.data?.type === 'GP_SESSION_END') {
      Platform.endSession(secondsPlayed);
    }
  });
})();
```

### 4.3 Token Handoff Flow

The portal uses `postMessage` to securely pass auth tokens to your game:

```
Portal iframe load ──→ Game calls Platform.login()
                           └── SDK sends  postMessage({ type: 'GP_REQUEST_TOKEN' })
                           └── Portal responds postMessage({ type: 'GP_TOKEN', accessToken, refreshToken })
                           └── SDK stores tokens, authenticates player
                           └── Platform.login() resolves with { player }
```

This works cross-origin safely. Your game does not need to handle token handoff manually.

---

## 5. SDK API Reference

### `Platform.init(config)`

Initialize the SDK. Call **once** before any other method.

```typescript
Platform.init({
  apiBaseUrl: string,  // API base URL: '/api/v1' (same-origin, works on localhost and production)
  gameId: string,      // Your game slug (must match Developer Console slug)
})
```

---

### `Platform.login()` → `Promise<{ player: PlayerInfo }>`

Authenticate the current player. Returns the player profile.

```typescript
interface PlayerInfo {
  id: string
  username: string
  displayName: string
  authType: 'GUEST' | 'EMAIL' | 'GOOGLE'
  avatarUrl?: string
  createdAt: string
}
```

> ⚠️ Always `await` this before accessing player data or cloud saves.

---

### `Platform.getGameProgress()` → `Promise<{ progress: object | null }>`

Load the player's cloud save for this game.

```javascript
const { progress } = await Platform.getGameProgress();
// progress is null if no save exists yet
// progress is your previously-saved JSON object if it exists
```

---

### `Platform.saveGameProgress(data)` → `Promise<void>`

Save the player's progress to the cloud.

```javascript
await Platform.saveGameProgress({
  level: 10,
  score: 99500,
  unlockedItems: ['fire_sword', 'dragon_armor'],
  settings: { music: 0.8, sfx: 1.0 },
});
```

**Constraints:**
- Any valid JSON object
- Max **64 KB** per player per game
- Automatically versioned (last-write-wins; no conflict resolution)
- Called automatically debounced — safe to call every few seconds

---

### `Platform.startSession()` → `void`

Begin a tracked play session. Call after `login()`. Required for DAU/MAU analytics.

---

### `Platform.endSession(durationSeconds)` → `void`

End the current session. Call on tab close / game over / player exit.

```javascript
Platform.endSession(142); // player played for 142 seconds
```

---

### `Platform.track(eventName, properties?)` → `void`

Track a custom analytics event. Powers the Admin Console's AI analytics.

```javascript
Platform.track('level_completed', {
  level: 5,
  score: 1200,
  time_seconds: 142,
  deaths: 3,
});

Platform.track('item_purchased', {
  item: 'fire_sword',
  currency: 'gold',
  amount: 500,
});

Platform.track('game_over', {
  level: 5,
  reason: 'fell_into_void',
  score: 450,
});
```

**Recommended standard events:**

| Event | When to fire | Key properties |
|-------|-------------|----------------|
| `game_start` | Player starts a new game | `difficulty`, `mode` |
| `level_start` | Player enters a level | `level`, `attempt_number` |
| `level_completed` | Level cleared | `level`, `score`, `time_seconds` |
| `level_failed` | Player failed | `level`, `reason`, `attempt_number` |
| `game_over` | Game ended | `final_score`, `level_reached` |
| `item_purchased` | In-game purchase | `item`, `currency`, `amount` |
| `tutorial_completed` | Tutorial done | `step_count`, `time_seconds` |
| `settings_changed` | Player changes settings | `setting`, `value` |

---

## 6. Analytics & Events

All events tracked via `Platform.track()` are visible in the Admin Console under **Analytics → Games**.

The platform's **AI Ops** module automatically analyzes:
- Retention curves (D1, D7, D30)
- Drop-off levels (where players quit)
- Session duration trends
- Conversion funnels

No additional setup required — just fire events consistently.

---

## 7. Save Data Format & Game Update Compatibility

Progress is stored permanently in the platform database as a JSON object tied to your game's unique ID. When your game is updated, the player's saved state is **preserved**, so your game must safely load and migrate older save states.

**✅ Good save structure:**
```json
{
  "schemaVersion": 2,
  "level": 10,
  "score": 99500,
  "lastCheckpoint": "world_3_start",
  "inventory": ["fire_sword", "dragon_armor"],
  "unlockedWorlds": ["world_1", "world_2"],
  "settings": { "music": 0.8, "sfx": 1.0, "language": "en" },
  "statistics": { "totalDeaths": 12, "playtimeSeconds": 3600 }
}
```

**❌ What to avoid:**
- 🚫 Don't store large binary/base64 data (screenshots, canvas dumps, sound files)
- 🚫 Don't store full game assets or maps (keep payload under 64 KB)
- 🚫 Don't store auth tokens, API keys, or secrets
- 🚫 Don't delete or rename existing keys without backward-compatible fallbacks

### Schema Migration Pattern (Ensuring Progress Across Game Updates)

```javascript
function parsePlayerProgress(raw) {
  const CURRENT_VERSION = 2;
  const state = raw || {};

  // Migration for players who played version 1
  if (!state.schemaVersion || state.schemaVersion < 2) {
    state.unlockedWorlds = state.unlockedWorlds || ['world_1'];
    state.schemaVersion = 2;
  }

  return {
    level: state.level ?? 1,
    score: state.score ?? 0,
    inventory: state.inventory ?? [],
    unlockedWorlds: state.unlockedWorlds ?? ['world_1'],
    ...state,
  };
}
```

### Save Trigger Best Practices (Mobile & Web)
- Do **not** rely solely on `window.onunload` (mobile browsers often terminate iframes without firing it).
- Save at checkpoints, level completion, and significant inventory changes.
- Save on tab minimize/switch:
  ```javascript
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && window.myGameState) {
      Platform.saveGameProgress(window.myGameState);
    }
  });
  ```

---

## 8. Game Submission Checklist

Before clicking **"Submit for Review"**, verify every item:

### Hosting / Upload
- [ ] ZIP file has `index.html` at the **root** (not inside a subfolder)
- [ ] ZIP is under 200 MB
- [ ] `X-Frame-Options` is **not** set to `DENY` or `SAMEORIGIN`
- [ ] Game loads in under 5 seconds on a 10 Mbps connection

### SDK Integration
- [ ] `Platform.init()` is called with the correct `gameId` (matching slug)
- [ ] `Platform.login()` is awaited before accessing player data
- [ ] `Platform.startSession()` is called after login
- [ ] `Platform.endSession()` is called on game exit
- [ ] `Platform.saveGameProgress()` is called at key checkpoints
- [ ] `Platform.getGameProgress()` is called on game start to restore saves

### Functional Testing (Developer Sandbox)
- [ ] Game loads inside the portal's iframe sandbox
- [ ] Guest player can start and play
- [ ] Progress saves and loads correctly across page refreshes
- [ ] Game works on mobile (portrait mode if applicable)
- [ ] No browser console errors blocking gameplay

### Assets
- [ ] Thumbnail image uploaded (**480×270 px**, 16:9, JPEG/PNG under 200 KB)
- [ ] Banner image uploaded (**1280×720 px**, 16:9, JPEG/PNG under 500 KB)
- [ ] Game description is accurate and engaging (min 50 chars)
- [ ] Tags are set for discoverability

### Developer Console
- [ ] Slug is correct (lowercase, hyphenated, URL-safe)
- [ ] Genre is accurate
- [ ] Orientation is set correctly (`landscape` / `portrait` / `any`)
- [ ] Sandbox test confirmed game plays correctly

---

## 9. FAQ

**Q: My game shows a blank screen in the portal iframe. What's wrong?**

Check these in order:
1. Open browser DevTools → Console. Look for `Mixed Content` or `Refused to frame` errors.
2. Verify `X-Frame-Options` is not set to DENY/SAMEORIGIN in your server headers.
3. Check the Developer Console sandbox for SDK error logs.
4. Ensure your `index.html` is at the root of the uploaded ZIP.

---

**Q: Players can't save progress — `Platform.saveGameProgress()` returns an error.**

- Ensure `Platform.login()` was awaited before saving.
- Ensure the `gameId` in `Platform.init()` exactly matches the slug set in the Developer Console.
- Check the sandbox SDK log panel for authentication errors.

---

**Q: Can I test locally before uploading?**

Yes. Run your game locally on `http://localhost:XXXX`, self-host `platform-sdk.js` alongside your `index.html`, and test with `apiBaseUrl: 'http://localhost:3000/api/v1'` pointing at the local backend. For portal iframe testing, upload your ZIP as a DRAFT and use the Developer Console sandbox.

---

**Q: My game supports both mobile and desktop. Which orientation should I choose?**

Choose **`any`** — the portal will not enforce any specific orientation. Your game is responsible for adapting its layout to the viewport. Use CSS `@media (orientation: portrait)` and `(orientation: landscape)` to handle both.

---

**Q: Can I use Unity WebGL / Godot / Phaser?**

Yes. Any game engine that exports to browser (HTML + JS/WASM) works. The SDK is vanilla JavaScript — the platform auto-injects it into your `index.html`. For Unity WebGL, the injection is added to your game's entry HTML file.

---

**Q: How do I update my game after it's been published?**

In the Developer Console, go to **My Games**, click on your game, and upload a new ZIP bundle. The updated game goes through review again before going live.

---

**Q: What is the 6-month Favourite lock?**

When a player adds a game as a Favourite, they cannot change it for 6 calendar months. This is a platform business rule enforced server-side. Design your game experience knowing that Favouriting represents a long-term commitment from the player. The `favouriteChangeEligibleAt` field in the `/player/my-games` API response indicates when the lock expires.

---

## Platform Business Rules

### Access State Vocabulary

The platform uses the following canonical access states in the `/games/:slug/access` API response:

| `accessState` field | Player-facing meaning |
|---|---|
| `TRY_AVAILABLE` | Player has one free trial play available |
| `REPLAY_DENIED` | Free trial used — must Favourite or subscribe |
| `FAVOURITE` | Player has this as a Favourite — unlimited play |
| `SUBSCRIPTION_ACCESS` | Active subscription grants access |

### Asset Specifications

| Asset | Dimensions | Format | Max Size |
|-------|-----------|--------|----------|
| Thumbnail | **480×270 px** (16:9) | JPEG / PNG | 200 KB |
| Banner | **1280×720 px** (16:9) | JPEG / PNG | 500 KB |

---

## Support

| Issue | Where to go |
|-------|---------|
| Developer Console access | https://golive-platform.netlify.app/developer |
| SDK / API issues | Check `browser-gaming-backend/docs/sdk.md` and `docs/api.md` |
| Platform status | https://golive-platform.netlify.app |

**SDK Reference**: [`docs/sdk.md`](browser-gaming-backend/docs/sdk.md)  
**API Reference**: [`docs/api.md`](browser-gaming-backend/docs/api.md)  
**Portal**: https://golive-platform.netlify.app  
**Developer Console**: https://golive-platform.netlify.app/developer

---

*Last updated: September 2026 · GoLive Platform Team*
