import { CONSTRUCTION_DURATION_SECONDS } from "../content";
import type { SettlementSimulation } from "../settlementSimulation";

/**
 * Test helper: plays one move the way a player would. Builds the first
 * preferred card that is affordable (else the first affordable card), else
 * swaps at the Marketplace, else gathers. Returns what it did.
 */
export function playMove(sim: SettlementSimulation, prefer: string[] = []): "built" | "swapped" | "gathered" | "none" {
  if (sim.state.mode === "construction") { sim.update(CONSTRUCTION_DURATION_SECONDS); return "built"; }
  if (sim.state.mode !== "awaiting-choice") return "none";
  const offered = sim.state.availableBuildingIds;
  const affordable = offered.filter((id) => sim.canAffordBuilding(id));
  const pick = prefer.find((id) => affordable.includes(id)) ?? affordable[0];
  if (pick) {
    sim.chooseBuilding(pick);
    sim.update(CONSTRUCTION_DURATION_SECONDS);
    return "built";
  }
  const swap = offered.find((id) => sim.swapPlanFor(id));
  if (swap) {
    sim.swapAndBuild(swap);
    sim.update(CONSTRUCTION_DURATION_SECONDS);
    return "swapped";
  }
  return sim.gather().length ? "gathered" : "none";
}

/** Plays moves until the muster (or `guard` moves, so a bug can't loop forever). */
export function playToMuster(sim: SettlementSimulation, prefer: string[] = [], guard = 40): void {
  for (let i = 0; i < guard && (sim.state.mode === "awaiting-choice" || sim.state.mode === "construction"); i += 1) {
    if (playMove(sim, prefer) === "none") throw new Error(`stuck on move ${sim.state.move}`);
  }
}

/** Plays to the end: the muster, then the battle with the best sellsword hire. */
export function playToEnd(sim: SettlementSimulation, prefer: string[] = []): void {
  playToMuster(sim, prefer);
  if (sim.state.mode === "muster") sim.muster(sim.bestHire());
}
