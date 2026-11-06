import type { IconKind } from "./combatScene";

/** Timing is visual only; the recorded battle remains the sole casualty authority. */
export function combatFrame(kind: IconKind, phase: number): number {
  const start = kind === "archers" ? .10 : kind === "horsemen" ? .18 : kind === "elephants" ? .23 : .20;
  const progress = (phase - start) / .65;
  return progress < 0 || progress >= 1 ? 0 : Math.min(7, Math.floor(progress * 8));
}
export function formationDepth(counts: Record<IconKind, number>, columns: number): number {
  return Math.max(1, Object.values(counts).reduce((sum, count) => sum + Math.ceil(count / columns), 0));
}
