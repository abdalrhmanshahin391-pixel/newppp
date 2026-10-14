// OpenAI calls for Rita's curriculum: summarise a ten-page window, write a
// lesson, judge a learner's answers against the lesson objectives, and draw the
// lesson picture. Every reply is strict JSON checked against the zod schemas.
import { z } from "zod";
import { getServerRuntimeSecret } from "@/lib/config.server";
import { resolveRitaOpenAiKey } from "@/lib/rita-voice.server";
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

async function apiKey() {
  const fromEnv = await getServerRuntimeSecret("OPENAI_API_KEY");
  if (fromEnv.length > 20) return fromEnv;
  const saved = await resolveRitaOpenAiKey();
  if (saved) return saved;
  throw new CurriculumAiError(
    503,
    "Add OPENAI_API_KEY to the server secrets to use the curriculum AI.",
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

const TranscriptionSchema = z.object({
  pages: z
    .array(z.object({ page_no: z.number().int().min(1), text: z.string().max(12_000) }))
    .max(10),
});

/** Reads scanned pages (no text layer) so the rest of the flow can work with text. */
export async function transcribePages(
  pages: { page_no: number; jpegBase64: string }[],
): Promise<{ pages: { page_no: number; text: string }[]; model: string }> {
  const key = await apiKey();
  const model = await curriculumTextModel();
  const content: unknown[] = [
    {
      type: "text",
      text: `Transcribe each page image of an English course book exactly, keeping line breaks and table rows.
Pages in order: ${pages.map((page) => page.page_no).join(", ")}.
Reply with JSON: {"pages":[{"page_no":N,"text":"..."}]}`,
    },
  ];
  for (const page of pages) {
    content.push({
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${page.jpegBase64}`, detail: "high" },
    });
  }
  const json = await postJson(
    CHAT_URL,
    key,
    {
      model,
      messages: [{ role: "user", content }],
      response_format: { type: "json_object" },
      temperature: 0,
      max_completion_tokens: 8_000,
    },
    120_000,
  );
  const parsed = TranscriptionSchema.safeParse(
    parseJsonObject(String(json?.choices?.[0]?.message?.content ?? "")),
  );
  if (!parsed.success)
    throw new CurriculumAiError(502, "The AI could not read those scanned pages.");
  const wanted = new Set(pages.map((page) => page.page_no));
  return { pages: parsed.data.pages.filter((page) => wanted.has(page.page_no)), model };
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

/** The look of every lesson picture, matching the purple circle path nodes. */
export function lessonImagePrompt(scene: string) {
  return `A single round sticker-style cartoon illustration for a language-learning app lesson.
Scene: ${scene.slice(0, 300)}
Style: flat vector cartoon, one or two friendly characters with simple rounded shapes, bold clean outlines,
soft cel shading, bright cheerful colours, centred inside a solid violet circle (#8B4DEB) that fills the
frame, plain white outside the circle, no words, no letters, no numbers, no logos.`;
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
      quality: "medium",
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
