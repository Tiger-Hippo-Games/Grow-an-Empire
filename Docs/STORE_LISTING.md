# Store listing

The metadata for the GoLive listing (SUBMISSION_GUIDE §2 and §16 "Content & metadata"; DEVELOPER_GUIDE §2). Metadata can be changed later with `PUT /api/v1/developer/games/{id}` without another review. **The slug can't be changed after submission.**

| Field | Value | Rule |
|---|---|---|
| Title | Grow an Empire | Must match `<title>` in `index.html` |
| Slug | `grow-an-empire` | Lowercase, digits, hyphens, ≤ 60 characters, globally unique. Must equal `GAME_ID` in `src/platform/adapters.ts` (it's passed to `Platform.init`). If the slug is taken, change both. |
| Genre | `strategy` | One of idle, strategy, platformer, puzzle, arcade, rpg, simulation, sports |
| Orientation | `any` | Tested at 1280×720, 1920×1080, 390×800, 375×667 and 667×375. Also declared in `index.html` |
| Tags | `city-builder, strategy, medieval, short-session, single-player` | Optional, comma-separated |
| Age | 13+ | Mild fantasy combat, shown only as a score; no gore |

## Description (233 characters; the portal needs 150–500)

> Build a medieval city one choice at a time. Pick twelve buildings, balance grain, timber and stone, and muster enough defenders to hold off the Ashfang Raiders. A short strategy game that plays in your browser on desktop and mobile.

The same text is the `<meta name="description">` in `index.html`. Keep them in sync.

## Create-game request

```http
POST /api/v1/developer/games
Authorization: Bearer <developer JWT>
Content-Type: application/json

{
  "title": "Grow an Empire",
  "slug": "grow-an-empire",
  "description": "Build a medieval city one choice at a time. Pick twelve buildings, balance grain, timber and stone, and muster enough defenders to hold off the Ashfang Raiders. A short strategy game that plays in your browser on desktop and mobile.",
  "genre": "strategy",
  "orientation": "any"
}
```

## Images

The portal docs disagree on sizes, so both sets are made. Regenerate them with `python Tools/ArtPipeline/make_store_art.py` after the art changes.

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
| Violence | Fine: mild fantasy combat, resolved as a defence score. No gore or injury is shown. |
| Adult content, hate content | None |
| Real-money transactions, gambling, crypto | None. There is no shop or currency to buy. |
| Misleading content | **Owner to confirm** that "Grow an Empire" and "Ashfang Raiders" don't imitate an existing title or brand |
| Unlicensed IP | **Owner to confirm** the art provenance rows in `Assets/Art/PROVENANCE.md`. There's no audio. |
| Iframe escape, fingerprinting | None: the game only talks to `window.parent` through `postMessage` and uses the portal SDK |
