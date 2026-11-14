// Uzyra's short recorded lines for the study circle ("the cards are ready"): files in
// public/sounds/uzyra/ made once with her call voice (voice-agent/uzyra_voice_lines.py). A line
// is chosen and decoded when its action is picked, while the answer is being written, and plays
// in the same moment the answer, the cards or the questions show (never after them). Two lines
// per action take turns. The circle's sound switch turns them off with the other sounds.
import { decodeClip, leadingSilence, playClip } from "./tech-sound";

/** How many lines each action has (files `<action>-1.mp3` … `<action>-n.mp3`). */
const LINES: Record<string, number> = {
  make_cards: 2,
  make_mcq: 2,
  explain: 2,
  meaning: 2,
  word_by_word: 2,
  why_form: 2,
  compare_arabic: 2,
  simplify: 2,
  common_mistake: 2,
  summarize_section: 2,
  explain_reply: 2,
  report: 2,
};

/** A line that is not decoded by the time its answer shows is dropped, never played late. */
const LATE_MS = 250;

const decoded = new Map<string, Promise<AudioBuffer | null>>();
const ready = new Map<string, AudioBuffer>();
/** Where each line's voice starts (the files begin with ~0.13 s of silence). */
const starts = new Map<string, number>();

function load(file: string): Promise<AudioBuffer | null> {
  let job = decoded.get(file);
  if (!job) {
    job = fetch(`/sounds/uzyra/${file}`)
      .then((response) => (response.ok ? response.arrayBuffer() : null))
      .then((data) => (data ? decodeClip(data) : null))
      .then((buffer) => {
        if (buffer) {
          ready.set(file, buffer);
          starts.set(file, leadingSilence(buffer));
        } else decoded.delete(file);
        return buffer;
      })
      .catch(() => {
        decoded.delete(file);
        return null;
      });
    decoded.set(file, job);
  }
  return job;
}

function nextFile(action: string): string | null {
  const count = LINES[action];
  if (!count) return null;
  const key = `uzyra-line-turn:${action}`;
  let turn = 0;
  try {
    turn = (Number(window.localStorage.getItem(key)) || 0) % count;
    window.localStorage.setItem(key, String((turn + 1) % count));
  } catch {
    turn = Math.floor(Math.random() * count);
  }
  return `${action}-${turn + 1}.mp3`;
}

/** A chosen line on its way to being ready; hand it to `playVoiceLine` when the answer shows. */
export type VoiceCue = { file: string };

/** Picks and starts decoding the line for an action (null for an action without lines). */
export function prepareVoiceLine(action: string): VoiceCue | null {
  if (typeof window === "undefined") return null;
  const file = nextFile(action);
  if (!file) return null;
  void load(file);
  return { file };
}

/** Decodes every line of these actions (all of them without a list) ahead, when the circle opens. */
export function warmVoiceLines(actions: readonly string[] = Object.keys(LINES)): void {
  if (typeof window === "undefined") return;
  for (const action of actions)
    for (let n = 1; n <= (LINES[action] ?? 0); n++) void load(`${action}-${n}.mp3`);
}

/** Plays the line now, as its answer shows; a line not ready within a moment is dropped. */
export function playVoiceLine(cue: VoiceCue | null | undefined): void {
  if (!cue) return;
  const buffer = ready.get(cue.file);
  if (buffer) {
    playClip(buffer, 0.9, starts.get(cue.file) ?? 0);
    return;
  }
  const asked = performance.now();
  void load(cue.file).then((late) => {
    if (late && performance.now() - asked < LATE_MS) playClip(late, 0.9, starts.get(cue.file) ?? 0);
  });
}

/** For tests: whether a line is decoded and waiting. */
export function voiceLineReady(cue: VoiceCue | null): boolean {
  return Boolean(cue && ready.has(cue.file));
}
