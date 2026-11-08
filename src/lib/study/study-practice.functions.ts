// Flashcards and four-option questions from what the learner selected in a study guide. The server
// checks the lesson and the selection and counts the request (resolveRequest), asks the model, and
// returns only what passes the checks in study-practice.ts. The study page displays the results
// for the current visit; nothing is stored. Previews by an admin count nothing.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/legacy-auth-middleware";
import { resolveRequest } from "./study-request.functions";
import {
  askPracticeModel,
  cardsSystemPrompt,
  cleanCards,
  cleanMcqs,
  maxCards,
  mcqCount,
  mcqSystemPrompt,
  NO_CARDS_TEXT,
  NO_MCQ_TEXT,
  PRACTICE_FAILURE_TEXT,
  practiceUserMessage,
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

function parse(data: unknown) {
  const result = PracticeInput.safeParse(data);
  if (!result.success) throw new Error("Bad request.");
  return result.data;
}

/** One JSON answer from the same model as Rita's written answers (see askPracticeModel). */
async function askModel(system: string, user: string, maxTokens: number) {
  const { resolveRitaV3Key } = await import("@/lib/rita-v3.server");
  const key = await resolveRitaV3Key("groq", "GROQ_API_KEY");
  // Wrapped: the platform's fetch must be called on its own, not as a method of another object.
  return askPracticeModel({
    fetch: (input, init) => fetch(input, init),
    key,
    system,
    user,
    maxTokens,
  });
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
    const asked = await askModel(
      cardsSystemPrompt(limit),
      practiceUserMessage(quote, lessonContext),
      3500,
    );
    if (!asked.ok)
      return { ok: false, code: asked.reason, message: PRACTICE_FAILURE_TEXT[asked.reason] };
    const cards = cleanCards(asked.reply, `${quote}\n${lessonContext}`, limit);
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
    const asked = await askModel(
      mcqSystemPrompt(count),
      practiceUserMessage(quote, lessonContext),
      4000,
    );
    if (!asked.ok)
      return { ok: false, code: asked.reason, message: PRACTICE_FAILURE_TEXT[asked.reason] };
    const questions = cleanMcqs(asked.reply, count);
    if (!questions.length) return { ok: false, code: "no_questions", message: NO_MCQ_TEXT };
    return { ok: true, questions };
  });
