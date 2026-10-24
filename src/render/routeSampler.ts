/** Immutable road polylines share one arc-length table across citizens and crews. */
export interface RoutePoint { x: number; y: number }
const tables = new WeakMap<readonly RoutePoint[], { cumulative: Float64Array; length: number }>();

function measure(points: readonly RoutePoint[]) {
  let table = tables.get(points);
  if (!table) {
    const cumulative = new Float64Array(points.length);
    for (let i = 1; i < points.length; i++) cumulative[i] = cumulative[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    table = { cumulative, length: cumulative.at(-1) ?? 0 };
    tables.set(points, table);
  }
  return table;
}

export function routeLength(points: readonly RoutePoint[]): number { return measure(points).length; }

/** Writes into caller-owned outputs. Duplicate points and zero-length routes are safe. */
export function sampleRoute(points: readonly RoutePoint[], distance: number, out: RoutePoint, tangent?: RoutePoint): number {
  if (points.length < 2) {
    out.x = points[0]?.x ?? 0; out.y = points[0]?.y ?? 0;
    if (tangent) { tangent.x = 0; tangent.y = -1; }
    return 0;
  }
  const { cumulative, length } = measure(points);
  const d = Math.max(0, Math.min(length, distance));
  let low = 1, high = points.length - 1;
  while (low < high) { const mid = (low + high) >>> 1; if (cumulative[mid] < d) low = mid + 1; else high = mid; }
  while (low < points.length - 1 && cumulative[low] === cumulative[low - 1]) low++;
  const a = points[low - 1], b = points[low], segment = cumulative[low] - cumulative[low - 1];
  const t = segment > 0 ? (d - cumulative[low - 1]) / segment : 0;
  out.x = a.x + (b.x - a.x) * t; out.y = a.y + (b.y - a.y) * t;
  if (tangent) { tangent.x = segment > 0 ? (b.x - a.x) / segment : 0; tangent.y = segment > 0 ? (b.y - a.y) / segment : -1; }
  return low - 1;
}
