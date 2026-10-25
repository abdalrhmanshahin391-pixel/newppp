// The lesson engine: one small state machine that decides where a learner is in a lesson and what
// comes next. Rita, the page and the model never move the lesson themselves; they send events here
// and show the step that comes back. Pure: no I/O, so every rule below has a unit test.
//
// Rules that always hold:
// 1. Only this engine moves the lesson.
// 2. Every event carries the revision it was made for; an older one is refused, so an answer said
//    and tapped at the same moment counts once.
// 3. "No question" is not mastery; only practice answers are.
// 4. An answer after a hint, a wrong try or a reveal is not independent.
// 5. Speech that matched no option is never counted as wrong.
// 6. A section is never passed with fewer than its required independent questions.
// 7. Remediation runs at most twice; then the lesson moves on and the stars show it.
// 8. The order of questions comes from the content and the run's seed, so a reload returns to the
//    same question.
import {
  findItem,
  type LessonContent,
  type LessonItem,
  type LessonSection,
} from "./rita-lesson-content.ts";
import {
  correctAnswerText,
  publicItem,
  type Grade,
  type PublicItem,
} from "./rita-lesson-grader.ts";

export const PHASES = [
  "intro",
  "explain",
  "guided",
  "practice",
  "remediation",
  "section_result",
  "wrap",
  "done",
] as const;
export type Phase = (typeof PHASES)[number];

const ITEM_PHASES: Phase[] = ["guided", "practice", "remediation"];
export const REMEDIATION_SIZE = 3;
export const MAX_REMEDIATION_ROUNDS = 2;
/** Wrong tries before the answer is shown and the lesson moves on. */
export const MAX_TRIES = 2;
/** Off-topic turns in a row before the page offers to end the lesson. */
export const OFF_TOPIC_LIMIT = 2;

export type ItemRecord = {
  item_id: string;
  phase: Phase;
  section: number;
  tries: number;
  hint: boolean;
  revealed: boolean;
  correct: boolean;
  independent: boolean;
};

export type Outcome = "pending" | "passed" | "passed_after_help" | "moved_on";

export type SectionTally = {
  asked: number;
  first_try: number;
  remediation_rounds: number;
  outcome: Outcome;
};

export type Feedback = {
  item_id: string;
  status: "correct" | "wrong" | "revealed" | "unclear" | "hint";
  given: string;
  /** True when the item is finished (right, or shown after the last try). */
  settled: boolean;
  /** The right answer, only once the item is settled. */
  answer: string;
  explain_ar: string;
  explain_en: string;
  hint_ar: string;
  hint_en: string;
  unclear_reason: string;
};

export type RunState = {
  v: 1;
  seed: string;
  revision: number;
  phase: Phase;
  section: number;
  /** Item ids for the current item phase, in the order they are asked. */
  queue: string[];
  position: number;
  /** The open item's tries and help so far. */
  current: { tries: number; hint: boolean } | null;
  log: ItemRecord[];
  tallies: SectionTally[];
  explain_repeats: number;
  questions: number;
  off_topic_streak: number;
  offer_end: boolean;
  paused: boolean;
  nudges: number;
  ended_early: boolean;
  last: Feedback | null;
};

export type LessonEvent =
  | { type: "ready" }
  | { type: "no_question" }
  | { type: "question" }
  | { type: "repeat" }
  | { type: "graded"; item_id: string; grade: Grade }
  | { type: "hint"; item_id: string }
  | { type: "reveal"; item_id: string }
  | { type: "off_topic" }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "timeout" }
  | { type: "end" };

export type EventType = LessonEvent["type"];

export type Rejection = "stale" | "not_allowed" | "paused" | "wrong_item" | "finished";

export type Transition =
  | { ok: true; state: RunState; changed: boolean }
  | { ok: false; reason: Rejection; state: RunState };

