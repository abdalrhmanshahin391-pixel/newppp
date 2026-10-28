// The scheduled AI review of Rita's replies (every 2 minutes, from pg_cron).
//
// It reads every recent conversation, so it needs the service key, which the published site's
// server does not have; Lovable Cloud gives it to Edge Functions automatically. The engine is the
// app's own (../_shared/rita-review.core.ts, a byte for byte copy kept by
// scripts/sync-lesson-edge.mjs); the admin's "review now" steps on the site use the same code.
//
// Rules this file keeps:
// - POST only, and only with the private worker key (site_secrets.worker_cron_key), the same key the
//   cron job sends. verify_jwt is off in config.toml because the caller is the database, not a user.
// - It answers with counts only (reviewed, problems, waiting...), never conversation text.
import { createClient } from "@supabase/supabase-js";
import { runScheduledReview, setReviewDeps, type ReviewDb } from "../_shared/rita-review.core.ts";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

/** Leaves time for a reply started near the end to finish before the platform's limit. */
const BUDGET_MS = 90_000;

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

  try {
    return json(await runScheduledReview(db as unknown as ReviewDb, BUDGET_MS));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("rita-review:", message);
    return json({ error: "review_failed", message: message.slice(0, 300) }, 500);
  }
}

Deno.serve(handle);
