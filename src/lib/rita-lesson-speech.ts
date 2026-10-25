// What Rita says during a lesson with exercises, and what the worker is told about each step.
// The lines are fixed text built from the lesson content and the engine's step, never written by
// the model: whether an answer is right, the question and the results are always exactly what the
// window shows. The model only teaches (the intro and each part's explanation) and answers
// questions. Wording never assumes the learner's gender. Pure, so every line is tested.
import type { Feedback, LessonStep } from "./rita-lesson-engine.ts";
import type { PublicItem } from "./rita-lesson-grader.ts";

export type SpeechLanguage = "ar" | "en";

/** The step as the worker sees it: no answer key, and only what Rita may talk about. */
export type WorkerStep = {
  revision: number;
  phase: LessonStep["phase"];
  paused: boolean;
  section: LessonStep["section"];
  explain: LessonStep["explain"];
  item: { id: string; prompt: string; options: string[]; template: string } | null;
  item_number: number;
  item_count: number;
};

export type StepMessage = WorkerStep & {
  /** An exact line for Rita to say now ("" for none). */
  say: string;
  /** "model": Rita teaches this step herself (the intro and each explanation). */
  action: "model" | "";
};

const ITEM_PHASES = new Set(["guided", "practice", "remediation"]);

export function workerStep(step: LessonStep): WorkerStep {
  return {
    revision: step.revision,
    phase: step.phase,
    paused: step.paused,
    section: step.section,
    explain: step.explain,
    item: step.item
      ? {
          id: step.item.id,
          prompt: step.item.prompt,
          options: step.item.options,
          template: step.item.template,
        }
      : null,
    item_number: step.item_number,
    item_count: step.item_count,
  };
}

const PRAISE = {
  ar: ["صح!", "تمام، صح.", "حلو، صح.", "بالزبط."],
  en: ["Right!", "Yes, that's right.", "Exactly.", "Good, that's it."],
};

function pick<T>(list: T[], seed: string): T {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return list[hash % list.length];
}

function joinOptions(options: string[], lang: SpeechLanguage): string {
  if (options.length <= 1) return options.join("");
  const last = options[options.length - 1];
  const rest = options.slice(0, -1).join(lang === "ar" ? "، " : ", ");
  return lang === "ar" ? `${rest}، ولا ${last}؟` : `${rest}, or ${last}?`;
}

/** Reads the open question: its number, the sentence (the gap said as a pause) and the choices. */
export function questionLine(step: LessonStep, lang: SpeechLanguage): string {
  const item = step.item;
  if (!item) return "";
  const number =
    step.phase === "guided"
      ? lang === "ar"
        ? "مثال مع مساعدة."
        : "A guided example."
      : lang === "ar"
        ? `سؤال ${step.item_number} من ${step.item_count}.`
        : `Question ${step.item_number} of ${step.item_count}.`;
  return `${number} ${itemLine(item, lang)}`.trim();
}

function itemLine(item: PublicItem, lang: SpeechLanguage): string {
  switch (item.template) {
    case "choice_fill":
      return `${item.prompt.replace("___", "…")} ${joinOptions(item.options, lang)}`;
    case "meaning_choice":
      return lang === "ar"
        ? `شو معنى ${item.word}؟ ${joinOptions(item.options, lang)}`
        : `What does ${item.word} mean? ${joinOptions(item.options, lang)}`;
    case "word_order":
      return lang === "ar"
        ? "المطلوب ترتيب الكلمات على الشاشة بالترتيب الصح."
        : "Put the words on the screen in the right order.";
    case "syllable_tiles":
      return lang === "ar"
        ? `المطلوب تركيب الكلمة من القطع${item.clue_ar ? `، ومعناها ${item.clue_ar}` : ""}.`
        : "Build the word from the pieces on the screen.";
  }
}

/** What Rita says about an answer, a hint or speech she could not match. */
export function feedbackLine(feedback: Feedback, lang: SpeechLanguage): string {
  const explain = lang === "en" ? feedback.explain_en || feedback.explain_ar : feedback.explain_ar;
  const hint = lang === "en" ? feedback.hint_en || feedback.hint_ar : feedback.hint_ar;
  switch (feedback.status) {
    case "correct":
      return `${pick(PRAISE[lang], feedback.item_id)} ${explain}`.trim();
    case "wrong":
      return lang === "ar"
        ? `مش هيك. ${hint} خلّينا نجرّب كمان مرة.`.replace(/\s+/g, " ").trim()
        : `Not quite. ${hint} Let's try once more.`.replace(/\s+/g, " ").trim();
    case "revealed":
      return lang === "ar"
        ? `الجواب الصحيح: ${feedback.answer}. ${explain}`.trim()
        : `The answer is: ${feedback.answer}. ${explain}`.trim();
    case "hint":
      return (
        hint ||
        (lang === "ar"
          ? "خلّينا نفكّر بالفاعل: عن مين عم نحكي؟"
          : "Think about who the sentence is about.")
      );
    case "unclear":
      if (feedback.unclear_reason === "tap_to_answer") {
        return lang === "ar"
          ? "هاد التمرين بالضغط على القطع على الشاشة."
          : "This one is done by tapping the pieces on the screen.";
      }
      return lang === "ar"
        ? "ما سمعتها منيح. ممكن إعادتها، أو الضغط على الجواب على الشاشة."
        : "I didn't catch that. Say it once more, or tap the answer.";
  }
}

