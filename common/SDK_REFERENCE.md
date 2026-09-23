# Browser Gaming Platform — SDK Documentation

**Package**: `@gaming-platform/sdk`  
**Version**: 1.0.0  
**Bundles**:
- `dist/platform-sdk.js` — IIFE bundle for `<script src>` tag (exposes `window.Platform`)
- `dist/index.esm.js` — ESM for bundlers / modern `<script type="module">`
- `dist/index.cjs.js` — CommonJS for Node.js

---

## Quick Start (Script Tag — Most Common)

```html
<!-- Load the SDK -->
<script src="platform-sdk.js"></script>

<script>
  // 1. Initialize once per page
  Platform.init({
    apiBaseUrl: 'http://localhost:3000/api/v1',
    gameId: 'chess-empire',              // your game's slug or ID
  });

  // 2. Authenticate (auto-creates a guest account on first visit)
  const { player } = await Platform.login();
  console.log('Welcome,', player.displayName);

  // 3. Load cloud save
  const { progress, version } = await Platform.getGameProgress();
  console.log('Saved state:', progress);

  // 4. Save progress
  await Platform.saveGameProgress({ level: 5, coins: 1200 });

  // 5. Track events
  Platform.track('level_completed', { level: 5, score: 1200 });
</script>
```

---

## ES Module (Bundler / Vite / Webpack)

```js
import Platform from '@gaming-platform/sdk';

Platform.init({
  apiBaseUrl: 'http://localhost:3000/api/v1',
  gameId: 'chess-empire',
});

const { player } = await Platform.login();
```

You can also import individual functions:
```js
import { init, login, saveGameProgress, track } from '@gaming-platform/sdk';
```

---

## API Reference

### `Platform.init(config)`

Must be called **once** before any other method. Restores a saved token from `localStorage` automatically.

```ts
Platform.init({
  apiBaseUrl: 'http://localhost:3000/api/v1',   // required
  gameId: 'chess-empire',                        // required — slug or ID
  storagePrefix: 'gp_',                          // optional (default: 'gp_')
});
```

---

### `Platform.login()` → `{ player, accessToken }`

Authenticates the player. On first visit, **automatically creates a guest account**. On subsequent visits, restores the saved session from `localStorage`. Falls back to a new guest account if the token has expired.

```js
const { player, accessToken } = await Platform.login();
// player.id, player.username, player.displayName, player.authType, ...
```

**Returns**: `{ player: PlayerInfo, accessToken: string }`

---

### `Platform.logout()`

Clears all stored tokens and player data from `localStorage`.

```js
Platform.logout();
```

---

### `Platform.getPlayer()` → `PlayerInfo`

Fetches the current player's profile from the server (network request).

```js
const player = await Platform.getPlayer();
```

---

### `Platform.currentPlayer()` → `PlayerInfo | null`

Returns the cached player without a network request. Returns `null` if not logged in.

```js
const player = Platform.currentPlayer();
if (player) console.log('Logged in as', player.displayName);
```

---

### `Platform.getGameProgress(gameId?)` → `GameProgressResult`

Loads the cloud save for the current game (or a specific `gameId`/slug). Returns `{ progress: {}, version: 0 }` if no save exists yet.

```js
const { progress, version } = await Platform.getGameProgress();
// or: await Platform.getGameProgress('chess-empire');
```

**Returns**: `{ gameId, progress, version, updatedAt? }`

---

### `Platform.saveGameProgress(progress, gameId?)` → `SaveResult`

Saves opaque game state to the cloud. Uses the version from the last `getGameProgress()` call for optimistic concurrency. Throws if the server detects a stale write (progress was changed elsewhere).

```js
await Platform.saveGameProgress({ level: 5, coins: 1200, items: ['sword'] });
// or for a different game: await Platform.saveGameProgress(data, 'ludo-empire');
```

**Returns**: `{ gameId, version, updatedAt }`

**Throws**: `Error("Conflict")` if another client saved a newer version first. Reload with `getGameProgress()` and retry.

---

### `Platform.track(eventName, properties?)`

Fire-and-forget event tracking. **Never throws** — analytics failures are silently ignored to avoid breaking gameplay.

```js
Platform.track('level_completed', { level: 5, score: 1200, duration: 48 });
Platform.track('item_purchased', { itemId: 'sword', coins: 300 });
```

