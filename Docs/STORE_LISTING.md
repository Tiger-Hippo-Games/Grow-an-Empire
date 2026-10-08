# Store listing

The metadata for the GoLive listing (SUBMISSION_GUIDE §2 and §16 "Content & metadata"; DEVELOPER_GUIDE §2). Metadata can be changed later with `PUT /api/v1/developer/games/{id}` without another review. **The slug can't be changed after submission.**

| Field | Value | Rule |
|---|---|---|
| Title | Grow an Empire | Must match `<title>` in `index.html` |
| Slug | `grow-an-empire` | Lowercase, digits, hyphens, ≤ 60 characters, globally unique. Must equal `GAME_ID` in `src/platform/adapters.ts` (it's passed to `Platform.init`). If the slug is taken, change both. |
| Genre | `strategy` | One of idle, strategy, platformer, puzzle, arcade, rpg, simulation, sports |
| Orientation | `any` | Large frames get the 16:9 stage designed for 1920×1080, scaled and centred. Phones and tablets in either orientation, and small windows, get a rearranged layout at full size (build panel beside the city in landscape, below it in portrait). Also declared in `index.html` |
| Tags | `city-builder, strategy, medieval, short-session, single-player` | Optional, comma-separated |
| Age | 13+ | Mild fantasy combat, shown as unit icons greying out; no gore |

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
  "orientation": "any"
}
```

## Images

The current reference requires the 480x270 thumbnail and 1280x720 banner in `Assets/Art/Store/upload/`. Upload those in the Developer Console. The older differently sized copies in `public/assets/` remain bundled for compatibility. Regenerate with `python Tools/ArtPipeline/make_store_art.py` after art changes.

| File | Size | Used for |
|---|---|---|
| `public/assets/thumbnail.jpg` | 400×300, 47 KB | Inside the ZIP, and `upload-assets` (SUBMISSION_GUIDE §9) |
| `public/assets/banner.jpg` | 1280×360, 139 KB | Inside the ZIP, and `upload-assets` |
| `Assets/Art/Store/upload/thumbnail-480x270.jpg` | 480×270, 53 KB | Developer Console upload (DEVELOPER_GUIDE §8: under 200 KB) |
| `Assets/Art/Store/upload/banner-1280x720.jpg` | 1280×720, 307 KB | Developer Console upload (DEVELOPER_GUIDE §8: under 500 KB) |

The source is `Assets/Art/Store/store-art-source-1920x1080.png`, a capture of a finished 12-move city with the interface hidden. The title font is Cinzel (SIL OFL 1.1); see `Assets/Art/PROVENANCE.md`.

## Content policy check (SUBMISSION_GUIDE §14)

| Rule | Status |
|---|---|
| Violence | Fine: mild fantasy combat, shown as unit icons that grey out. No gore or injury is shown. |
| Adult content, hate content | None |
| Real-money transactions, gambling, crypto | None. There is no shop or currency to buy. |
| Misleading content | **Owner to confirm** that "Grow an Empire" and the 25 enemy names in `src/game/campaigns.ts` (Ashfang Clan, Black Anvil Company, …) don't imitate an existing title or brand |
| Unlicensed IP | **Owner to confirm** the art provenance rows in `Assets/Art/PROVENANCE.md`. Sound effects are synthesized in code (Web Audio); there are no audio files. |
| Iframe escape, fingerprinting | None: the game only talks to `window.parent` through `postMessage` and uses the portal SDK |
