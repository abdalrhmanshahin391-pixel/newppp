import type { MemoryPair } from "@/lib/use-memory-pairs";

export type GameMode = "match" | "speed" | "recall" | "sequence";

export const GAME_MODES: { key: GameMode; label: string; hint: string }[] = [
  { key: "match", label: "Match", hint: "Six on the left, six on the right" },
  { key: "speed", label: "Speed", hint: "One prompt, four answers, 8 seconds" },
  { key: "recall", label: "Recall", hint: "Type the answer from memory" },
  { key: "sequence", label: "Sequence", hint: "Drag five tiles into order" },
];

export const BOARD_SIZE = 6;

export function shuffle<T>(list: T[]): T[] {
  const next = [...list];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

/** Weak pairs (more misses) are seeded first, then the rest is shuffled. */
export function seedPool(pairs: MemoryPair[]): MemoryPair[] {
  const weak = shuffle(pairs.filter((p) => (p.misses ?? 0) > 0)).sort(
    (a, b) => (b.misses ?? 0) - (a.misses ?? 0),
  );
  const rest = shuffle(pairs.filter((p) => (p.misses ?? 0) === 0));
  return [...weak, ...rest];
}

/** Forgiving comparison for the Recall mode. */
export function normalizeAnswer(value: string) {
  return value
    .toLowerCase()
    .replace(/[.,;:!?()"']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string) {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const row = [i];
    for (let j = 1; j <= n; j++) {
      row[j] = Math.min(
        prev[j] + 1,
        row[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = row;
  }
  return prev[n];
}

export function answerMatches(given: string, expected: string) {
  const a = normalizeAnswer(given).replace(/\s/g, "");
  const b = normalizeAnswer(expected).replace(/\s/g, "");
  if (!a) return false;
  if (a === b) return true;
  const tolerance = b.length > 12 ? 2 : b.length > 6 ? 1 : 0;
  return levenshtein(a, b) <= tolerance;
}

export function formatTime(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function accuracyOf(correct: number, wrong: number) {
  const total = correct + wrong;
  return total === 0 ? 100 : Math.round((correct / total) * 100);
}

/* ------------------------------------------------------------------ *
 * Sound — short synthesised tones, no audio files.
 * ------------------------------------------------------------------ */
const MUTE_KEY = "rita_mem_muted";

export function isMuted() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(MUTE_KEY) === "1";
}

export function setMuted(v: boolean) {
  try {
    window.localStorage.setItem(MUTE_KEY, v ? "1" : "0");
  } catch {
    /* ignore */
  }
}

let ctx: AudioContext | null = null;

function tone(freq: number, duration: number, type: OscillatorType, delay = 0, gain = 0.08) {
  if (typeof window === "undefined" || isMuted()) return;
  try {
    const AC = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!AC) return;
    ctx = ctx ?? new AC();
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const vol = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    vol.gain.setValueAtTime(gain, start);
    vol.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(vol).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration);
  } catch {
    /* ignore */
  }
}

export const sfx = {
  correct() {
    tone(660, 0.14, "sine");
    tone(990, 0.18, "sine", 0.08);
  },
  wrong() {
    tone(150, 0.18, "square", 0, 0.05);
  },
  finish() {
    tone(523, 0.16, "sine");
    tone(659, 0.16, "sine", 0.12);
    tone(784, 0.28, "sine", 0.24);
  },
  tick() {
    tone(420, 0.05, "triangle", 0, 0.03);
  },
};

export function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}
