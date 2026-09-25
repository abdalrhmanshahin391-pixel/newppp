import type { SpeakResult, WordMark } from "@/lib/de-lab";

function words(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function lev(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const row = [i + 1];
    for (let j = 0; j < b.length; j++) {
      row[j + 1] = Math.min(prev[j + 1] + 1, row[j] + 1, prev[j] + (a[i] === b[j] ? 0 : 1));
    }
    prev = row;
  }
  return prev[b.length];
}

function sim(a: string, b: string): number {
  if (!a || !b) return 0;
  return 1 - lev(a, b) / Math.max(a.length, b.length);
}

/** Word-by-word comparison of what was said against the German target. */
export function scoreSpeech(target: string, transcript: string): SpeakResult {
  const want = words(target);
  const got = words(transcript);
  const pool = [...got];
  const marks: WordMark[] = [];
  let total = 0;

  for (const w of want) {
    let bestIdx = -1;
    let best = 0;
    for (let i = 0; i < pool.length; i++) {
      const s = sim(w, pool[i]);
      if (s > best) {
        best = s;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0 && best >= 0.5) pool.splice(bestIdx, 1);
    else best = bestIdx >= 0 ? best : 0;
    total += Math.max(0, best);
    marks.push({ word: w, state: best >= 0.92 ? "good" : best >= 0.6 ? "close" : "bad" });
  }

  const base = want.length ? total / want.length : 0;
  const extra = Math.max(0, pool.length - 1) * 0.04;
  const score = Math.max(0, Math.min(100, Math.round((base - extra) * 100)));
  return { score, transcript: transcript.trim(), words: marks };
}

export function band(score: number): { label: string; color: string } {
  if (score >= 85) return { label: "Native-ish", color: "#2f9e63" };
  if (score >= 65) return { label: "Good", color: "#c98a2b" };
  return { label: "Try again", color: "#d94a4a" };
}
