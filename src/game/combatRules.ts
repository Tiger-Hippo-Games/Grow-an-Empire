/** Campaign 1 is defended by one of four explicit army compositions. */
export type DefenseStrategy = "swordsmen" | "archers" | "horsemen" | "mixed";

export interface DefenseCounts { swordsmen: number; archers: number; horsemen: number; }

export function defenseStrategy(units: DefenseCounts): DefenseStrategy | null {
  if (units.swordsmen >= 3 && units.archers >= 3) return "mixed";
  if (units.horsemen >= 6) return "horsemen";
  if (units.swordsmen >= 6) return "swordsmen";
  if (units.archers >= 10) return "archers";
  return null;
}

export const ENEMY_SWORDSMEN = 5;
