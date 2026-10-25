// OpenAI calls for Rita's curriculum: summarise a ten-page window, write a
// lesson, judge a learner's answers against the lesson objectives, and draw the
// lesson picture. Every reply is strict JSON checked against the zod schemas.
import { normalizeLessonContentReply, normalizeLessonDraftReply } from "./model-reply-normalize";
import { interpretTranscript, type TranscriptOutcome } from "./page-transcript";
import { isImageRejection, VISION_CHECK_JPEG_BASE64 } from "./vision-check-image";
import { z } from "zod";
import { getServerRuntimeSecret } from "@/lib/config.server";
import { resolveRitaOpenAiKey } from "@/lib/rita-voice.server";
import { GeneratedDeckSchema, finalizeSlides, type Slide } from "@/lib/rita-slides";
import {
  LessonItemSchema,
  generatedContentSchema,
  itemProblems,
  type LessonContent,
  type LessonItem,
  type LessonSection,
} from "@/lib/rita-lesson-content";
import {
  EvaluationSchema,
  LessonDraftSchema,
  WindowSummarySchema,
  describeSchemaError,
  parseJsonObject,
  type Evaluation,
  type LessonDraft,
  type LessonTurn,
  type Objective,
  type WindowSummary,
} from "@/lib/rita-curriculum";

const CHAT_URL = "https://api.openai.com/v1/chat/completions";
const IMAGE_URL = "https://api.openai.com/v1/images/generations";
const DEFAULT_TEXT_MODEL = "gpt-4.1-mini";
const DEFAULT_IMAGE_MODEL = "gpt-image-1";

export type CurriculumKind = "grammar" | "vocabulary";

export class CurriculumAiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// The key the signed-in admin can read with their own session. The service-role
// reader below is unavailable on some hosts, which used to make a key that is
// saved on the AI keys page look missing here.
const PRIMED_KEY_TTL_MS = 10 * 60 * 1000;
let primedKey: { key: string; at: number } | null = null;

export function hasPrimedOpenAiKey() {
  return Boolean(primedKey && Date.now() - primedKey.at < PRIMED_KEY_TTL_MS);
}

export function primeOpenAiKey(key: string) {
  const trimmed = key.trim();
  if (trimmed.length > 20) primedKey = { key: trimmed, at: Date.now() };
}

async function apiKey() {
  const fromEnv = await getServerRuntimeSecret("OPENAI_API_KEY");
  if (fromEnv.length > 20) return fromEnv;
  const saved = await resolveRitaOpenAiKey();
  if (saved) return saved;
  if (primedKey && hasPrimedOpenAiKey()) return primedKey.key;
  throw new CurriculumAiError(
    503,
    "No OpenAI key found: save one on the AI keys page (OpenAI) or add OPENAI_API_KEY to the server secrets.",
  );
}

export async function curriculumTextModel() {
  return (await getServerRuntimeSecret("RITA_CURRICULUM_MODEL")) || DEFAULT_TEXT_MODEL;
}

