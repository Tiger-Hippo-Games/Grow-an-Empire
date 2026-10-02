import { describe, expect, it } from "vitest";
import { BUILDINGS } from "../../game/content";
import { RESOURCE_NAMES } from "../../game/economy";
import { effectHtml } from "../cardEffect";
import { amount, icon, iconWord } from "../icons";

describe("icon set", () => {
  it("draws every resource", () => {
    for (const name of RESOURCE_NAMES) expect(icon(name)).toMatch(/<svg class="gi gi-[a-z]+" viewBox="0 0 24 24"[^>]*><(path|rect|circle|g|ellipse)/);
  });

  it("reads amounts aloud with the right word", () => {
    expect(amount("planks", 1)).toContain(">1</b><span class=\"sr\"> plank</span>");
    expect(amount("wood", 4, { sign: "+" })).toContain(">+4</b><span class=\"sr\"> wood</span>");
    expect(iconWord("swordsmen", 1)).toBe("swordsman");
  });

  it("gives every building on offer an icon effect", () => {
    for (const id of Object.keys(BUILDINGS)) expect(effectHtml(id), id).toContain("<svg");
  });
});
