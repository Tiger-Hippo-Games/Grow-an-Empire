/**
 * The battle rule: the side with more strength wins. Nothing is random, so
 * the result is known the moment the armies are counted; the battle view only
 * animates it. Pure functions, shared by the simulation, the HUD's live
 * strength readouts and the balance tests.
 *
 * Counters: archers are worth more against a swordsman-heavy army, swordsmen
 * less against an archer-heavy one, and horsemen ride down archers but stall
 * on a wall of swordsmen. So a mixed army is never badly countered.
 */

import { ELEPHANT_SWORDSMEN } from "./economy";

export interface ArmyCounts { archers: number; swordsmen: number; horsemen: number }
/**
 * The player's side at the battle: trained soldiers, hired sellswords, militia
 * and (from a Gajashala) war elephants. An elephant fights like
 * `ELEPHANT_SWORDSMEN` swordsmen, for strength and for the enemy's counters.
 */
export interface PlayerArmy extends ArmyCounts { militia: number; elephants?: number }
export interface EnemyArmy { archers: number; swordsmen: number; horsemen: number; veterancy: number }

export const MILITIA_STRENGTH = 0.5;
/** Free villagers who pick up tools and join the defence. */
export const MILITIA_CAP = 10;

function shares(army: ArmyCounts): { archers: number; swordsmen: number; horsemen: number } {
  const total = army.archers + army.swordsmen + army.horsemen;
  if (total === 0) return { archers: 0, swordsmen: 0, horsemen: 0 };
  return { archers: army.archers / total, swordsmen: army.swordsmen / total, horsemen: army.horsemen / total };
}

/** The army as the counters see it: each elephant counts as `ELEPHANT_SWORDSMEN` swordsmen. */
export function effectiveCounts(army: ArmyCounts & { elephants?: number }): ArmyCounts {
  return { archers: army.archers, swordsmen: army.swordsmen + ELEPHANT_SWORDSMEN * (army.elephants ?? 0), horsemen: army.horsemen };
}

/** Strength of one soldier of each kind, facing `opponent`. */
export function unitStrengths(opponent: ArmyCounts): Record<keyof ArmyCounts, number> {
  const share = shares(opponent);
  return {
    archers: 1.5 + 0.5 * share.swordsmen,
    swordsmen: 2 - 0.5 * share.archers,
    horsemen: 3 + 0.5 * share.archers - 0.5 * share.swordsmen,
  };
}

/**
 * What the city's buildings change in the battle: `bonus` is the Dharma
 * Stambha's strength share (0.2 = 20% stronger); `militiaStrength` replaces
 * `MILITIA_STRENGTH` (a Burj drills the militia to full strength).
 */
export interface BattleModifiers { bonus?: number; militiaStrength?: number }

export function playerStrength(army: PlayerArmy, enemy: ArmyCounts, mods: BattleModifiers = {}): number {
  const each = unitStrengths(enemy);
  const counts = effectiveCounts(army);
  const militia = mods.militiaStrength ?? MILITIA_STRENGTH;
  return (1 + (mods.bonus ?? 0)) * (counts.archers * each.archers + counts.swordsmen * each.swordsmen + counts.horsemen * each.horsemen + army.militia * militia);
}

export function enemyStrength(enemy: EnemyArmy, army: ArmyCounts & { elephants?: number }): number {
  const each = unitStrengths(effectiveCounts(army));
  return enemy.veterancy * (enemy.archers * each.archers + enemy.swordsmen * each.swordsmen + enemy.horsemen * each.horsemen);
}

export function enemyHeadCount(enemy: EnemyArmy): number {
  return enemy.archers + enemy.swordsmen + enemy.horsemen;
}

/**
 * The Prakara's volley: removes `share` of the enemy's head count (rounded to
 * the nearest soldier) before the battle, spread across the enemy's kinds in
 * proportion (largest remainder first, then swordsmen, horsemen, archers).
 */
export function watchtowerVolley(enemy: EnemyArmy, share: number): { remaining: EnemyArmy; felled: ArmyCounts } {
  const kinds = ["swordsmen", "horsemen", "archers"] as const;
  const total = enemyHeadCount(enemy);
  const toFell = Math.min(total, Math.max(0, Math.round(total * share)));
  const felled: ArmyCounts = { archers: 0, swordsmen: 0, horsemen: 0 };
  for (const kind of kinds) felled[kind] = Math.floor(enemy[kind] * share);
  let left = toFell - kinds.reduce((sum, kind) => sum + felled[kind], 0);
  const byRemainder = [...kinds].sort((a, b) => (enemy[b] * share - felled[b]) - (enemy[a] * share - felled[a]));
  for (const kind of byRemainder) {
    if (left <= 0) break;
    if (felled[kind] < enemy[kind]) { felled[kind] += 1; left -= 1; }
  }
  const remaining: EnemyArmy = { ...enemy, archers: enemy.archers - felled.archers, swordsmen: enemy.swordsmen - felled.swordsmen, horsemen: enemy.horsemen - felled.horsemen };
  return { remaining, felled };
}