async function postJson(url: string, key: string, body: unknown, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const raw = await response.text();
    if (!response.ok) {
      let message = raw.slice(0, 300);
      try {
        message = JSON.parse(raw)?.error?.message ?? message;
      } catch {
        /* keep raw text */
      }
      throw new CurriculumAiError(response.status, `OpenAI ${response.status}: ${message}`);
    }
    return JSON.parse(raw);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new CurriculumAiError(504, "OpenAI took too long to answer. Try again.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * One chat call that must return JSON matching the schema. A reply that does
 * not match gets one more try with the validation error shown to the model;
 * rate limits and server errors get one retry after a short pause.
 */
async function chatJson<S extends z.ZodTypeAny>(
  schema: S,
  system: string,
  user: string,
  options: {
    maxTokens: number;
    timeoutMs: number;
    temperature?: number;
    /** Tidies the parsed reply (cosmetic limits only) before it is checked. */
    normalize?: (raw: unknown) => unknown;
  },
): Promise<{ value: z.infer<S>; model: string }> {
  const key = await apiKey();
  const model = await curriculumTextModel();
  const messages: { role: string; content: string }[] = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
  let lastProblem = "";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let json: { choices?: { message?: { content?: string } }[] };
    try {
      json = await postJson(
        CHAT_URL,
        key,
        {
          model,
          messages,
          response_format: { type: "json_object" },
          temperature: options.temperature ?? 0.4,
          max_completion_tokens: options.maxTokens,
        },
        options.timeoutMs,
      );
    } catch (error) {
      const retryable =
        error instanceof CurriculumAiError && (error.status === 429 || error.status >= 500);
      if (!retryable || attempt === 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1_500 * (attempt + 1)));
      continue;
    }
    const content = String(json?.choices?.[0]?.message?.content ?? "");
    let parsed: unknown;
    try {
      parsed = parseJsonObject(content);
    } catch {
      lastProblem = "The reply was not valid JSON.";
    }
    if (parsed !== undefined) {
      const result = schema.safeParse(options.normalize ? options.normalize(parsed) : parsed);
      if (result.success) return { value: result.data, model };
      lastProblem = describeSchemaError(result.error);
    }
    if (attempt === 2) break;
    messages.push(
      { role: "assistant", content: content.slice(0, 6_000) },
      {
        role: "user",
        content: `That JSON is not valid: ${lastProblem}. Send the corrected JSON object only.`,
      },
    );
  }
  throw new CurriculumAiError(
    502,
    `The AI reply did not match the expected format (${lastProblem}).`,
  );
}

const SUMMARY_SHAPE = `{
  "overview": "2-4 sentences in English about what these pages teach",
  "overview_ar": "the same in Arabic",
  "topics": [{
    "title": "topic name", "title_ar": "Arabic name",
    "from_page": 1, "to_page": 2,
    "key_points": ["rule or idea, short"],
    "examples": ["example sentence from the pages"],
    "vocabulary": [{ "word": "hello", "meaning_ar": "مرحبا", "example": "Hello, Sara!" }]
  }],
  "suggested_lessons": [{ "topic": "one teachable topic", "title_ar": "Arabic title", "from_page": 1, "to_page": 1 }],
  "continues_next_window": false
}`;

export async function summarizeWindow(input: {
  kind: CurriculumKind;
  bookTitle: string;
  from: number;
  to: number;
  pageText: string;
}): Promise<{ summary: WindowSummary; model: string }> {
  const focus =
    input.kind === "grammar"
      ? "List each grammar rule with its form, the key points a learner must remember and real examples from the pages."
      : "List each word group with every word, its Arabic meaning and an example sentence from the pages.";
  const system = `You summarise pages of an English course book for an Arabic-speaking A1 learner's tutor.
Only use what is on the given pages. Never invent rules, words or examples. Page numbers must be the
"=== Page N ===" numbers and must stay between ${input.from} and ${input.to}. ${focus}
Suggest small lessons that each fit one 5-10 minute voice lesson.
If the last topic is cut off at the end of the pages, set continues_next_window to true.
Reply with one JSON object shaped like:
${SUMMARY_SHAPE}`;
  const user = `Book: ${input.bookTitle} (${input.kind})\nPages ${input.from}-${input.to}:\n\n${input.pageText}`;
  const { value, model } = await chatJson(WindowSummarySchema, system, user, {
    maxTokens: 4_000,
    timeoutMs: 90_000,
    temperature: 0.2,
  });
  return { summary: value, model };
}

/** A page that gave no saved text, with the reason, so nothing is skipped without the admin seeing it. */
export type PageNote = { page_no: number; kind: "blank" | "refused" | "cut"; reason: string };

