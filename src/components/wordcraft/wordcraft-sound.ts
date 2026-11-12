// Wordcraft's small sounds, made with Web Audio (no files): a soft tick when a letter joins the
// path, a short rise for a word found, a little run of notes for a finished puzzle, and a low
// note for a miss. Quiet on purpose; the player can mute them. Nothing plays before a tap.
let context: AudioContext | null = null;

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
  start: number,
  length: number,
  volume: number,
  type: OscillatorType = "sine",
) {
  const ctx = audio();
  if (!ctx) return;
  const t = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(volume, t + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + length + 0.02);
}

export const sounds = {
  /** A letter joins the path; a little higher for each letter. */
  tick(step: number) {
    tone(520 + Math.min(step, 8) * 40, 0, 0.05, 0.035);
  },
  word() {
    tone(660, 0, 0.12, 0.06);
    tone(880, 0.07, 0.16, 0.05);
  },
  done() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.22, 0.05));
  },
  miss() {
    tone(220, 0, 0.14, 0.04, "triangle");
  },
};
