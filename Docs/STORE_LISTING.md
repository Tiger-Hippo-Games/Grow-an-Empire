# Store listing

The metadata for the GoLive listing (SUBMISSION_GUIDE §2 and §16 "Content & metadata"; DEVELOPER_GUIDE §2). Metadata can be changed later with `PUT /api/v1/developer/games/{id}` without another review. **The slug can't be changed after submission.**

| Field | Value | Rule |
|---|---|---|
| Title | Grow an Empire | Must match `<title>` in `index.html` |
| Slug | `grow-an-empire` | Lowercase, digits, hyphens, ≤ 60 characters, globally unique. Must equal `GAME_ID` in `src/platform/adapters.ts` (it's passed to `Platform.init`). If the slug is taken, change both. |
| Genre | `strategy` | One of idle, strategy, platformer, puzzle, arcade, rpg, simulation, sports |
| Orientation | `landscape` | Ravi, 2026-10-10. The game is laid out for the 16:9 1920×1080 portal frame (a 1280×720 stage scaled to fit; exactly 1.5× at 1920×1080); any device that shows at least 1920 px along one side gets that frame. Smaller frames still get a rearranged layout, so a phone held either way stays playable. Also declared in `index.html` (`<meta name="orientation">`) |
| Tags | `city-builder, strategy, medieval, short-session, single-player` | Optional, comma-separated |
| Age | 13+ | Mild fantasy combat: small painted soldiers fight in a popup and fall; no gore |

## Description (up to 2,000 characters under the current reference)

> Build a kingdom in mythic Bharatvarsha one choice at a time, then defend it. Every building costs timber, stone or planks, and every soldier needs arms and food. Beat 25 enemy armies of swordsmen, archers and horsemen and climb past 1,008 rival rajas to rank 1. A short strategy game for your browser.

The same text is the `<meta name="description">` in `index.html`. Keep them in sync.

## Create-game request

```http
POST /api/v1/developer/games
Authorization: Bearer <developer JWT>
Content-Type: application/json

{
  "title": "Grow an Empire",
  "slug": "grow-an-empire",
  "description": "Build a kingdom in mythic Bharatvarsha one choice at a time, then defend it. Every building costs timber, stone or planks, and every soldier needs arms and food. Beat 25 enemy armies of swordsmen, archers and horsemen and climb past 1,008 rival rajas to rank 1. A short strategy game for your browser.",
  "genre": "strategy",
  "orientation": "landscape"
}
```

## Images

The current reference requires the 480x270 thumbnail and 1280x720 banner in `Assets/Art/Store/upload/`. Upload those in the Developer Console. The older differently sized copies in `public/assets/` remain bundled for compatibility. Regenerate with `python Tools/ArtPipeline/make_store_art.py` after art changes.

| File | Size | Used for |
|---|---|---|
| `public/assets/thumbnail.jpg` | 400×300, 59 KB | Inside the ZIP, and `upload-assets` (SUBMISSION_GUIDE §9) |
| `public/assets/banner.jpg` | 1280×360, 167 KB | Inside the ZIP, and `upload-assets` |
| `Assets/Art/Store/upload/thumbnail-480x270.jpg` | 480×270, 64 KB | Developer Console upload (under 200 KB) |
| `Assets/Art/Store/upload/banner-1280x720.jpg` | 1280×720, 309 KB | Developer Console upload (under 500 KB) |

Key art v2 (0.10.2): the finished city at the muster under a warm dusk grade, its defenders (swordsman, archer, horseman) in the foreground and the raiders marching in, the title in Yatra One (the game's display face) with the tagline "Build a kingdom. Raise an army. Hold the realm." and "25 campaigns · 1,008 rival rajas". Everything in it is the game's own art: a real capture (`Assets/Art/Store/store-art-source-1920x1080-v2.png`, the 1920×1080 frame at the muster with the interface hidden) and frames from the combat sprite sheets. Fonts: Yatra One and Cinzel (SIL OFL 1.1); see `Assets/Art/PROVENANCE.md`.

## Content policy check (SUBMISSION_GUIDE §14)

| Rule | Status |
|---|---|
| Violence | Fine: mild fantasy combat; small painted soldiers clash in a popup and fall. No gore or injury is shown. |
| Adult content, hate content | None |
| Real-money transactions, gambling, crypto | None. There is no shop or currency to buy. |
| Misleading content | **Owner to confirm** that "Grow an Empire" and the 25 enemy names in `src/game/campaigns.ts` (Ashfang Clan, Black Anvil Company, …) don't imitate an existing title or brand |
| Unlicensed IP | **Owner to confirm** the art provenance rows in `Assets/Art/PROVENANCE.md`. Sound effects are synthesized in code (Web Audio); there are no audio files. |
| Iframe escape, fingerprinting | None: the game only talks to `window.parent` through `postMessage` and uses the portal SDK |
