// Lessons with exercises: start, event and answer, run next to the protected tables.
//
// The exercise content holds the answer keys, so the browser never reads it and the app's own server
// has no service key. This function does: Lovable Cloud gives Edge Functions the key automatically.
// The app's server functions (src/lib/rita-lesson-run.functions.ts) forward the learner's token here.
//
// Rules this file keeps:
// - POST only; every call needs a valid user token, checked with getClaims (verify_jwt is off in
//   config.toml because the new signing keys are verified in code).
// - `db` (service key) is only used for protected tables and is always scoped to the caller's user id
//   inside the shared core; `userDb` is the caller's own connection so row level security decides
//   which lessons they may see.
// - Answers leave only through `viewOf` in the shared core, which is a whitelist (no content, no keys).
// - Errors are short codes; details go to the function log only.
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  AnswerInput,
  EventInput,
  LessonRunError,
  StartInput,
  answerItem,
  sendEvent,
  startRun,
  type Db,
} from "../_shared/rita-lesson-run.core.ts";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const Envelope = z.object({
  op: z.enum(["start", "event", "answer", "ping"]),
  data: z.unknown().optional(),
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function config() {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey =
    Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !anonKey || !serviceKey) return null;
  return { url, anonKey, serviceKey };
}

async function handle(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const header = request.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (token.split(".").length !== 3) return json({ error: "unauthorized" }, 401);

  const env = config();
  if (!env) {
    console.error("rita-lesson-run: the function environment is missing a Supabase key");
    return json({ error: "not_configured" }, 500);
  }

  const userDb = createClient(env.url, env.anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  }) as unknown as Db;
  const { data: claimsData, error: claimsError } = await userDb.auth.getClaims(token);
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) return json({ error: "unauthorized" }, 401);

  let envelope: z.infer<typeof Envelope>;
  try {
    envelope = Envelope.parse(await request.json());
  } catch {
    return json({ error: "bad_request" }, 400);
  }

  const db = createClient(env.url, env.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as unknown as Db;
  const deps = { db, userDb, userId };

  try {
    if (envelope.op === "ping") {
      // The admin check asks "can the exercise backend read the protected content?". Booleans only.
      const probe = await db.from("rita_lesson_contents").select("lesson_id").limit(1);
      return json({ ok: !probe.error, schemaMissing: probe.error?.code === "42P01" });
    }
    if (envelope.op === "start") return json(await startRun(deps, StartInput.parse(envelope.data)));
    if (envelope.op === "event") return json(await sendEvent(deps, EventInput.parse(envelope.data)));
    return json(await answerItem(deps, AnswerInput.parse(envelope.data)));
  } catch (error) {
    if (error instanceof z.ZodError) return json({ error: "bad_request" }, 400);
    if (error instanceof LessonRunError) return json({ error: error.code, message: error.message }, error.status);
    console.error("rita-lesson-run:", error instanceof Error ? error.message : String(error));
    return json({ error: "server_error" }, 500);
  }
}

Deno.serve(handle);
