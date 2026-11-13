// Pairs' sounds, made with Web Audio (no files). The two that matter most are right and wrong:
// they play the moment the second card is tapped (the audio is woken on the first touch of the
// board, so even the first one is not late). Right is a quick rising "ding-ding", higher with every
// match in a row; wrong is a short low buzz. A tick marks each of the last five seconds, and short
// tunes mark "time's up" and a cleared board. Muted from the game's sound button.
let context: AudioContext | null = null;

const MUTE_KEY = "uzyra-pairs-muted";

export function readMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveMuted(muted: boolean) {
  try {
    window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    /* kept for this visit only */
  }
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  context ??= new Ctor();
  if (context.state === "suspended") void context.resume().catch(() => undefined);
  return context;
}

function tone(
  freq: number,
  length: number,
  volume: number,
  start = 0,
  type: OscillatorType = "sine",
  slideTo?: number,
) {
  const ctx = audio();
  if (!ctx) return;
  const t = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + length);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(volume, t + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + length + 0.02);
}

const bell = (freq: number, volume: number, start = 0) => {
  tone(freq, 0.42, volume, start);
  tone(freq * 2.76, 0.18, volume * 0.3, start);
};

export const pairsSounds = {
  /** Wakes the audio on the first touch so the first right / wrong sound is not late. */
  warm() {
    audio();
  },
  /** A right match; `streak` is how many in a row (1, 2, 3...). */
  right(streak: number) {
    const lift = Math.pow(2, Math.min(streak - 1, 6) / 12); // a semitone higher per match
    bell(1046.5 * lift, 0.09);
    bell(1567.98 * lift, 0.075, 0.06);
    if (streak >= 5) bell(2093 * lift, 0.04, 0.14);
  },
  wrong() {
    tone(180, 0.24, 0.09, 0, "sawtooth", 110);
    tone(90, 0.24, 0.06, 0, "square");
  },
  tick() {
    tone(1400, 0.05, 0.05, 0, "square");
  },
  timeUp() {
    [659.25, 523.25, 392].forEach((f, i) => tone(f, 0.28, 0.07, i * 0.14, "triangle"));
  },
  cleared() {
    [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((f, i) => bell(f, 0.06, i * 0.08));
  },
};