export function initialState(content: LessonContent, seed: string): RunState {
  return {
    v: 1,
    seed,
    revision: 1,
    phase: "intro",
    section: 0,
    queue: [],
    position: 0,
    current: null,
    log: [],
    tallies: content.sections.map(() => ({
      asked: 0,
      first_try: 0,
      remediation_rounds: 0,
      outcome: "pending" as Outcome,
    })),
    explain_repeats: 0,
    questions: 0,
    off_topic_streak: 0,
    offer_end: false,
    paused: false,
    nudges: 0,
    ended_early: false,
    last: null,
  };
}

/** Which events the learner (by voice, tap or button) may send in a phase. */
export function allowedEvents(state: RunState): EventType[] {
  if (state.phase === "done") return [];
  if (state.paused) return ["resume", "question", "repeat", "off_topic", "end", "timeout"];
  // "resume" outside a pause is how the learner answers "continue the lesson?" after drifting.
  const always: EventType[] = [
    "question",
    "repeat",
    "off_topic",
    "pause",
    "resume",
    "end",
    "timeout",
  ];
  if (ITEM_PHASES.includes(state.phase)) {
    const events: EventType[] = ["graded", "hint", ...always];
    if ((state.current?.tries ?? 0) >= 1) events.push("reveal");
    return events;
  }
  return ["ready", "no_question", ...always];
}

function currentItemId(state: RunState): string | null {
  return ITEM_PHASES.includes(state.phase) ? (state.queue[state.position] ?? null) : null;
}

function itemOf(content: LessonContent, id: string): LessonItem {
  const found = findItem(content, id);
  if (!found) throw new Error(`Unknown lesson item ${id}`);
  return found.item;
}

function feedbackFor(
  item: LessonItem,
  status: Feedback["status"],
  given: string,
  settled: boolean,
  unclear_reason = "",
): Feedback {
  const showHint = status === "wrong" || status === "hint";
  return {
    item_id: item.id,
    status,
    given,
    settled,
    answer: settled ? correctAnswerText(item) : "",
    explain_ar: settled ? item.explain_ar : "",
    explain_en: settled ? item.explain_en : "",
    hint_ar: showHint ? item.hint_ar : "",
    hint_en: showHint ? item.hint_en : "",
    unclear_reason,
  };
}

/** Starts the item phases of a section: the guided example first, when there is one. */
function startSection(content: LessonContent, state: RunState): RunState {
  const section = content.sections[state.section];
  if (section.guided.length) {
    return {
      ...state,
      phase: "guided",
      queue: section.guided.map((item) => item.id),
      position: 0,
      current: { tries: 0, hint: false },
    };
  }
  return startPractice(content, state);
}

function startPractice(content: LessonContent, state: RunState): RunState {
  const section = content.sections[state.section];
  const queue = section.practice.slice(0, section.mastery.required).map((item) => item.id);
  return { ...state, phase: "practice", queue, position: 0, current: { tries: 0, hint: false } };
}

/**
 * Remediation questions for a round: first the remediation items that train the skills the learner
 * missed, then other remediation items, then practice items that were not asked. Items from an
 * earlier round are used again only when nothing new is left.
 */
export function remediationQueue(
  section: LessonSection,
  state: RunState,
  sectionIndex: number,
): string[] {
  const records = state.log.filter((record) => record.section === sectionIndex);
  const missed = new Set(
    records
      .filter((record) => !record.independent && record.phase !== "guided")
      .map((record) => findSkill(section, record.item_id))
      .filter(Boolean),
  );
  const used = new Set(records.map((record) => record.item_id));
  const asked = new Set(section.practice.slice(0, section.mastery.required).map((item) => item.id));
  const pool = [
    ...section.remediation.filter((item) => missed.has(item.skill_tag)),
    ...section.remediation.filter((item) => !missed.has(item.skill_tag)),
    ...section.practice.filter((item) => !asked.has(item.id)),
  ];
  const fresh = pool.filter((item) => !used.has(item.id));
  const reused = pool.filter((item) => used.has(item.id));
  return [...fresh, ...reused].slice(0, REMEDIATION_SIZE).map((item) => item.id);
}