function resultLine(step: LessonStep, lang: SpeechLanguage): string {
  const result = step.section_result;
  if (!result) return "";
  const last = step.section ? step.section.index + 1 >= step.section.count : true;
  if (lang === "en") {
    const verdict =
      result.outcome === "passed"
        ? "Great, this part is done."
        : result.outcome === "passed_after_help"
          ? "Good, after the review it's clearer."
          : "We'll move on and come back to this in review.";
    return `${result.first_try} of ${result.asked} right the first time. ${verdict} ${last ? "Ready for the summary?" : "Ready for the next part?"}`;
  }
  const verdict =
    result.outcome === "passed"
      ? "ممتاز، خلصنا هالجزء."
      : result.outcome === "passed_after_help"
        ? "تمام، بعد المراجعة صارت أوضح."
        : "بنكمل، وبنرجع لهالنقطة بالمراجعة.";
  return `${result.first_try} من ${result.asked} صح من أول مرة. ${verdict} ${last ? "نروح للملخص؟" : "نكمل للجزء الجاي؟"}`;
}

/**
 * The message for the worker when the lesson moves from `previous` to `next` (previous is null
 * when the call has just started, or started in the middle of a lesson). Returns null when nothing
 * the learner hears needs to change.
 */
export function stepMessage(
  previous: LessonStep | null,
  next: LessonStep,
  lang: SpeechLanguage,
): StepMessage | null {
  const base = workerStep(next);
  const fresh = previous === null;
  if (!fresh && previous.revision === next.revision) return null;
  const message = (say: string, action: StepMessage["action"] = ""): StepMessage => ({
    ...base,
    say,
    action,
  });

  if (next.paused) {
    if (!fresh && previous.paused) return message("");
    return message(
      lang === "ar"
        ? "تمام، وقّفنا التمرين. لما يكون الوقت مناسب، احكي «كمّل»."
        : "Okay, the exercise is paused. Say “continue” when you're ready.",
    );
  }

  switch (next.phase) {
    case "intro":
      return message("", "model");
    case "explain": {
      const newPart =
        fresh || previous.phase !== "explain" || previous.section?.id !== next.section?.id;
      // The result of the last answer (if any) is already said; the model teaches the new part.
      return newPart ? message("", "model") : message("");
    }
    case "guided":
    case "practice":
    case "remediation": {
      const lines: string[] = [];
      const resumed = !fresh && previous.paused;
      const sameItem =
        !fresh && previous.item?.id === next.item?.id && previous.phase === next.phase;
      const feedback = next.feedback;
      const feedbackChanged =
        !fresh && JSON.stringify(previous.feedback) !== JSON.stringify(next.feedback);
      if (feedback && feedbackChanged && !resumed) {
        // A finished question (moved on) or a try on the same question.
        if (!sameItem || feedback.item_id === next.item?.id)
          lines.push(feedbackLine(feedback, lang));
      }
      if (
        next.phase === "remediation" &&
        (fresh || previous.phase !== "remediation" || !sameItem) &&
        next.item_number === 1
      ) {
        lines.push(
          lang === "ar"
            ? "خلّينا نراجع هالنقطة بكم سؤال."
            : "Let's review this with a few questions.",
        );
      }
      if (fresh || resumed || !sameItem) lines.push(questionLine(next, lang));
      return message(lines.filter(Boolean).join(" "));
    }
    case "section_result": {
      const lines: string[] = [];
      if (next.feedback && !fresh) lines.push(feedbackLine(next.feedback, lang));
      lines.push(resultLine(next, lang));
      return message(lines.join(" "));
    }
    case "wrap": {
      const summary =
        lang === "en"
          ? next.summary?.summary_en || next.summary?.summary_ar
          : next.summary?.summary_ar;
      return message(
        lang === "ar"
          ? `${summary ?? ""} نخلّص الدرس؟`.trim()
          : `${summary ?? ""} Shall we finish the lesson?`.trim(),
      );
    }
    case "done": {
      const stars = next.summary?.stars ?? 0;
      if (lang === "en") {
        return message(
          stars ? `Lesson done, ${stars} of 3 stars. Nice work.` : "We stopped the lesson here.",
        );
      }
      return message(stars ? `خلصنا الدرس، ${stars} من 3 نجوم. شغل حلو.` : "وقّفنا الدرس هون.");
    }
  }
}

/** A gentle nudge after a silence in an exercise: first an offer of a hint, then of a repeat. */
export function silenceLine(stage: 1 | 2, lang: SpeechLanguage): string {
  if (stage === 1) {
    return lang === "ar"
      ? "إذا بدك تلميح، احكي «تلميح»."
      : "If you'd like a hint, just say “hint”.";
  }
  return lang === "ar" ? "بدك أعيد السؤال؟" : "Shall I repeat the question?";
}

export function isItemPhase(phase: string): boolean {
  return ITEM_PHASES.has(phase);
}
