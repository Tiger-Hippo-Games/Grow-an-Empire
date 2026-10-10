/**
 * Small synthesized sound effects (Web Audio, no audio files to download or
 * ship), tuned to the Bharatvarsha setting: a temple bell when a move ends,
 * the shankh (conch) as the armies meet, dhol beats and a Bhupali phrase on
 * victory. The audio context starts on the first click or key press, as browsers
 * require, and is suspended while the game is muted or the tab is hidden.
 */
export type SoundName = "click" | "build" | "gather" | "complete" | "trained" | "coins" | "warning" | "hit" | "victory" | "defeat" | "conch";

type Note = { frequency: number; at: number; length: number; type?: OscillatorType; volume?: number; slideTo?: number; attack?: number };

const SOUNDS: Record<SoundName, Note[]> = {
  click: [{ frequency: 520, at: 0, length: 0.045, type: "sine", volume: 0.07, slideTo: 390 }],
  build: [{ frequency: 160, at: 0, length: 0.10, type: "sine", volume: 0.12, slideTo: 75 }, { frequency: 460, at: 0.015, length: 0.07, type: "triangle", volume: 0.035 }, { frequency: 130, at: 0.13, length: 0.09, type: "sine", volume: 0.08, slideTo: 65 }],
  gather: [{ frequency: 392, at: 0, length: 0.15, type: "triangle", volume: 0.06 }, { frequency: 494, at: 0.09, length: 0.15, type: "sine", volume: 0.06 }, { frequency: 587, at: 0.18, length: 0.24, type: "sine", volume: 0.05 }],
  // A small temple bell: a bright strike and its octave, ringing out.
  complete: [{ frequency: 1046, at: 0, length: 0.7, type: "sine", volume: 0.07 }, { frequency: 2093, at: 0, length: 0.35, type: "sine", volume: 0.03 }, { frequency: 1568, at: 0.02, length: 0.5, type: "sine", volume: 0.025 }],
  trained: [{ frequency: 392, at: 0, length: 0.08, type: "triangle", volume: 0.025 }, { frequency: 523, at: 0.08, length: 0.12, type: "triangle", volume: 0.025 }],
  coins: [{ frequency: 1318, at: 0, length: 0.07, type: "sine", volume: 0.045 }, { frequency: 1760, at: 0.06, length: 0.14, type: "sine", volume: 0.035 }],
  warning: [{ frequency: 220, at: 0, length: 0.18, type: "triangle", volume: 0.12, slideTo: 170 }],
  hit: [{ frequency: 130, at: 0, length: 0.13, type: "sine", volume: 0.13, slideTo: 48 }, { frequency: 350, at: 0.025, length: 0.07, type: "triangle", volume: 0.055, slideTo: 120 }],
  // Dhol beats under a rising Bhupali phrase (Sa Re Ga Pa Dha Sa).
  victory: [
    { frequency: 90, at: 0, length: 0.14, type: "sine", volume: 0.16, slideTo: 55 }, { frequency: 90, at: 0.28, length: 0.14, type: "sine", volume: 0.16, slideTo: 55 },
    { frequency: 140, at: 0.42, length: 0.08, type: "sine", volume: 0.1, slideTo: 90 }, { frequency: 90, at: 0.56, length: 0.14, type: "sine", volume: 0.16, slideTo: 55 },
    { frequency: 392, at: 0, length: 0.14, type: "triangle" }, { frequency: 440, at: 0.14, length: 0.14, type: "triangle" },
    { frequency: 494, at: 0.28, length: 0.14, type: "triangle" }, { frequency: 587, at: 0.42, length: 0.14, type: "triangle" },
    { frequency: 659, at: 0.56, length: 0.14, type: "triangle" }, { frequency: 784, at: 0.7, length: 0.5, type: "triangle" },
  ],
  // The shankh: a breathy low call that swells and bends up a little.
  conch: [
    { frequency: 233, at: 0, length: 1.1, type: "triangle", volume: 0.05, slideTo: 247, attack: 0.16 },
    { frequency: 466, at: 0.05, length: 1.0, type: "sine", volume: 0.04, slideTo: 494, attack: 0.14 },
    { frequency: 699, at: 0.1, length: 0.9, type: "sine", volume: 0.02, slideTo: 741, attack: 0.12 },
  ],
  defeat: [
    { frequency: 330, at: 0, length: 0.25, type: "triangle" }, { frequency: 262, at: 0.25, length: 0.25, type: "triangle" },
    { frequency: 196, at: 0.5, length: 0.6, type: "triangle", slideTo: 180 },
  ],
};

