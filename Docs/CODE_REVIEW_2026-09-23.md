# Code review — 2026-09-23

End-to-end review of `src/` (game, render, UI, orchestration), with every
suspected bug reproduced in a headless browser against the real production art
before being fixed, then re-verified afterward.

## Bugs found and fixed

| # | Severity | Where | What went wrong | Fix |
|---|---|---|---|---|
| 1 | High | `main.ts` | **Save wiped by a failed or interrupted load.** `beforeunload` autosaved even while the page was still loading. If boot failed (or the tab closed mid-load), the blank starting state overwrote the player's real save. Reproduced: a mid-construction save became a fresh game. | Autosave is disabled until boot has finished (`initialized`). Uses `pagehide` + tab-hidden instead of `beforeunload`. |
| 2 | High | `saveGame.ts`, `settlementSimulation.ts` | **A save that parses but is stale locks the game.** Validation checked shape only, so a save naming a building that no longer exists (e.g. after a rename) passed. The game then hung on the loading screen on *every* reload. Reproduced. | `describeSnapshotProblem()` checks ids against the catalog, duplicates, numeric resources, level range, and construction consistency. Unusable saves are deleted and a fresh game starts, with a message. |
| 3 | High | `main.ts` `beginConstruction` | **Choice committed before its art loaded.** On a failed download the simulation entered construction with no sprites, the panel stayed open, and the promise rejection went uncaught. On a slow download the 30s timer could run out before the building appeared. Reproduced. | Art loads first; the choice is committed only once it's ready. Failure shows a message and the player can pick again. Cards are disabled while loading. |
| 4 | Medium | `constructionView.ts` | A failed building load stayed cached as a rejected promise, so that building could never load for the rest of the session. | Failed loads are dropped from the cache; the next attempt retries. |
| 5 | Medium | `spriteAssets.ts`, `main.ts` | Load errors displayed as `[object Event]` (Three.js rejects with a DOM Event), inserted via `innerHTML`. | `loadTexture()` wraps failures in an `Error` naming the file. The loading screen uses `textContent` and has a Reload button. |
| 6 | Medium | `settlementSimulation.ts` | If a campaign excluded the top-ranked next offer, the card was dropped (only 2 choices) instead of falling through to the next eligible building. Latent: Campaign 1 allows everything. | Whitelist applied inside `nextBuildingOffer()` ranking. Test added. |
| 7 | Low | `main.ts` | The frame timer only ticked while playing, so un-pausing produced one oversized (clamped) step. This had been fixed on 2026-09-22 and regressed. | `getFrameDelta()` runs every frame. |
| 8 | Low | `main.ts` | An exception in the frame loop would re-throw 60×/second. | Loop catches, pauses, and tells the player to Restart or reload. |
| 9 | Low | `main.ts` | Milestone copy used `completedMove <= 8`, which is always true, so its else-branch was dead. | `< TOTAL_MOVES`. |
| 10 | Low | `hud.ts` | Army summary hard-coded "the Ashfang Raiders". | Uses `campaign.objective.enemyName`. |
| 11 | Low | `loadSnapshot` | `Object.assign` over the live state: fields missing from a save kept the *previous run's* values; missing resource keys became `undefined` (NaN in HUD). | Layers the save over a fresh initial state and fills resource keys with 0. |
| 12 | Perf | `villagers.ts` | Routes were rebuilt and measured twice per villager on every frame, with a Vector2 allocated per villager per frame. | Routes and lengths are cached per build order; the sample vector is reused. Movement math is unchanged. |
| 13 | Hygiene | `constructionView.ts` | Removed plots leaked their sprite materials; re-creating a plot would duplicate its sprites. | `removePlot()` disposes materials; `createPlotSprites()` replaces an existing plot. |

Balance and content are **unchanged**: no production numbers, offer rules, or
scoring were touched, and the exhaustive 6,561-path build-order test passes as before.

## Verification

- `tsc --noEmit` clean; `vite build` succeeds.
- `pnpm test`: 56 tests pass (was 41). New `src/game/__tests__/robustness.test.ts` covers save validation, legacy-save loading, the campaign whitelist, and the storage wrapper (including storage that throws).
- Headless Chromium with the real production art, against the production build:
  1. Boot failure (blocked civic-center image) → readable error + Reload; save preserved and resumed afterward.
  2. Save with an unknown building → fresh game, no page errors, bad save removed.
  3. Bakery art blocked on pick → cards stay open with a message, simulation stays in awaiting-choice; unblocking and clicking again starts construction.
  4. Full 8-move playthrough at 8× with the tutorial, a mid-construction reload and a post-completion reload → identical HUD across reloads, army report restored, zero console/page errors.

## Observations not changed (design calls for you)

- **Card text vs. real math.** Quarry says "+2 stone and defense" but adds +1 defense. Sawmill silently adds +1 defense. Raw producers say "+2 each move" but grow +1 every 3 moves of maturity.
- **Mercenaries don't spend anything.** They're capped by wealth and rations, but neither is deducted, and `supplyTurns` counts the full ration stock.
- **Production pulse** fires on every completed building each move, including converters that had no input and the House.
- **Dead data.** `productionSeconds` / `productionAmount` in the building catalog are never read (production is per-move). Log-stockpile art is bundled by `assetCatalog.ts` but never used. `hud.isGridChecked` is unused.
- **Tutorial and restart.** Restart while the Step 1 coach is open leaves the coach on screen until a card is picked. Harmless, but worth tidying if the tutorial grows.
- **Converter order is part of the balance.** The Blacksmith runs before the Weapons Workshop and can take the planks it needed (documented on `resolveMoveEconomy()`).

## Where to start reading

1. `src/game/content.ts`: the catalog and offer rules.
2. `src/game/settlementSimulation.ts`: the file header explains the move lifecycle; `update()` and `resolveMoveEconomy()` are the core.
3. `src/main.ts`: the header explains the per-frame data flow; `initialize()` documents the boot and failure policy.
4. `render/*` and `ui/hud.ts`: each exported function now has a short doc comment.
