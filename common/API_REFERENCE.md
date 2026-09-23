# Browser Gaming Platform — API Reference

**Base URL**: `https://golive-platform.netlify.app`  
**API Prefix**: `/api/v1`  
**Interactive Docs (local)**: http://localhost:3000/api/docs (Swagger UI)  
**OpenAPI JSON**: `docs/openapi.json`

> **Game developer?** See [`GAME_SUBMISSION_GUIDE.md`](./GAME_SUBMISSION_GUIDE.md) for a step-by-step walkthrough of the entire upload and submission flow.

---

## Authentication

All protected endpoints require:
```
Authorization: Bearer <accessToken>
```

Access tokens expire in **15 minutes**. Use the refresh endpoint to get a new one.

Rate limits apply globally (100 req/min) and tighter limits on auth endpoints (10/min).

---

## Public Endpoints (no token required)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/health` | Health check — `{ status, database, timestamp }` |
| `POST` | `/api/v1/auth/guest` | Create anonymous guest account |
| `POST` | `/api/v1/auth/register` | Register with email + password |
| `POST` | `/api/v1/auth/login` | Login with email + password |
| `POST` | `/api/v1/auth/refresh` | Exchange refresh token for new access token |
| `GET` | `/api/v1/auth/google` | Google OAuth redirect |

---

## Player Endpoints (token required)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/auth/logout` | Invalidate refresh token |
| `GET` | `/api/v1/me` | Get own player profile |
| `PUT` | `/api/v1/me` | Update display name, avatar, country, language |
| `GET` | `/api/v1/me/recent-games` | Last 10 played games |

---

## Games Endpoints (token required)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/games` | List all published games (filterable by genre) |
| `GET` | `/api/v1/games/featured` | Get featured games |
| `GET` | `/api/v1/games/:gameId` | Get single game by ID or slug |

**Query params for `GET /games`**:
- `genre` — filter by genre (`idle`, `strategy`, `platformer`, `puzzle`, `arcade`, `rpg`)
- `page` — page number (default: 1)
- `limit` — results per page (default: 20, max: 100)

---

## Progress Endpoints (token required)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/games/:gameId/progress` | Load player progress for a game |
| `PUT` | `/api/v1/games/:gameId/progress` | Save/update player progress |

**PUT body**:
```json
{
  "progress": { "level": 5, "coins": 1200 },
  "version": 3
}
```
- `progress`: opaque JSON blob — the platform stores but does not interpret it
- `version`: optional, for optimistic concurrency conflict detection

**Response 409**: version mismatch (client has stale data)

---

## Analytics Endpoint (token optional)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/analytics/events` | Track a gameplay event |

**POST body**:
```json
{
  "eventName": "level_completed",
  "gameId": "chess-empire",
  "sessionId": "uuid-v4",
  "properties": { "level": 5, "score": 1200 },
  "timestamp": "2026-08-17T12:00:00Z"
}
```
- Special events: `game_started` creates a session; `game_ended` closes it
- `gameId` can be either an ID or a slug

---

## Standard Response Envelope

**Success**:
```json
{
  "success": true,
  "data": { ... }
}
```

**Error**:
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  },
  "path": "/api/v1/games",
  "timestamp": "2026-08-17T12:00:00.000Z"
}
```

---

## Developer Endpoints

Developer tokens are separate from player tokens. Obtain one via `/developer/login`.

### Auth
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/developer/register` | Create a developer account |
| `POST` | `/api/v1/developer/login` | Get a developer JWT |

### Game Management
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/developer/games` | List all your games |
| `POST` | `/api/v1/developer/games` | Create a new game listing |
| `GET` | `/api/v1/developer/games/:id` | Get game details + submission status |
| `PUT` | `/api/v1/developer/games/:id` | Update game metadata (no review triggered) |
| `DELETE` | `/api/v1/developer/games/:id` | Delete a DRAFT game |

### Bundle & Asset Upload
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/developer/games/:id/upload-bundle` | Upload ZIP — validates, stores in DB, sets `bundleVerifiedAt` |
| `POST` | `/api/v1/developer/games/:id/upload-assets` | Upload thumbnail and/or banner image |

**Upload bundle** request: `multipart/form-data`, field name `file`, accepts `.zip`

**Upload assets** request: `multipart/form-data`, fields `thumbnail` and/or `banner` (PNG, JPEG, WebP)

**Upload bundle success response:**
```json
{
  "message": "HTML5 game bundle uploaded, verified, and stored successfully.",
  "iframeUrl": "/api/v1/games/my-game/play/index.html",
  "bundleStoredInDb": true,
  "sdkAutoInjected": false,
  "filesCount": 47,
  "game": {
    "iframeUrl": "/api/v1/games/my-game/play/index.html",
    "bundleVerifiedAt": "2026-09-23T00:00:00.000Z"
  }
}
```

### Submission
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/developer/games/:id/submit` | Submit for review — requires `iframeUrl` and `bundleVerifiedAt` to be set |

**Submission gates** (returns `400` if any fail):
1. `iframeUrl` must not be null (bundle must have been uploaded)
2. `bundleVerifiedAt` must not be null (upload must have succeeded)
3. Bundle asset must still exist in DB storage

### Game File Serving (Public — No Auth)
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/games/:slug/play/:file` | Serve any file from the stored game bundle (e.g. `index.html`, `assets/sprite.png`) |

This is the canonical URL your game runs at. Files are extracted on-demand from the ZIP stored in the database.

**Response headers:**
- `Content-Type` — correct MIME type for the file extension
- `X-Frame-Options: ALLOWALL` — allows embedding in iframes
- `Cache-Control: no-cache` for `index.html`; `max-age=86400` for assets

**404 response** (bundle missing):
```json
{
  "error": "Game bundle not found",
  "message": "The game files for this slug are not available...",
  "slug": "my-game"
}
```
