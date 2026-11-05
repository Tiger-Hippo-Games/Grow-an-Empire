/** Complete city footprint, including outer plots, roofs, tree and garrison. */
export const CITY_WORLD = { left: -38, right: 38, bottom: -20, top: 24 } as const;
export interface ScreenArea { left: number; right: number; top: number; bottom: number }

/** Orthographic contain-fit: every city edge lands inside the available screen rectangle. */
export function fitCityCamera(width: number, height: number, area: ScreenArea, bounds: WorldBounds = CITY_WORLD) {
  const availableWidth = Math.max(1, area.right - area.left);
  const availableHeight = Math.max(1, area.bottom - area.top);
  const unitsPerPixel = Math.max((bounds.right - bounds.left) / availableWidth, (bounds.top - bounds.bottom) / availableHeight);
  const viewWidth = width * unitsPerPixel;
  const viewHeight = height * unitsPerPixel;
  return {
    width: viewWidth, height: viewHeight,
    x: (bounds.left + bounds.right) / 2 - ((area.left + area.right) / 2 - width / 2) * unitsPerPixel,
    y: (bounds.top + bounds.bottom) / 2 + ((area.top + area.bottom) / 2 - height / 2) * unitsPerPixel,
  };
}

export interface WorldBounds { left: number; right: number; bottom: number; top: number }

/** Smallest framing the growing-city camera uses (world units), so a young village is close but not cramped. */
export const MIN_CITY_FRAME = { width: 34, height: 19 } as const;

/**
 * 0.16.0 growing-city camera: frame what exists (padded), never smaller than
 * MIN_CITY_FRAME and never beyond the complete footprint (CITY_WORLD). As the
 * city spreads the camera eases out, so every building stays on screen.
 */
export function growingCityBounds(content: WorldBounds): WorldBounds {
  let { left, right, bottom, top } = content;
  const grow = (lo: number, hi: number, min: number): [number, number] => {
    if (hi - lo >= min) return [lo, hi];
    const centre = (lo + hi) / 2;
    return [centre - min / 2, centre + min / 2];
  };
  [left, right] = grow(left, right, MIN_CITY_FRAME.width);
  [bottom, top] = grow(bottom, top, MIN_CITY_FRAME.height);
  // Slide inside the full footprint, then clip to it.
  const shift = (lo: number, hi: number, min: number, max: number): [number, number] => {
    if (lo < min) { hi += min - lo; lo = min; }
    if (hi > max) { lo -= hi - max; hi = max; }
    return [Math.max(min, lo), Math.min(max, hi)];
  };
  [left, right] = shift(left, right, CITY_WORLD.left, CITY_WORLD.right);
  [bottom, top] = shift(bottom, top, CITY_WORLD.bottom, CITY_WORLD.top);
  return { left, right, bottom, top };
}

/**
 * 0.16.0 construction focus: a closer view centred on one plot inside the same
 * free screen area. `zoom` > 1 shows the plot larger; the view never shows
 * beyond the complete city footprint, so the terrain and city stay framed.
 */
export function focusCityCamera(width: number, height: number, area: ScreenArea, point: { x: number; y: number }, zoom: number, bounds: WorldBounds = CITY_WORLD) {
  const base = fitCityCamera(width, height, area, bounds);
  const z = Math.max(1, zoom);
  const viewWidth = base.width / z;
  const viewHeight = base.height / z;
  const unitsPerPixel = viewWidth / width;
  // Camera centre that puts `point` at the centre of the free area.
  let x = point.x - ((area.left + area.right) / 2 - width / 2) * unitsPerPixel;
  let y = point.y + ((area.top + area.bottom) / 2 - height / 2) * unitsPerPixel;
  // Keep the zoomed view inside the base (whole-city) view, so nothing beyond it ever shows.
  const clamp = (value: number, baseCentre: number, baseSize: number, size: number) => Math.min(baseCentre + (baseSize - size) / 2, Math.max(baseCentre - (baseSize - size) / 2, value));
  x = clamp(x, base.x, base.width, viewWidth);
  y = clamp(y, base.y, base.height, viewHeight);
  return { width: viewWidth, height: viewHeight, x, y };
}

/** Blend between two camera views (t in 0..1; smoothstep unless `smooth` is false). */
export function blendCamera(a: { width: number; height: number; x: number; y: number }, b: { width: number; height: number; x: number; y: number }, t: number, smooth = true) {
  const k = Math.max(0, Math.min(1, t));
  const s = smooth ? k * k * (3 - 2 * k) : k;
  return { width: a.width + (b.width - a.width) * s, height: a.height + (b.height - a.height) * s, x: a.x + (b.x - a.x) * s, y: a.y + (b.y - a.y) * s };
}
