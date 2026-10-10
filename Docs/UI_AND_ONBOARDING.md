# UI and first-run design

Updated for 0.10.2. The code wins where this and it disagree; the rules that are easy to break are in `AGENTS.md`.

## Reference principle

Classic EYEZMAZE GROW games keep the evolving world dominant, present the available choices as clear visual objects, and limit permanent controls to essentials. Their rules are learned by choosing an item and watching how the world reacts. Grow an Empire follows that principle without copying the original presentation.

Reference: [EYEZMAZE GROW CUBE](https://www.eyezmaze.com/game/grow_cube/index.html)

## HUD hierarchy

1. **World:** always fills the stage (1280×720 scaled to the portal frame, or the frame itself on phones).
2. **Current decision:** the build panel, only while a choice is open. From move 2 it first shows the **move report** (what each building used and made, each good before → after, warnings); **Choose** (or Enter) reveals the three cards and **Gather**.
3. **Immediate state:** campaign, move (`n / campaign.moveLimit`), civic level and population in one slim top bar.
4. **Speed:** a four-stop slider (1×, 2×, 4×, 8×; default 4×), in reach from the map onward. It hides under dialogs, the tutorial and the Realm board.
5. **Optional detail:** the stockpile drawer, the card's "i" (or a long press), a dialog's Details fold.
6. **Utility controls:** pause, map, Realm, grid, sound, help, full screen and restart in one low-emphasis strip (folded under "More" on phones).

## First-run journey

1. **Welcome:** "Build. Grow. Defend." The move count (from the campaign), then four picture rules: pay goods to build, buildings make goods every move, goods train soldiers who eat, win the battle after the last move. No formulas, no prescribed opening.
2. **Step 1, the first decision:** a coach on the build panel: "Build: pay now; it works every move after. Gather: build nothing this move; the city still works."
3. **Step 2, the first reaction:** after move 1, the rhythm: goods become soldiers, soldiers eat rations, the battle comes after the last move (read from `campaign.moveLimit`).
4. **The first move report** is still shown with words, with one learner line ("What your city did last move. Read it, then Choose."). Icons only from the next screen on. A player who skips the tutorial goes straight to icons.

The tutorial is saved as completed, can be skipped at once (Skip or Escape) and replayed from "How to play". Its modal pauses the city.

## The campaign screens

- **Briefing** (campaign start): the enemy, the counter to it, the move count, the star rules. The build panel stays hidden behind it.
- **Muster** (after the last move): both armies, the forecast, and the sellsword market with a Bazaar. The steppers disable at their limits.
- **Battle** (in the same popup): formations close in, four rounds, exact survivors; Skip or Escape shows the result. Focus starts on the heading, so a stray Enter doesn't skip it, and the second click of a double click on Fight doesn't land on Skip.
- **Result:** stars, the realm rank, the build order, what would have done better; Next, Replay, Map, View the city.

Every dialog is named by its heading, keeps Tab inside, and gives focus back when it closes.

## Interaction rules

- One high-emphasis decision area at a time.
- No permanent resource wall; the stockpile strip shows what the offered cards need.
- Choice cards use building art as the primary affordance; consequences are written as production and unlock statements, not lore.
- Words while learning, icons only afterwards (`<html class="words">`); every amount is an icon plus a number plus a hidden word for screen readers.
- Tap targets at least 44 px; text at least 0.78rem; contrast at least 4.5:1 for small text.
- Keyboard: 1–3 choose a card, Enter leaves the report, G gathers, Space or P pauses, S changes speed, M mutes, F toggles full screen. Shortcuts stop while a dialog, the map or the Realm board is open, and while typing or choosing in a list; the speed slider keeps them working.
- Reduced motion: the battle and the button press feedback stop animating.
