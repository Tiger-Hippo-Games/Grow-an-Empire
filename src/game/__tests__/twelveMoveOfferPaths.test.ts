import { describe, expect, it } from "vitest";
import { BUILDINGS, isBuildingEligible, nextBuildingOffer, OPENING_BUILD_OPTIONS, TOTAL_MOVES } from "../content";
import { getVisibleRoadSegments } from "../../render/cityLayout";
import { buildFunctionalRoutes } from "../../render/villagers";

/** Memoized traversal covers every reachable build order without storing half a million simulations. */
describe("every reachable twelve-move build order", () => {
  it("keeps playable distinct offers and valid villager paths through the finale", () => {
    const memo = new Map<string, number>();
    const checkedRoads = new Set<string>();
    const edgeKey = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      [`${a.x.toFixed(6)},${a.y.toFixed(6)}`, `${b.x.toFixed(6)},${b.y.toFixed(6)}`].sort().join("|");

    function explore(built: string[], options: string[]): number {
      if (built.length === TOTAL_MOVES) return 1;
      const move = built.length + 1;
      const key = `${[...built].sort().join(",")}|${options.join(",")}`;
      const cached = memo.get(key);
      if (cached !== undefined) return cached;
      expect(options.length, `move ${move}: ${built.join(", ")}`).toBeGreaterThan(0);
      expect(options.length).toBeLessThanOrEqual(3);
      expect(new Set([...built, ...options]).size).toBe(built.length + options.length);
      for (const id of options) expect(isBuildingEligible(BUILDINGS[id], built, move)).toBe(true);

      const roadKey = [...built].sort().join(",");
      if (!checkedRoads.has(roadKey)) {
        checkedRoads.add(roadKey);
        const visibleEdges = new Set(getVisibleRoadSegments(built).map(([a, b]) => edgeKey(a, b)));
        for (const route of buildFunctionalRoutes(built)) {
          for (let i = 1; i < route.points.length; i += 1) {
            expect(visibleEdges.has(edgeKey(route.points[i - 1], route.points[i])), `${roadKey}: ${route.id}`).toBe(true);
          }
        }
      }

      let paths = 0;
      for (const id of options) {
        const nextBuilt = [...built, id];
        if (nextBuilt.length === TOTAL_MOVES) { paths += 1; continue; }
        const nextOptions = options.filter((option) => option !== id);
        const offer = nextBuildingOffer(nextBuilt, nextOptions, move + 1, id);
        if (offer) nextOptions.push(offer);
        paths += explore(nextBuilt, nextOptions);
      }
      memo.set(key, paths);
      return paths;
    }

    expect(explore([], [...OPENING_BUILD_OPTIONS])).toBeGreaterThan(0);
    expect(checkedRoads.size).toBeGreaterThan(TOTAL_MOVES);
  });
});
