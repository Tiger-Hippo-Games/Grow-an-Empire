import { describe, expect, it } from "vitest";
import { defenseStrategy, ENEMY_SWORDSMEN } from "../combatRules";

describe("Campaign 1 defense against five raider swordsmen", () => {
  it("uses the three promised thresholds, including their exact boundaries", () => {
    expect(ENEMY_SWORDSMEN).toBe(5);
    expect(defenseStrategy({ swordsmen: 5, archers: 0 })).toBeNull();
    expect(defenseStrategy({ swordsmen: 6, archers: 0 })).toBe("swordsmen");
    expect(defenseStrategy({ swordsmen: 0, archers: 9 })).toBeNull();
    expect(defenseStrategy({ swordsmen: 0, archers: 10 })).toBe("archers");
    expect(defenseStrategy({ swordsmen: 3, archers: 2 })).toBeNull();
    expect(defenseStrategy({ swordsmen: 2, archers: 3 })).toBeNull();
    expect(defenseStrategy({ swordsmen: 3, archers: 3 })).toBe("mixed");
  });
});
