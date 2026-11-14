// Repeat's voice and ears.
// - Uzyra says each sentence with the site's natural voice (the same speech model the "tap a
//   word" window uses, through /api/german/tts with lang "en"). Each sentence's audio is kept
//   on the device after the first time, so it is fetched and paid for once. Guests, or a failed
//   request, get the browser's own English voice instead.
// - The learner's words are heard live by the browser's speech recogniser, so each word turns
//   black the moment it is said. Browsers without one record a short clip that is transcribed
//   once at the end instead.
// Sounds go through one Web Audio context, woken by the "Start" tap (iPad needs a tap first).
import { ttsHeaders } from "@/lib/tts-auth";

const CACHE = "uzyra-repeat-voice";
const MAX_KEPT = 240;

let ctx: AudioContext | null = null;

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
  if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
  return ctx;
}

/** Called from the "Start" tap: wakes the audio so Uzyra's first sentence is not silent. */
export function wakeAudio(): void {
  const c = audio();
  if (!c) return;
  // A silent tick inside the tap unlocks playback on iPad and iPhone.
  const buffer = c.createBuffer(1, 1, 22050);
  const source = c.createBufferSource();
  source.buffer = buffer;
  source.connect(c.destination);
  source.start();
}

// ---------- Uzyra's voice --------------------------------------------------------------------

const loading = new Map<string, Promise<AudioBuffer | null>>();
const cacheUrl = (text: string) => `/__repeat-voice/${encodeURIComponent(text)}`;

async function fetchVoice(text: string): Promise<ArrayBuffer | null> {
  try {
    const store = "caches" in window ? await caches.open(CACHE) : null;
    const kept = await store?.match(cacheUrl(text));
    if (kept) return await kept.arrayBuffer();
    const headers = await ttsHeaders();
    if (!headers) return null;
    const response = await fetch("/api/german/tts", {
      method: "POST",
      headers,
      body: JSON.stringify({ text, lang: "en", style: "fast" }),
    });
    if (!response.ok) return null;
    const data = await response.arrayBuffer();
    if (data.byteLength < 512) return null;
    if (store) {
      void (async () => {
        const keys = await store.keys();
        for (const old of keys.slice(0, Math.max(0, keys.length - MAX_KEPT + 1))) {
          await store.delete(old);
        }
        await store.put(
          cacheUrl(text),
          new Response(data.slice(0), { headers: { "Content-Type": "audio/mpeg" } }),
        );
      })().catch(() => undefined);
    }
    return data;
  } catch {
    return null;
  }
}

/** Starts getting a sentence's audio ready (call for the next card while this one plays). */
export function prepareSentence(text: string): Promise<AudioBuffer | null> {
  const known = loading.get(text);
  if (known) return known;
  const job = (async () => {
    const data = await fetchVoice(text);
    const c = audio();
    if (!data || !c) return null;
    try {
      return await c.decodeAudioData(data);
    } catch {
      return null;
    }
  })();
  loading.set(text, job);
  // A failure is not remembered: the next try asks again.
  void job.then((buffer) => {
    if (!buffer) loading.delete(text);
  });
  return job;
}

/** The first moment with sound in a clip (the model's MP3s start with a little silence). */
function soundStart(buffer: AudioBuffer): number {
  const data = buffer.getChannelData(0);
  const limit = Math.min(data.length, Math.floor(buffer.sampleRate * 0.4));
  for (let i = 0; i < limit; i += 1) {
    if (Math.abs(data[i]) > 0.012) return Math.max(0, i / buffer.sampleRate - 0.02);
  }
  return 0;
}

function browserVoice(text: string, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) return resolve();
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.95;
    const english = synth.getVoices().find((v) => v.lang?.toLowerCase().startsWith("en-us"));
    if (english) utterance.voice = english;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.clearTimeout(guard);
      resolve();
    };
    // Some browsers never fire "end": finish after a generous guess of the sentence's length.
    const guard = window.setTimeout(finish, 1500 + text.length * 120);
    utterance.onend = finish;
    utterance.onerror = finish;
    signal.addEventListener("abort", () => {
      synth.cancel();
      finish();
    });
    synth.speak(utterance);
  });
}

/** Says the sentence; resolves when it has finished (or was stopped). */
export async function speakSentence(text: string, signal: AbortSignal): Promise<void> {
  const buffer = await prepareSentence(text);
  if (signal.aborted) return;
  const c = audio();
  if (!buffer || !c) return browserVoice(text, signal);
  await new Promise<void>((resolve) => {
    const source = c.createBufferSource();
    const gain = c.createGain();
    gain.gain.value = 1;
    source.buffer = buffer;
    source.connect(gain).connect(c.destination);
    const finish = () => {
      signal.removeEventListener("abort", stop);
      resolve();
    };
    const stop = () => {
      try {
        source.stop();
      } catch {
        /* already finished */
      }
      finish();
    };
    source.onended = finish;
    signal.addEventListener("abort", stop);
    source.start(0, soundStart(buffer));
  });
}

// ---------- Game sounds ----------------------------------------------------------------------

function tone(
  freq: number,
  length: number,
  volume: number,
  start = 0,
  type: OscillatorType = "sine",
) {
  const c = audio();
  if (!c) return;
  const t = c.currentTime + start;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(volume, t + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + length + 0.02);
}

