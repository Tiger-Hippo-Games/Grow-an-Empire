import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { playBattle, type BattleSide } from "../popupBattle";
import { resolveBattle } from "../../game/battle";

/** Minimal DOM double; timing and counts are exercised with the real controller. */
class Element {
  children: Element[] = [];
  className = "";
  textContent = "";
  attributes = new Map<string, string>();
  style = { setProperty: vi.fn(), backgroundImage: "" };
  classList = {
    contains: (name: string) => this.className.split(" ").includes(name),
    add: (name: string) => { if (!this.classList.contains(name)) this.className += ` ${name}`; },
    remove: (name: string) => { this.className = this.className.split(" ").filter(n => n !== name).join(" "); },
    toggle: (name: string, on: boolean) => { if (on) this.classList.add(name); else this.classList.remove(name); },
  };
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  appendChild(child: Element) { this.children.push(child); return child; }
  append(...children: Element[]) { this.children.push(...children); }
  replaceChildren(...children: Element[]) { this.children = children; }
  all(): Element[] { return [this, ...this.children.flatMap(child => child.all())]; }
}

const player: BattleSide = { title: "Your army", start: { swordsmen: 40, archers: 40, horsemen: 40, militia: 40 } };
const enemy: BattleSide = { title: "Enemy", start: { swordsmen: 40, archers: 40, horsemen: 40, militia: 0 } };
const rounds = resolveBattle(player.start, { ...enemy.start, veterancy: 1 }, { two: .2, three: .5 }).rounds;
let doc: { visibilityState: string; createElement: () => Element };
beforeEach(() => {
  vi.useFakeTimers();
  doc = { visibilityState: "visible", createElement: () => new Element() };
  vi.stubGlobal("document", doc);
  vi.stubGlobal("window", { matchMedia: () => ({ matches: false }) });
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => setTimeout(() => callback(performance.now()), 16));
  vi.stubGlobal("cancelAnimationFrame", (id: ReturnType<typeof setTimeout>) => clearTimeout(id));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("popup battle playback", () => {
  it("caps sprite counts while keeping full army labels and exact round survivors", () => {
    const container = new Element();
    const onRound = vi.fn(), onDone = vi.fn();
    playBattle(container as unknown as HTMLElement, player, enemy, rounds, { onRound, onDone });
    expect(container.all().filter(e => e.className === "battle-actor")).toHaveLength(42);
    expect(container.all().some(e => e.attributes.get("aria-label") === "swordsmen: 40")).toBe(true);
    vi.advanceTimersByTime(7500);
    expect(onRound.mock.calls.map(call => call[0])).toEqual([0, 1, 2, 3]);
    expect(onRound.mock.calls[3][1]).toEqual(rounds[3]);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cancels pending rounds when Skip or another screen replaces the popup", () => {
    const onRound = vi.fn(), onDone = vi.fn();
    const stop = playBattle(new Element() as unknown as HTMLElement, player, enemy, rounds, { onRound, onDone });
    vi.advanceTimersByTime(2400);
    expect(onRound).toHaveBeenCalledTimes(1);
    stop(); stop();
    vi.advanceTimersByTime(10000);
    expect(onRound).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
  });

  it("pauses round progression in a hidden tab", () => {
    const onRound = vi.fn(), onDone = vi.fn();
    playBattle(new Element() as unknown as HTMLElement, player, enemy, rounds, { onRound, onDone });
    doc.visibilityState = "hidden";
    vi.advanceTimersByTime(10000);
    expect(onRound).not.toHaveBeenCalled();
    doc.visibilityState = "visible";
    vi.advanceTimersByTime(7500);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("respects reduced motion and still delivers all round counts", () => {
    vi.stubGlobal("window", { matchMedia: () => ({ matches: true }) });
    const onRound = vi.fn(), onDone = vi.fn();
    const container = new Element();
    playBattle(container as unknown as HTMLElement, player, enemy, rounds, { onRound, onDone });
    expect(container.children[0].classList.contains("reduced-motion")).toBe(true);
    vi.advanceTimersByTime(640);
    expect(onRound).toHaveBeenCalledTimes(4);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("holds rounds while the portal pauses an otherwise visible popup", () => {
    let paused = true;
    const onRound = vi.fn(), onDone = vi.fn();
    playBattle(new Element() as unknown as HTMLElement, player, enemy, rounds, { onRound, onDone, isPaused: () => paused });
    vi.advanceTimersByTime(10000);
    expect(onRound).not.toHaveBeenCalled();
    paused = false;
    vi.advanceTimersByTime(7500);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("logs once and shows the saved result after a playback error", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const onDone = vi.fn();
    playBattle(new Element() as unknown as HTMLElement, player, enemy, rounds, { onRound: () => { throw new Error("DOM unavailable"); }, onDone });
    vi.advanceTimersByTime(10000);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
