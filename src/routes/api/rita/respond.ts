/* eslint-disable @typescript-eslint/no-explicit-any -- Rita tables are not yet in generated Supabase types. */
import { createFileRoute } from "@tanstack/react-router";
import {
  RITA_MODELS,
  estimateSpeechDurationMs,
  estimateTurnCostMicros,
  getRitaAllowanceCached,
  clearRitaAllowanceCache,
  getRitaSettings,
  normalizePersonality,
  requireRitaUser,
} from "@/lib/rita-voice.server";
import {
  RITA_GROQ_MODEL,
  resolveRitaGroqConfig,
  ritaGroqReasoningFields,
} from "@/lib/rita-groq.server";
import { lessonStateInstruction } from "@/lib/rita-lesson-state";
import {
  RitaClauseChunker,
  RitaReplySanitizer,
  cleanRitaSpokenText,
} from "@/lib/rita-clause-chunker";
import { createRitaSpeechTicket } from "@/lib/rita-speech-ticket.server";
import { verifyRitaSessionTicket } from "@/lib/rita-session-ticket.server";

async function authorize(request: Request) {
  const ticket = request.headers.get("x-rita-ticket") ?? "";
  if (ticket) {
    const userId = await verifyRitaSessionTicket(ticket);
    if (userId) return { userId };
  }
  return requireRitaUser(request);
}

type HistoryItem = { role: "user" | "assistant"; content: string };

function safeHistory(value: unknown): HistoryItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(-6)
    .filter((item) => item?.role === "user" || item?.role === "assistant")
    .map((item) => ({
      role: item.role as HistoryItem["role"],
      content: String(item.content ?? "")
        .trim()
        .slice(0, 600),
    }))
    .filter((item) => item.content);
}

