// Wordcraft's sounds, made with Web Audio (no files). Tracing a word plays a little tune: each
// letter is the next note of a pentatonic scale, so any path sounds pleasant, and stepping back
// plays the note softer and lower. A found word rings; words found in a row ring brighter.
// "Right word, wrong route" has its own two-note "almost". Hints chime, undo steps down, and a
// finished round plays a short run. The player can mute everything; nothing plays before a tap.
let context: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  // iPhone and iPad mute web sounds while the ring/silent switch is on silent. A game's sounds are
  // its feedback, so ask Safari (16.4+) to treat them as playback; older browsers ignore this.
  const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
  if (session && session.type !== "playback") {
    try {
      session.type = "playback";
    } catch {
      /* not allowed here; the sounds still play when the phone is not on silent */
    }
  }
  context ??= new Ctor();
  if (context.state === "suspended") void context.resume().catch(() => undefined);
  return context;
}

type Voice = { type?: OscillatorType; volume: number; length: number; start?: number };

function tone(freq: number, { type = "sine", volume, length, start = 0 }: Voice) {
  const ctx = audio();
  if (!ctx) return;
  const t = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(volume, t + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + length + 0.02);
}

/** A soft pluck: a sine with a quieter triangle an octave up. */
function pluck(freq: number, volume: number, start = 0, length = 0.2) {
  tone(freq, { volume, length, start });
  tone(freq * 2, { type: "triangle", volume: volume * 0.25, length: length * 0.6, start });
}

/** A bell: a sine with an inharmonic partial that fades first. */
function bell(freq: number, volume: number, start = 0) {
  tone(freq, { volume, length: 0.5, start });
  tone(freq * 2.76, { volume: volume * 0.35, length: 0.22, start });
}

// C major pentatonic from C5 up: C D E G A, then the next octave.
const SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760];
const note = (step: number) => SCALE[Math.min(Math.max(step, 1), SCALE.length) - 1];

export const sounds = {
  /** A letter joins the path: the `step`th note of the tune. */
  tick(step: number) {
    pluck(note(step), 0.07, 0, 0.18);
  },
  /** The path loses its last letter (back to `step` letters). */
  back(step: number) {
    pluck(note(step) / 2, 0.04, 0, 0.12);
  },
  /**
   * A word is found; `streak` is how many in a row without a miss (1, 2, 3...). It has to stand
   * out from the tracing tune that was just playing, so it is louder and lower than the old bells:
   * a warm major chord under a bright two-note "ding-ding", starting just after the last letter.
   */
  word(streak: number) {
    const lift = streak >= 3 ? 1.26 : streak === 2 ? 1.12 : 1;
    const at = 0.04;
    pluck(523.25 * lift, 0.12, at, 0.36);
    pluck(659.25 * lift, 0.09, at, 0.36);
    bell(1046.5 * lift, 0.13, at);
    bell(1567.98 * lift, 0.11, at + 0.09);
    if (streak >= 2) bell(2093 * lift, 0.07, at + 0.18);
    if (streak >= 3)
      [2637, 3136, 3520].forEach((f, i) =>
        tone(f, { volume: 0.03, length: 0.12, start: at + 0.26 + i * 0.05 }),
      );
  },
  /** The right word on a route that blocks the grid: close, but not this way. */
  almost() {
    pluck(783.99, 0.06, 0, 0.16);
    pluck(659.25, 0.05, 0.11, 0.2);
  },
  miss() {
    tone(196, { type: "triangle", volume: 0.07, length: 0.18 });
  },
  /** A hint shows `count` more letters: one chime each. */
  hint(count: number) {
    for (let i = 0; i < count; i++) bell(1046.5 + i * 220, 0.045, i * 0.09);
  },
  undo() {
    pluck(783.99, 0.05, 0, 0.14);
    pluck(587.33, 0.045, 0.09, 0.18);
  },
  /** The whole grid is done. */
  done() {
    [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((f, i) => pluck(f, 0.07, i * 0.08, 0.3));
    [1046.5, 1318.51, 1567.98].forEach((f) => bell(f, 0.035, 0.45));
  },
};