function findSkill(section: LessonSection, itemId: string): string {
  const all = [...section.guided, ...section.practice, ...section.remediation];
  return all.find((item) => item.id === itemId)?.skill_tag ?? "";
}

function setTally(state: RunState, patch: Partial<SectionTally>): RunState {
  const tallies = state.tallies.map((tally, index) =>
    index === state.section ? { ...tally, ...patch } : tally,
  );
  return { ...state, tallies };
}

function toSectionResult(state: RunState, outcome: Outcome): RunState {
  return {
    ...setTally(state, { outcome }),
    phase: "section_result",
    queue: [],
    position: 0,
    current: null,
  };
}

/** The open item is finished: record it and move to the next item or the end of the phase. */
function settle(content: LessonContent, state: RunState, record: ItemRecord): RunState {
  let next: RunState = { ...state, log: [...state.log, record] };
  if (next.position + 1 < next.queue.length) {
    return { ...next, position: next.position + 1, current: { tries: 0, hint: false } };
  }
  const section = content.sections[next.section];
  const sectionRecords = (phase: Phase) =>
    next.log.filter((entry) => entry.section === next.section && entry.phase === phase);
  if (next.phase === "guided") return startPractice(content, next);
  if (next.phase === "practice") {
    const practice = sectionRecords("practice");
    const firstTry = practice.filter((entry) => entry.independent).length;
    next = setTally(next, { asked: practice.length, first_try: firstTry });
    if (firstTry >= section.mastery.min_correct) return toSectionResult(next, "passed");
    return startRemediation(content, next);
  }
  // Remediation round finished: two of three right (independently) passes the section.
  const round = next.queue.length;
  const right = next.log
    .slice(-round)
    .filter((entry) => entry.phase === "remediation" && entry.independent).length;
  if (right >= Math.ceil((round * 2) / 3)) return toSectionResult(next, "passed_after_help");
  return startRemediation(content, next);
}

function startRemediation(content: LessonContent, state: RunState): RunState {
  const tally = state.tallies[state.section];
  if (tally.remediation_rounds >= MAX_REMEDIATION_ROUNDS) return toSectionResult(state, "moved_on");
  const queue = remediationQueue(content.sections[state.section], state, state.section);
  if (!queue.length) return toSectionResult(state, "moved_on");
  const next = setTally(state, { remediation_rounds: tally.remediation_rounds + 1 });
  return { ...next, phase: "remediation", queue, position: 0, current: { tries: 0, hint: false } };
}

function advanceFromSectionResult(content: LessonContent, state: RunState): RunState {
  if (state.section + 1 < content.sections.length) {
    return { ...state, phase: "explain", section: state.section + 1, explain_repeats: 0 };
  }
  return { ...state, phase: "wrap" };
}

function stepKey(state: RunState): string {
  return [
    state.phase,
    state.section,
    state.position,
    state.queue.join(","),
    state.paused,
    state.offer_end,
    JSON.stringify(state.last),
  ].join("|");
}

/**
 * Applies one event. `revision` is the revision the sender saw; anything older than the state's is
 * refused. The revision goes up only when what the learner sees changes, so a question or a "say
 * that again" never makes a tap on the open item stale.
 */