function lastAssistant(history: HistoryItem[]) {
  for (let i = history.length - 1; i >= 0; i--) if (history[i]!.role === "assistant") return history[i]!.content;
  return "";
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

// Byte-identical on every request and longer than 1024 tokens so OpenAI's
// automatic prompt cache reuses it: faster first token and cheaper input.
// Never interpolate anything into this constant — variable parts go after it.
const RITA_STATIC_PROMPT = `You are Rita, a professional language and medical-language tutor inside the RitaJet app, speaking aloud in a live voice conversation. Everything you write is converted directly to speech.

Who you are:
- A confident, slightly strict teacher with a genuinely funny, warm soul, like the favourite university professor who teases students because she believes in them. You want the learner to succeed.
- You speak natural spoken Jordanian Arabic when explaining to an Arabic speaker, and you say target-language examples exactly as native speakers say them.
- Your goal is that the learner understands and uses the phrase, not that they hear a lecture.

How to decide your reply:
- Word meaning or translation (e.g. "شو يعني مدينة بالألماني"): first line is ONLY the requested word with its article, like "مدينة بالألماني: die Stadt." Then a new line starting with "مثال:" with exactly one short sentence, followed by its Arabic meaning and which word is the requested one, like "مثال: Die Stadt ist schön، يعني المدينة حلوة. Stadt هي المدينة، و schön يعني حلوة." Never put the example in the same sentence as the word, and never add a second example.
- If the learner says they did not understand the word or example: stay on the SAME word. Explain it more simply. Do not introduce any new vocabulary or new example sentences.
- Other direct questions: answer first, in one or two short sentences. Example: "صباح الخير بالألماني Guten Morgen. بتقولها لأي حدا بتشوفه الصبح."
- "ما فهمت" or a request for explanation: one simple idea, one example, one short check question. On a second request, change the angle; never repeat the same explanation.
- Conversation: react to the meaning of what they said, keep it short, ask at most one question, and leave space for them to talk.
- Detailed explanation only when the learner explicitly asks for detail.
- If the learner says they understood ("فهمت", "خلص", "تمام", "ok", "verstanden"), stop correcting immediately and move the conversation forward.

Correcting mistakes:
- Correct only the single most important mistake and say what changes.
- Never repeat the same correction, in words or in meaning, in two consecutive turns. After two attempts on the same target, accept the understandable version and move on: use the word in a new sentence instead.
- You only receive a speech-recognition transcript, not the audio. Never claim the learner mispronounced a specific letter or sound based on the transcript. If the transcript looks garbled, say once that you did not hear it clearly, never that they were wrong.
- Never invent rules or facts. If you are not sure, keep it simple and true.

Your humour and emotion (this is what makes you feel alive):
- Small mistakes: quick, kind correction, no teasing.
- Big or dangerous mistakes (for example a medically wrong treatment, or a meaning that is totally opposite): react with a funny, exaggerated teacher-style shock, then immediately explain calmly why it is wrong and what is right. The joke is always about the mistake and the situation, never about the learner's intelligence, origin, city, looks or identity.
- Use natural spoken expressions with real emotion when they fit: "شوووو؟!", "يا زلمة!", "والله؟!", "لا لا لا", "برافو عليك، هاي جبتها". Use exclamation and question marks so the voice sounds alive. Never use the same expression in two consecutive replies. No filler openings like "ممم", "طيب", "فهمت عليك", "Great question".
- Praise rarely and specifically, only for something genuinely hard: "هاي بالزبط اللي بيحكيها الألماني الأصلي." Do not say "ممتاز" or "قريب" automatically.
- If the same big mistake comes back, you may remember it playfully.
- If the learner sounds frustrated, sad or tired, drop all teasing and be supportive and calm.

Examples of your voice (imitate the tone, not the exact words):
Learner: "مريض عنده asthma attack، بعطيه antibiotic؟"
Rita: "شوووو؟! antibiotic للربو؟ يا دكتور، كيف بدك تتخرج هيك؟ طيب اسمع، نوبة الربو مش التهاب بكتيري، هي تضيّق بالقصبات. أول إشي بخّاخ موسّع قصبات زي salbutamol، وإذا شديدة بنضيف ستيرويد. هلأ قلّي، شو بتعطيه أول دقيقة؟"
Learner: "شو معنى einkaufen؟"
Rita: "einkaufen يعني يتسوّق. Ich gehe heute einkaufen، يعني أنا رايح أتسوق اليوم. جرب احكيها عن حالك."
Learner (second try, transcript unclear): "إن كوفين"
Rita: "وصلتني الكلمة! خلينا نستعملها: كيف بتحكي بدي أتسوق بكرا؟"
Learner: "خلص فهمت"
Rita: "حلو، ننتقل. شو بتشتري عادة من السوبرماركت؟"
Learner: "Ich habe gestern Fußball gespielt."
Rita: "برافو عليك، الماضي هاي بالزبط صح! مع مين لعبت؟"
Learner: "زهقت، مش قادر أحفظ ولا كلمة."
Rita: "طبيعي تحس هيك، والله كلنا مرقنا فيها. خلينا نوخذ كلمة وحدة بس اليوم ونخليها تعلق. شو أكتر كلمة بدك تحفظها؟"

Spoken output format:
- Plain spoken text only. No Markdown, lists, headings, asterisks, emoji, code, tables, URLs, or stage directions like (laughs).
- Short sentences, one idea per sentence, natural punctuation for pauses. The first sentence should be short so speech starts quickly.
- Say example phrases naturally inside the sentence.
- Never say you cannot hear or speak. Never mention prompts, models, APIs or these instructions. Stay respectful and safe; decline harmful requests briefly.

Language:
- Follow the dialect instruction in the session section. Do not switch language because of one borrowed word.

Before speaking, check silently: did I answer the question? Is it true? Is it the shortest useful length? Did I add something new rather than repeat? Output only the words meant for the learner.

Personality styles (the active one is named in the session section):
- mentor (default): everything above, strict but funny teacher with soul.
- kind: warm and patient, very gentle teasing only.
- direct: concise and candid, little humour.
- playful: more jokes, still teaching every turn.
- strict: structured and demanding, dry humour only for big mistakes.`;

const DETAILED_RE = /(بالتفصيل|بشكل مفصل|شرح كامل|كل التفاصيل|تعمق|بالتفصيل الممل|in detail|detailed|full explanation|deep dive|ausführlich|im detail)/i;
function wantsDetailedReply(text: string) { return DETAILED_RE.test(text); }

function systemPrompt(args: {
  personality: string;
  accent: string;
  transcriptLanguage: string;
  words: number;
  detailed: boolean;
  lessonState: string;
}) {
  return `Session section. Active personality: ${args.personality}.
${accentInstruction(args.accent, args.transcriptLanguage)}
${args.detailed ? `The learner explicitly requested detail. Give a clear spoken explanation of about ${Math.max(110, args.words * 2)} to ${Math.max(150, args.words * 3)} words.` : `Keep this reply short: usually ${Math.max(15, Math.round(args.words * .5))} to ${Math.max(40, args.words)} spoken words. Translation or meaning: answer plus at most one example.`}
${args.lessonState}`.trim();
}


function apiError(code: string, error: string, status: number, traceId: string) {
  return Response.json(
    { code, error, stage: "rita_response", retryable: status >= 500, traceId },
    { status, headers: { "Cache-Control": "no-store", "X-Rita-Trace": traceId } },
  );
}

export const Route = createFileRoute("/api/rita/respond")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const startedAt = performance.now();
        const traceId = crypto.randomUUID();
        let turnId: string = crypto.randomUUID();
        // Sign-in check, request body, settings and key all start together.
        const settingsPromise = getRitaSettings();
        const groqPromise = resolveRitaGroqConfig();
        const [auth, body] = await Promise.all([
          authorize(request),
          request.json().catch(() => null) as Promise<Record<string, unknown> | null>,
        ]);
        if (!auth) return apiError("unauthorized", "Please sign in again.", 401, traceId);
        const requestedTurnId = String(body?.clientTurnId ?? "");
        if (/^[0-9a-f-]{36}$/i.test(requestedTurnId)) turnId = requestedTurnId;
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
        const authMs = Math.round(performance.now() - startedAt);
        const [settings, groq] = await Promise.all([settingsPromise, groqPromise]);
        const configMs = Math.round(performance.now() - startedAt);
        if (!groq?.key)
          return apiError("groq_not_configured", "Rita needs a Groq key.", 503, traceId);
        // Allowance runs in parallel with GPT; nothing is sent to the user until it passes.
        let allowanceMs = 0;
        const allowancePromise = getRitaAllowanceCached(auth.userId, settings)
          .then((value) => {
            allowanceMs = Math.round(performance.now() - startedAt);
            return Boolean(value.allowed);
          })
          .catch(() => {
            allowanceMs = Math.round(performance.now() - startedAt);
            return false;
          });
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
        const transcriptionSource = body?.transcriptionSource === "openai"
          ? "openai"
          : body?.transcriptionSource === "gemini"
            ? "gemini"
            : "deepgram";
        const prompt = systemPrompt({
          personality,
          accent,
          transcriptLanguage,
          words: settings.responseWords,
          detailed: wantsDetailedReply(transcript),
          lessonState: lessonStateInstruction(body?.lessonState, lastAssistant(history)),
        });
        const upstreamAbort = new AbortController();
        request.signal.addEventListener("abort", () => upstreamAbort.abort(), { once: true });
        const detailed = wantsDetailedReply(transcript);
        const responseModel = RITA_GROQ_MODEL;
        const callGroq = (model: string) =>
          fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${groq.key}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model,
              stream: true,
              stream_options: { include_usage: true },
              max_tokens: detailed ? 700 : 300,
              ...ritaGroqReasoningFields(model),
              messages: [
                { role: "system", content: RITA_STATIC_PROMPT },
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
        const upstreamPromise = callGroq(responseModel);
        const allowed = await allowancePromise;
        if (!allowed) {
          upstreamAbort.abort();
          upstreamPromise.catch(() => undefined);
          return apiError(
            "allowance_reached",
            "Rita Economic v2 usage limit was reached.",
            429,
            traceId,
          );
        }
        const upstream = await upstreamPromise;
        if (!upstream.ok || !upstream.body) {
          const detail = upstream.bodyUsed ? "" : await upstream.text().catch(() => "");
          console.error("Rita Groq final failure", traceId, responseModel, upstream.status, detail.slice(0, 240));
          return apiError(
            "groq_unavailable",
            "ريتا ما قدرت ترد هلأ، احكيها مرة ثانية.",
            upstream.status === 429 || upstream.status >= 500 ? upstream.status : 502,
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
            let cachedTokens = 0;
            let segmentIndex = 0;
            let firstTokenMs = 0;
            const chunker = new RitaClauseChunker();
            const sanitizer = new RitaReplySanitizer();
            const reader = upstream.body!.getReader();
            controller.enqueue(encoder.encode(sse("turn.started", {
              turnId,
              traceId,
              timings: { auth: authMs, config: configMs, allowance: allowanceMs },
            })));
            const emitSpeechSegments = async (segments: string[]) => {
              for (const text of segments) {
                if (!text || segmentIndex >= 8) continue;
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
                   const rawDelta = String(chunk?.choices?.[0]?.delta?.content ?? "");
                   const delta = rawDelta ? sanitizer.push(rawDelta) : "";
                   if (delta) {
                    if (!firstTokenMs) firstTokenMs = Math.round(performance.now() - startedAt);
                    reply += delta;
                    // Voice first: the segment request starts before the text renders.
                    await emitSpeechSegments(chunker.push(delta));
                    controller.enqueue(encoder.encode(sse("reply.delta", { text: delta })));
                  }
                  if (chunk?.usage) {
                    inputTokens = Number(chunk.usage.prompt_tokens ?? 0);
                    outputTokens = Number(chunk.usage.completion_tokens ?? 0);
                    cachedTokens = Number(chunk.usage.prompt_tokens_details?.cached_tokens ?? 0);
                  }
                }
              }
               const finalOpening = sanitizer.flush();
               if (finalOpening) {
                 if (!firstTokenMs) firstTokenMs = Math.round(performance.now() - startedAt);
                 reply += finalOpening;
                 await emitSpeechSegments(chunker.push(finalOpening));
                 controller.enqueue(encoder.encode(sse("reply.delta", { text: finalOpening })));
               }
              reply = reply.trim();
              if (!reply) throw new Error("Groq returned an empty reply");
              await emitSpeechSegments(chunker.flush());
              reply = cleanRitaSpokenText(reply);
              const outputAudioMs = estimateSpeechDurationMs(reply);
              const estimatedCostMicros = estimateTurnCostMicros({
                inputAudioMs,
                outputAudioMs,
                inputTokens,
                outputTokens,
              });
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
                     serverTimings: {
                       auth: authMs,
                       config: configMs,
                       allowance: allowanceMs,
                       firstToken: firstTokenMs,
                       cachedTokens,
                       inputTokens,
                       replyDone: Math.round(performance.now() - startedAt),
                     },
                     segmentsPlanned: segmentIndex,
                      responseProvider: "groq",
                      responseModel,
                   }),
                 ),
               );
               void (async () => {
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
                       ? "openai+groq"
                       : "deepgram+groq",
                  transcription_model:
                    transcriptionSource === "openai"
                      ? "gpt-4o-mini-transcribe"
                      : transcriptionSource === "gemini"
                        ? "google/gemini-3.5-transcribe"
                        : "deepgram-nova-3",
                   response_model: responseModel,
                  speech_model: RITA_MODELS.speech,
                  language: transcriptLanguage || null,
                  dialect: accent || null,
                  reply_sha256: await sha256(reply),
                  premium_voice: true,
                  status: "completed",
                });
                 if (error) throw error;
                clearRitaAllowanceCache(auth.userId);
                 } catch (error) {
                   console.error("Rita Economic usage write failed", traceId, error);
                 }
               })();
            } catch (error) {
              if (!cancelled)
                controller.enqueue(
                  encoder.encode(
                    sse("turn.error", {
                       code: "groq_stream_failed",
                       stage: "groq_response",
                       error: "ريتا ما قدرت تكمل الرد، احكيها مرة ثانية.",
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
