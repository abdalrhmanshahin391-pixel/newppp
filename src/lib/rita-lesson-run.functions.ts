// Server functions for lessons with exercises (content version 2). The learner's browser never
// reads the content (it holds the answers) and never writes a run or a result, and this app server
// has no service key either. The work happens in the `rita-lesson-run` Edge Function (see
// supabase/functions/rita-lesson-run), which holds the key; these functions only check the schema
// of the request and forward it with the learner's own token. The operations themselves live in
// rita-lesson-run.core.ts, shared by both sides.
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
import type { EdgeReply } from "@/lib/rita-lesson-edge.server";

async function callEdge<T>(op: "start" | "event" | "answer", data: unknown): Promise<EdgeReply<T>> {
  const { callLessonEdge } = await import("@/lib/rita-lesson-edge.server");
  return callLessonEdge<T>(op, data);
}

export type { AnswerResult, EventResult, StartRunResult };

/** A failed call becomes an error the page already knows how to show; the code stays in the message. */
function failed(reply: Extract<EdgeReply<unknown>, { ok: false }>): never {
  throw new Error(`lesson_${reply.code}: ${reply.message}`);
}

export const startLessonRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => StartInput.parse(data))
  .handler(async ({ data }): Promise<StartRunResult> => {
    const reply = await callEdge<StartRunResult>("start", data);
    if (reply.ok) return reply.data;
    // Until the function is deployed the learner keeps Rita's spoken lesson instead of an error
    // screen. Only "not reachable" falls back; a real failure stays visible.
    if (reply.unreachable) return { available: false };
    return failed(reply);
  });

export const sendLessonEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => EventInput.parse(data))
  .handler(async ({ data }): Promise<EventResult> => {
    const reply = await callEdge<EventResult>("event", data);
    return reply.ok ? reply.data : failed(reply);
  });

export const answerLessonItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => AnswerInput.parse(data))
  .handler(async ({ data }): Promise<AnswerResult> => {
    const reply = await callEdge<AnswerResult>("answer", data);
    return reply.ok ? reply.data : failed(reply);
  });