export function reduce(
  content: LessonContent,
  state: RunState,
  event: LessonEvent,
  revision: number,
): Transition {
  if (state.phase === "done") return { ok: false, reason: "finished", state };
  if (revision !== state.revision) return { ok: false, reason: "stale", state };
  if (!allowedEvents(state).includes(event.type)) {
    return { ok: false, reason: state.paused ? "paused" : "not_allowed", state };
  }
  const itemId = currentItemId(state);
  if (
    (event.type === "graded" || event.type === "hint" || event.type === "reveal") &&
    event.item_id !== itemId
  ) {
    return { ok: false, reason: "wrong_item", state };
  }

  let next = applyEvent(content, state, event);
  // Anything on topic means the learner is still in the lesson: the "continue or end?" offer goes.
  if (event.type !== "off_topic" && event.type !== "timeout") {
    next = { ...next, off_topic_streak: 0, offer_end: false };
  }
  const changed = stepKey(next) !== stepKey(state);
  if (changed) next = { ...next, revision: state.revision + 1 };
  return { ok: true, state: next, changed };
}

function applyEvent(content: LessonContent, state: RunState, event: LessonEvent): RunState {
  switch (event.type) {
    case "end":
      return {
        ...state,
        phase: "done",
        ended_early: true,
        paused: false,
        current: null,
        last: null,
      };
    case "pause":
      return { ...state, paused: true };
    case "resume":
      return { ...state, paused: false };
    case "timeout":
      return { ...state, nudges: state.nudges + 1 };
    case "off_topic": {
      const streak = state.off_topic_streak + 1;
      return { ...state, off_topic_streak: streak, offer_end: streak >= OFF_TOPIC_LIMIT };
    }
    case "question":
      return { ...state, questions: state.questions + 1 };
    case "repeat":
      return state.phase === "explain"
        ? { ...state, explain_repeats: state.explain_repeats + 1 }
        : state;
    case "ready":
    case "no_question":
      return advanceFromReady(content, state);
    case "hint": {
      const item = itemOf(content, event.item_id);
      return {
        ...state,
        current: { tries: state.current?.tries ?? 0, hint: true },
        last: feedbackFor(item, "hint", "", false),
      };
    }
    case "reveal": {
      const item = itemOf(content, event.item_id);
      const record = recordFor(state, event.item_id, { correct: false, revealed: true });
      return settle(content, { ...state, last: feedbackFor(item, "revealed", "", true) }, record);
    }
    case "graded":
      return applyGrade(content, state, event.item_id, event.grade);
  }
}

function advanceFromReady(content: LessonContent, state: RunState): RunState {
  const cleared = { ...state, last: null };
  switch (state.phase) {
    case "intro":
      return { ...cleared, phase: "explain", section: 0 };
    case "explain":
      return startSection(content, cleared);
    case "section_result":
      return advanceFromSectionResult(content, cleared);
    case "wrap":
      return { ...cleared, phase: "done" };
    default:
      return state;
  }
}

function recordFor(
  state: RunState,
  itemId: string,
  result: { correct: boolean; revealed: boolean },
): ItemRecord {
  const tries = state.current?.tries ?? 0;
  const hint = state.current?.hint ?? false;
  return {
    item_id: itemId,
    phase: state.phase,
    section: state.section,
    tries: result.revealed ? tries : tries + 1,
    hint,
    revealed: result.revealed,
    correct: result.correct,
    independent: result.correct && !result.revealed && tries === 0 && !hint,
  };
}

function applyGrade(
  content: LessonContent,
  state: RunState,
  itemId: string,
  grade: Grade,
): RunState {
  const item = itemOf(content, itemId);
  if (grade.status === "unclear") {
    return { ...state, last: feedbackFor(item, "unclear", grade.given, false, grade.reason) };
  }
  if (grade.status === "correct") {
    const record = recordFor(state, itemId, { correct: true, revealed: false });
    return settle(
      content,
      { ...state, last: feedbackFor(item, "correct", grade.given, true) },
      record,
    );
  }
  const tries = (state.current?.tries ?? 0) + 1;
  if (tries >= MAX_TRIES) {
    const record: ItemRecord = {
      ...recordFor(state, itemId, { correct: false, revealed: false }),
      tries,
      revealed: true,
    };
    return settle(
      content,
      { ...state, last: feedbackFor(item, "revealed", grade.given, true) },
      record,
    );
  }
  return {
    ...state,
    current: { tries, hint: state.current?.hint ?? false },
    last: feedbackFor(item, "wrong", grade.given, false),
  };
}

