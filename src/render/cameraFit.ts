/** Complete city footprint, including outer plots, roofs, tree and garrison. */
export const CITY_WORLD = { left: -38, right: 38, bottom: -20, top: 24 } as const;
export interface ScreenArea { left: number; right: number; top: number; bottom: number }

/** Orthographic contain-fit: every city edge lands inside the available screen rectangle. */
export function fitCityCamera(width: number, height: number, area: ScreenArea) {
  const availableWidth = Math.max(1, area.right - area.left);
  const availableHeight = Math.max(1, area.bottom - area.top);
  const unitsPerPixel = Math.max((CITY_WORLD.right - CITY_WORLD.left) / availableWidth, (CITY_WORLD.top - CITY_WORLD.bottom) / availableHeight);
  const viewWidth = width * unitsPerPixel;
  const viewHeight = height * unitsPerPixel;
  return {
    width: viewWidth, height: viewHeight,
    x: (CITY_WORLD.left + CITY_WORLD.right) / 2 - ((area.left + area.right) / 2 - width / 2) * unitsPerPixel,
    y: (CITY_WORLD.top + CITY_WORLD.bottom) / 2 + ((area.top + area.bottom) / 2 - height / 2) * unitsPerPixel,
  };
}
