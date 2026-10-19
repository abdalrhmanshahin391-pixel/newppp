import { createFileRoute } from "@tanstack/react-router";
import { getServerRuntimeSecret } from "@/lib/config.server";
import {
  bearerToken,
  checkUsage,
  parseImageRequest,
  promptPreview,
  tokenIsUsable,
} from "@/lib/rita-image-request";

const TABLE = "rita_image_generations";
const BUCKET = "generated-images";
const MAX_BODY_BYTES = 8 * 1024;
const SIGNED_URL_SECS = 60 * 60 * 24 * 7;
// A "running" row older than this is a request that died; it must not block new ones forever.
const STALE_RUNNING_MS = 3 * 60 * 1000;

const noStore = { "cache-control": "no-store" };

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { ...noStore, ...headers } });
}

async function tokenMatches(provided: string, expected: string) {
  const { createHash, timingSafeEqual } = await import("node:crypto");
  const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();
  return timingSafeEqual(digest(provided), digest(expected));
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

function isMissingSchema(error: { message?: string; code?: string } | null) {
  const text = `${error?.code ?? ""} ${error?.message ?? ""}`;
  return /42P01|PGRST205|does not exist|Could not find the table/i.test(text);
}

/**
 * Private endpoint so the site's own OpenAI key can make pictures on request.
 * Closed unless RITA_IMAGE_API_TOKEN (32+ characters) is set; every call needs it as a bearer
 * token, is capped per hour and per day, and is logged without the full prompt.
 */
export const Route = createFileRoute("/api/admin/generate-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const configured = (await getServerRuntimeSecret("RITA_IMAGE_API_TOKEN")).trim();
        // Not configured: behave as if the route does not exist.
        if (!tokenIsUsable(configured)) return new Response("Not found", { status: 404 });
        const provided = bearerToken(request.headers.get("authorization"));
        if (!provided || !(await tokenMatches(provided, configured))) {
          return json({ error: "Unauthorized" }, 401);
        }

        const raw = await request.text();
        if (raw.length > MAX_BODY_BYTES) return json({ error: "Request body is too large." }, 413);
        let body: unknown = null;
        try {
          body = JSON.parse(raw);
        } catch {
          return json({ error: "Body must be valid JSON." }, 400);
        }
        const parsed = parseImageRequest(body);
        if (!parsed.ok) return json({ error: parsed.error }, 400);
        const wanted = parsed.value;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // The log table is new and not in the generated types.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const table = () => (supabaseAdmin.from as any)(TABLE);

        // Caps fail closed: without the log table there is no way to enforce them.
        const now = Date.now();
        const since = (ms: number) => new Date(now - ms).toISOString();
        const count = async (ms: number, statuses: string[]) => {
          const { count: found, error } = await table()
            .select("id", { count: "exact", head: true })
            .in("status", statuses)
            .gte("created_at", since(ms));
          return { found: Number(found ?? 0), error };
        };
        const [hour, day, running] = await Promise.all([
          count(60 * 60 * 1000, ["ok", "running"]),
          count(24 * 60 * 60 * 1000, ["ok", "running"]),
          count(STALE_RUNNING_MS, ["running"]),
        ]);
        const usageError = hour.error ?? day.error ?? running.error;
        if (usageError) {
          return json(
            {
              error: isMissingSchema(usageError)
                ? "Apply migration 20261019180000 (image log table) first."
                : "Could not check the usage limits.",
            },
            503,
          );
        }
        const decision = checkUsage({ hour: hour.found, day: day.found, running: running.found });
        if (!decision.allowed) {
          return json({ error: decision.reason }, 429, {
            "retry-after": String(decision.retryAfterSecs),
          });
        }

        const { data: row, error: insertError } = await table()
          .insert({
            status: "running",
            size: wanted.size,
            quality: wanted.quality,
            style: wanted.style,
            prompt_preview: promptPreview(wanted.prompt),
          })
          .select("id")
          .single();
        if (insertError || !row) return json({ error: "Could not record the request." }, 503);
        const id = String(row.id);
        const finish = (patch: Record<string, unknown>) =>
          table()
            .update(patch)
            .eq("id", id)
            .then(() => undefined);

        try {
          const { generateImageFromPrompt } = await import("@/lib/rita-curriculum-ai.server");
          const image = await generateImageFromPrompt(wanted);
          let url: string | null = null;
          let storagePath: string | null = null;
          if (wanted.save) {
            const day = new Date().toISOString().slice(0, 7);
            storagePath = `${day}/${id}.webp`;
            const upload = await supabaseAdmin.storage
              .from(BUCKET)
              .upload(storagePath, image.bytes, { contentType: image.contentType, upsert: true });
            if (upload.error) {
              storagePath = null;
            } else {
              const signed = await supabaseAdmin.storage
                .from(BUCKET)
                .createSignedUrl(storagePath, SIGNED_URL_SECS);
              url = signed.data?.signedUrl ?? null;
            }
          }
          await finish({ status: "ok", bytes: image.bytes.length, storage_path: storagePath });
          return json({
            id,
            model: image.model,
            size: wanted.size,
            quality: wanted.quality,
            content_type: image.contentType,
            bytes: image.bytes.length,
            image_base64: toBase64(image.bytes),
            url,
            saved: Boolean(url),
            save_error:
              wanted.save && !url ? "The picture was made but could not be stored." : null,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          await finish({ status: "error", error: message.slice(0, 300) });
          const status = (error as { status?: number })?.status;
          // The caller's request was fine; relay the provider's own reason.
          return json({ error: message.slice(0, 400) }, status === 429 ? 429 : 502);
        }
      },
    },
  },
});
