# Mobile UX: fewer words, more icons

The full plan, with the before/after word counts, lives in the project's Claude doc "Grow an Empire: mobile UX plan (fewer words, more icons)". This file is the short version for anyone working in the code.

## The problem (v0.2.4)

On a phone the game asked players to read rules instead of letting them see them: 449 words through Campaign 1, costs and outputs written as words ("4 wood", "+5 wood each move, growing with age"), and the stockpile hidden while a choice was open.

## Decisions (Ravi, 2026-10-03)

- **Text and icons in the tutorial, then icons only everywhere**, on every screen size (desktop included).
- **Commission painted icons** (`Docs/ICON_COMMISSION_BRIEF.md`); the game takes them in the same slots.
- **Test with portal users** (`Docs/PLAYTEST_PORTAL.md`).

## The rules (v0.4.0 on)

0. **Learning, then icons.** While the player is learning (tutorial not yet finished or skipped, or replayed from "How to play"), `<html class="words">` is set and labels show beside the icons. After that the game speaks in icons: `.w` elements hide, `.ws` words stay only for screen readers. Every icon button keeps its word as `aria-label` and tooltip; the "More" menu keeps its words because it is a list.
1. **Icon + number, not words.** Every amount of a good, unit or person shows its icon (`amount()` in `src/ui/icons.ts`). A bare "4 wood" on screen fails `Tools/qa/text_budget.py`.
2. **Show what you have next to what it costs.** The "You have" strip (`#stock-strip`) sits above the cards.
3. **One decision per screen.** Only the primary button is bright.
4. **Details on tap.** Sentences sit behind the card's "i" button or a long press on the card (`.build-slot.show-info`), and the dialogs' "…" Details fold (`.flow-extra`), in every layout.
5. **Teach by pointing.** Tutorial steps are an icon and 4–6 words.

## Where things are

| Piece | Code |
|---|---|
| Icon drawings (41, inline SVG), painted-icon slots, `icon()`, `amount()`, `iconWord()` | `src/ui/icons.ts` |
| A building's effect as icons ("+5 [wood] /move") | `src/ui/cardEffect.ts` (same numbers as `benefitText()` in `content.ts`) |
| Cards, stock strip, move summary, move report (`renderReport`), Gather, speed slider, toasts, tutorial | `src/ui/hud.ts` |
| Briefing, muster, popup battle screen, result, Details fold | `src/ui/campaignFlow.ts` |
| The battle animation in the popup | `src/render/popupBattle.ts` |
| Map card | `src/ui/campaignMap.ts` |
| Realm board | `src/ui/realmBoard.ts` |
| Styles | end of `src/styles.css` ("Icons (v0.3.0)") |

## Word budgets (phone, per screen)

Enforced by `python Tools/qa/text_budget.py` in portrait and landscape. Words are letters-only tokens a player can see; while a dialog or the map is open, only its words count; folded text doesn't count until opened. The first map, briefing and tutorial are counted while learning; the rest after the tutorial is skipped (icons only).

| Screen | v0.2.4 | v0.3.0 | v0.4.0 | v0.10.2 | Budget |
|---|---|---|---|---|---|
| Campaign map (first visit) | 51 | 28 | 28 | 28 | 30 |
| Enemy briefing (first) | 54 | 14 | 14 | 15 | 24 |
| Tutorial | 85 | 35 | 35 | 36 | 38 |
| First choice | 64 | 17 | 7 | 8 | 14 |
| Move report (after the tutorial) | — | — | — | 1 | 12 |
| Later choice (move 6) | 73 | 23 | 14 | 9 | 20 |
| Muster | 44 | 26 | 9 | 7 | 14 |
| Battle | 18 | 18 | 10 | 9 | 14 |
| Result | 60 | 25 | 14 | 14 | 22 |
| Campaign map (after) | — | — | 14 | 14 | 16 |
| Enemy briefing (after) | — | — | 7 | 10 | 12 |

Adding text to a screen? Check it against its budget, or put it behind "i" / "Details".

## Phase 2 and 3 (v0.4.0)

- **Portal-user testing:** the game reports `ux_choice`, `ux_card_info`, `ux_unaffordable_tap`, `ux_details_opened` and a one-time `ux_clarity_vote` ("Easy to follow?" on the first result). The five-second test kit and the targets are in `Docs/PLAYTEST_PORTAL.md`, with phone screenshots in `Docs/playtest/`.
- **Painted icons:** `icons.ts` uses `icon-<name>-v1.webp` once it is bundled (`Assets/Art/Production/Icons/` → `pnpm art:export`), else the drawing. Brief and contact sheet: `Docs/ICON_COMMISSION_BRIEF.md`, `Docs/art/icon-commission-sheet.png`.
- **Goods fly to the stockpile:** after each move, what the city made rises from the city and lands on its count in the strip (`flyGoods` in `hud.ts`; off with reduced motion).
- **Long press** on a card (touch or pen, 450 ms) opens its details instead of choosing it.
- **Still to do:** the five-second test itself, real phones and Safari (no WebKit in the cloud QA), and the painted icons once delivered.
