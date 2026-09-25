// Server-only: the single place that decides which AI key every tool uses.
//
// Every text/vision study tool uses the same protected project Gemini key.

export const AI_TOOL_IDS = [
  "aio",
  "rita",
  "lecture",
  "questions",
  "archive",
  "summaries",
  "german",
  "speech",
] as const;

export type AiToolId = (typeof AI_TOOL_IDS)[number];

export const AI_TOOLS: { id: AiToolId; name: string; blurb: string }[] = [
  { id: "aio", name: "All in One", blurb: "Guide, summary, cards and questions from one lecture." },
  { id: "rita", name: "Rita AI Model 3.8", blurb: "Cuts questions out of a PDF and explains each one." },
  { id: "lecture", name: "Lecture Lab", blurb: "Short questions with two-line notes from a lecture." },
  { id: "questions", name: "Question generator", blurb: "The question maker in the study hub." },
  { id: "archive", name: "Archive solver", blurb: "Solves and explains old archive papers." },
  { id: "summaries", name: "PDF summaries", blurb: "Turns a PDF or photos into a clean summary." },
  { id: "german", name: "German tools", blurb: "Word import, tap game and sentence building." },
  { id: "speech", name: "German speaking", blurb: "Listening and pronunciation scoring." },
];

export const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
export const GATEWAY_MODEL = "openai/gpt-6-astra";
export const GOOGLE_OPENAI_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
export const GOOGLE_DEFAULT_MODEL = "gemini-flash-latest";

export type KeySource = "own" | "shared" | "secret" | "gateway";

export type AiTarget = {
  url: string;
  key: string;
  model: string;
  source: KeySource;
  /** true when a Google Gemini key is used (not the shared RitaJet AI) */
  google: boolean;
};

type Row = { api_key: string | null; preferred_model: string | null; purpose: string; slot: number };

async function readRows(supabase: any, tool: AiToolId): Promise<Row[]> {
  try {
    const { data } = await supabase
      .from("admin_ai_keys")
      .select("api_key, preferred_model, purpose, slot")
      .eq("provider", "gemini")
      .in("purpose", [tool, "shared"])
      .order("slot", { ascending: true });
    return ((data ?? []) as Row[]).filter((r) => String(r.api_key ?? "").trim().length > 10);
  } catch {
    return [];
  }
}

/** Where one tool should send its request right now. */
export async function resolveAiTarget(supabase: any, tool: AiToolId): Promise<AiTarget> {
  const secret = (process.env["GEMINI_API_KEY"] ?? "").trim();
  if (secret.length > 10) {
    return {
      url: GOOGLE_OPENAI_URL,
      key: secret,
      model: GOOGLE_DEFAULT_MODEL,
      source: "secret",
      google: true,
    };
  }

  const gatewayKey = (process.env["LOVABLE_API_KEY"] ?? "").trim();
  if (!gatewayKey) {
    throw new Error("The AI service is not switched on yet. Add a Gemini key in the admin AI page.");
  }
  return { url: GATEWAY_URL, key: gatewayKey, model: GATEWAY_MODEL, source: "gateway", google: false };
}

/** Just the raw Gemini key for tools that talk to Google's own API directly. */
export async function resolveGeminiKeyForTool(
  supabase: any,
  tool: AiToolId,
): Promise<{ key: string; model: string | null }> {
  const secret = (process.env["GEMINI_API_KEY"] ?? "").trim();
  if (secret.length > 10) return { key: secret, model: null };
  throw new Error(
    "This tool has no Gemini key yet. Ask the site owner to add one in the admin AI page.",
  );
}

/** One cheap call used by the “Test” buttons. */
export async function pingChatKey(
  key: string,
  model?: string | null,
  opts?: { gateway?: boolean },
): Promise<{ ok: boolean; message: string }> {
  const trimmed = key.trim();
  const gateway = !!opts?.gateway;
  if (!gateway && !trimmed.startsWith("AIza")) {
    return {
      ok: false,
      message:
        "This does not look like a Google AI Studio key. Those start with AIza — grab one from aistudio.google.com/apikey.",
    };
  }
  const url = gateway ? GATEWAY_URL : GOOGLE_OPENAI_URL;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (gateway) headers["Lovable-API-Key"] = trimmed;
  else headers["Authorization"] = `Bearer ${trimmed}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: model?.trim() || (gateway ? GATEWAY_MODEL : GOOGLE_DEFAULT_MODEL),
        messages: [{ role: "user", content: "Reply with the single word: ok" }],
      }),
    });
    if (res.ok) return { ok: true, message: "Working — this answered straight away." };
    const body = await res.text();
    if (res.status === 401 || res.status === 403)
      return { ok: false, message: "The key was rejected (not valid or not enabled)." };
    if (res.status === 429)
      return { ok: false, message: "It works but is rate limited right now — try again in a minute." };
    return { ok: false, message: `Error ${res.status}: ${body.slice(0, 160)}` };
  } catch (e: any) {
    return { ok: false, message: `Could not reach the AI service: ${String(e?.message ?? e).slice(0, 160)}` };
  }
}

/** Turns raw provider errors into something a student can read. */
export function friendlyAiError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (/429|quota|rate/i.test(raw)) return "Rita is busy right now — wait a minute and try again.";
  if (/401|403|API key|permission/i.test(raw))
    return "Rita's AI needs attention from the site owner.";
  if (/safety|blocked/i.test(raw)) return "Rita couldn't work with that page. Try a different one.";
  if (/empty|did not return valid JSON|no candidate/i.test(raw))
    return "Rita couldn't read that clearly. Try a sharper photo or a bit more text.";
  return "Something went wrong while working on that. Please try again.";
}
