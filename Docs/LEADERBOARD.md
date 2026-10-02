# Leaderboard: what the game sends, and what the portal needs to build

Grow an Empire has 25 campaigns, played in order. A player's **level** is the highest campaign they have won, and the leaderboard ranks players by it. The GoLive SDK has no leaderboard call (common/SDK_REFERENCE.md), so the game puts each player's standing where the portal can read it, against the player id. The portal builds the board itself.

## The standing (game/leaderboard.ts)

| Field | Meaning |
|---|---|
| `level` | Highest campaign won, 0–25 |
| `campaignId` | That campaign's id, e.g. `campaign-7-wolfmoor` (`null` before the first win) |
| `campaignName` | Its name, e.g. `Wolfmoor` |
| `totalStars` | Best stars summed over all campaigns, 0–75 |
| `score` | `level × 100 + totalStars`, 0–2575. Level always decides first; among players on the same campaign, more stars rank higher |
| `reachedAt` | ISO time the score last went up. **Ties: whoever got there first ranks higher** |
| `schema` | 1 |

The score never goes down: a replay can only add stars.

**Ranking:** `score` descending, then `reachedAt` ascending. Show signed-in players only (`authType` `EMAIL` or `GOOGLE`; not `GUEST`).

## Where the game puts it

The same standing goes to two places. Use either one; using both lets one check the other.

### 1. The cloud save (always, every player)

Every `Platform.saveGameProgress()` call, which the portal stores per player for game `grow-an-empire`, now includes:

```json
{
  "playerId": "<the id from Platform.login()>",
  "campaignStars": { "campaign-1-first-muster": 3, "campaign-2-reedmarsh": 2 },
  "leaderboard": {
    "schema": 1, "level": 2, "campaignId": "campaign-2-reedmarsh", "campaignName": "Reedmarsh Crossing",
    "totalStars": 5, "score": 205, "reachedAt": "2026-10-02T10:15:00.000Z"
  }
}
```

It's written after every move and at the end of each campaign, so it's always current. Guests have it too, so if the portal keeps the same player id when a guest registers, their progress counts straight away.

Example query, if progress is a JSON column (adapt it to the portal's schema):

```sql
SELECT p.id, p.display_name,
       (gp.progress->'leaderboard'->>'level')::int        AS level,
       gp.progress->'leaderboard'->>'campaignName'         AS campaign,
       (gp.progress->'leaderboard'->>'totalStars')::int   AS stars,
       (gp.progress->'leaderboard'->>'score')::int        AS score,
       (gp.progress->'leaderboard'->>'reachedAt')::timestamptz AS reached_at
FROM game_progress gp
JOIN players p ON p.id = gp.player_id
WHERE gp.game_id = (SELECT id FROM games WHERE slug = 'grow-an-empire')
  AND p.auth_type <> 'GUEST'
  AND gp.progress ? 'leaderboard'
ORDER BY score DESC, reached_at ASC
LIMIT 100;
```

### 2. A `leaderboard_score` analytics event (signed-in players only)

`Platform.track("leaderboard_score", …)` is sent when a signed-in player's score goes up (after a campaign result) and once per visit (`reason: "visit"`), so players who registered after playing as guests appear without waiting for their next win:

```json
{ "player_id": "…", "display_name": "…", "auth_type": "EMAIL", "level": 2,
  "campaign_id": "campaign-2-reedmarsh", "campaign_name": "Reedmarsh Crossing",
  "total_stars": 5, "score": 205, "reached_at": "2026-10-02T10:15:00.000Z",
  "reason": "improved", "game_version": "0.2.4" }
```

Leaderboard from events: for each player, keep the row with the highest `score` (earliest `reached_at` on a tie).

## For the portal developers

- **Trust the token, not the payload.** Take the player from the request's access token. The `player_id` in the event and the `playerId` in the save are for convenience and cross-checking. A browser can send anything, so reject `level > 25`, `totalStars > 75`, `score` that isn't `level × 100 + totalStars`, and any `campaignId` whose number doesn't match `level`. The save also has the full `campaignStars` table, so the server can recompute the standing itself.
- **Names:** show the portal's current display name for the player id. `display_name` in the event is only a snapshot.
- **If the SDK gets a leaderboard call** (for example `Platform.submitScore(score, metadata)`), the game can switch to it in one place: `reportLeaderboard()` in `src/main.ts`. Nothing else in the game needs to change.

## Testing

- `?platform=mock&auth=email` on the dev server signs in as a registered mock player. After a win, `window.__goLiveMock.calls` has the `leaderboard_score` event, and `localStorage["grow-an-empire:mock-cloud"]` holds the save with `leaderboard`.
- `?platform=mock` (guest): the save has `leaderboard`, and no event is sent.
- Unit tests: `src/game/__tests__/leaderboard.test.ts`.
