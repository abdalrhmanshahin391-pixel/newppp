// Archive Solver — server-side worker.
//
// The browser only uploads plain page text. Everything below runs on the
// server (from a cron hook), so a job keeps going after the student closes
// the site.
//
// Per chunk:
//   1. Ask Gemini for the *bookends* of each question (first/last 5 words),
//      or the verbatim block for very short items.
//   2. Slice each question out locally with `sliceByBookends` — the consumed
//      range is deleted from the working text, so nothing is matched twice.
//   3. Fall back to local numbered-question slicing for anything missed.
//   4. Solve each question block on its own, strict JSON out.

import { sliceByBookends, sliceByNumbers } from "@/lib/bookend-slicer";

const MODEL_CHAIN = ["gemini-3.1-flash-lite", "gemini-2.5-flash-lite", "gemini-2.5-flash"];

const BOOKEND_SYSTEM = `You locate exam questions inside raw PDF text.

The user gives you a chunk of text containing ONE OR MORE questions. A "question" includes the stem AND everything belonging to it (MCQ options, True/False, a single answer line) up until the next question starts.

Rules:
- Option labels may be "A." "A)" "a-" "•" or plain lines. Any style counts.
- A question may have only ONE line after the stem ("Answer: True"). It still counts.
- Any new number ("12." "12)") starts a new question.
- Return [] only if the chunk is purely a cover page / table of contents.

For each question return ONE object:
- If the whole block is MORE than 15 words:
  { "first_words": "<first 5 words of the stem, verbatim>", "last_words": "<last 5 words of the LAST line of this question, verbatim>" }
- If it is 15 words or fewer:
  { "exact_text": "<the entire block, verbatim>" }

Return STRICT JSON: a single array, reading order, nothing else.`;

const SOLVER_SYSTEM = `You are a medical/scientific exam tutor. The user gives you ONE question block (stem + options, or an open question).

Return STRICT JSON only:
{
  "stem": "the question stem, plain text",
  "options": [{"letter":"A","body":"...","is_correct":true,"why":"one sentence saying why this option is right or wrong"}],
  "concept": "<=8 words naming the core concept tested",
  "explanation": "Markdown with THREE sections separated by blank lines:\\n\\n**Concept**\\n2-3 sentences on the underlying mechanism.\\n\\n**Why the correct answer is right**\\n- 2-3 short bullets.\\n\\n**Why the other options are wrong**\\n- **A.** one sentence\\n- **B.** one sentence\\n- **C.** one sentence",
  "summary_table": "A markdown table. Header: | Option | Verdict | One-line reason |. Then |---|---|---|. Then ONE line per option, each on its own line, with the correct row marked ✓ and the others ✗.",
  "difficulty": "easy" | "medium" | "hard"
}

Rules:
- Output EXACTLY 4 options A, B, C, D, exactly one with is_correct true. If the source only gives the correct answer, invent 3 plausible wrong distractors.
- Copy source options verbatim when present, in source order.
- Output JSON only, no markdown fences.`;

function stripFences(text: string): string {
  return String(text || "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

function parseArray(text: string): any[] {
  const s = stripFences(text);
  try {
    const p = JSON.parse(s);
    if (Array.isArray(p)) return p;
    if (Array.isArray(p?.questions)) return p.questions;
    if (Array.isArray(p?.items)) return p.items;
  } catch {
    /* fall through */
  }
  const lb = s.indexOf("[");
  const rb = s.lastIndexOf("]");
  if (lb !== -1 && rb > lb) {
    try {
      const p = JSON.parse(s.slice(lb, rb + 1));
      if (Array.isArray(p)) return p;
    } catch {
      /* ignore */
    }
  }
  return [];
}

function parseObject(text: string): any | null {
  const s = stripFences(text);
  try {
    return JSON.parse(s);
  } catch {
    /* fall through */
  }
  const lb = s.indexOf("{");
  const rb = s.lastIndexOf("}");
  if (lb !== -1 && rb > lb) {
    try {
      return JSON.parse(s.slice(lb, rb + 1));
    } catch {
      /* ignore */
    }
  }
  return null;
}

export class BlockedError extends Error {}
export class RateLimitedError extends Error {}

async function geminiText(apiKey: string, system: string, user: string): Promise<string> {
  let lastError = "";
  for (const model of MODEL_CHAIN) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2,
            maxOutputTokens: 8192,
          },
        }),
      },
    );
    if (res.status === 429) throw new RateLimitedError("Rita is rate limited right now.");
    if (res.status === 401 || res.status === 403 || res.status === 402) {
      throw new BlockedError("Rita's question engine needs attention from the site owner.");
    }
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      lastError = JSON.stringify(json).slice(0, 300);
      if (/not found|not supported|unavailable/i.test(lastError)) continue;
      throw new Error(`Gemini error (${res.status}): ${lastError}`);
    }
    const text = json?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? "").join("") ?? "";
    if (text) return text;
    lastError = "empty reply";
  }
  throw new Error(lastError || "No usable Gemini model.");
}

