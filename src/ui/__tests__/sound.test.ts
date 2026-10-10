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
    const gesture = vi.mocked(window.addEventListener).mock.calls.find(call => call[0] === "pointerdown")![1] as () => void;
    gesture();
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
    const gesture = vi.mocked(window.addEventListener).mock.calls.find(call => call[0] === "pointerdown")![1] as () => void;
    gesture();
    sound.setMuted(true);
    sound.setMuted(false);
    sound.setMuted(true);
    await Promise.resolve();
    expect(resume).toHaveBeenCalledTimes(2);
    expect(suspend).toHaveBeenCalledTimes(2);
    expect(console.warn).toHaveBeenCalledTimes(2);
  });
});

describe("audio interaction and cleanup", () => {
  it("does not create audio before a player gesture, including restored unmute settings", () => {
    const Context = vi.fn();
    window.AudioContext = Context as unknown as typeof AudioContext;
    const sound = createSound(false);
    sound.play("complete");
    sound.setMuted(false);
    sound.setPaused(false);
    expect(Context).not.toHaveBeenCalled();
  });

  it("coalesces rapid taps and stops voices on mute or portal pause", () => {
    const gain = () => ({ gain: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: (target: unknown) => target, disconnect: vi.fn() });
    const voices: Array<{ stop: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>; onended?: () => void }> = [];
    window.AudioContext = class {
      state = "running";
      currentTime = 0;
      destination = {};
      createGain = gain;
      createOscillator() {
        const voice = { stop: vi.fn(), start: vi.fn(), disconnect: vi.fn(), onended: undefined as (() => void) | undefined, frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: (target: unknown) => target };
        voices.push(voice);
        return voice;
      }
      suspend() { return Promise.resolve(); }
      resume() { return Promise.resolve(); }
    } as unknown as typeof AudioContext;
    const sound = createSound(false);
    const gesture = vi.mocked(window.addEventListener).mock.calls.find(call => call[0] === "pointerdown")![1] as () => void;
    gesture();
    sound.play("click"); sound.play("click");
    expect(voices).toHaveLength(1);
    sound.setMuted(true);
    expect(voices[0].stop).toHaveBeenCalledTimes(2); // scheduled end, then immediate stop
    voices[0].onended!();
    expect(voices[0].disconnect).toHaveBeenCalledTimes(1);
    sound.setMuted(false);
    sound.play("gather");
    expect(voices).toHaveLength(4);
    sound.setPaused(true);
    expect(voices.slice(1).every(voice => voice.stop.mock.calls.length === 2)).toBe(true);
    sound.play("hit");
    expect(voices).toHaveLength(4);
  });
});