/** Star thresholds: the strength margin needed for two and three stars (0.35 = win by 35%). */
export interface StarMargins { two: number; three: number }

export function starsFor(margin: number, win: boolean, margins: StarMargins): 0 | 1 | 2 | 3 {
  if (!win) return 0;
  if (margin >= margins.three - 1e-9) return 3;
  if (margin >= margins.two - 1e-9) return 2;
  return 1;
}

export interface BattleRound { player: ArmyCounts & { militia: number; elephants?: number }; enemy: ArmyCounts }
export interface BattleOutcome {
  win: boolean;
  playerStrength: number;
  enemyStrength: number;
  /** yours ÷ theirs − 1 (0.17 = "won by 17%"); negative on a defeat. */
  margin: number;
  stars: 0 | 1 | 2 | 3;
  /** Units still standing after each of the four rounds (for the unit strip). */
  rounds: BattleRound[];
}

const ROUNDS = 4;

/** Losses spread over the rounds: `lost` of `start`, removed evenly, rounding up early. */
function survivorsAfter(start: number, lost: number, round: number): number {
  return Math.max(0, start - Math.ceil((lost * round) / ROUNDS));
}

/** Removes `lost` units from an army, front line first: swordsmen, horsemen, archers, elephants, then militia. */
function applyLosses<T extends ArmyCounts & { militia?: number; elephants?: number }>(army: T, lost: number): T {
  const order: Array<keyof ArmyCounts | "militia" | "elephants"> = ["swordsmen", "horsemen", "archers", "elephants", "militia"];
  const result = { ...army };
  let remaining = lost;
  for (const key of order) {
    const available = (result[key as keyof T] as unknown as number | undefined) ?? 0;
    const take = Math.min(available, remaining);
    (result as unknown as Record<string, number>)[key] = available - take;
    remaining -= take;
  }
  return result;
}

/**
 * Fights the battle. `enemy` is the army that reaches the field (after any
 * Prakara volley); `mods` are the city's battle modifiers.
 */
export function resolveBattle(army: PlayerArmy, enemy: EnemyArmy, margins: StarMargins, mods: BattleModifiers = {}): BattleOutcome {
  const ours = playerStrength(army, enemy, mods);
  const theirs = enemyStrength(enemy, army);
  const win = ours > theirs;
  const margin = theirs > 0 ? ours / theirs - 1 : (ours > 0 ? 1 : 0);
  const elephants = army.elephants ?? 0;
  const ourCount = army.archers + army.swordsmen + army.horsemen + army.militia + elephants;
  const theirCount = enemyHeadCount(enemy);
  // The loser falls entirely; the winner loses the share of its units equal to
  // loser strength ÷ winner strength (at most 90%), so a narrow win looks costly.
  const ourLost = win ? Math.min(ourCount, Math.round(ourCount * Math.min(0.9, theirs / Math.max(ours, 1e-9)))) : ourCount;
  const theirLost = win ? theirCount : Math.min(theirCount, Math.round(theirCount * Math.min(0.9, ours / Math.max(theirs, 1e-9))));
  const rounds: BattleRound[] = [];
  for (let round = 1; round <= ROUNDS; round += 1) {
    const oursLeft = survivorsAfter(ourCount, ourLost, round);
    const theirsLeft = survivorsAfter(theirCount, theirLost, round);
    const start = { archers: army.archers, swordsmen: army.swordsmen, horsemen: army.horsemen, militia: army.militia, ...(elephants ? { elephants } : {}) };
    const player = applyLosses(start, ourCount - oursLeft);
    const enemyLeft = applyLosses({ archers: enemy.archers, swordsmen: enemy.swordsmen, horsemen: enemy.horsemen }, theirCount - theirsLeft);
    rounds.push({ player, enemy: enemyLeft });
  }
  return { win, playerStrength: ours, enemyStrength: theirs, margin, stars: starsFor(margin, win, margins), rounds };
}

/**
 * The cheapest single addition that would have won (or reached the next star):
 * how many more of one soldier type. Used for "4 more archers would have won."
 */
export function gapToTarget(army: PlayerArmy, enemy: EnemyArmy, targetMargin: number, types: ReadonlyArray<keyof ArmyCounts> = ["archers", "swordsmen", "horsemen"], mods: BattleModifiers = {}): { type: keyof ArmyCounts; count: number } | null {
  let best: { type: keyof ArmyCounts; count: number } | null = null;
  // Bound the search by the enemy's maximum possible strength. Late armies
  // can need more than the old 60-soldier limit for an accurate defeat hint.
  const limit = Math.max(60, Math.ceil(enemyHeadCount(enemy) * 3.5 * enemy.veterancy * (1 + targetMargin) / (1 + (mods.bonus ?? 0))) + 1);
  for (const type of types) {
    for (let count = 1; count <= limit; count += 1) {
      const trial = { ...army, [type]: army[type] + count };
      const ours = playerStrength(trial, enemy, mods);
      const theirs = enemyStrength(enemy, trial);
      if (ours > theirs && ours / theirs - 1 >= targetMargin - 1e-9) {
        if (!best || count < best.count) best = { type, count };
        break;
      }
    }
  }
  return best;
}
