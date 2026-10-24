import { describe, expect, it } from "vitest";
import { BUILDINGS } from "../../game/content";
import { routeLength, sampleRoute } from "../routeSampler";
import { createCityTraffic } from "../cityTraffic";
import { buildFunctionalRoutes, hallStop } from "../villagers";
import { getRoadRoute, getServiceRoute, sharedRoadPlan } from "../cityLayout";

describe("shared authored roads", () => {
  it("deduplicates shared branches and counts their users independent of build order", () => {
    const ids = Object.keys(BUILDINGS);
    const plan = sharedRoadPlan(ids);
    expect(new Set(plan.map(e => e.key)).size).toBe(plan.length);
    expect(plan.some(e => e.users > 3)).toBe(true);
    expect(sharedRoadPlan([...ids].reverse()).map(e => [e.key, e.users]).sort()).toEqual(plan.map(e => [e.key, e.users]).sort());
    expect(sharedRoadPlan(["farm", "farm"])).toEqual(sharedRoadPlan(["farm"]));
  });
  it("draws every service and cross-district delivery segment used by citizens", () => {
    const ids = Object.keys(BUILDINGS), edges = sharedRoadPlan(ids);
    for (const points of [...ids.map(getServiceRoute), ...ids.map(id => getRoadRoute(id, "marketplace"))]) {
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1], b = points[i];
        if (a.distanceToSquared(b) < 1e-8) continue;
        expect(edges.some(e => (e.from.equals(a) && e.to.equals(b)) || (e.from.equals(b) && e.to.equals(a)))).toBe(true);
      }
    }
  });
});

describe("cached arc-length route sampling", () => {
  it("matches exact traversal through corners, endpoints and duplicate nodes", () => {
    const points = [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 4 }];
    expect(routeLength(points)).toBe(7);
    const out = { x: 0, y: 0 }, tangent = { x: 0, y: 0 };
    for (const distance of [-1, 0, 1, 3, 4, 7, 10]) {
      sampleRoute(points, distance, out, tangent);
      const d = Math.max(0, Math.min(7, distance));
      expect(out).toEqual(d <= 3 ? { x: d, y: 0 } : { x: 3, y: d - 3 });
      expect(Math.hypot(tangent.x, tangent.y)).toBeCloseTo(1);
    }
    sampleRoute([], 5, out); expect(out).toEqual({ x: 0, y: 0 });
  });
});

describe("persistent visual traffic", () => {
  const routes = () => buildFunctionalRoutes(["farm", "bakery", "granary", "woodcutter", "sawmill", "marketplace"]);
  it("keeps trips and walked distance when a new building adds routes", () => {
    const traffic = createCityTraffic(hallStop); traffic.sync(routes(), 12); traffic.advance(.2);
    const before = traffic.actors.map(a => [a.route.id, a.distance, a.stride]);
    traffic.sync(buildFunctionalRoutes(["farm", "bakery", "granary", "woodcutter", "sawmill", "marketplace", "house"]), 12);
    expect(traffic.actors.map(a => [a.route.id, a.distance, a.stride])).toEqual(before);
  });
  it("uses fixed steps and stays still when paused or given a backward clock", () => {
    const a = createCityTraffic(hallStop), b = createCityTraffic(hallStop), plan = routes();
    a.sync(plan, 12); b.sync(plan, 12);
    for (let i = 0; i < 60; i++) a.advance(1 / 60);
    for (let i = 0; i < 30; i++) b.advance(1 / 30);
    const state = () => a.actors.map(x => [x.x, x.y, x.stride, x.visits]);
    expect(state()).toEqual(b.actors.map(x => [x.x, x.y, x.stride, x.visits]));
    const before = state(); a.advance(0); a.advance(-2); expect(state()).toEqual(before);
    a.reset(); expect(a.actors).toHaveLength(0);
  });
  it("lets the full representative workforce complete visits without a permanent junction/gate lock", () => {
    const traffic = createCityTraffic(hallStop), plan = buildFunctionalRoutes(Object.keys(BUILDINGS));
    traffic.sync(plan, 80);
    let waits = 0;
    for (let i = 0; i < 600 * 30; i++) {
      const strides = traffic.actors.map(a => a.stride);
      traffic.advance(1 / 30);
      for (const actor of traffic.actors) if (actor.waiting) { waits++; expect(actor.stride).toBe(strides[actor.id]); }
    }
    expect(waits).toBeGreaterThan(0);
    expect(traffic.actors.filter(a => a.visits < 2).map(a => ({ id: a.id, route: a.route.id, visits: a.visits, x: a.x, y: a.y, waiting: a.waiting, outbound: a.outbound, distance: a.distance, dwell: a.dwell }))).toEqual([]);
    expect(traffic.actors.every(a => Number.isFinite(a.x) && Number.isFinite(a.y))).toBe(true);
  }, 60_000);
});
