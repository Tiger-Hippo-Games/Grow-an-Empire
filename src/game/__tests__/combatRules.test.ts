import { describe, expect, it } from "vitest";
import { defenseStrategy, ENEMY_SWORDSMEN } from "../combatRules";

describe("Campaign 1 defense against five raider swordsmen", () => {
  it("uses the four promised thresholds, including their exact boundaries", () => {
    expect(ENEMY_SWORDSMEN).toBe(5);
    expect(defenseStrategy({ swordsmen: 5, archers: 0, horsemen: 0 })).toBeNull();
    expect(defenseStrategy({ swordsmen: 6, archers: 0, horsemen: 0 })).toBe("swordsmen");
    expect(defenseStrategy({ swordsmen: 0, archers: 9, horsemen: 0 })).toBeNull();
    expect(defenseStrategy({ swordsmen: 0, archers: 10, horsemen: 0 })).toBe("archers");
    expect(defenseStrategy({ swordsmen: 0, archers: 0, horsemen: 5 })).toBeNull();
    expect(defenseStrategy({ swordsmen: 0, archers: 0, horsemen: 6 })).toBe("horsemen");
    expect(defenseStrategy({ swordsmen: 3, archers: 2, horsemen: 0 })).toBeNull();
    expect(defenseStrategy({ swordsmen: 2, archers: 3, horsemen: 0 })).toBeNull();
    expect(defenseStrategy({ swordsmen: 3, archers: 3, horsemen: 0 })).toBe("mixed");
  });
});