---

### `Platform.startSession()` → `string`

Creates a new session ID, fires `game_started` to the analytics API, and returns the session ID. Call once when the game scene loads.

```js
const sessionId = Platform.startSession();
```

---

### `Platform.endSession(durationSeconds?)`

Fires `game_ended` to close the session. Call when the player exits or the game ends.

```js
Platform.endSession(120);   // 120 seconds played
// or without duration:
Platform.endSession();      // server calculates from session start time
```

---

### `Platform.currentSessionId()` → `string | null`

Returns the current session ID without a network call.

```js
const sid = Platform.currentSessionId();
```

---

### `Platform.getGames(filters?)` → `GameInfo[]`

Returns the list of all published games.

```js
const games = await Platform.getGames();
const strategyGames = await Platform.getGames({ genre: 'strategy' });
const featured = await Platform.getGames({ featured: true });
const results = await Platform.getGames({ search: 'empire' });
```

**Filters**: `{ genre?, featured?, search? }`

---

### `Platform.getRecentGames(limit?)` → `GameInfo[]`

Returns the current player's recently played games (default: last 10).

```js
const recent = await Platform.getRecentGames();
const last5 = await Platform.getRecentGames(5);
```

---

## Types

```ts
interface PlatformConfig {
  apiBaseUrl: string;       // e.g. 'http://localhost:3000/api/v1'
  gameId: string;           // slug or ID of the game
  storagePrefix?: string;   // localStorage key prefix (default: 'gp_')
}

interface PlayerInfo {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  authType: string;         // 'GUEST' | 'EMAIL' | 'GOOGLE'
  createdAt: string;
  lastLoginAt?: string;
}

interface GameInfo {
  id: string;
  slug: string;
  title: string;
  genre: string;
  thumbnailUrl?: string;
  bannerUrl?: string;
  launchUrl?: string;
  status: string;
  featured: boolean;
}

interface GameProgressResult {
  gameId: string;
  progress: Record<string, unknown>;  // your game's state — platform does not interpret this
  version: number;
  updatedAt?: string;
}

interface SaveResult {
  gameId: string;
  version: number;
  updatedAt: string;
}
```

---

## Full Integration Example

```html
<!DOCTYPE html>
<html>
<head><title>My Game</title></head>
<body>
<script src="platform-sdk.js"></script>
<script>
  const GAME_ID = 'chess-empire';

  async function initPlatform() {
    // Initialize
    Platform.init({
      apiBaseUrl: 'http://localhost:3000/api/v1',
      gameId: GAME_ID,
    });

    // Login (creates guest on first visit, restores on return)
    const { player } = await Platform.login();
    document.title = `Welcome ${player.displayName}`;

    // Load cloud save
    const { progress, version } = await Platform.getGameProgress();
    console.log('Resuming from level', progress.level || 1);

    // Start session tracking
    Platform.startSession();

    // --- your game starts here ---
    runGame(progress);
  }

  async function runGame(initialState) {
    let state = { ...initialState, level: (initialState.level || 0) + 1 };

    // Save periodically
    try {
      await Platform.saveGameProgress(state);
      Platform.track('level_completed', { level: state.level });
    } catch (e) {
      console.warn('Save conflict — reloading save');
      const fresh = await Platform.getGameProgress();
      state = fresh.progress;
    }

    // End session when done
    Platform.endSession(120);
  }

  initPlatform().catch(console.error);
</script>
</body>
</html>
```

---

## Error Handling

```js
try {
  await Platform.saveGameProgress(myState);
} catch (err) {
  if (err.message.includes('Conflict')) {
    // Another device saved newer progress — reload and merge
    const { progress, version } = await Platform.getGameProgress();
    const merged = { ...progress, ...myState };
    await Platform.saveGameProgress(merged);
  } else if (err.message.includes('Not authenticated')) {
    // Token expired — re-login
    await Platform.login();
    await Platform.saveGameProgress(myState);
  }
}
```

| Condition | Error message contains |
|-----------|----------------------|
| Not initialized | `"Platform not initialized"` |
| Not authenticated | `"Not authenticated"` |
| Version conflict | `"Conflict"` |
| Server error | HTTP status message |