function normalizeBookends(rows: any[]) {
  const out: any[] = [];
  for (const row of rows) {
    const exact = String(row?.exact_text ?? row?.exact ?? "").trim();
    const first = String(row?.first_words ?? row?.first_5 ?? "").trim();
    const last = String(row?.last_words ?? row?.last_5 ?? "").trim();
    if (exact.length >= 5) out.push({ exact_text: exact });
    else if (first && last) out.push({ first_words: first, last_words: last });
  }
  return out;
}

function normalizeSolved(raw: any, fallbackStem: string) {
  const letters = ["A", "B", "C", "D"];
  const optionsRaw = Array.isArray(raw?.options) ? raw.options.slice(0, 6) : [];
  const options = optionsRaw.map((o: any, i: number) => ({
    letter: String(o?.letter ?? letters[i] ?? String(i + 1)).trim().slice(0, 2).toUpperCase(),
    body: String(o?.body ?? o?.text ?? "").trim(),
    is_correct: !!o?.is_correct,
    why: String(o?.why ?? o?.reason ?? "").trim(),
  })).filter((o: any) => o.body);
  if (!options.some((o: any) => o.is_correct) && options.length) options[0].is_correct = true;
  const stem = String(raw?.stem ?? raw?.prompt ?? "").trim() || fallbackStem.slice(0, 400);
  if (!stem || options.length < 2) return null;
  const diff = String(raw?.difficulty ?? "medium").toLowerCase();
  const concept = String(raw?.concept ?? "").trim().slice(0, 120);
  let explanation = String(raw?.explanation ?? "").trim();
  // Never save a bare answer: rebuild the full teaching text from the per-option
  // reasons when the model skipped a section.
  const right = options.find((o: any) => o.is_correct);
  const wrong = options.filter((o: any) => !o.is_correct);
  const hasWhyRight = /why the correct/i.test(explanation);
  const hasWhyWrong = /why the other|wrong/i.test(explanation);
  if (!explanation || !hasWhyRight || !hasWhyWrong) {
    const parts: string[] = [];
    if (explanation) parts.push(explanation);
    else if (concept) parts.push(`**Concept**\n${concept}`);
    if (!hasWhyRight && right)
      parts.push(`**Why the correct answer is right**\n- **${right.letter}.** ${right.why || right.body}`);
    if (!hasWhyWrong && wrong.length)
      parts.push(
        `**Why the other options are wrong**\n` +
          wrong.map((o: any) => `- **${o.letter}.** ${o.why || "Does not fit the concept tested."}`).join("\n"),
      );
    explanation = parts.join("\n\n").trim();
  }
  let summary_table = String(raw?.summary_table ?? "").trim();
  if (!summary_table && options.length) {
    summary_table = [
      "| Option | Verdict | One-line reason |",
      "|---|---|---|",
      ...options.map(
        (o: any) => `| ${o.letter} | ${o.is_correct ? "✓" : "✗"} | ${(o.why || o.body).replace(/\|/g, "/")} |`,
      ),
    ].join("\n");
  }
  return {
    stem,
    options,
    concept,
    explanation,
    summary_table,
    difficulty: ["easy", "medium", "hard"].includes(diff) ? diff : "medium",
  };
}

type Admin = any;

async function nextPosition(admin: Admin, userId: string, subject: string, subtopic: string) {
  const { data } = await admin
    .from("study_questions")
    .select("position")
    .eq("user_id", userId)
    .eq("subject", subject)
    .eq("subtopic", subtopic)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  return Number(data?.position ?? 0) + 1;
}

/**
 * Processes a bounded amount of work: at most one job, at most `maxChunks`
 * chunks. Safe to call every minute — a lease keeps two runs apart.
 */
