# GoLive Platform — External Game Developer Reference & Integration Guide

Welcome to the **GoLive Platform**! This guide is for 3rd-party game developers and studios. It covers everything needed to build, package, test, and submit your HTML5 game.

- **Developer Console**: [https://golive-platform.netlify.app/developer](https://golive-platform.netlify.app/developer)  
- **Live Platform**: [https://golive-platform.netlify.app](https://golive-platform.netlify.app)  
- **Platform SDK**: `https://golive-platform.netlify.app/sdk/platform-sdk.js`  
- **SDK Version**: `1.5.0`

---

## 1. How the Game Should Be Built

Your game will run as a client-side HTML5 application. Follow these structural, CSS, and asset guidelines:

### A. ZIP Package Structure
Your submission must be a standard `.zip` archive (max **200 MB**). The `index.html` file **must reside at the root of the ZIP**:

```text
my-game.zip
├── index.html          <-- MUST be at the root (not inside a subfolder)
├── favicon.ico
├── css/
│   └── style.css
├── js/
│   └── game.js
└── assets/
    ├── sprites/
    │   └── player.png
    └── audio/
        └── jump.mp3
```

### B. Viewport & CSS Reset Clarity
Games are rendered inside a flexible container. Your `index.html` must include proper viewport metadata and CSS resets to prevent layout breaks, unwanted scrollbars, and mobile pinch-zoom distortion:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <!-- CRITICAL: Prevent mobile page zooming and scrolling -->
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
  <title>My Game</title>
  
  <style>
    /* CSS Reset for seamless viewport filling */
    * {
      box-sizing: border-box;
      -webkit-touch-callout: none;
      -webkit-user-select: none;
      user-select: none;
      margin: 0;
      padding: 0;
    }
    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden; /* No scrollbars */
      background-color: #000000;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    canvas {
      display: block;
      /* Responsive aspect ratio scaling */
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
  </style>
  
  <!-- GoLive Platform SDK -->
  <script src="https://golive-platform.netlify.app/sdk/platform-sdk.js"></script>
</head>
<body>
  <canvas id="gameCanvas"></canvas>
  <script src="js/game.js"></script>
</body>
</html>
```

### C. Art Assets & File Path Rules
- **Strictly Relative Paths**: All references to textures, audio, fonts, WASM, and JSON files **must be relative** (`./assets/hero.png` or `assets/hero.png`). Never use root-relative paths (`/assets/hero.png`), because games are served from a scoped subpath on our CDN.
- **Allowed Formats**:
  - Images: `.png`, `.jpg`, `.jpeg`, `.webp`, `.svg`, `.gif`
  - Audio: `.mp3`, `.ogg`, `.wav`, `.aac`, `.webm`
  - 3D & Models: `.glb`, `.gltf`, `.bin`
  - Code & Data: `.html`, `.js`, `.css`, `.json`, `.wasm`
  - Fonts: `.woff`, `.woff2`, `.ttf`, `.otf`
- **Prohibited Files**: The upload is rejected if the ZIP contains executables or libraries (`.exe`, `.dll`, `.so`, `.dylib`, `.jar`), shell scripts (`.sh`, `.bat`, `.cmd`, `.ps1`), server-side scripts (`.php`, `.asp`, `.jsp`, `.py`, `.rb`, `.pl`, `.lua`), or server config files (`.htaccess`).
- **Promotional Art for Catalog** (recommended sizes):
  - **Game Thumbnail Icon**: **480 × 270 px** (16:9, PNG/JPEG/WebP, < 200 KB).
  - **Hero Banner**: **1280 × 720 px** (16:9, PNG/JPEG/WebP, < 500 KB).

---

## 2. How the Game Should Run

Your game executes inside a sandboxed, responsive `<iframe>` with full GPU acceleration.

### A. Ready Signal (`GAME_READY`)
When your game has finished loading its assets and is ready to show, send this signal to the portal:

```javascript
window.parent.postMessage({ type: 'GAME_READY' }, '*');
```

*This dismisses the platform loading screen and reveals your game. Send it once your title screen is drawn, not before.*

### B. Access Is Checked Before Your Game Loads
The portal checks whether the player is allowed to play (free trial, favourite slot, or subscription) **before** it loads your game. If your game is running, the player is allowed to play it. You do not need to build any access check yourself.

### C. No Navigation Out of the Iframe
Do not try to navigate the parent page (`window.top.location`) or build an "exit to portal" button. The portal provides its own close/back controls around the game.

### D. Audio Autoplay Policy & User Gesture
Modern browsers (Chrome, Safari, iOS, Android) block WebAudio until a user gesture occurs.
- Implement a **"Tap to Play"** or **"Click to Start"** screen.
- In the click/touch event listener, resume your WebAudio context:
  ```javascript
  const startBtn = document.getElementById('start-btn');
  startBtn.addEventListener('click', async () => {
    if (audioContext && audioContext.state === 'suspended') {
      await audioContext.resume();
    }
    startGame();
  });
  ```

---

## 3. SDK Initialization & Player Identity

### A. Initialization
Call `Platform.init()` during your game's boot sequence, before using any other SDK feature:

```javascript
await Platform.init({ gameId: 'your-game-slug' });
```

> **Important**: `gameId` must exactly match the **slug** of your game in the Developer Console (e.g. `galaxy-strike`). If it does not match, saves and leaderboards will not work.

### B. Getting the Player
Call `Platform.login()` once after `init()`. It returns the signed-in player, or a guest player if the user is not signed in:

```javascript
const { player } = await Platform.login();
console.log('Player ID:', player.id);
console.log('Display Name:', player.displayName);
```

After login, `Platform.getPlayer()` returns the same player object synchronously.

### C. Can This Player Play the Game?
You do not need to check this. The portal decides whether the player can play (free trial, favourite slot, or subscription) **before** your game is loaded. If your game is running, the player is allowed to play.

If you want to offer extra content to paying members, you can read the player's subscription tier:

```javascript
const sub = await Platform.getSubscription();
// sub is null for free players, otherwise:
// { tier: 'PREMIUM' | 'ULTRA', isPremium: true, isUnlimited: boolean, expiresAt: string | null }
if (sub && sub.isPremium) {
  unlockBonusSkins();
}
```

---

## 4. Saving Progress & Cloud Storage

### Guidelines for Cloud Saves
- **Capacity**: Maximum **64 KB** per save (JSON). Larger saves are rejected.
- **Save Frequency**: Save at logical checkpoints (level complete, purchase made, boss defeated, game over). **Do NOT save every frame** — keep saves at least 5–10 seconds apart.
- **Schema Versioning**: Always include a `schemaVersion: number` in your save data so future game updates can read older saves.
- **Not every player can save**: Players on a **free trial** (who have not added the game to their favourites and have no subscription) can play but **cannot save**. Their save call will fail. Your game must keep running normally when a save fails — never block gameplay on a save.

### Saving Progress (`Platform.saveGameProgress`)
```javascript
const saveData = {
  schemaVersion: 1,
  level: 5,
  bestScore: 12500,
  coins: 450,
  unlockedCharacters: ['warrior', 'mage']
};

try {
  await Platform.saveGameProgress(saveData);
} catch (err) {
  // Save not allowed (e.g. trial player) or network error.
  // Log it and carry on — do not stop the game.
  console.warn('Cloud save failed:', err.message);
}
```

### Loading Progress (`Platform.getGameProgress`)
```javascript
let saved = null;
try {
  saved = await Platform.getGameProgress();
} catch (err) {
  console.warn('Could not load cloud save:', err.message);
}

if (saved && saved.progress) {
  restorePlayerState(saved.progress);
} else {
  // First time playing (or no save available) — start fresh
  initializeDefaultSave();
}
```

---

## 5. Leaderboards & Score Posting

Scores are posted to **leaderboards that belong to your game**. A game can have **several leaderboards** (for example `high-score`, `fastest-lap`, `weekly-challenge`).

### A. Create Your Leaderboards First
In the **Developer Console**, open the **Leaderboards** tab, pick your game from the dropdown, and click **+ Create Leaderboard**. For each one you set:
- **Name**: shown to players (e.g. *High Score*).
- **Slug**: the ID your code uses (e.g. `high-score`). Lowercase letters, numbers, `-` and `_` only. Unique within your game. **It cannot be changed later**, so choose carefully.
- **Reset Period**: `All-Time`, `Daily`, `Weekly`, or `Monthly`. Non-all-time boards start fresh each period (see the reset times below).
- **Metric**: `Highest Score Wins` (default) or `Lowest Time (Speedrun)` — for time boards, submit the time as a number (e.g. milliseconds) and the lowest value ranks first.
- **Max Score** (optional): any submission above this value is rejected (anti-cheat cap).

**Reset times** (all in **UTC**):

| Period | Resets at |
|---|---|
| Daily | Every day at 00:00 UTC (05:30 IST) |
| Weekly | Every Monday at 00:00 UTC (weeks run Monday–Sunday) |
| Monthly | The 1st of each month at 00:00 UTC |
| All-Time | Never |

> **Important**: Your game can only submit to leaderboards created for **its own** slug. Submitting to a slug that does not exist, or to a leaderboard that has been **deactivated**, returns an error.

The platform team may also add leaderboards to your game and share them with you; they appear in the same Leaderboards tab and work the same way.

You can list your game's active leaderboards from code:

```javascript
const boards = await Platform.getLeaderboards();
// [{ slug: 'high-score', name: 'High Score', description, period: 'weekly', metric: 'score', maxScore: 1000000 }, ...]
// period: 'alltime' | 'daily' | 'weekly' | 'monthly'    metric: 'score' (highest wins) | 'time' (lowest wins)
```

### B. Can a Player Post a Score in This Session?
**YES**, with `Platform.submitScore(leaderboardSlug, score, metadata?)`:

```javascript
try {
  const result = await Platform.submitScore('high-score', finalScore, { level: 7 });
  // result = { leaderboard: 'high-score', submitted: 8200, bestScore: 9100, rank: 4, improved: false }
  showRank(result.rank, result.bestScore);
} catch (err) {
  // e.g. unknown leaderboard, score over the cap, submitted too soon, player not signed in
  console.warn('Score not posted:', err.message);
}
```

- If you pass only a number — `Platform.submitScore(8200)` — the score goes to your game's **default leaderboard** (the first one you created).
- Players must be **signed in** to post scores. Guests can still play and view leaderboards.

### C. Can the Game Read the Leaderboard?
**YES.** Fetch the top players of any of your leaderboards (current period) and show them in your own UI:

```javascript
// Arguments: (leaderboard slug, number of entries — max 100)
const board = await Platform.getLeaderboard('high-score', 10);

board.entries.forEach(entry => {
  console.log('#' + entry.rank + ' ' + entry.displayName + ': ' + entry.score);
});

// The current player's own best score and rank in the current period
const me = await Platform.getMyRank('high-score');
// { leaderboard: 'high-score', rank: 4, score: 9100 }   (rank and score are null if no score yet)
```

**Response Structure**:
```typescript
interface LeaderboardResponse {
  leaderboard: {
    slug: string;
    name: string;
    period: string;     // 'alltime' | 'daily' | 'weekly' | 'monthly'
    metric: string;     // 'score' (highest wins) | 'time' (lowest wins)
    periodKey: string;  // current period, e.g. 'alltime', '2026-10-05', '2026-W41', '2026-10'
  };
  entries: LeaderboardEntry[];
}

interface LeaderboardEntry {
  rank: number;         // 1, 2, 3...
  playerId: string;
  displayName: string;  // e.g. "CosmicHero"
  avatarUrl?: string;
  score: number;        // the player's best score in this period
  submittedAt: string;  // ISO timestamp
}
```

### Guidelines for Scores
- **Best score only**: The platform keeps each player's **best** result per leaderboard (highest score, or lowest time on speedrun boards). Submitting a worse result never lowers their rank (`improved: false`).
- **Numbers only**: `score` must be a non-negative number (`>= 0`).
- **When to post**: On game over, level clear, or match end — not during play.
- **Rate limit**: One submission per player per leaderboard every **30 seconds**. Extra submissions are rejected.
- **Max score cap**: Scores above the leaderboard's Max Score are rejected.
- **Metadata**: Optional JSON object (e.g. level, time, character), max **2 KB**.
- **Player must be playing**: Scores are only accepted from players who have launched your game on the platform.
- **Always use `try/catch`**: A rejected score must never break or block the game.
- **Show the period**: On Daily/Weekly/Monthly boards, tell players when the board resets (e.g. "Weekly — resets Monday") so an empty board after a reset is not confusing.

---

## 6. Game Engine Export Guidelines

### Phaser / PixiJS / Vanilla HTML5
- In your bundler (Vite, Webpack, Rollup), ensure the base path is set to `./`:
  ```javascript
  // vite.config.js
  export default {
    base: './', // CRITICAL: generates relative asset URLs
  };
  ```

### Unity WebGL
1. In **Build Settings**, select **WebGL**.
2. In **Player Settings**:
   - Set **Compression Format** to **Gzip** or **Disabled** (Brotli requires custom decompression headers not supported on static hosts).
   - Target **WebGL 2.0**.
   - Strip unused code to keep bundle under 50 MB.
3. Place the GoLive SDK script tag inside your Unity WebGL template `index.html`.

### Godot Engine
1. Export using the **Web (HTML5)** preset.
2. In Project Settings, set Canvas resize mode to **2D Scale** or **Adaptive**.
3. Add the GoLive SDK script tag to your custom HTML export shell.

---

## 7. Submitting via the Developer Console

1. **Sign In**: Navigate to [https://golive-platform.netlify.app/developer](https://golive-platform.netlify.app/developer).
2. **Click Submit New Game**: Click **✨ Submit New HTML5 Game**.
3. **Fill in Metadata**:
   - **Title**: Display name (e.g., *Galaxy Strike*).
   - **Slug**: URL identifier (e.g., `galaxy-strike`). This is the `gameId` you pass to `Platform.init()`.
   - **Genre**: e.g. `Action`, `Strategy`, `Puzzle`, `Sports`, `Arcade`, `Idle`, or `Adventure`.
   - **Orientation**: `Landscape`, `Portrait`, or `Any`.
   - **Description**: A short paragraph (up to 2,000 characters) describing gameplay and features.
4. **Upload ZIP Archive**: Drag and drop your `.zip` bundle.
5. **Upload Artwork**:
   - Thumbnail: 480 × 270 px (PNG/JPEG/WebP).
   - Banner: 1280 × 720 px (PNG/JPEG/WebP).
6. **Sandbox Preview**: Test your game inside the live preview pane to verify asset loading, canvas scaling, and SDK handshakes.
7. **Submit for Review**: Click **Submit for Review** to queue your game for catalog publication.

---

## 8. Pre-Submission Quality Checklist

Before submitting, verify that:

- [ ] `index.html` is located at the root of the ZIP.
- [ ] CSS includes `html, body { width: 100%; height: 100%; overflow: hidden; margin: 0; }`.
- [ ] Viewport `<meta>` tag prevents unwanted mobile zooming.
- [ ] All asset paths are relative (`./assets/...`).
- [ ] `Platform.init({ gameId })` is called on startup, and `gameId` matches your slug exactly.
- [ ] `window.parent.postMessage({ type: 'GAME_READY' }, '*')` is sent when assets finish loading.
- [ ] Audio only plays after the first user touch/click.
- [ ] The game keeps working if a save or load fails (e.g. trial players cannot save).
- [ ] Cloud saves stay under 64 KB and include a `schemaVersion`.
- [ ] Leaderboards are created in the Developer Console, and scores are posted with `Platform.submitScore('<leaderboard-slug>', score)` inside `try/catch`.
- [ ] Game tested inside the **Developer Console Sandbox Preview**.
- [ ] Thumbnail (480×270 px) and Banner (1280×720 px) uploaded.

---

*GoLive Platform · 3rd-Party Developer Reference · SDK v1.5.0*
