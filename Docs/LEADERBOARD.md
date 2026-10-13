# Strongest Player — production weekly leaderboard

Production configuration supplied on 2026-10-13: game slug `grow`, SDK leaderboard ID `strongplayer`, Weekly, Highest Score Wins, no maximum score. The platform resets the board every Monday at 00:00 UTC (05:30 IST). The official SDK script and SDK-selected API host remain unchanged.

## Score

One point per distinct campaign won: 0–25. Winning a replay, earning extra stars, or repeatedly losing after a prior win cannot increase or reduce that count. Stars still unlock campaigns and rank the separate single-player AI Realm. A new campaign win increases the score by exactly one. The platform keeps the player's best submitted count in the current week; it owns ranking and ties.

The weekly submission is the player's accumulated campaign wins when a battle finishes, including progress earned in previous weeks. It is not a count of wins earned only during this week. An unchanged accumulated count can be posted again after the Monday reset. An account with prior progress joins the new week after its next battle.

`leaderboardEntry()` derives the count from known campaign star records. Saved leaderboard schema 1 (level × 100 + stars) is recalculated as schema 2 on the next save/result. Settlement snapshot schema stays 6; campaign ids, star records and v4/v5 migration remain intact. Browser save keys retain their established names. Changing the portal game slug to the supplied production `grow` selects that game's cloud namespace; it does not move cloud saves from an unrelated listing.

## SDK and UI

```typescript
await Platform.init({ gameId: "grow" });
await Platform.submitScore("strongplayer", completedCampaignCount, metadata);
const top = await Platform.getLeaderboard("strongplayer", 10);
const me = await Platform.getMyRank("strongplayer");
```

Calls go through the platform adapter. Submissions are caught and spaced at least 30 seconds apart, including weekly transitions; fast results coalesce to the best pending count. Metadata stays below 2 KB. Guests never post or request a private rank, but can read the top ten. Missing SDK methods, timeouts, denied requests and unavailable boards cannot block gameplay.

Open the map's rank chip or More → Realm, then select **Strongest Player**. The view shows top ten players, campaign counts, your own rank when signed in, the reset schedule, and Refresh. AI Realm remains a separate tab. Portal display names are escaped. Loading, empty week, guest, unavailable board and unavailable private-rank states are explicit; close/Escape return focus to the opener, Tab stays inside the dialog, and refresh restores focus without stealing it from another control.

## Verification

`pnpm check` covers counting unique campaigns, invalid/unknown stars, old score migration, production game/board ids, guest access, response validation, rejected calls, byte caps, weekly resets and 30-second coalescing. `Tools/qa/player_leaderboard.py` injects a scriptable SDK into the unpacked release for three-size UI checks, escaped names, empty/error recovery, the first-win score, and a 25-move journey with a mid-run reload. It never contacts or changes the live leaderboard.

Developer Console Sandbox Preview remains the final live check: verify a signed-in score appears under the player's portal name on `strongplayer`, a guest cannot post, and the production weekly reset is reflected correctly. The local test verifies API calls and behavior, not Netlify persistence or gem payouts; the platform handles ended-period prizes.
