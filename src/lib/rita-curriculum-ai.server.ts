// OpenAI calls for Rita's curriculum: summarise a ten-page window, write a
// lesson, judge a learner's answers against the lesson objectives, and draw the
// lesson picture. Every reply is strict JSON checked against the zod schemas.
import { z } from "zod";
import { getServerRuntimeSecret } from "@/lib/config.server";
import { resolveRitaOpenAiKey } from "@/lib/rita-voice.server";
import { GeneratedDeckSchema, finalizeSlides, type Slide } from "@/lib/rita-slides";
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
  options: { maxTokens: number; timeoutMs: number; temperature?: number },
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
      const result = schema.safeParse(parsed);
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

/** Reads scanned pages (no text layer) so the rest of the flow can work with text. */
export async function transcribePages(
  pages: { page_no: number; jpegBase64: string }[],
): Promise<{ pages: { page_no: number; text: string }[]; model: string; failures: string[] }> {
  const key = await apiKey();
  const model = await curriculumTextModel();
  // One request per page: a single slow or malformed page can no longer sink its
  // neighbours, and each request stays well inside the host's time limit.
  const settled = await Promise.allSettled(
    pages.map((page) => transcribeOnePage(key, model, page)),
  );
  const done: { page_no: number; text: string }[] = [];
  const failures: string[] = [];
  settled.forEach((result, index) => {
    if (result.status === "fulfilled") done.push(result.value);
    else {
      const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
      failures.push(`p${pages[index].page_no}: ${reason}`);
    }
  });
  if (!done.length && failures.length) {
    const first = settled.find((result) => result.status === "rejected") as PromiseRejectedResult;
    throw first.reason instanceof Error ? first.reason : new CurriculumAiError(502, failures[0]);
  }
  return { pages: done, model, failures };
}

const SinglePageSchema = z.object({ text: z.string().max(12_000) });

async function transcribeOnePage(
  key: string,
  model: string,
  page: { page_no: number; jpegBase64: string },
): Promise<{ page_no: number; text: string }> {
  const body = {
    model,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Transcribe this page of an English course book exactly, keeping line breaks and table rows.
If the page has no readable text (a cover picture, a blank page), reply with an empty string.
Reply with JSON: {"text":"..."}`,
          },
          {
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${page.jpegBase64}`, detail: "high" },
          },
        ],
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0,
    max_completion_tokens: 4_000,
  };
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const json = await postJson(CHAT_URL, key, body, 100_000);
      const parsed = SinglePageSchema.safeParse(
        parseJsonObject(String(json?.choices?.[0]?.message?.content ?? "")),
      );
      if (!parsed.success) throw new CurriculumAiError(502, "The AI could not read that page.");
      return { page_no: page.page_no, text: parsed.data.text };
    } catch (error) {
      lastError = error;
      const retryable =
        error instanceof CurriculumAiError ? error.status === 429 || error.status >= 500 : true;
      if (!retryable || attempt === 2) break;
      await new Promise((resolve) => setTimeout(resolve, 1_500 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new CurriculumAiError(502, "Page read failed.");
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
