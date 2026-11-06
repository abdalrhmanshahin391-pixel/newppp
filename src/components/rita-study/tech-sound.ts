// Small arcade-style blips for selecting text in the guide: a short square-wave "ti" for each word
// that joins the selection and a two-note chirp when the selection is done. No speech, no files:
// generated with Web Audio, quiet, and switchable off (remembered per browser).

const KEY = "uzyra-study-sound";

let ctx: AudioContext | null = null;
let lastBlip = 0;
let step = 0;

/** A sound that was not allowed to start within this many ms is dropped, not played late. */
const STALE_MS = 400;

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

/** The audio context, made on first use (and again if the browser closed the old one). */
function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx && (ctx.state as string) === "closed") ctx = null;
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
  return ctx;
}

/**
 * Makes sure the sound is awake. Safari only lets sound start from a real touch, press or key, and
 * it puts the sound to sleep again ("interrupted") when the learner switches tabs or the screen
 * locks. So this is called straight from those events (see `installSoundUnlock`): it creates the
 * context if needed, wakes it from any state that is not "running", and plays one silent sample,
 * which is what unlocks audio on iPhone and iPad.
 */
export function unlockSound(): void {
  if (!soundOn()) return;
  const a = audio();
  if (!a) return;
  if (a.state !== "running") void a.resume().catch(() => undefined);
  try {
    const source = a.createBufferSource();
    source.buffer = a.createBuffer(1, 1, 22050);
    source.connect(a.destination);
    source.start(0);
  } catch {
    /* the silent sample is a nicety; the wake-up above is what matters */
  }
}

/** Kept for the selection code: wake the sound from a press. */
export function primeSound(): void {
  unlockSound();
}

/**
 * Listens for the learner's first touch (and every one after a sleep) anywhere on the page, so the
 * sound is already awake before the first selection or tap on the circle. Also tries to wake it
 * when the learner comes back to the tab. Returns a function that stops listening.
 */
export function installSoundUnlock(): () => void {
  const wake = () => {
    if (!ctx || ctx.state !== "running") unlockSound();
  };
  const events = ["pointerdown", "pointerup", "touchend", "click", "keydown"] as const;
  for (const name of events) window.addEventListener(name, wake, { capture: true, passive: true });
  const back = () => {
    if (document.visibilityState === "hidden") return;
    // No gesture here, so this may be refused: then the next touch wakes it.
    if (ctx && ctx.state !== "running") void ctx.resume().catch(() => undefined);
  };
  document.addEventListener("visibilitychange", back);
  window.addEventListener("pageshow", back);
  window.addEventListener("focus", back);
  return () => {
    for (const name of events) window.removeEventListener(name, wake, { capture: true });
    document.removeEventListener("visibilitychange", back);
    window.removeEventListener("pageshow", back);
    window.removeEventListener("focus", back);
  };
}

/**
 * Runs `play` once the sound is running. If it is asleep, wake it first and play only if it woke
 * up straight away; a sound that would come out late, or all at once with others, is dropped.
 */
function whenRunning(play: (a: AudioContext) => void) {
  const a = audio();
  if (!a) return;
  if (a.state === "running") {
    play(a);
    return;
  }
  const asked = performance.now();
  void a
    .resume()
    .then(() => {
      if (a.state === "running" && performance.now() - asked < STALE_MS) play(a);
    })
    .catch(() => undefined);
}