/** Section score: the share of its practice questions answered right the first time, alone. */
export function sectionScore(tally: SectionTally): number {
  return tally.asked ? tally.first_try / tally.asked : 0;
}

/** 0-100, the mean of the section scores. */
export function lessonScore(state: RunState): number {
  if (!state.tallies.length) return 0;
  const sum = state.tallies.reduce((total, tally) => total + sectionScore(tally), 0);
  return Math.round((sum / state.tallies.length) * 100);
}

/**
 * Stars from independent answers only. 3: every section 90% or more without remediation.
 * 2: every section passed (alone or after help) at 70% or more, or passed after help.
 * 1: the lesson was finished. 0: it was ended early.
 */
export function lessonStars(state: RunState): 0 | 1 | 2 | 3 {
  if (state.phase !== "done" || state.ended_early) return 0;
  const tallies = state.tallies;
  if (tallies.every((tally) => tally.outcome === "passed" && sectionScore(tally) >= 0.9)) return 3;
  if (
    tallies.every(
      (tally) =>
        tally.outcome === "passed_after_help" ||
        (tally.outcome === "passed" && sectionScore(tally) >= 0.7),
    )
  ) {
    return 2;
  }
  return 1;
}

export function isFinished(state: RunState): boolean {
  return state.phase === "done" && !state.ended_early;
}

/** What the page and Rita are shown for the current step. Never contains an unanswered answer. */
export type LessonStep = {
  step_id: string;
  revision: number;
  phase: Phase;
  paused: boolean;
  offer_end: boolean;
  allowed: EventType[];
  section: { id: string; title: string; title_ar: string; index: number; count: number } | null;
  explain: LessonSection["explain"] | null;
  item: PublicItem | null;
  item_number: number;
  item_count: number;
  tries: number;
  feedback: Feedback | null;
  section_result: (SectionTally & { score: number; required: number; min_correct: number }) | null;
  summary: { summary_ar: string; summary_en: string; stars: number; score: number } | null;
};

export function stepOf(content: LessonContent, state: RunState): LessonStep {
  const sectionData =
    state.phase === "intro" || state.phase === "wrap" || state.phase === "done"
      ? null
      : content.sections[state.section];
  const itemId = currentItemId(state);
  const item = itemId ? publicItem(itemOf(content, itemId), state.seed) : null;
  const tally = state.tallies[state.section];
  const finished = state.phase === "wrap" || state.phase === "done";
  return {
    step_id: [
      state.phase,
      sectionData?.id ?? "-",
      itemId ?? "-",
      state.phase === "remediation" ? tally.remediation_rounds : 0,
    ].join(":"),
    revision: state.revision,
    phase: state.phase,
    paused: state.paused,
    offer_end: state.offer_end,
    allowed: allowedEvents(state),
    section: sectionData
      ? {
          id: sectionData.id,
          title: sectionData.title,
          title_ar: sectionData.title_ar,
          index: state.section,
          count: content.sections.length,
        }
      : null,
    explain: state.phase === "explain" && sectionData ? sectionData.explain : null,
    item,
    item_number: item ? state.position + 1 : 0,
    item_count: item ? state.queue.length : 0,
    tries: state.current?.tries ?? 0,
    feedback: state.last,
    section_result:
      state.phase === "section_result" && sectionData
        ? {
            ...tally,
            score: Math.round(sectionScore(tally) * 100),
            required: sectionData.mastery.required,
            min_correct: sectionData.mastery.min_correct,
          }
        : null,
    summary: finished
      ? {
          ...content.wrap,
          stars: state.phase === "done" ? lessonStars(state) : 0,
          score: lessonScore(state),
        }
      : null,
  };
}
