import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BUILDINGS } from "../../game/content";
import { BUILDING_LOADING_HINTS, createLoadingScreen } from "../loadingScreen";

class Element {
  textContent = "";
  style = { transform: "" };
  attributes = new Map<string, string>();
  classes = new Set<string>();
  classList = { add: (name: string) => this.classes.add(name), contains: (name: string) => this.classes.has(name) };
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
}
function loader() {
  const nodes = Object.fromEntries(["tip", "building", "benefit", "progress", "fill", "label"].map(key => [key, new Element()]));
  const root = Object.assign(new Element(), {
    attached: true,
    contains() { return this.attached; },
    querySelector(selector: string) { return nodes[selector.replace("#loading-", "")]; },
  });
  return { root, nodes, controller: createLoadingScreen(root as unknown as HTMLElement) };
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("window", { setInterval, clearInterval });
  vi.spyOn(Math, "random").mockReturnValue(0);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("loading screen", () => {
  it("has exactly one accurate hint per building", () => {
    expect(BUILDING_LOADING_HINTS.map(hint => hint.id).sort()).toEqual(Object.keys(BUILDINGS).sort());
    for (const hint of BUILDING_LOADING_HINTS) {
      expect(hint.name).toBe(BUILDINGS[hint.id].name);
      expect(hint.benefit).toBe(BUILDINGS[hint.id].benefit);
      expect(hint.benefit).not.toBe("");
    }
  });
  it("cycles all hints, then stops immediately when the game is ready", () => {
    const { root, nodes, controller } = loader();
    const seen = [];
    for (const hint of BUILDING_LOADING_HINTS) {
      seen.push(nodes.building.textContent);
      expect(nodes.benefit.textContent).toBe(hint.benefit);
      vi.advanceTimersByTime(4000);
    }
    expect(new Set(seen).size).toBe(Object.keys(BUILDINGS).length);
    controller.finish();
    expect(root.classes.has("hidden")).toBe(true);
    expect(nodes.tip.classes.has("hidden")).toBe(true);
    expect(nodes.progress.attributes.get("aria-valuenow")).toBe("100");
    expect(vi.getTimerCount()).toBe(0);
  });
  it("keeps progress monotonic as more assets join the boot queue", () => {
    const { nodes, controller } = loader();
    controller.setProgress(1, 2);
    controller.setProgress(1, 10);
    expect(nodes.progress.attributes.get("aria-valuenow")).toBe("45");
    controller.setProgress(10, 10);
    expect(nodes.progress.attributes.get("aria-valuenow")).toBe("90");
    controller.finish();
    expect(nodes.fill.style.transform).toBe("scaleX(1)");
  });
  it("stops when the boot watchdog replaces the loader with an error", () => {
    const { root } = loader();
    root.attached = false;
    vi.advanceTimersByTime(4000);
    expect(vi.getTimerCount()).toBe(0);
  });
});
