// The AI review of Rita's replies, one conversation at a time, with no timer.
//
// When a call ends, the database wakes this function for that call's conversation
// (public.rita_review_wake, from the trigger on rita_v3_sessions.ended_at). One run reviews up to two
// replies, a stage at a time, for about a minute; if replies are left it asks the database to wake it
// again for the same conversation, until every reply and the whole-conversation review are done.
// Nothing runs while nobody has talked to Rita.
//
// It needs the service key, which the published site's server does not have; Lovable Cloud gives it
// to Edge Functions automatically. The engine is the app's own (../_shared/rita-review.core.ts, a
// byte for byte copy kept by scripts/sync-lesson-edge.mjs); the admin's "review now" uses the same code.
//
// Rules this file keeps:
// - POST only, and only with the private worker key (site_secrets.worker_cron_key).
//   verify_jwt is off in config.toml because the caller is the database, not a user.
// - One run per conversation at a time (rita_review_claim), a daily ceiling against loops, and at
//   most MAX_DEPTH runs in a row for one conversation.
// - It answers with counts only (reviewed, problems, waiting...), never conversation text.
import { createClient } from "@supabase/supabase-js";
import {
  reviewConversation,
  reviewEnabled,
  setReviewDeps,
  type ReviewDb,
} from "../_shared/rita-review.core.ts";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

/** A new stage starts only in the first 45 seconds; a question still open at 125 seconds is saved
 * and stopped, well inside the platform's limit for one run. */
const START_WINDOW_MS = 45_000;
const HARD_STOP_MS = 125_000;
const TURNS_PER_RUN = 2;
/** Runs in a row for one conversation (about 40 replies' worth with room for retries). */
const MAX_DEPTH = 80;
/** After OpenAI says "too many requests" or is down, wait this long before the next run. */
const SERVICE_PAUSE_MS = 30_000;

const uuid = /^[0-9a-f-]{36}$/i;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function sameText(a: string, b: string): Promise<boolean> {
  const digest = async (value: string) =>
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  const [x, y] = await Promise.all([digest(a), digest(b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i += 1) diff |= x[i] ^ y[i];
  return diff === 0;
}

async function handle(request: Request): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const provided = (request.headers.get("x-worker-key") ?? "").trim();
  if (!provided) return json({ error: "unauthorized" }, 401);

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !serviceKey) {
    console.error("rita-review: the function environment is missing a Supabase key");
    return json({ error: "not_configured" }, 500);
  }
  const db = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: secret } = await db
    .from("site_secrets")
    .select("value")
    .eq("key", "worker_cron_key")
    .maybeSingle();
  const expected = typeof secret?.value === "string" ? secret.value.trim() : "";
  if (!expected || !(await sameText(provided, expected))) {
    return json({ error: "unauthorized" }, 401);
  }

  setReviewDeps({
    openAiKey: async () => {
      const fromEnv = (Deno.env.get("OPENAI_API_KEY") ?? "").trim();
      if (fromEnv.length > 20) return fromEnv;
      for (const purpose of ["rita", "shared"]) {
        const { data } = await db
          .from("admin_ai_keys")
          .select("api_key")
          .eq("provider", "openai")
          .eq("purpose", purpose)
          .eq("slot", 1)
          .maybeSingle();
        const saved = String(data?.api_key ?? "").trim();
        if (saved.length > 20) return saved;
      }
      return null;
    },
    modelOverride: async () => (Deno.env.get("RITA_REVIEW_MODEL") ?? "").trim(),
  });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const conversationId = String(body.conversationId ?? "");
  const depth = Number.isInteger(body.depth) ? Number(body.depth) : 0;
  if (!uuid.test(conversationId)) return json({ error: "bad_request" }, 400);
  if (!(await reviewEnabled(db as unknown as ReviewDb))) return json({ enabled: false });

  // A ceiling against a runaway loop, not a budget: replies finished in the last 24 hours.
  const { data: settings } = await db
    .from("rita_review_settings")
    .select("daily_turn_limit")
    .eq("id", true)
    .maybeSingle();
  const limit = Number(settings?.daily_turn_limit ?? 1500);
  const dayStart = new Date(Date.now() - 24 * 3600 * 1000);
  const { count } = await db
    .from("rita_turn_reviews")
    .select("id", { count: "exact", head: true })
    .eq("status", "done")
    .gte("reviewed_at", dayStart.toISOString());
  if ((count ?? 0) >= limit) return json({ enabled: true, skipped: "daily_limit" });

  const { data: claimed } = await db.rpc("rita_review_claim", {
    p_conversation: conversationId,
    p_seconds: Math.ceil(HARD_STOP_MS / 1000) + 15,
  });
  if (!claimed) return json({ enabled: true, skipped: "busy" });

  const started = Date.now();
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), HARD_STOP_MS);
  let again = false;
  let pause = 0;
  try {
    const summary = await reviewConversation(db as unknown as ReviewDb, {
      conversationId,
      deadlineAt: started + START_WINDOW_MS,
      maxTurns: TURNS_PER_RUN,
      signal: stop.signal,
    });
    // Replies left, part-way stages, or the closing work: wake again for the same conversation.
    again = summary.waiting > 0 || summary.finalPending || summary.failed > 0;
    if (summary.stopped) {
      again = true;
      pause = SERVICE_PAUSE_MS;
    }
    return json({ enabled: true, depth, ...summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("rita-review:", message);
    return json({ error: "review_failed", message: message.slice(0, 300) }, 500);
  } finally {
    clearTimeout(timer);
    await db.rpc("rita_review_release", { p_conversation: conversationId });
    if (again && depth < MAX_DEPTH) {
      if (pause && Date.now() - started + pause < HARD_STOP_MS) {
        await new Promise((resolve) => setTimeout(resolve, pause));
      }
      const { error } = await db.rpc("rita_review_wake", {
        p_conversation: conversationId,
        p_depth: depth + 1,
      });
      if (error) console.error("rita-review: could not wake the next run", error.message);
    }
  }
}

Deno.serve(handle);
