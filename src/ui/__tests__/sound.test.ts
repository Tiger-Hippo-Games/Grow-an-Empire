import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSound } from "../sound";

beforeEach(() => {
  vi.stubGlobal("window", { addEventListener: vi.fn() });
  vi.stubGlobal("document", { addEventListener: vi.fn() });
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("optional audio failures", () => {
  it("closes partially initialized contexts and logs initialization failure only once", () => {
    const close = vi.fn().mockResolvedValue(undefined);
    window.AudioContext = class {
      createGain() { throw new Error("audio unavailable"); }
      close = close;
    } as unknown as typeof AudioContext;
    const sound = createSound(false);
    expect(() => sound.play("click")).not.toThrow();
    expect(() => sound.play("click")).not.toThrow();
    expect(close).toHaveBeenCalledTimes(2);
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it("handles rejected resume/suspend promises without flooding the console", async () => {
    const resume = vi.fn().mockRejectedValue(new Error("resume blocked"));
    const suspend = vi.fn().mockRejectedValue(new Error("suspend failed"));
    window.AudioContext = class {
      state = "suspended";
      createGain() { return { gain: { value: 0 }, connect: vi.fn() }; }
      resume = resume;
      suspend = suspend;
    } as unknown as typeof AudioContext;
    const sound = createSound(false);
    sound.setMuted(false);
    sound.setMuted(true);
    sound.setMuted(false);
    sound.setMuted(true);
    await Promise.resolve();
    expect(resume).toHaveBeenCalledTimes(2);
    expect(suspend).toHaveBeenCalledTimes(2);
    expect(console.warn).toHaveBeenCalledTimes(2);
  });
});