/** Reads scanned pages (no text layer) so the rest of the flow can work with text. */
export async function transcribePages(pages: { page_no: number; jpegBase64: string }[]): Promise<{
  pages: { page_no: number; text: string }[];
  model: string;
  failures: string[];
  notes: PageNote[];
}> {
  const key = await apiKey();
  const model = await curriculumTextModel();
  // One request per page: a single slow or malformed page can no longer sink its
  // neighbours, and each request stays well inside the host's time limit.
  const settled = await Promise.allSettled(
    pages.map((page) => transcribeOnePage(key, model, page)),
  );
  const done: { page_no: number; text: string }[] = [];
  const notes: PageNote[] = [];
  const failures: string[] = [];
  settled.forEach((result, index) => {
    if (result.status === "fulfilled") {
      // A refused page is not saved: it stays missing and is shown to the admin to settle.
      if (result.value.text !== null)
        done.push({ page_no: result.value.page_no, text: result.value.text });
      if (result.value.note) notes.push(result.value.note);
    } else {
      const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
      failures.push(`p${pages[index].page_no}: ${reason}`);
    }
  });
  if (!done.length && !notes.length && failures.length) {
    const first = settled.find((result) => result.status === "rejected") as PromiseRejectedResult;
    throw first.reason instanceof Error ? first.reason : new CurriculumAiError(502, failures[0]);
  }
  return { pages: done, model, failures, notes };
}

const TRANSCRIBE_PROMPT = `Transcribe the printed text on this scanned book page exactly, keeping line breaks and table rows.
Copy every printed word, even small text next to pictures, captions, page numbers and tables. Ignore the pictures themselves.
Reply with the page text only, no comments. If the page has no readable text at all (a blank page, a cover picture), reply with exactly: NO_TEXT`;

// Second try after a refusal: say what the page is, since the first reply may have been a misfire
// on a photo or a diagram.
const TRANSCRIBE_RETRY_PROMPT = `This is a page from a study book, scanned for a learning app. Copy only the printed words; ignore photos, diagrams and people in the pictures.
Reply with the page text only. If there are no printed words, reply with exactly: NO_TEXT`;

