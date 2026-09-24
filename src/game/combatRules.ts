/** Campaign 1 is defended by one of four explicit army compositions. */
export type DefenseStrategy = "swordsmen" | "archers" | "horsemen" | "mixed";

export interface DefenseCounts { swordsmen: number; archers: number; horsemen: number; }

export function defenseStrategy(units: DefenseCounts, enemyStrength = ENEMY_SWORDSMEN): DefenseStrategy | null {
  const scale = enemyStrength / ENEMY_SWORDSMEN;
  if (units.swordsmen >= Math.ceil(3 * scale) && units.archers >= Math.ceil(3 * scale)) return "mixed";
  if (units.horsemen >= Math.ceil(6 * scale)) return "horsemen";
  if (units.swordsmen >= Math.ceil(6 * scale)) return "swordsmen";
  if (units.archers >= Math.ceil(10 * scale)) return "archers";
  return null;
}

export const ENEMY_SWORDSMEN = 5;