export const repeatSounds = {
  /** The whole sentence said: a bright two-note "ding". */
  right() {
    tone(1046.5, 0.42, 0.09);
    tone(2888, 0.18, 0.025);
    tone(1567.98, 0.46, 0.08, 0.08);
    tone(4327, 0.16, 0.02, 0.08);
  },
  /** The microphone opens: a soft low "tick" so the learner knows to speak. */
  listen() {
    tone(660, 0.09, 0.04, 0, "triangle");
  },
  /** Ten cards done. */
  finished() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.4, 0.06, i * 0.09));
  },
};

// ---------- The learner's words --------------------------------------------------------------

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

function recogniser(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => Recognition;
    webkitSpeechRecognition?: new () => Recognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type HearingMode = "live" | "clip" | "none";

/** How this browser can hear the learner: live word by word, a clip at the end, or not at all. */
export function hearingMode(): HearingMode {
  if (recogniser()) return "live";
  if (typeof window !== "undefined" && "MediaRecorder" in window && navigator.mediaDevices)
    return "clip";
  return "none";
}

/** Asks for the microphone once, from the "Start" tap. False when it was refused. */
export async function askForMicrophone(): Promise<boolean> {
  if (!navigator.mediaDevices?.getUserMedia) return hearingMode() === "live";
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return true;
  } catch (error) {
    const name = (error as { name?: string })?.name;
    return !(name === "NotAllowedError" || name === "SecurityError");
  }
}

export type Hearing = {
  /** Stops listening; what was heard so far still arrives through `onHeard`. */
  stop(): void;
};

export type HearingEnd = "ended" | "denied" | "failed";

/**
 * Listens to the learner. `onHeard` gets everything heard so far (again with every change);
 * `onEnd` once, when listening stops for good.
 */
export function listen(opts: {
  onHeard: (text: string) => void;
  onEnd: (why: HearingEnd) => void;
  /** For the clip mode: how long to record at most. */
  maxMs: number;
}): Hearing {
  const Live = recogniser();
  if (Live) return listenLive(Live, opts);
  return listenClip(opts);
}

function listenLive(
  Live: new () => Recognition,
  opts: { onHeard: (text: string) => void; onEnd: (why: HearingEnd) => void },
): Hearing {
  let stopped = false;
  let ended = false;
  let before = "";
  let current: Recognition | null = null;
  let restarts: number[] = [];
  const end = (why: HearingEnd) => {
    if (ended) return;
    ended = true;
    opts.onEnd(why);
  };
  const begin = () => {
    const rec = new Live();
    current = rec;
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    let latest = "";
    rec.onresult = (event) => {
      latest = Array.from(event.results, (result) => result[0]?.transcript ?? "").join(" ");
      opts.onHeard(`${before} ${latest}`.trim());
    };
    rec.onerror = (event) => {
      const error = String(event?.error ?? "");
      if (error === "not-allowed" || error === "service-not-allowed") {
        stopped = true;
        end("denied");
      } else if (error === "audio-capture" || error === "network") {
        stopped = true;
        end("failed");
      }
      // "no-speech" and "aborted": the end handler decides.
    };
    rec.onend = () => {
      before = `${before} ${latest}`.trim();
      // Safari ends a "continuous" session after a pause: keep listening until told to stop,
      // but not in a tight loop when the recogniser keeps failing straight away.
      const now = Date.now();
      restarts = restarts.filter((t) => now - t < 4000);
      restarts.push(now);
      if (!stopped && restarts.length <= 4) {
        try {
          begin();
          return;
        } catch {
          /* falls through to the end */
        }
      }
      end("ended");
    };
    rec.start();
  };
  try {
    begin();
  } catch {
    end("failed");
  }
  return {
    stop() {
      stopped = true;
      try {
        current?.stop();
      } catch {
        end("ended");
      }
    },
  };
}

function listenClip(opts: {
  onHeard: (text: string) => void;
  onEnd: (why: HearingEnd) => void;
  maxMs: number;
}): Hearing {
  let recorder: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  let timer = 0;
  let cancelled = false;
  const chunks: Blob[] = [];
  const stop = () => {
    window.clearTimeout(timer);
    if (recorder && recorder.state !== "inactive") recorder.stop();
  };
  void (async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      opts.onEnd("denied");
      return;
    }
    if (cancelled) {
      stream.getTracks().forEach((track) => track.stop());
      opts.onEnd("ended");
      return;
    }
    recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    recorder.onstop = async () => {
      stream?.getTracks().forEach((track) => track.stop());
      const type = recorder?.mimeType || "audio/webm";
      const clip = new Blob(chunks, { type });
      try {
        const headers = await ttsHeaders();
        if (!headers || clip.size < 2048) throw new Error("no clip");
        const form = new FormData();
        const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
        form.append("audio", clip, `recording.${ext}`);
        form.append("language", "en");
        const response = await fetch("/api/german/score", {
          method: "POST",
          headers: { Authorization: headers.Authorization },
          body: form,
        });
        if (!response.ok) throw new Error(String(response.status));
        const json = (await response.json()) as { text?: string };
        opts.onHeard(String(json.text ?? ""));
        opts.onEnd("ended");
      } catch {
        opts.onEnd("failed");
      }
    };
    recorder.start();
    timer = window.setTimeout(stop, opts.maxMs);
  })();
  return {
    stop() {
      cancelled = true;
      stop();
    },
  };
}
