import { describe, expect, it } from "vitest";
import { CONSTRUCTION_DURATION_SECONDS, TOTAL_MOVES } from "../content";
import { SettlementSimulation } from "../settlementSimulation";
import { getVisibleRoadSegments } from "../../render/cityLayout";
import { buildFunctionalRoutes } from "../../render/villagers";

/**
 * Exhaustively answers TECHNICAL_IMPLEMENTATION.md's own open review question:
 * "Can the rolling-card algorithm ever produce fewer than three valid choices
 * before Move 8?" It walks every reachable eight-move build order (every
 * player's every possible choice, at every move) rather than sampling a few,
 * so a "no" here is a proof for the current catalog, not a guess.
 *
 * With 3 choices available at each of 8 moves, there are exactly 3^8 = 6,561
 * possible playthroughs. That count itself is an assertion: if it changes,
 * either the branching factor changed (see below) or a path is being missed.
 */
const EXPECTED_LEAF_PATHS = 3 ** TOTAL_MOVES;

function collectLeafStates(): SettlementSimulation[] {
  const leaves: SettlementSimulation[] = [];

  function explore(sim: SettlementSimulation): void {
    if (sim.state.mode === "complete") {
      leaves.push(sim);
      return;
    }
    expect(sim.state.mode).toBe("awaiting-choice");
    // This is the invariant the review question asks about: the pool must
    // never starve before the run's final move.
    expect(
      sim.state.availableBuildingIds.length,
      `move ${sim.state.move} offered ${sim.state.availableBuildingIds.length} choices ` +
        `(built so far: ${sim.state.builtBuildingIds.join(", ") || "none"})`,
    ).toBe(3);

    for (const option of sim.state.availableBuildingIds) {
      const branch = new SettlementSimulation();
      branch.loadSnapshot(sim.serialize());
      branch.chooseBuilding(option);
      branch.update(CONSTRUCTION_DURATION_SECONDS);
      explore(branch);
    }
  }

  explore(new SettlementSimulation());
  return leaves;
}

describe("every reachable eight-move build order", () => {
  const leaves = collectLeafStates();

  it(`reaches exactly ${EXPECTED_LEAF_PATHS} distinct completed cities`, () => {
    expect(leaves).toHaveLength(EXPECTED_LEAF_PATHS);
  });

  it("always finishes with civic level 8, at least the base population, and eight built buildings", () => {
    for (const sim of leaves) {
      expect(sim.state.civicLevel).toBe(TOTAL_MOVES);
      expect(sim.state.population).toBeGreaterThanOrEqual(37);
      expect(sim.state.armyReport).not.toBeNull();
      expect(sim.state.builtBuildingIds).toHaveLength(TOTAL_MOVES);
    }
  });

  it("never repeats a building within a single completed city", () => {
    for (const sim of leaves) {
      expect(new Set(sim.state.builtBuildingIds).size).toBe(sim.state.builtBuildingIds.length);
    }
  });

  it("produces only distinct build orders (no two branches collapse to the same city)", () => {
    const signatures = new Set(leaves.map((sim) => sim.state.builtBuildingIds.join(">")));
    expect(signatures.size).toBe(leaves.length);
  });

  it("keeps every villager route on revealed roads at every reachable move", () => {
    const checkedSets = new Set<string>();
    for (const sim of leaves) {
      for (let count = 0; count <= TOTAL_MOVES; count += 1) {
        const built = sim.state.builtBuildingIds.slice(0, count);
        const key = [...built].sort().join(",");
        if (checkedSets.has(key)) continue;
        checkedSets.add(key);
        const visible = getVisibleRoadSegments(built);
        const edgeKey = (a: { x: number; y: number }, b: { x: number; y: number }): string =>
          [`${a.x.toFixed(6)},${a.y.toFixed(6)}`, `${b.x.toFixed(6)},${b.y.toFixed(6)}`].sort().join("|");
        const visibleEdges = new Set(visible.map(([from, to]) => edgeKey(from, to)));
        const routes = buildFunctionalRoutes(built);
        for (const route of routes) {
          for (let index = 1; index < route.points.length; index += 1) {
            const edge = edgeKey(route.points[index - 1], route.points[index]);
            expect(visibleEdges.has(edge), `move ${count}, built ${key}, route ${route.id} uses hidden edge ${edge}`).toBe(true);
          }
        }
      }
    }
    expect(checkedSets.size).toBeGreaterThan(TOTAL_MOVES);
  });
});
