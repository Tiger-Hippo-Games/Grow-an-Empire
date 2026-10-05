/**
 * Small synthesized sound effects (Web Audio, no audio files to download or
 * ship), tuned to the Bharatvarsha setting: a temple bell when a move ends,
 * the shankh (conch) as the armies meet, dhol beats and a Bhupali phrase on
 * victory. The audio context starts on the first click or key press, as browsers
 * require, and is suspended while the game is muted or the tab is hidden.
 */
export type SoundName = "click" | "build" | "complete" | "trained" | "coins" | "warning" | "hit" | "victory" | "defeat" | "conch";

type Note = { frequency: number; at: number; length: number; type?: OscillatorType; volume?: number; slideTo?: number };

const SOUNDS: Record<SoundName, Note[]> = {
  click: [{ frequency: 660, at: 0, length: 0.05, type: "triangle", volume: 0.12 }],
  build: [{ frequency: 180, at: 0, length: 0.08, type: "square", volume: 0.07 }, { frequency: 150, at: 0.1, length: 0.08, type: "square", volume: 0.07 }],
  // A small temple bell: a bright strike and its octave, ringing out.
  complete: [{ frequency: 1046, at: 0, length: 0.7, type: "sine", volume: 0.07 }, { frequency: 2093, at: 0, length: 0.35, type: "sine", volume: 0.03 }, { frequency: 1568, at: 0.02, length: 0.5, type: "sine", volume: 0.025 }],
  trained: [{ frequency: 392, at: 0, length: 0.08, type: "sawtooth", volume: 0.05 }, { frequency: 523, at: 0.08, length: 0.12, type: "sawtooth", volume: 0.05 }],
  coins: [{ frequency: 1318, at: 0, length: 0.06, type: "square", volume: 0.05 }, { frequency: 1760, at: 0.06, length: 0.1, type: "square", volume: 0.05 }],
  warning: [{ frequency: 220, at: 0, length: 0.18, type: "triangle", volume: 0.12, slideTo: 170 }],
  hit: [{ frequency: 140, at: 0, length: 0.09, type: "sawtooth", volume: 0.08, slideTo: 60 }, { frequency: 900, at: 0, length: 0.03, type: "square", volume: 0.03 }],
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
    { frequency: 233, at: 0, length: 1.1, type: "sawtooth", volume: 0.035, slideTo: 247 },
    { frequency: 466, at: 0.05, length: 1.0, type: "triangle", volume: 0.05, slideTo: 494 },
    { frequency: 699, at: 0.1, length: 0.9, type: "sine", volume: 0.025, slideTo: 741 },
  ],
  defeat: [
    { frequency: 330, at: 0, length: 0.25, type: "triangle" }, { frequency: 262, at: 0.25, length: 0.25, type: "triangle" },
    { frequency: 196, at: 0.5, length: 0.6, type: "triangle", slideTo: 180 },
  ],
};

export function createSound(initiallyMuted: boolean) {
  let muted = initiallyMuted;
  let context: AudioContext | null = null;
  let master: GainNode | null = null;

  function ensureContext(): AudioContext | null {
    if (context) return context;
    const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return null;
    try {
      context = new Context();
      master = context.createGain();
      master.gain.value = 0.6;
      master.connect(context.destination);
    } catch {
      context = null;
    }
    return context;
  }

  // Browsers only allow audio after a user gesture.
  const unlock = (): void => {
    if (muted) return;
    const audio = ensureContext();
    if (audio?.state === "suspended") void audio.resume().catch(() => undefined);
  };
  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("keydown", unlock);
  document.addEventListener("visibilitychange", () => {
    if (!context) return;
    if (document.visibilityState === "hidden") void context.suspend().catch(() => undefined);
    else if (!muted) void context.resume().catch(() => undefined);
  });

  function play(name: SoundName): void {
    if (muted) return;
    const audio = ensureContext();
    if (!audio || !master || audio.state !== "running") return;
    try {
      const now = audio.currentTime;
      for (const note of SOUNDS[name]) {
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.type = note.type ?? "sine";
        oscillator.frequency.setValueAtTime(note.frequency, now + note.at);
        if (note.slideTo) oscillator.frequency.exponentialRampToValueAtTime(note.slideTo, now + note.at + note.length);
        const volume = note.volume ?? 0.1;
        gain.gain.setValueAtTime(0.0001, now + note.at);
        gain.gain.exponentialRampToValueAtTime(volume, now + note.at + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + note.at + note.length);
        oscillator.connect(gain).connect(master);
        oscillator.start(now + note.at);
        oscillator.stop(now + note.at + note.length + 0.02);
      }
    } catch {
      // Audio is decoration: never let it break the game.
    }
  }

  return {
    play,
    get muted() { return muted; },
    setMuted(value: boolean) {
      muted = value;
      if (!context) { if (!muted) unlock(); return; }
      if (muted) void context.suspend().catch(() => undefined);
      else void context.resume().catch(() => undefined);
    },
  };
}

export type Sound = ReturnType<typeof createSound>;