function tone(a: AudioContext, freq: number, start: number, length: number, volume: number) {
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

/** One short "ti" for a new word; quick drags make a "titititi" (at most one per 28ms). */
export function blip(): void {
  if (!soundOn()) return;
  const now = performance.now();
  if (now - lastBlip < 28) return;
  lastBlip = now;
  step = (step + 1) % 6;
  const freq = 1180 + step * 90;
  whenRunning((a) => tone(a, freq, 0, 0.03, 0.035));
}

/** The selection is done. */
export function chirp(): void {
  if (!soundOn()) return;
  whenRunning((a) => {
    tone(a, 1320, 0, 0.05, 0.04);
    tone(a, 1980, 0.055, 0.08, 0.04);
  });
}

/** A quick rising or falling sweep (the "whoosh" of the round menu). */
function sweep(
  a: AudioContext,
  from: number,
  to: number,
  length: number,
  volume: number,
  type: OscillatorType,
) {
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
  whenRunning((a) => {
    sweep(a, 360, 1500, 0.16, 0.03, "sawtooth");
    tone(a, 1760, 0.12, 0.05, 0.025);
  });
}

/** The round menu closes: the same sweep, falling. */
export function menuCloseSound(): void {
  if (!soundOn()) return;
  whenRunning((a) => sweep(a, 1300, 420, 0.12, 0.025, "sawtooth"));
}

const SCALE = [784, 880, 1047, 1175, 1319, 1568, 1760, 2093];

/** Passing over an option: one note of a small rising scale, so sliding across them plays a tune. */
export function optionNote(index: number): void {
  if (!soundOn()) return;
  const freq = SCALE[index % SCALE.length];
  whenRunning((a) => tone(a, freq, 0, 0.045, 0.03));
}

/** An option is chosen: a three-note run up. */
export function confirmSound(): void {
  if (!soundOn()) return;
  whenRunning((a) => {
    tone(a, 1047, 0, 0.05, 0.04);
    tone(a, 1319, 0.05, 0.05, 0.04);
    tone(a, 1568, 0.1, 0.09, 0.04);
  });
}

// ── Starting a call and entering a lesson ───────────────────────────────────────────────────────

/** A soft sine "bell": quick attack, long fade. */
function bell(a: AudioContext, freq: number, start: number, length: number, volume: number) {
  const osc = a.createOscillator();
  const gain = a.createGain();
  const at = a.currentTime + start;
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, at);
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(volume, at + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
  osc.connect(gain).connect(a.destination);
  osc.start(at);
  osc.stop(at + length + 0.05);
}

type HoldVoice = { low: OscillatorNode; high: OscillatorNode; gain: GainNode };
let holdVoice: HoldVoice | null = null;

/**
 * Holding the call circle: a soft two-oscillator tone (a root and its fifth, through a gentle
 * low-pass) whose pitch and volume rise with the fill and fall again as it drains. Called once per
 * frame with the current fill; at 0 the tone fades out and stops.
 */
export function holdTone(fill: number): void {
  if (fill <= 0 || !soundOn()) {
    endHoldTone();
    return;
  }
  const a = audio();
  if (!a) return;
  if (a.state !== "running") {
    void a.resume().catch(() => undefined);
    return;
  }
  const now = a.currentTime;
  if (!holdVoice) {
    const low = a.createOscillator();
    const high = a.createOscillator();
    const filter = a.createBiquadFilter();
    const gain = a.createGain();
    low.type = "sine";
    high.type = "triangle";
    filter.type = "lowpass";
    filter.frequency.value = 1600;
    gain.gain.setValueAtTime(0, now);
    low.connect(filter);
    high.connect(filter);
    filter.connect(gain).connect(a.destination);
    low.start(now);
    high.start(now);
    holdVoice = { low, high, gain };
  }
  const freq = 196 * Math.pow(2, fill * 1.5);
  holdVoice.low.frequency.setTargetAtTime(freq, now, 0.03);
  holdVoice.high.frequency.setTargetAtTime(freq * 1.5, now, 0.03);
  holdVoice.gain.gain.setTargetAtTime(0.02 + fill * 0.035, now, 0.05);
}

/** Fades the hold tone out (let go, drained, or full). */
export function endHoldTone(): void {
  const voice = holdVoice;
  holdVoice = null;
  const a = ctx;
  if (!voice || !a) return;
  const now = a.currentTime;
  voice.gain.gain.cancelScheduledValues(now);
  voice.gain.gain.setTargetAtTime(0, now, 0.04);
  voice.low.stop(now + 0.3);
  voice.high.stop(now + 0.3);
}

/** The circle is full and the call starts: a small rising major chord. */
export function holdDoneSound(): void {
  endHoldTone();
  if (!soundOn()) return;
  whenRunning((a) => {
    bell(a, 784, 0, 0.5, 0.05);
    bell(a, 988, 0.06, 0.5, 0.04);
    bell(a, 1175, 0.12, 0.7, 0.04);
  });
}

/**
 * The UZYRA intro starts drawing: an airy breath (filtered noise sweeping up while the letters
 * draw) that settles on a soft open chord as the hairline opens. Plays only when the sound is
 * already awake (a tap on the lesson wakes it), never late.
 */
export function introSound(): void {
  if (!soundOn()) return;
  const a = ctx;
  if (!a || a.state !== "running") return;
  const now = a.currentTime;
  const length = 1.1;
  const noise = a.createBuffer(1, Math.ceil(a.sampleRate * length), a.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  const source = a.createBufferSource();
  const band = a.createBiquadFilter();
  const gain = a.createGain();
  source.buffer = noise;
  band.type = "bandpass";
  band.Q.value = 1.2;
  band.frequency.setValueAtTime(380, now);
  band.frequency.exponentialRampToValueAtTime(2600, now + length);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.03, now + 0.35);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + length);
  source.connect(band).connect(gain).connect(a.destination);
  source.start(now);
  source.stop(now + length);
  bell(a, 523, 0.85, 1.4, 0.035);
  bell(a, 784, 0.9, 1.4, 0.028);
  bell(a, 1047, 0.95, 1.6, 0.022);
}
