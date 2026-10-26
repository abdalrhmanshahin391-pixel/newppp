// Calls the `rita-lesson-run` Edge Function with the signed-in learner's own token.
// The function holds the service key and the protected exercise content; this app server holds
// neither. It only forwards. Pure fetch, so it runs the same locally and on the published site.
import { getRequest } from "@tanstack/react-start/server";
import { getSupabasePublicConfig } from "@/integrations/supabase/config";

export type EdgeOp = "start" | "event" | "answer" | "ping";

export type EdgeReply<T> =
  | { ok: true; data: T }
  /** `unreachable`: the function is not deployed yet (404) or could not be reached at all. */
  | { ok: false; unreachable: boolean; status: number; code: string; message: string };

export async function callLessonEdge<T>(op: EdgeOp, data?: unknown): Promise<EdgeReply<T>> {
  const token = (getRequest()?.headers.get("authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!token)
    return {
      ok: false,
      unreachable: false,
      status: 401,
      code: "unauthorized",
      message: "Sign in first.",
    };
  const { url, publishableKey } = getSupabasePublicConfig();
  let response: Response;
  try {
    response = await fetch(`${url}/functions/v1/rita-lesson-run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: publishableKey,
      },
      body: JSON.stringify({ op, data }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (cause) {
    return {
      ok: false,
      unreachable: true,
      status: 0,
      code: "unreachable",
      message:
        cause instanceof Error
          ? cause.message.slice(0, 160)
          : "The lesson service could not be reached.",
    };
  }
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (response.ok) return { ok: true, data: body as T };
  const failure = (body ?? {}) as { error?: unknown; message?: unknown };
  return {
    ok: false,
    // A function that is not deployed answers 404 with a platform message, not our own code.
    unreachable: response.status === 404 && typeof failure.error !== "string",
    status: response.status,
    code: typeof failure.error === "string" ? failure.error : `http_${response.status}`,
    message:
      typeof failure.message === "string"
        ? failure.message
        : "The lesson service answered with an error.",
  };
}
