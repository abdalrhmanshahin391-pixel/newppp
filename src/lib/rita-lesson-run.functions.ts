// Server functions for lessons with exercises (content version 2). The learner's browser never
// reads the content (it holds the answers) and never writes a run or a result. The operations live
// in rita-lesson-run.core.ts; `db` is the server connection scoped by hand to the signed-in learner,
// `userDb` is the learner's own connection so RLS decides which lessons they may see.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/legacy-auth-middleware";
import {
  AnswerInput,
  EventInput,
  StartInput,
  answerItem,
  sendEvent,
  startRun,
  type AnswerResult,
  type Db,
  type EventResult,
  type LessonDeps,
  type StartRunResult,
} from "@/lib/rita-lesson-run.core";

export type { AnswerResult, EventResult, StartRunResult };

async function depsOf(context: unknown): Promise<LessonDeps> {
  const ctx = context as { supabase: Db; userId: string };
  const { supabaseAdmin } = await import("@/integrations/supabase/legacy-client.server");
  return { db: supabaseAdmin as unknown as Db, userDb: ctx.supabase, userId: ctx.userId };
}

export const startLessonRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => StartInput.parse(data))
  .handler(async ({ data, context }): Promise<StartRunResult> => startRun(await depsOf(context), data));

export const sendLessonEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => EventInput.parse(data))
  .handler(async ({ data, context }): Promise<EventResult> => sendEvent(await depsOf(context), data));

export const answerLessonItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => AnswerInput.parse(data))
  .handler(async ({ data, context }): Promise<AnswerResult> => answerItem(await depsOf(context), data));
