import { describe, expect, it } from "vitest";
import { combatFrame, formationDepth } from "../battlePresentation";
import { CITY_ZOOM, cityZoomIndex } from "../cityZoom";

describe("army presentation", () => {
  it("holds ready poses before and after attacks, and only addresses authored cells", () => {
    for (const kind of ["archers", "swordsmen", "horsemen", "elephants", "militia"] as const) {
      expect(combatFrame(kind, 0)).toBe(0); expect(combatFrame(kind, .99)).toBe(0);
      const frames = Array.from({ length: 100 }, (_, n) => combatFrame(kind, n / 100));
      expect(new Set(frames).size).toBe(8);
      expect(frames.every(n => Number.isInteger(n) && n >= 0 && n < 8)).toBe(true);
    }
  });
  it("allocates every actual unit into ranks, keeping ranged and melee ranks separate", () => {
    expect(formationDepth({ swordsmen: 40, archers: 9, horsemen: 0, elephants: 2, militia: 3 }, 16)).toBe(6);
    expect(formationDepth({ swordsmen: 0, archers: 0, horsemen: 0, elephants: 0, militia: 0 }, 16)).toBe(1);
  });
  it("offers exactly one wider and one closer view around normal, with bounded controls", () => {
    expect(CITY_ZOOM).toEqual([.8, 1, 1.4]);
    expect(cityZoomIndex(-1)).toBe(0); expect(cityZoomIndex(3)).toBe(2);
    expect(cityZoomIndex(1)).toBe(1);
  });
});
