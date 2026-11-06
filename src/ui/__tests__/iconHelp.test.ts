import { describe, expect, it } from "vitest";
import { ICON_HELP } from "../iconHelp";
import { PAINTED_ICON_NAMES } from "../icons";

describe("icon explanations (0.16.2)", () => {
  it("explains every game icon in a plain sentence", () => {
    for (const name of PAINTED_ICON_NAMES) {
      const help = ICON_HELP[name];
      expect(help, name).toBeDefined();
      expect(help!.name.length).toBeGreaterThan(2);
      expect(help!.text.length).toBeGreaterThan(20);
      expect(help!.text.length).toBeLessThan(160);
    }
    expect(ICON_HELP["per-move"]?.text).toMatch(/every move/i);
  });
});
