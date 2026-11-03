// Small arcade-style blips for selecting text in the guide: a short square-wave "ti" for each word
// that joins the selection and a two-note chirp when the selection is done. No speech, no files:
// generated with Web Audio, quiet, and switchable off (remembered per browser).

const KEY = "uzyra-study-sound";

let ctx: AudioContext | null = null;
let lastBlip = 0;
let step = 0;

export function soundOn(): boolean {
  try {
    return window.localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundOn(on: boolean): void {
  try {
    window.localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    /* storage can be blocked; the choice lasts this visit only */
  }
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(freq: number, start: number, length: number, volume: number) {
  const a = audio();
  if (!a) return;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(freq, a.currentTime + start);
  gain.gain.setValueAtTime(0, a.currentTime + start);
  gain.gain.linearRampToValueAtTime(volume, a.currentTime + start + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + start + length);
  osc.connect(gain).connect(a.destination);
  osc.start(a.currentTime + start);
  osc.stop(a.currentTime + start + length + 0.02);
}

/** Wakes the audio from a press, so the first blip is not lost (browsers need a gesture). */
export function primeSound(): void {
  if (soundOn()) audio();
}

/** One short "ti" for a new word; quick drags make a "titititi" (at most one per 28ms). */
export function blip(): void {
  if (!soundOn()) return;
  const now = performance.now();
  if (now - lastBlip < 28) return;
  lastBlip = now;
  step = (step + 1) % 6;
  tone(1180 + step * 90, 0, 0.03, 0.035);
}

/** The selection is done. */
export function chirp(): void {
  if (!soundOn()) return;
  tone(1320, 0, 0.05, 0.04);
  tone(1980, 0.055, 0.08, 0.04);
}

/** A quick rising or falling sweep (the "whoosh" of the round menu). */
function sweep(from: number, to: number, length: number, volume: number, type: OscillatorType) {
  const a = audio();
  if (!a) return;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, a.currentTime);
  osc.frequency.exponentialRampToValueAtTime(to, a.currentTime + length);
  gain.gain.setValueAtTime(0, a.currentTime);
  gain.gain.linearRampToValueAtTime(volume, a.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + length);
  osc.connect(gain).connect(a.destination);
  osc.start();
  osc.stop(a.currentTime + length + 0.02);
}

/** The round menu opens: a short rising electronic sweep. */
export function menuOpenSound(): void {
  if (!soundOn()) return;
  sweep(360, 1500, 0.16, 0.03, "sawtooth");
  tone(1760, 0.12, 0.05, 0.025);
}

/** The round menu closes: the same sweep, falling. */
export function menuCloseSound(): void {
  if (!soundOn()) return;
  sweep(1300, 420, 0.12, 0.025, "sawtooth");
}

const SCALE = [784, 880, 1047, 1175, 1319, 1568, 1760, 2093];

/** Passing over an option: one note of a small rising scale, so sliding across them plays a tune. */
export function optionNote(index: number): void {
  if (!soundOn()) return;
  tone(SCALE[index % SCALE.length], 0, 0.045, 0.03);
}

/** An option is chosen: a three-note run up. */
export function confirmSound(): void {
  if (!soundOn()) return;
  tone(1047, 0, 0.05, 0.04);
  tone(1319, 0.05, 0.05, 0.04);
  tone(1568, 0.1, 0.09, 0.04);
}
