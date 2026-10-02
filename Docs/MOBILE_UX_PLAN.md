# Mobile UX: fewer words, more icons

The full plan, with the before/after word counts, lives in the project's Claude doc "Grow an Empire: mobile UX plan (fewer words, more icons)". This file is the short version for anyone working in the code.

## The problem (v0.2.4)

On a phone the game asked players to read rules instead of letting them see them: 449 words through Campaign 1, costs and outputs written as words ("4 wood", "+5 wood each move, growing with age"), and the stockpile hidden while a choice was open.

## The rules (v0.3.0 on)

1. **Icon + number, not words.** Every amount of a good, unit or person shows its icon (`amount()` in `src/ui/icons.ts`). A bare "4 wood" on screen fails `Tools/qa/text_budget.py`.
2. **Show what you have next to what it costs.** The "You have" strip (`#stock-strip`) sits above the cards.
3. **One decision per screen.** Only the primary button is bright.
4. **Details on tap.** Sentences sit behind the card's "i" button (`.build-slot.show-info`) and the dialogs' "Details" fold (`.flow-extra`). The fixed 1280×720 layout shows dialog details and unlock notes without folding.
5. **Teach by pointing.** Tutorial steps are an icon and 4–6 words.

## Where things are

| Piece | Code |
|---|---|
| Icon drawings (22, inline SVG) and `icon()`, `amount()`, `iconWord()` | `src/ui/icons.ts` |
| A building's effect as icons ("+5 [wood] /move") | `src/ui/cardEffect.ts` (same numbers as `benefitText()` in `content.ts`) |
| Cards, stock strip, move summary, toasts, tutorial | `src/ui/hud.ts` |
| Briefing, muster, result, Details fold | `src/ui/campaignFlow.ts` |
| Map card | `src/ui/campaignMap.ts` |
| Styles | end of `src/styles.css` ("Icons (v0.3.0)") |

## Word budgets (phone, per screen)

Enforced by `python Tools/qa/text_budget.py` in portrait and landscape. Words are letters-only tokens a player can see; while a dialog or the map is open, only its words count; folded text doesn't count until opened.

| Screen | v0.2.4 | v0.3.0 | Budget |
|---|---|---|---|
| Campaign map | 51 | 28 | 30 |
| Enemy briefing | 54 | 14 | 20 |
| Tutorial | 85 | 35 | 38 |
| First choice | 64 | 17 | 22 |
| Later choice (move 6) | 73 | 23 | 30 |
| Muster | 44 | 26 | 30 |
| Battle | 18 | 18 | 22 |
| Result | 60 | 25 | 30 |

Adding text to a phone screen? Check it against its budget, or put it behind "i" / "Details".

## Next (Phase 2 and 3)

- A five-second test with five new players on their own phones: can they say what they have, what each card costs and what it makes?
- Real phones and Safari.
- Painted icons in the same slots (replace the drawings in `icons.ts`), goods flying to the stockpile, a card preview on long press.
