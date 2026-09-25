/**
 * Server-only gate for the scheduled background workers.
 *
 * The workers used to accept the project's publishable key, which also ships to
 * every browser, so anyone could trigger paid AI jobs. They now require a
 * private key that lives only in the admin-only `site_secrets` table (same
 * pattern as the nightly vault snapshot), or Lovable's own cron secret.
 */
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

const SECRET_KEY = "worker_cron_key";

async function timingSafeMatch(provided: string, expected: string) {
  const { createHash, timingSafeEqual } = await import("node:crypto");
  const digest = (v: string) => createHash("sha256").update(v, "utf8").digest();
  return timingSafeEqual(digest(provided), digest(expected));
}

/** Returns a 401 Response when the caller is not a trusted scheduler, else null. */
export async function authorizeWorkerRequest(request: Request): Promise<Response | null> {
  const provided = request.headers.get("x-worker-key") ?? "";

  if (provided) {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/legacy-client.server");
      const { data } = await (supabaseAdmin.from as any)("site_secrets")
        .select("value")
        .eq("key", SECRET_KEY)
        .maybeSingle();
      const expected = typeof data?.value === "string" ? data.value.trim() : "";
      if (expected && (await timingSafeMatch(provided, expected))) return null;
    } catch {
      /* fall through to the cron secret below */
    }
  }

  const denied = await authenticateCronRequest(request);
  if (denied) return new Response("Unauthorized", { status: 401 });
  return null;
}