export async function runArchiveWorker(maxChunks = 2): Promise<{ handled: number; jobId?: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/legacy-client.server");
  const admin = supabaseAdmin as Admin;
  const now = new Date();

  const { data: jobs } = await admin
    .from("archive_jobs")
    .select("*")
    .in("status", ["queued", "running"])
    .or(`lease_until.is.null,lease_until.lt.${now.toISOString()}`)
    .order("created_at", { ascending: true })
    .limit(1);

  const job = (jobs ?? [])[0];
  if (!job) return { handled: 0 };

  // Single-flight lease.
  const lease = new Date(now.getTime() + 5 * 60_000).toISOString();
  const { data: claimed } = await admin
    .from("archive_jobs")
    .update({ status: "running", lease_until: lease })
    .eq("id", job.id)
    .or(`lease_until.is.null,lease_until.lt.${now.toISOString()}`)
    .select("id")
    .maybeSingle();
  if (!claimed) return { handled: 0 };

  const { data: chunks } = await admin
    .from("archive_chunks")
    .select("*")
    .eq("job_id", job.id)
    .eq("status", "pending")
    .order("chunk_index", { ascending: true })
    .limit(maxChunks);

  const pending = chunks ?? [];
  if (pending.length === 0) {
    await admin
      .from("archive_jobs")
      .update({ status: "done", lease_until: null })
      .eq("id", job.id);
    return { handled: 0, jobId: job.id };
  }

  const { resolveGeminiKey } = await import("@/lib/ai-keys.server");
  let apiKey: string;
  try {
    ({ key: apiKey } = await resolveGeminiKey(admin, "archive"));
  } catch (e) {
    await admin
      .from("archive_jobs")
      .update({ status: "paused", lease_until: null, error: (e as Error).message })
      .eq("id", job.id);
    return { handled: 0, jobId: job.id };
  }

  let handled = 0;
  let found = 0;
  let solved = 0;

  for (const chunk of pending) {
    try {
      await admin
        .from("archive_chunks")
        .update({ status: "working", attempts: Number(chunk.attempts ?? 0) + 1 })
        .eq("id", chunk.id);

      const text = String(chunk.chunk_text ?? "");
      let slices: { text: string }[] = [];
      if (text.trim().length > 40) {
        const rows = parseArray(await geminiText(apiKey, BOOKEND_SYSTEM, text));
        slices = sliceByBookends(text, normalizeBookends(rows));
        if (slices.length === 0) slices = sliceByNumbers(text);
      }
      found += slices.length;

      let position = await nextPosition(admin, job.user_id, job.subject, job.subtopic);
      const inserts: any[] = [];
      for (const slice of slices.slice(0, 60)) {
        try {
          const raw = parseObject(await geminiText(apiKey, SOLVER_SYSTEM, slice.text));
          const q = normalizeSolved(raw, slice.text);
          if (!q) continue;
          inserts.push({
            user_id: job.user_id,
            subject: job.subject,
            subtopic: job.subtopic,
            position: position++,
            source_job_id: job.id,
            ...q,
          });
        } catch (e) {
          if (e instanceof BlockedError || e instanceof RateLimitedError) throw e;
          // A single unsolvable question never stops the paper.
        }
      }
      if (inserts.length) await admin.from("study_questions").insert(inserts);
      solved += inserts.length;

      await admin
        .from("archive_chunks")
        .update({ status: "done", error: null, question_blocks: slices.map((s) => s.text) })
        .eq("id", chunk.id);
      handled++;
    } catch (e) {
      const blocked = e instanceof BlockedError;
      const limited = e instanceof RateLimitedError;
      await admin
        .from("archive_chunks")
        .update({
          status: blocked || limited ? "pending" : "failed",
          error: (e as Error).message.slice(0, 400),
        })
        .eq("id", chunk.id);
      if (blocked) {
        await admin
          .from("archive_jobs")
          .update({ status: "paused", lease_until: null, error: (e as Error).message })
          .eq("id", job.id);
        return { handled, jobId: job.id };
      }
      if (limited) break; // back off; the next scheduled run retries
    }
  }

  if (solved > 0) {
    try {
      const { bumpQuota } = await import("@/lib/quota.server");
      await bumpQuota(job.user_id, "archive_questions", solved);
    } catch {
      /* quota accounting must never fail a job */
    }
  }

  const { count: leftover } = await admin
    .from("archive_chunks")
    .select("id", { count: "exact", head: true })
    .eq("job_id", job.id)
    .eq("status", "pending");

  // Stop the moment the student's allowance is gone, instead of solving a
  // 1000-question file for free.
  let outOfAllowance = false;
  if ((leftover ?? 0) > 0) {
    try {
      const { remainingQuota } = await import("@/lib/quota.server");
      const left = await remainingQuota(job.user_id, "archive_questions");
      outOfAllowance = left !== null && left <= 0;
    } catch {
      outOfAllowance = false;
    }
  }

  if (outOfAllowance) {
    await admin
      .from("archive_chunks")
      .update({ status: "skipped" })
      .eq("job_id", job.id)
      .eq("status", "pending");
  }

  await admin
    .from("archive_jobs")
    .update({
      status: (leftover ?? 0) > 0 && !outOfAllowance ? "running" : "done",
      lease_until: null,
      error: outOfAllowance
        ? "Stopped: your plan's Archive question allowance ran out. Upgrade to solve the rest."
        : job.error ?? null,
      chunks_done: Number(job.chunks_done ?? 0) + handled,
      questions_found: Number(job.questions_found ?? 0) + found,
      questions_solved: Number(job.questions_solved ?? 0) + solved,
    })
    .eq("id", job.id);

  return { handled, jobId: job.id };
}
