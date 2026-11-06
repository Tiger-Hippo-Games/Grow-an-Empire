export const CITY_ZOOM = [.8, 1, 1.4] as const;
export function cityZoomIndex(value: number): number { return Math.max(0, Math.min(2, Math.round(value))); }
