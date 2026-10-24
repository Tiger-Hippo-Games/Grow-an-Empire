import { routeLength, sampleRoute, type RoutePoint } from "./routeSampler";

export interface TrafficRoute { id: string; kind: "service" | "supply" | "civic"; points: readonly RoutePoint[]; speed: number }
export interface CitizenTrip extends RoutePoint {
  id: number; route: TrafficRoute; distance: number; start: number; length: number;
  outbound: boolean; speed: number; stride: number; dwell: number; visits: number;
  moving: boolean; working: boolean; waiting: boolean; dx: number; dy: number; edge: string;
}
const STEP = 1 / 30;
const pointKey = (p: RoutePoint) => `${p.x.toFixed(4)},${p.y.toFixed(4)}`;

/** Presentation only: persistent commutes, passing lanes, following and junction/gate yield.
 * No simulation state, saved fields, timers or random-number consumption. */
export function createCityTraffic(stopBeforeHall: (index: number, length: number) => number) {
  const actors: CitizenTrip[] = [];
  let routes: readonly TrafficRoute[] = [], accumulator = 0, clock = 0, laneScale = 1;
  let junctions: RoutePoint[] = [];
  const reservations = new Map<string, { actor: number; until: number }>();
  const arrivals = new Map<string, Map<number, number>>();
  const edgeKeys = new WeakMap<readonly RoutePoint[], string[]>();
  const position = { x: 0, y: 0 }, tangent = { x: 0, y: -1 }, ahead = { x: 0, y: 0 }, aheadTangent = { x: 0, y: -1 };

  function leastUsedRoute(): TrafficRoute {
    const counts = new Map(routes.map(r => [r.id, 0]));
    for (const actor of actors) counts.set(actor.route.id, (counts.get(actor.route.id) ?? 0) + 1);
    return routes.reduce((best, r) => (counts.get(r.id) ?? 0) < (counts.get(best.id) ?? 0) ? r : best, routes[0]);
  }
  function assign(actor: CitizenTrip, route: TrafficRoute): void {
    actor.route = route; actor.length = routeLength(route.points);
    actor.start = route.kind === "service" ? stopBeforeHall(actor.id, actor.length) : 0;
    actor.distance = actor.start; actor.outbound = true; actor.speed = 0; actor.dwell = 0;
  }
  function pose(actor: CitizenTrip): void {
    const segment = sampleRoute(actor.route.points, actor.distance, position, tangent);
    let keys = edgeKeys.get(actor.route.points);
    if (!keys) {
      keys = actor.route.points.map((p, i, points) => [pointKey(p), pointKey(points[i + 1] ?? p)].sort().join("|"));
      edgeKeys.set(actor.route.points, keys);
    }
    actor.edge = keys[segment];
    const sign = actor.outbound ? 1 : -1;
    actor.dx = tangent.x * sign; actor.dy = tangent.y * sign;
    // Direction-relative lanes let opposing people pass. Fade at the exact work stop.
    const end = Math.min(actor.distance - actor.start, actor.length - actor.distance);
    const lane = (.25 + (actor.id % 3) * .035) * laneScale * Math.min(1, Math.max(0, end) / .8);
    actor.x = position.x - actor.dy * lane; actor.y = position.y + actor.dx * lane;
  }
  function step(): void {
    clock += STEP;
    for (const [key, owner] of reservations) {
      const actor = actors[owner.actor], junction = junctions.find(j => pointKey(j) === key);
      if (owner.until < clock || !actor || !junction || Math.hypot(actor.x - junction.x, actor.y - junction.y) > 1.05 || actor.dwell > 0) reservations.delete(key);
    }
    // FIFO arrivals prevent a busy approach from starving another branch.
    for (const junction of junctions) {
      const key = pointKey(junction), queue = arrivals.get(key) ?? new Map<number, number>();
      const nearby = actors.filter(a => a.dwell <= 0 && Math.hypot(a.x - junction.x, a.y - junction.y) <= 1.05);
      for (const id of queue.keys()) if (!nearby.some(a => a.id === id)) queue.delete(id);
      for (const actor of nearby) if (!queue.has(actor.id)) queue.set(actor.id, clock);
      arrivals.set(key, queue);
      if (!reservations.has(key) && queue.size) {
        const first = [...queue].sort((a, b) => a[1] - b[1] || a[0] - b[0])[0][0];
        reservations.set(key, { actor: first, until: clock + 1.6 });
      }
    }
    for (const actor of actors) {
      actor.waiting = false; actor.moving = false;
      if (actor.length - actor.start < .01) { actor.working = false; pose(actor); continue; }
      if (actor.dwell > 0) {
        actor.dwell -= STEP; actor.speed = 0;
        actor.working = actor.outbound && actor.route.kind === "service";
        if (actor.dwell <= 0) {
          if (!actor.outbound && routes.some(r => !actors.some(a => a.route.id === r.id))) assign(actor, leastUsedRoute());
          else actor.outbound = !actor.outbound;
          actor.working = false;
        }
        pose(actor); continue;
      }
      actor.working = false;
      pose(actor);
      const sign = actor.outbound ? 1 : -1;
      const remaining = actor.outbound ? actor.length - actor.distance : actor.distance - actor.start;
      sampleRoute(actor.route.points, Math.max(actor.start, Math.min(actor.length, actor.distance + sign * .85)), ahead, aheadTangent);
      const turn = Math.max(.4, tangent.x * aheadTangent.x + tangent.y * aheadTangent.y);
      const desired = actor.route.speed * (.92 + (actor.id % 7) * .025) * turn * Math.min(1, Math.max(.2, remaining / .8));
      actor.speed = Math.min(desired, actor.speed + STEP * 2.4);
      const junction = junctions.find(j => Math.hypot(j.x - actor.x, j.y - actor.y) <= 1.05);
      if (junction) {
        const key = pointKey(junction), owner = reservations.get(key);
        if (owner && owner.actor !== actor.id) actor.waiting = true;
        else if (!owner) reservations.set(key, { actor: actor.id, until: clock + 1.6 });
      }
      const destination = actor.outbound ? actor.route.points.at(-1)! : null;
      for (const other of actors) {
        if (other === actor) continue;
        if (destination && remaining < 1 && other.dwell > 0 && other.outbound && pointKey(other.route.points.at(-1)!) === pointKey(destination)) actor.waiting = true;
        if (other.dwell > 0) continue;
        const dx = other.x - actor.x, dy = other.y - actor.y;
        const forward = dx * actor.dx + dy * actor.dy;
        // The junction owner clears the crossing before following resumes;
        // otherwise an actor waiting for that owner could also block its exit.
        if (!junction && actor.edge === other.edge && forward > .02 && forward < .7 && Math.abs(dx * actor.dy - dy * actor.dx) < .16 && actor.dx * other.dx + actor.dy * other.dy > .97) actor.waiting = true;
      }
      if (actor.waiting) actor.speed = 0;
      else {
        if (junction) reservations.set(pointKey(junction), { actor: actor.id, until: clock + 1.6 });
        const travelled = Math.min(remaining, actor.speed * STEP);
        actor.distance += sign * travelled; actor.stride += travelled; actor.moving = travelled > 1e-6;
        if (remaining - travelled < .001) { actor.visits++; actor.dwell = 1.1 + (actor.id % 5) * .18; actor.speed = 0; }
      }
      pose(actor);
    }
  }
  return {
    actors: actors as readonly CitizenTrip[],
    setLaneScale(scale: number): void { laneScale = Number.isFinite(scale) && scale > 0 ? scale : 1; },
    sync(nextRoutes: readonly TrafficRoute[], count: number): void {
      if (routes !== nextRoutes) {
        routes = nextRoutes;
        const nodes = new Map<string, { p: RoutePoint; neighbours: Set<string> }>();
        for (const r of routes) for (let i = 1; i < r.points.length; i++) {
          const a = r.points[i - 1], b = r.points[i];
          for (const [p, neighbour] of [[a, b], [b, a]]) {
            const key = pointKey(p), node = nodes.get(key) ?? { p, neighbours: new Set<string>() };
            node.neighbours.add(pointKey(neighbour)); nodes.set(key, node);
          }
        }
        junctions = [...nodes.values()].filter(n => n.neighbours.size > 2).map(n => n.p);
        reservations.clear(); arrivals.clear();
        for (const actor of actors) {
          const route = routes.find(r => r.id === actor.route.id);
          if (route) actor.route = route;
          else assign(actor, leastUsedRoute());
        }
      }
      actors.splice(Math.max(0, count));
      if (!routes.length) return;
      while (actors.length < count) {
        const id = actors.length;
        const actor: CitizenTrip = { id, route: leastUsedRoute(), distance: 0, start: 0, length: 0, outbound: true, speed: 0, stride: 0, dwell: 0, visits: 0, moving: false, working: false, waiting: false, x: 0, y: 0, dx: 0, dy: -1, edge: "" };
        assign(actor, actor.route);
        actor.distance += (actor.length - actor.start) * ((id * .61803398875) % 1);
        actor.stride = actor.distance; pose(actor); actors.push(actor);
      }
    },
    advance(seconds: number): void {
      accumulator += Math.max(0, Math.min(.5, seconds));
      while (accumulator + 1e-9 >= STEP) { step(); accumulator -= STEP; }
    },
    reset(): void { actors.length = 0; reservations.clear(); arrivals.clear(); accumulator = 0; clock = 0; routes = []; },
  };
}
