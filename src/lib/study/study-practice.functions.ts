// Flashcards and four-option questions from what the learner selected in a study guide. The server
// checks the lesson and the selection and counts the request (resolveRequest), asks the model, and
// returns only what passes the checks in study-practice.ts. The study page displays the results
// for the current visit; nothing is stored. Previews by an admin count nothing.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/legacy-auth-middleware";
import { resolveRequest } from "./study-request.functions";
import {
  cardsSystemPrompt,
  cleanCards,
  cleanMcqs,
  maxCards,
  mcqCount,
  mcqSystemPrompt,
  NO_CARDS_TEXT,
  NO_MCQ_TEXT,
  practiceUserMessage,
  readJson,
  type StudyCard,
  type StudyMcq,
} from "./study-practice";

const PracticeInput = z.object({
  lessonId: z.string().uuid(),
  preview: z.boolean().default(false),
  requestId: z.string().uuid(),
  selection: z.object({
    segIds: z.array(z.string().max(24)).max(12),
    exact: z.string().max(4000),
    parts: z.array(z.string().max(4000)).max(12).optional(),
  }),
});

type Failure = { ok: false; code: string; message: string; retryAfter?: number };
export type CardsResult = { ok: true; cards: StudyCard[] } | Failure;
export type McqResult = { ok: true; questions: StudyMcq[] } | Failure;

const TRY_AGAIN = "ما زبطت هالمرة. جرّب مرة ثانية.";

function parse(data: unknown) {
  const result = PracticeInput.safeParse(data);
  if (!result.success) throw new Error("Bad request.");
  return result.data;
}

/** One JSON answer from the same model as Rita's written answers; null when it fails. */
async function askModel(system: string, user: string, maxTokens: number): Promise<unknown> {
  const { resolveRitaV3Key } = await import("@/lib/rita-v3.server");
  const key = await resolveRitaV3Key("groq", "GROQ_API_KEY");
  if (!key) return null;
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        temperature: 0.2,
        max_completion_tokens: maxTokens,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) return null;
    const json = await response.json();
    return readJson(String(json?.choices?.[0]?.message?.content ?? ""));
  } catch {
    return null;
  }
}

/** Flashcards (a word or sentence and its meaning) from the selection. */
export const studyMakeCards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(parse)
  .handler(async ({ data, context }): Promise<CardsResult> => {
    const outcome = await resolveRequest(context, {
      ...data,
      action: "make_cards",
      channel: "text",
    });
    if ("result" in outcome) return outcome.result as Failure;
    const { quote, context: lessonContext } = outcome.resolved;
    const limit = maxCards(quote);
    const reply = await askModel(
      cardsSystemPrompt(limit),
      practiceUserMessage(quote, lessonContext),
      2500,
    );
    if (reply === null) return { ok: false, code: "failed", message: TRY_AGAIN };
    const cards = cleanCards(reply, `${quote}\n${lessonContext}`, limit);
    if (!cards.length) return { ok: false, code: "no_cards", message: NO_CARDS_TEXT };
    return { ok: true, cards };
  });

/** Questions with four options and one right answer, from the selection. */
export const studyMakeMcq = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(parse)
  .handler(async ({ data, context }): Promise<McqResult> => {
    const outcome = await resolveRequest(context, {
      ...data,
      action: "make_mcq",
      channel: "text",
    });
    if ("result" in outcome) return outcome.result as Failure;
    const { quote, context: lessonContext } = outcome.resolved;
    const count = mcqCount(quote);
    const reply = await askModel(
      mcqSystemPrompt(count),
      practiceUserMessage(quote, lessonContext),
      3000,
    );
    if (reply === null) return { ok: false, code: "failed", message: TRY_AGAIN };
    const questions = cleanMcqs(reply, count);
    if (!questions.length) return { ok: false, code: "no_questions", message: NO_MCQ_TEXT };
    return { ok: true, questions };
  });
