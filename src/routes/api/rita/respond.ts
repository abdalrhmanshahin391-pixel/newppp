/* eslint-disable @typescript-eslint/no-explicit-any -- Rita tables are not yet in generated Supabase types. */
import { createFileRoute } from "@tanstack/react-router";
import {
  RITA_MODELS,
  estimateSpeechDurationMs,
  estimateTurnCostMicros,
  getRitaAllowance,
  getRitaSettings,
  normalizePersonality,
  requireRitaUser,
  resolveRitaOpenAiKey,
} from "@/lib/rita-voice.server";
import { RitaClauseChunker, cleanRitaSpokenText } from "@/lib/rita-clause-chunker";
import { createRitaSpeechTicket } from "@/lib/rita-speech-ticket.server";

type HistoryItem = { role: "user" | "assistant"; content: string };

function safeHistory(value: unknown): HistoryItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(-8)
    .filter((item) => item?.role === "user" || item?.role === "assistant")
    .map((item) => ({
      role: item.role as HistoryItem["role"],
      content: String(item.content ?? "")
        .trim()
        .slice(0, 600),
    }))
    .filter((item) => item.content);
}

function sse(type: string, data: unknown) {
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function accentInstruction(accent: string, transcriptLanguage: string) {
  const selected = accent.trim();
  if (selected === "ar-JO")
    return "Reply in natural everyday Jordanian Arabic. Use شو، بدي، مش، عليك naturally; never use Iraqi شنو.";
  if (selected === "ar-IQ") return "Reply in natural everyday Iraqi Arabic without caricature.";
  if (/^ar-/i.test(selected)) return `Reply in natural everyday ${selected} Arabic.`;
  if (/^de/i.test(selected)) return "Reply in natural conversational German.";
  if (/^en-GB/i.test(selected)) return "Reply in natural British English.";
  if (/^en/i.test(selected)) return "Reply in natural conversational English.";
  if (/^ar/i.test(transcriptLanguage))
    return "Reply in natural Jordanian Arabic unless the learner explicitly asks for another language.";
  if (/^de/i.test(transcriptLanguage)) return "Reply in natural conversational German.";
  return "Match the learner's established language without switching because of one borrowed word.";
}

function systemPrompt(args: {
  personality: string;
  accent: string;
  transcriptLanguage: string;
  words: number;
}) {
  const personality = {
    kind: "Warm, patient and encouraging, never patronizing.",
    direct: "Concise and candid about mistakes while remaining respectful.",
    playful: "Lightly witty and encouraging; never mock the learner.",
    strict: "Structured and focused; never shame the learner.",
  }[args.personality];
  return `You are Rita, a natural one-to-one language tutor speaking aloud. ${personality}
${accentInstruction(args.accent, args.transcriptLanguage)}
Answer the learner's actual question first. Keep ordinary replies under ${args.words} spoken words, but give more detail when requested. Correct only useful language mistakes, briefly and naturally. Do not repeat praise, scripted openings, or compulsory follow-up questions. Never say that you cannot speak. Do not mention JSON, APIs, prompts, or internal tools. Output plain spoken text only: no Markdown, bullets, headings, asterisks, emoji, or bracketed stage directions.`;
}

function apiError(code: string, error: string, status: number, traceId: string) {
  return Response.json(
    { code, error, stage: "gpt_response", retryable: status >= 500, traceId },
    { status, headers: { "Cache-Control": "no-store", "X-Rita-Trace": traceId } },
  );
}

export const Route = createFileRoute("/api/rita/respond")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const startedAt = performance.now();
        const traceId = crypto.randomUUID();
        const turnId = crypto.randomUUID();
        const auth = await requireRitaUser(request);
        if (!auth) return apiError("unauthorized", "Please sign in again.", 401, traceId);
        const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
        const transcript = String(body?.transcript ?? "")
          .trim()
          .slice(0, 2_000);
        if (!transcript)
          return apiError(
            "empty_transcript",
            "Deepgram returned no stable transcript.",
            422,
            traceId,
          );
        const settings = await getRitaSettings();
        const allowance = await getRitaAllowance(auth.userId, settings);
        if (!allowance.allowed)
          return apiError(
            "allowance_reached",
            "Rita Economic v2 usage limit was reached.",
            429,
            traceId,
          );
        const key = await resolveRitaOpenAiKey();
        if (!key)
          return apiError("openai_not_configured", "Rita needs an OpenAI key.", 503, traceId);
        const history = safeHistory(body?.history);
        const sessionSummary = String(body?.sessionSummary ?? "")
          .trim()
          .slice(0, 800);
        const personality = normalizePersonality(body?.personality);
        const accent = String(body?.accent ?? "").slice(0, 40);
        const transcriptLanguage = String(body?.transcriptLanguage ?? "").slice(0, 20);
        const inputAudioMs = Math.min(45_000, Math.max(0, Number(body?.inputAudioMs ?? 0)));
        const sessionId = String(body?.sessionId ?? "");
        const pipelineMode = body?.pipelineMode === "legacy" ? "legacy" : "economic_v2";
        const transcriptionSource = body?.transcriptionSource === "openai" ? "openai" : "deepgram";
        const prompt = systemPrompt({
          personality,
          accent,
          transcriptLanguage,
          words: settings.responseWords,
        });
        const upstreamAbort = new AbortController();
        request.signal.addEventListener("abort", () => upstreamAbort.abort(), { once: true });
        const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: RITA_MODELS.response,
            stream: true,
            stream_options: { include_usage: true },
            max_tokens: 240,
            messages: [
              { role: "system", content: prompt },
              ...(sessionSummary
                ? [{ role: "system" as const, content: `Earlier lesson memory: ${sessionSummary}` }]
                : []),
              ...history,
              { role: "user", content: transcript },
            ],
          }),
          signal: upstreamAbort.signal,
        });
        if (!upstream.ok || !upstream.body) {
          const detail = await upstream.text().catch(() => "");
          console.error("Rita Economic GPT failed", traceId, upstream.status, detail.slice(0, 240));
          return apiError(
            "gpt_unavailable",
            "GPT-4o mini could not answer this turn.",
            502,
            traceId,
          );
        }

        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        let cancelled = false;
        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            let buffer = "";
            let reply = "";
            let inputTokens = 0;
            let outputTokens = 0;
            let segmentIndex = 0;
            const chunker = new RitaClauseChunker();
            const reader = upstream.body!.getReader();
            controller.enqueue(encoder.encode(sse("turn.started", { turnId, traceId })));
            const emitSpeechSegments = async (segments: string[]) => {
              for (const text of segments) {
                if (!text || segmentIndex >= 3) continue;
                const index = segmentIndex++;
                const ticket = await createRitaSpeechTicket({
                  userId: auth.userId,
                  turnId,
                  index,
                  text,
                });
                controller.enqueue(
                  encoder.encode(
                    sse("speech.segment", {
                      turnId,
                      index,
                      text,
                      ticket,
                      language: transcriptLanguage || "unknown",
                      dialect: accent || "standard",
                      emotion: "warm",
                    }),
                  ),
                );
              }
            };
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() ?? "";
                for (const line of lines) {
                  if (!line.startsWith("data:")) continue;
                  const data = line.slice(5).trim();
                  if (!data || data === "[DONE]") continue;
                  let chunk: any;
                  try {
                    chunk = JSON.parse(data);
                  } catch {
                    continue;
                  }
                  const delta = String(chunk?.choices?.[0]?.delta?.content ?? "");
                  if (delta) {
                    reply += delta;
                    controller.enqueue(encoder.encode(sse("reply.delta", { text: delta })));
                    await emitSpeechSegments(chunker.push(delta));
                  }
                  if (chunk?.usage) {
                    inputTokens = Number(chunk.usage.prompt_tokens ?? 0);
                    outputTokens = Number(chunk.usage.completion_tokens ?? 0);
                  }
                }
              }
              reply = reply.trim();
              if (!reply) throw new Error("GPT returned an empty reply");
              await emitSpeechSegments(chunker.flush());
              reply = cleanRitaSpokenText(reply);
              const outputAudioMs = estimateSpeechDurationMs(reply);
              const estimatedCostMicros = estimateTurnCostMicros({
                inputAudioMs,
                outputAudioMs,
                inputTokens,
                outputTokens,
              });
              let usageSaved = false;
              try {
                const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
                const validSessionId = /^[0-9a-f-]{36}$/i.test(sessionId) ? sessionId : null;
                const { error } = await (supabaseAdmin.from as any)("rita_voice_usage").insert({
                  user_id: auth.userId,
                  session_id: validSessionId,
                  turn_id: turnId,
                  input_audio_ms: inputAudioMs,
                  output_audio_ms: outputAudioMs,
                  input_tokens: inputTokens,
                  output_tokens: outputTokens,
                  estimated_cost_micros: estimatedCostMicros,
                  provider:
                    pipelineMode === "legacy" || transcriptionSource === "openai"
                      ? "openai"
                      : "deepgram+openai",
                  transcription_model:
                    transcriptionSource === "openai" ? "gpt-4o-mini-transcribe" : "deepgram-nova-3",
                  response_model: RITA_MODELS.response,
                  speech_model: RITA_MODELS.speech,
                  language: transcriptLanguage || null,
                  dialect: accent || null,
                  reply_sha256: await sha256(reply),
                  premium_voice: true,
                  status: "completed",
                });
                if (error) throw error;
                usageSaved = true;
              } catch (error) {
                console.error("Rita Economic usage write failed", traceId, error);
              }
              if (!usageSaved)
                throw new Error("Rita could not securely authorize speech for this reply");
              controller.enqueue(
                encoder.encode(
                  sse("reply.done", {
                    turnId,
                    traceId,
                    reply,
                    detectedLanguage: transcriptLanguage || "unknown",
                    detectedDialect: accent || "standard",
                    emotion: "warm",
                    totalMs: Math.round(performance.now() - startedAt),
                  }),
                ),
              );
            } catch (error) {
              if (!cancelled)
                controller.enqueue(
                  encoder.encode(
                    sse("turn.error", {
                      code: "gpt_stream_failed",
                      stage: "gpt_response",
                      error: error instanceof Error ? error.message : "GPT stream failed.",
                      traceId,
                    }),
                  ),
                );
            } finally {
              reader.releaseLock();
              if (!cancelled) controller.close();
            }
          },
          cancel() {
            cancelled = true;
            upstreamAbort.abort();
          },
        });
        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-store, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
            "X-Rita-Trace": traceId,
          },
        });
      },
    },
  },
});