export function createSound(initiallyMuted: boolean) {
  let muted = initiallyMuted;
  let paused = false;
  let unlocked = false;
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  const voices = new Set<OscillatorNode>();
  const lastPlayed = new Map<SoundName, number>();
  const warned = new Set<string>();
  const warnOnce = (operation: string, error: unknown): void => {
    if (warned.has(operation)) return;
    warned.add(operation);
    console.warn(`[Grow an Empire] Audio ${operation} failed; continuing without that sound.`, error);
  };

  function ensureContext(): AudioContext | null {
    if (context) return context;
    const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return null;
    try {
      context = new Context();
      const gain = context.createGain();
      gain.gain.value = 0.5;
      if (typeof context.createDynamicsCompressor === "function") {
        const limiter = context.createDynamicsCompressor();
        limiter.threshold.value = -18;
        limiter.knee.value = 18;
        limiter.ratio.value = 4;
        limiter.attack.value = 0.004;
        limiter.release.value = 0.18;
        gain.connect(limiter).connect(context.destination);
      } else gain.connect(context.destination);
      master = gain;
    } catch (error) {
      // Close a partially initialized context so retries don't leak resources.
      const partial = context;
      context = null;
      master = null;
      if (partial) void partial.close().catch((cause: unknown) => warnOnce("cleanup", cause));
      warnOnce("initialization", error);
    }
    return context;
  }

  // Browsers only allow audio after a user gesture.
  const unlock = (): void => {
    unlocked = true;
    if (muted || paused || document.visibilityState === "hidden") return;
    const audio = ensureContext();
    if (audio?.state === "suspended") void audio.resume().catch((error: unknown) => warnOnce("resume", error));
  };
  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("keydown", unlock);
  document.addEventListener("visibilitychange", () => {
    if (!context) return;
    if (document.visibilityState === "hidden") { stopVoices(); void context.suspend().catch((error: unknown) => warnOnce("suspend", error)); }
    else if (!muted && !paused) void context.resume().catch((error: unknown) => warnOnce("resume", error));
  });

  function stopVoices(): void {
    for (const voice of voices) {
      try { voice.stop(); } catch (error) { warnOnce("stop", error); }
    }
    voices.clear();
    lastPlayed.clear();
  }

  function play(name: SoundName): void {
    if (muted || paused || !unlocked || document.visibilityState === "hidden") return;
    const audio = ensureContext();
    if (!audio || !master || audio.state !== "running") return;
    try {
      const now = audio.currentTime;
      // Rapid repeated taps or same-frame training events should not stack voices.
      const gap = name === "warning" ? 0.45 : name === "trained" ? 0.2 : 0.06;
      if (now - (lastPlayed.get(name) ?? -Infinity) < gap) return;
      lastPlayed.set(name, now);
      for (const note of SOUNDS[name]) {
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.type = note.type ?? "sine";
        oscillator.frequency.setValueAtTime(note.frequency, now + note.at);
        if (note.slideTo) oscillator.frequency.exponentialRampToValueAtTime(note.slideTo, now + note.at + note.length);
        const volume = note.volume ?? 0.1;
        gain.gain.setValueAtTime(0.0001, now + note.at);
        gain.gain.exponentialRampToValueAtTime(volume, now + note.at + (note.attack ?? 0.007));
        gain.gain.exponentialRampToValueAtTime(0.0001, now + note.at + note.length);
        oscillator.connect(gain).connect(master);
        voices.add(oscillator);
        oscillator.onended = () => { voices.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
        oscillator.start(now + note.at);
        oscillator.stop(now + note.at + note.length + 0.02);
      }
    } catch (error) {
      // Audio is decoration: never let it break the game.
      warnOnce("playback", error);
    }
  }

  return {
    play,
    get muted() { return muted; },
    setPaused(value: boolean) {
      paused = value;
      if (!context) return;
      if (paused) { stopVoices(); void context.suspend().catch((error: unknown) => warnOnce("suspend", error)); }
      else if (!muted && document.visibilityState !== "hidden") void context.resume().catch((error: unknown) => warnOnce("resume", error));
    },
    setMuted(value: boolean) {
      muted = value;
      if (!context) { if (!muted && unlocked) unlock(); return; }
      if (muted) { stopVoices(); void context.suspend().catch((error: unknown) => warnOnce("suspend", error)); }
      else if (!paused && document.visibilityState !== "hidden") void context.resume().catch((error: unknown) => warnOnce("resume", error));
    },
  };
}

export type Sound = ReturnType<typeof createSound>;
