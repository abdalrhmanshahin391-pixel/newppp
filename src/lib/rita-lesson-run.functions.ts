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

/**
 * Exercise content is intentionally server-only because it contains answer keys. Some Lovable
 * deployments do not provide the service-role connection used by this legacy server function.
 * In that case the lesson page must keep its normal spoken-lesson path instead of presenting the
 * learner with an implementation error. Do not broaden this catch: real database failures should
 * remain visible to us.
 */
function lessonBackendIsUnavailable(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes("Missing server-only Lovable Cloud secret: SUPABASE_SERVICE_ROLE_KEY")
  );
}

export const startLessonRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => StartInput.parse(data))
  .handler(async ({ data, context }): Promise<StartRunResult> => {
    try {
      return await startRun(await depsOf(context), data);
    } catch (error) {
      // The exercise backend is optional until it has a secure server runtime. Returning this
      // keeps Rita's spoken lesson usable while preserving the protected content and its RLS.
      if (lessonBackendIsUnavailable(error)) return { available: false };
      throw error;
    }
  });

export const sendLessonEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => EventInput.parse(data))
  .handler(async ({ data, context }): Promise<EventResult> => sendEvent(await depsOf(context), data));

export const answerLessonItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => AnswerInput.parse(data))
  .handler(async ({ data, context }): Promise<AnswerResult> => answerItem(await depsOf(context), data));
