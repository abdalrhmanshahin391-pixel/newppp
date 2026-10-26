// Server functions for lessons with exercises (content version 2). The protected work (reading
// lesson content, which holds the answers, and saving runs/results/progress) happens in the
// `rita-lesson-run` Edge Function, which verifies the caller's token itself. These wrappers only
// forward the signed-in learner's bearer token; no server key is used here.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/legacy-auth-middleware";
import {
  AnswerInput,
  EventInput,
  StartInput,
  type AnswerResult,
  type EventResult,
  type StartRunResult,
} from "@/lib/rita-lesson-run.core";

export type { AnswerResult, EventResult, StartRunResult };

function bearerOf(context: unknown): string {
  const token = (context as { claims?: unknown; token?: string }).token;
  if (token) return token;
  throw new Error("Please sign in again.");
}

async function callLessonFunction<T>(token: string, body: Record<string, unknown>): Promise<T> {
  const base = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!base || !key) throw new Error("Lessons are not configured yet.");
  let res: Response;
  try {
    res = await fetch(`${base}/functions/v1/rita-lesson-run`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, apikey: key },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error("rita-lesson-run unreachable", err);
    throw new Error("Lessons are temporarily unavailable. Please try again.");
  }
  const json = (await res.json().catch(() => null)) as
    | { ok: true; result: T }
    | { ok: false; error: string; message?: string }
    | null;
  if (!res.ok || !json || !json.ok) {
    const message = json && !json.ok ? json.message : undefined;
    throw new Error(message || "Lessons are temporarily unavailable. Please try again.");
  }
  return json.result;
}

export const startLessonRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => StartInput.parse(data))
  .handler(async ({ data, context }): Promise<StartRunResult> =>
    callLessonFunction(bearerOf(context), { op: "start", ...data }),
  );

export const sendLessonEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => EventInput.parse(data))
  .handler(async ({ data, context }): Promise<EventResult> =>
    callLessonFunction(bearerOf(context), { op: "event", ...data }),
  );

export const answerLessonItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => AnswerInput.parse(data))
  .handler(async ({ data, context }): Promise<AnswerResult> =>
    callLessonFunction(bearerOf(context), { op: "answer", ...data }),
  );
