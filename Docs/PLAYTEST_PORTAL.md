# Testing with portal players

Phase 2 of the mobile UX plan (`Docs/MOBILE_UX_PLAN.md`): find out whether real GoLive players understand the icon-first game on their own phones. There are two parts: the game now reports what players do (passive, every player), and a short five-second test with recruited portal users (active, five or more players).

## 1. What the game reports (v0.4.0)

All through `Platform.track` with `game_version`, `campaign_number` and `layout` (`fixed` = desktop stage, `fluid` = phone or small window). `learning` is true while the player is still in the tutorial (labels shown).

| Event | When | Properties |
|---|---|---|
| `ux_choice` | A card is chosen on moves 1–3 | `move`, `building_id`, `seconds` (from the cards appearing), `info_opened` (times "i" or a long press was used this move), `unaffordable_taps`, `swap` |
| `ux_card_info` | A card's details are opened | `building_id`, `move`, `via` (`button` or `long_press`) |
| `ux_unaffordable_tap` | A card the player can't pay for is tapped | `building_id`, `move` |
| `ux_details_opened` | A dialog's "…" Details is opened | `dialog` (`briefing`, `result`) |
| `ux_report_read` | The move report is closed with Choose | `move`, `seconds` it was open |
| `ux_clarity_vote` | The one-time "Easy to follow?" on the first result | `vote` (`up` or `down`), `won`, `stars` |
| `tutorial_completed` / `tutorial_skipped` | Already sent since v0.2 | `step_count`, `time_seconds` |

What to look at, per release, phones (`layout = fluid`) against desktop:

- **Clarity:** share of `ux_clarity_vote` that is `up`. Target 80% or more.
- **First move:** median `seconds` on `ux_choice` move 1. Under 15 s means the cards read at a glance.
- **Mistaken taps:** `ux_unaffordable_tap` per player on moves 1–3. Target under 0.3; more means the red costs aren't read.
- **Details use:** if `ux_card_info` is high on the same building, its icons don't say enough: fix that card's effect row.
- **Skippers:** among players who `tutorial_skipped`, the share who finish Campaign 1 (`level_completed` with `campaign_number = 1`), compared with those who completed it.

## 2. Five-second test with portal users

**Who:** 5–8 GoLive players who have not played Grow an Empire, on their own phones. Recruit through the portal (a news post or a banner on the game page offering a reward), or from the portal's player list for people who play other strategy games.

**Stimuli:** the phone screenshots in `Docs/playtest/` (regenerate with `python Tools/qa/text_budget.py`, which writes them to `Tools/qa/out/`):

| Image | Shows |
|---|---|
| `phone-first-choice.png` | The first choice: stockpile strip, three cards |
| `phone-later-choice.png` | Move 6: the move summary row, a warning, three cards |
| `phone-muster.png` | The muster: both armies, the strength bar |
| `phone-briefing-again.png` | A briefing after the tutorial: enemy, counter, moves, stars |

**Script (per image, about 2 minutes):** show the image full screen for 5 seconds, hide it, then ask:

1. Choice screens: "What did you have?", "What does the second card cost?", "What does it give you?", "Which one could you not afford?"
2. Muster: "Who was stronger?", "Were you going to win?"
3. Briefing: "Who are you fighting?", "What beats them?", "How long until they arrive?"

Then show it again with no time limit: "What would you tap first?" Note any icon nobody could name.

**Success:** 4 of 5 players answer the "have", "cost" and "give" questions correctly on both choice screens; no icon is misnamed by more than one player. Anything that fails gets a fix and a re-test with new players.

**Real phones and Safari:** have at least two of the players use iPhones (Safari). The cloud QA only runs Chromium (no WebKit is installed there), so this is the first Safari check of the icon screens.

## 3. Reading the results

Record each round in `Docs/QA_RESULTS.md` (date, players, pass/fail per question, the icons that confused people) and the analytics numbers above for the release. Feed confusing icons into the painted-icon commission (`Docs/ICON_COMMISSION_BRIEF.md`) before they're painted.
