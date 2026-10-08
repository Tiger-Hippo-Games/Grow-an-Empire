# Portal leaderboard (GoLive SDK 1.5.0)

The current contract is `common/GOLIVE_DEVELOPER_REFERENCE.md`, section 5. Real player rankings use the SDK leaderboard API. The `leaderboard_score` analytics event and the leaderboard object in saves are diagnostics and migration data; they do not post a score to the portal board.

## Developer Console setup required

For game slug `grow-an-empire`, create this board before sandbox testing:

| Setting | Value |
|---|---|
| Name | Campaign Progress |
| Slug | `campaign-progress` |
| Reset period | All-Time |
| Metric | Highest Score Wins |
| Max score | 2575 |

The slug must match `LEADERBOARD_SLUG` in `src/platform/adapters.ts`. It must be active and belong to this game. If a board already exists with a different slug, update that constant before packaging. Slugs cannot be renamed after creation. All-Time has no reset date; a future periodic board must show its period and reset time wherever it is displayed.

## Score and identity

Score is `highest campaign won * 100 + total best stars`, from 0 to 2575. Campaigns range from 1 to 25 and total stars from 0 to 75. A replay never removes stars. The platform retains each player's best score; do not implement a separate server ranking or rely on a client-provided timestamp to decide platform ties.

`Platform.init({ gameId: "grow-an-empire" })` precedes `Platform.login()`. The returned player id owns saves. The game uses the portal's `displayName` in the Realm board, escapes it as text, and falls back to username or Guest if it is malformed. Offline play uses You. Scores are submitted only for signed-in accounts; guests play normally without posting.

## Posting

At battle end, `src/platform/scoreSubmission.ts` sends the standing through the platform adapter:

```typescript
await Platform.submitScore("campaign-progress", score, {
  level, campaignId, totalStars, reachedAt
});
```

Metadata stays below 2 KB of UTF-8 JSON. Attempts are at least 30 seconds apart. Fast battle results coalesce to the highest pending score; duplicate or worse successful scores are skipped. Missing/deactivated boards, rejected scores, an old SDK, sign-in failures and permission failures never block the result screen or the next campaign. A later battle may retry a rejected result; there is no endless score retry loop.

The in-game Realm ranks the player against 1,008 seeded AI rajas. It is a separate single-player feature and must not be presented as the live player leaderboard. The portal displays the real board and owns its player names, ranks and best scores.

## Verification

- `?platform=mock&auth=email`: after a battle, the mock log records `submitScore`, `campaign-progress`, score and metadata.
- `?platform=mock`: guests have progress and AI Realm standings but no score submission.
- Unit tests cover slug selection, guests, rejected calls, byte caps, 30-second spacing and coalescing.
- Required live sandbox checks: registered player score appears under their portal name, guest posts are absent, a denied trial save does not stop play, and a replay cannot lower the platform best score.