async function transcribeOnePage(
  key: string,
  model: string,
  page: { page_no: number; jpegBase64: string },
): Promise<{ page_no: number; text: string | null; note?: PageNote }> {
  const imageKb = Math.round((page.jpegBase64.length * 3) / 4 / 1024);
  const ask = async (prompt: string) => {
    const json = await postJson(
      CHAT_URL,
      key,
      {
        model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${page.jpegBase64}`, detail: "high" },
              },
            ],
          },
        ],
        temperature: 0,
        max_completion_tokens: 6_000,
      },
      60_000,
    );
    const choice = json?.choices?.[0];
    const content = typeof choice?.message?.content === "string" ? choice.message.content : "";
    const outcome = interpretTranscript(
      content,
      choice?.finish_reason,
      typeof choice?.message?.refusal === "string" ? choice.message.refusal : "",
    );
    // What the AI really answered, kept with every problem so the cause is never a guess.
    const meta = `[${model}, finish: ${choice?.finish_reason ?? "none"}, reply: ${content.length} chars, image: ${imageKb} KB]`;
    return { outcome, meta };
  };

  let result: { outcome: TranscriptOutcome; meta: string } | null = null;
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      result = await ask(attempt === 0 ? TRANSCRIBE_PROMPT : TRANSCRIBE_RETRY_PROMPT);
      lastError = undefined;
      // Only a refusal is worth a second, differently worded try.
      if (result.outcome.kind !== "refused") break;
    } catch (error) {
      lastError = error;
      const retryable =
        error instanceof CurriculumAiError ? error.status === 429 || error.status >= 500 : true;
      if (!retryable || attempt === 1) break;
      await new Promise((resolve) => setTimeout(resolve, 1_500 * (attempt + 1)));
    }
  }
  if (!result) {
    throw lastError instanceof Error ? lastError : new CurriculumAiError(502, "Page read failed.");
  }
  const { outcome, meta } = result;
  if (outcome.kind === "refused") {
    return {
      page_no: page.page_no,
      text: null,
      note: { page_no: page.page_no, kind: "refused", reason: `${outcome.reason} ${meta}` },
    };
  }
  if (outcome.kind === "blank") {
    return {
      page_no: page.page_no,
      text: "",
      note: { page_no: page.page_no, kind: "blank", reason: `${outcome.reason} ${meta}` },
    };
  }
  if (outcome.kind === "cut") {
    return {
      page_no: page.page_no,
      text: outcome.text.slice(0, 12_000),
      note: {
        page_no: page.page_no,
        kind: "cut",
        reason: `The page is very long: its text was cut at the limit. ${meta}`,
      },
    };
  }
  return { page_no: page.page_no, text: outcome.text.slice(0, 12_000) };
}

const LESSON_SHAPE = `{
  "title": "short English title", "title_ar": "short Arabic title (2-4 words, friendly)",
  "topic": "the topic", "source_from_page": 1, "source_to_page": 1,
  "summary": "what Rita teaches, in 2-4 sentences",
  "objectives": [{
    "id": "kebab-case-id", "text": "Learner can ...", "text_ar": "Arabic version",
    "criteria": "exactly what the learner must say for this to count (observable in speech)",
    "check_prompts": ["a question Rita asks to check it"], "weight": 1
  }],
  "plan": {
    "phases": [{ "phase": "warmup|teach|practice|check|wrap", "minutes": 2, "steps": ["what Rita does"] }],
    "teacher_notes": "common mistakes of Arabic speakers and how to correct them"
  },
  "vocabulary": [{ "word": "word", "meaning_ar": "معنى", "example": "Example sentence." }],
  "image_prompt": "one sentence describing a friendly cartoon scene for this topic, no text"
}`;

export async function generateLesson(input: {
  kind: CurriculumKind;
  bookTitle: string;
  topic: string;
  from: number;
  to: number;
  summaries: WindowSummary[];
  pageText: string;
  previousTitles: string[];
}): Promise<{ lesson: LessonDraft; model: string }> {
  const system = `You design one short spoken English lesson that Rita, a friendly voice tutor, teaches to an
Arabic-speaking A1 adult. The lesson is spoken only: no reading, writing or pictures.
Rules:
- Use only content from the given pages (${input.from}-${input.to}); source pages must stay in that range.
- Write 3 to 5 objectives. Each objective is something the learner says in English that Rita can hear,
  e.g. "makes a sentence about themselves with am". Criteria must be checkable from one spoken answer.
- Objective ids are lowercase kebab-case and unique.
- The plan has warmup, teach, practice, check and wrap phases, about 8 minutes in total.
- Put the most important objective first and give it weight 2; others weight 1.
- Do not repeat lessons that already exist: ${input.previousTitles.slice(0, 20).join("; ") || "none yet"}.
Reply with one JSON object shaped like:
${LESSON_SHAPE}`;
  const summaryText = JSON.stringify(input.summaries).slice(0, 12_000);
  const user = `Book: ${input.bookTitle} (${input.kind})
Requested topic: ${input.topic}
Summaries of the pages read so far:
${summaryText}

Page text ${input.from}-${input.to}:
${input.pageText}`;
  const { value, model } = await chatJson(LessonDraftSchema, system, user, {
    maxTokens: 4_000,
    timeoutMs: 90_000,
    temperature: 0.5,
    normalize: normalizeLessonDraftReply,
  });
  return { lesson: value, model };
}

const SLIDES_SHAPE = `{
  "slides": [{
    "kind": "title|point|example|vocabulary|practice|recap",
    "heading": "short English heading", "heading_ar": "Arabic heading",
    "bullets": ["one short idea per bullet, at most 6"],
    "example": "one example sentence from the pages, or empty",
    "vocabulary": [{ "word": "word", "meaning_ar": "معنى", "example": "Example sentence." }],
    "source_page": 1,
    "speaker_note": "what the tutor says out loud for this slide, one or two sentences"
  }]
}`;

/** Slides for one lesson, written only from that lesson's pages. */
export async function generateSlides(input: {
  kind: CurriculumKind;
  bookTitle: string;
  lessonTitle: string;
  topic: string;
  objectives: Objective[];
  from: number;
  to: number;
  pageText: string;
}): Promise<{ slides: Slide[]; model: string }> {
  const system = `You turn one lesson of an English course book into a short slide deck for an
Arabic-speaking A1 adult. The tutor shows the slides while teaching, so each slide is small and clear.
Rules:
- Use only content from the given pages (${input.from}-${input.to}); never invent rules, words or examples.
- 6 to 9 slides. The first slide has kind "title" and the last has kind "recap".
- In between: "point" slides (one rule or idea each, at most 4 short bullets), "example" slides
  (sentences from the pages), a "vocabulary" slide when the pages list words (at most 8 words), and one
  "practice" slide with a spoken task the learner can try.
- Every slide has a heading in English and Arabic. source_page is the page the slide comes from.
- Cover every lesson objective somewhere in the deck.
Reply with one JSON object shaped like:
${SLIDES_SHAPE}`;
  const objectives = input.objectives.map((objective) => `- ${objective.text}`).join("\n");
  const user = `Book: ${input.bookTitle} (${input.kind})
Lesson: ${input.lessonTitle} (topic: ${input.topic})
Objectives:
${objectives}

Page text ${input.from}-${input.to}:
${input.pageText}`;
  const { value, model } = await chatJson(GeneratedDeckSchema, system, user, {
    maxTokens: 4_000,
    timeoutMs: 90_000,
    temperature: 0.4,
  });
  return { slides: finalizeSlides(value.slides, { from: input.from, to: input.to }), model };
}

const EXERCISE_ITEM_SHAPE = `one of:
  { "template": "choice_fill", "id": "x", "skill_tag": "be.he_she_it", "prompt": "She ___ a teacher.",
    "instruction_ar": "اختر الكلمة المناسبة", "options": ["am","is","are"], "keep_option_order": true,
    "answer": "is", "hint_ar": "...", "explain_ar": "...", "explain_en": "...", "source_page": 12 }
  { "template": "meaning_choice", "id": "x", "skill_tag": "word.rent", "prompt": "What does it mean?",
    "instruction_ar": "اختر المعنى الصحيح", "word": "rent", "options": ["إيجار","باب","شارع"], "answer": "إيجار", ... }
  { "template": "word_order", "id": "x", "skill_tag": "be.question_order", "prompt": "Make a question.",
    "instruction_ar": "رتّب الكلمات لتعمل سؤال", "answer": ["Are","you","ready?"], "accepted": [], ... }
  { "template": "syllable_tiles", "id": "x", "skill_tag": "spell.property", "prompt": "Build the word.",
    "instruction_ar": "ركّب الكلمة", "word": "property", "clue_ar": "ملكية، عقار", "answer": ["prop","er","ty"], ... }`;

const LESSON_CONTENT_SHAPE = `{
  "schema": 2, "language": "en", "estimated_minutes": 12,
  "intro_ar": "one short sentence: what we learn today", "intro_en": "...",
  "sections": [{
    "id": "x", "title": "short English title", "title_ar": "short Arabic title", "source_pages": [12],
    "explain": {
      "rule_ar": "the rule in simple Jordanian Arabic, 1-3 short sentences",
      "rule_en": "the rule in one simple English sentence",
      "table": [{ "left": "I", "right": "am" }],
      "examples": [{ "text": "an example sentence from the pages", "note_ar": "short note" }]
    },
    "guided": [ITEM],
    "practice": [ITEM, ITEM, ITEM, ITEM, ITEM, ITEM, ITEM],
    "remediation": [ITEM, ITEM, ITEM],
    "mastery": { "required": 5, "min_correct": 4 }
  }],
  "wrap": { "summary_ar": "2 short sentences", "summary_en": "..." }
}
ITEM is ${EXERCISE_ITEM_SHAPE}`;

const EXERCISE_RULES = `Exercise rules (the website checks each answer in code, so every item must have exactly one right answer):
- choice_fill: the prompt has exactly one "___"; 2-4 options; the answer is one of the options and the ONLY
  option that fits the sentence's grammar and meaning. Distractors are real, plausible mistakes for an Arabic
  speaker, never silly. Set keep_option_order true only for a closed set the learner learns in order
  (am / is / are), otherwise false.
- meaning_choice: "word" is the English word; the answer and 2-3 distractors are short Arabic meanings; the
  meaning is the one the pages teach (choose the right sense for words with several meanings).
- word_order: "answer" is the sentence's words in order (keep punctuation on the last word); 3-8 words; list
  other correct orders in "accepted" (most items have none).
- syllable_tiles: for spelling words from the pages; "answer" pieces joined make "word" exactly; split into
  natural spelling chunks (2-5 pieces; not always 4); "clue_ar" is the Arabic meaning (never the word).
- Sentences are A1, short, and use only words from the pages or very common words.
- hint_ar points to the reason without giving the answer; explain_ar says why the answer is right in one short
  sentence. Simple Jordanian Arabic, wording that fits any gender (no خد/خدي, جاهز/جاهزة).
- skill_tag names the small skill (e.g. "be.plural", "word.owner", "spell.owner"); remediation items train the
  skills that practice items test.
- source_page is the page the sentence or word comes from.`;

/** A lesson with exercises (content version 2), written only from the lesson's pages. */
export async function generateLessonContent(input: {
  kind: CurriculumKind;
  bookTitle: string;
  lessonTitle: string;
  topic: string;
  objectives: Objective[];
  vocabulary: { word: string; meaning_ar: string }[];
  from: number;
  to: number;
  pageText: string;
}): Promise<{ content: LessonContent; model: string }> {
  const system = `You turn one lesson of a language course book into a short interactive lesson with exercises
for an Arabic-speaking A1 adult. Rita, a voice tutor, explains each part; then the learner answers short
exercises in a window on the screen.
Lesson rules:
- Use only content from the given pages (${input.from}-${input.to}); never invent rules or words.
- 2 to 4 parts in the book's order. Each part is one small goal (e.g. "he/she/it is", "the question",
  "the negative", or a group of 5-8 words). Cover every lesson objective.
- Each part: an explanation (rule, a small table when it helps, 1-3 examples from the pages), 1 guided item,
  7 practice items (5 are asked, 2 are spares) and 3 remediation items.
- Grammar parts mostly use choice_fill and word_order; word parts use meaning_choice, choice_fill (the word
  that fits the sentence's meaning) and syllable_tiles for spelling.
- About 12 minutes in total.
${EXERCISE_RULES}
Reply with one JSON object shaped like:
${LESSON_CONTENT_SHAPE}`;
  const objectives = input.objectives.map((objective) => `- ${objective.text}`).join("\n");
  const words = input.vocabulary
    .slice(0, 20)
    .map((item) => `${item.word} = ${item.meaning_ar}`)
    .join("; ");
  const user = `Book: ${input.bookTitle} (${input.kind})
Lesson: ${input.lessonTitle} (topic: ${input.topic})
Objectives:
${objectives}
Words in this lesson: ${words || "none listed"}

Page text ${input.from}-${input.to}:
${input.pageText}`;
  const { value, model } = await chatJson(
    generatedContentSchema({ from: input.from, to: input.to }),
    system,
    user,
    {
      maxTokens: 12_000,
      timeoutMs: 150_000,
      temperature: 0.4,
      normalize: normalizeLessonContentReply,
    },
  );
  return { content: value as LessonContent, model };
}

const ReviewSchema = z.object({
  warnings: z
    .array(
      z.object({
        item_id: z.string().trim().max(48).default(""),
        problem: z.string().trim().min(1).max(300),
      }),
    )
    .max(30),
});
export type ContentWarning = z.infer<typeof ReviewSchema>["warnings"][number];

/**
 * A second, separate check before any learner sees the exercises: items with two right answers,
 * explanations that contradict the pages, wrong meanings. Runs once, never during a lesson.
 */
export async function reviewLessonContent(input: {
  content: LessonContent;
  pageText: string;
}): Promise<{ warnings: ContentWarning[]; model: string }> {
  const system = `You check exercises written for Arabic-speaking A1 learners before they are published.
For each problem you find, give the item id and one sentence. Look for:
- a question where more than one option is correct, or where the marked answer is wrong;
- an explanation, hint or rule that is false or contradicts the book pages;
- a meaning that is not the sense the pages use; a spelling split that is wrong;
- English that is not natural or not A1; Arabic that is not simple Jordanian or assumes the learner's gender.
Do not report style preferences. If everything is fine, return an empty list.
Reply with one JSON object: { "warnings": [{ "item_id": "p1-3", "problem": "..." }] }`;
  const user = `Exercises (JSON):
${JSON.stringify(input.content).slice(0, 40_000)}

Book pages:
${input.pageText.slice(0, 20_000)}`;
  const { value, model } = await chatJson(ReviewSchema, system, user, {
    maxTokens: 3_000,
    timeoutMs: 120_000,
    temperature: 0,
  });
  return { warnings: value.warnings, model };
}

/** One new item in place of an old one: same kind, same skill, a different question. */
export async function regenerateExerciseItem(input: {
  section: LessonSection;
  item: LessonItem;
  pageText: string;
}): Promise<{ item: LessonItem; model: string }> {
  const others = [...input.section.guided, ...input.section.practice, ...input.section.remediation]
    .map((item) => item.prompt + ("word" in item ? ` ${item.word}` : ""))
    .join(" | ");
  const system = `You write one replacement exercise item for an Arabic-speaking A1 learner.
Keep the same template ("${input.item.template}") and skill_tag ("${input.item.skill_tag}"); write a different
question that does not repeat any existing one.
${EXERCISE_RULES}
Reply with one JSON object, the item only, shaped like ${EXERCISE_ITEM_SHAPE}`;
  const user = `Part: ${input.section.title} — ${input.section.explain.rule_en || input.section.explain.rule_ar}
Item to replace: ${JSON.stringify(input.item)}
Existing questions: ${others.slice(0, 4_000)}

Book pages:
${input.pageText.slice(0, 20_000)}`;
  const schema = LessonItemSchema.superRefine((item, ctx) => {
    if (item.template !== input.item.template) {
      ctx.addIssue({ code: "custom", message: `template must be ${input.item.template}` });
    }
    for (const problem of itemProblems(item)) ctx.addIssue({ code: "custom", message: problem });
  });
  const { value, model } = await chatJson(schema, system, user, {
    maxTokens: 1_500,
    timeoutMs: 60_000,
    temperature: 0.7,
  });
  return {
    item: { ...value, id: input.item.id, skill_tag: input.item.skill_tag } as LessonItem,
    model,
  };
}

export async function evaluateTurns(input: {
  lessonTitle: string;
  objectives: Objective[];
  turns: LessonTurn[];
}): Promise<{ evaluation: Evaluation; model: string }> {
  const objectives = input.objectives.map((objective) => ({
    id: objective.id,
    objective: objective.text,
    met_when: objective.criteria,
  }));
  const system = `You are the silent examiner of a spoken English lesson ("${input.lessonTitle}").
Look ONLY at the learner's lines (role "learner"). Rita's lines only give context.
For each objective listed, decide if the learner has now clearly shown it.
- met is true only if the learner's own words satisfy met_when. Small accent or speech-to-text errors are fine.
- evidence must be copied word for word from one learner line (at most 20 words). Never paraphrase.
- quality from 0 to 1: 1 = correct and natural, 0.7 = correct with a small slip, 0.5 = understandable but
  with a clear mistake. Below 0.5 means not met.
- If nothing new is shown, return {"updates": []}.
Reply with JSON: {"updates":[{"objective_id":"id","met":true,"quality":0.8,"evidence":"exact learner words"}]}`;
  const conversation = input.turns
    .map((turn) => `${turn.role === "user" ? "learner" : "rita"}: ${turn.text}`)
    .join("\n");
  const user = `Objectives still open:\n${JSON.stringify(objectives)}\n\nConversation:\n${conversation}`;
  const { value, model } = await chatJson(EvaluationSchema, system, user, {
    maxTokens: 600,
    timeoutMs: 20_000,
    temperature: 0,
  });
  return { evaluation: value, model };
}

/** An objective without its id — the id is kept by the caller. */
const ObjectiveTextSchema = z.object({
  text: z.string().trim().min(3).max(240),
  text_ar: z.string().trim().max(240).default(""),
  criteria: z.string().trim().min(3).max(400),
  check_prompts: z.array(z.string().trim().min(1).max(240)).min(1).max(4),
  weight: z.number().int().min(1).max(5).default(1),
});

export async function regenerateObjective(input: {
  lessonTitle: string;
  topic: string;
  objective: Objective;
}): Promise<Omit<Objective, "id">> {
  const system = `You rewrite ONE objective of a spoken English lesson for an Arabic-speaking A1 adult.
Keep the same teaching goal; improve the wording so the objective is clearer and easier to check from speech.
Rules:
- The objective is something the learner says in English that a tutor can hear.
- criteria must be checkable from one spoken answer.
- check_prompts are questions Rita asks to check it (1-4 short questions).
- weight stays between 1 and 5 (keep the original weight unless it is clearly wrong).
Reply with one JSON object shaped like:
{"text": "Learner can ...", "text_ar": "النسخة العربية", "criteria": "exactly what counts", "check_prompts": ["a question"], "weight": 2}`;
  const user = `Lesson: ${input.lessonTitle} (topic: ${input.topic})
Current objective to rewrite:
${JSON.stringify(input.objective)}`;
  const { value } = await chatJson(ObjectiveTextSchema, system, user, {
    maxTokens: 600,
    timeoutMs: 30_000,
    temperature: 0.4,
  });
  return value;
}

/** The look of every lesson picture: Rita's world in the home page colours. */
export function lessonImagePrompt(scene: string) {
  return `A single square illustration for a language-learning app lesson, shown inside a round frame.
Scene: ${scene.slice(0, 300)}
Style: friendly flat vector cartoon, one or two characters with simple rounded shapes, thick dark ink outlines
(#121117), soft cel shading, clear blue (#2b6df0) and soft blue (#e7eefd) as the main colours with a few cheerful
accents, on a plain light blue background. The subject is large and centred and fills the frame. No words, no
letters, no numbers, no logos, no border, no circle drawn around the picture.`;
}

/**
 * One picture from a free prompt, for the private image endpoint. "lesson" wraps the prompt in the
 * house cartoon style used for lesson covers; "raw" sends the prompt as written.
 */
export async function generateImageFromPrompt(input: {
  prompt: string;
  size: "1024x1024" | "1536x1024" | "1024x1536";
  quality: "medium" | "high";
  style: "raw" | "lesson";
}): Promise<{ bytes: Uint8Array; model: string; contentType: string }> {
  const key = await apiKey();
  const model = (await getServerRuntimeSecret("RITA_IMAGE_MODEL")) || DEFAULT_IMAGE_MODEL;
  const json = await postJson(
    IMAGE_URL,
    key,
    {
      model,
      prompt: input.style === "lesson" ? lessonImagePrompt(input.prompt) : input.prompt,
      size: input.size,
      quality: input.quality,
      output_format: "webp",
      output_compression: 85,
      n: 1,
    },
    110_000,
  );
  const encoded = String(json?.data?.[0]?.b64_json ?? "");
  if (!encoded) throw new CurriculumAiError(502, "The image model returned no picture.");
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return { bytes, model, contentType: "image/webp" };
}

export async function generateLessonImage(
  scene: string,
): Promise<{ bytes: Uint8Array; model: string; contentType: string }> {
  const key = await apiKey();
  const model = (await getServerRuntimeSecret("RITA_IMAGE_MODEL")) || DEFAULT_IMAGE_MODEL;
  const json = await postJson(
    IMAGE_URL,
    key,
    {
      model,
      prompt: lessonImagePrompt(scene),
      size: "1024x1024",
      quality:
        (await getServerRuntimeSecret("RITA_IMAGE_QUALITY")) === "medium" ? "medium" : "high",
      output_format: "webp",
      output_compression: 80,
      n: 1,
    },
    120_000,
  );
  const encoded = String(json?.data?.[0]?.b64_json ?? "");
  if (!encoded) throw new CurriculumAiError(502, "The image model returned no picture.");
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return { bytes, model, contentType: "image/webp" };
}

/** Before a long read: can this key read an image with the chosen model right now? */
export async function checkVisionKey(): Promise<{
  ok: boolean;
  model: string;
  error?: string;
  /** OpenAI refused the test picture itself: the key, model and quota are not to blame. */
  imageProblem?: boolean;
}> {
  const model = await curriculumTextModel();
  try {
    const key = await apiKey();
    await postJson(
      CHAT_URL,
      key,
      {
        model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Reply with the word ok." },
              {
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${VISION_CHECK_JPEG_BASE64}` },
              },
            ],
          },
        ],
        max_completion_tokens: 16,
      },
      20_000,
    );
    return { ok: true, model };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, model, error: message, imageProblem: isImageRejection(message) };
  }
}
