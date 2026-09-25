// Rita AI Model 3.8 — server-side worker.
//
// Everything after the upload happens here, on a schedule, so a run keeps
// going after the student closes the page: borders -> cut -> batch -> import.
// Bounded work per tick, single-flight lease per job, idempotent per chunk.

import {
  RITA_MODEL,
  BORDERS_SYSTEM,
  SOLVER_SYSTEM,
  resolveRitaKey,
  ritaKeyError,
  extractJsonArray,
  extractJsonObject,
  normalizeBookends,
  fetchBatch,
  getBatchState,
  mapBatchStatus,
  downloadResponses,
  responseText,
} from "@/lib/rita-ai-38.server";
import { sliceByBookends, sliceByNumbers } from "@/lib/bookend-slicer";

const JOBS = "rita_ai_jobs";
const CHUNKS = "rita_ai_chunks";

type Admin = any;

export type RitaLogEntry = { at: string; text: string; tech?: boolean };

export async function appendLog(admin: Admin, jobId: string, entries: RitaLogEntry[]) {
  if (!entries.length) return;
  const { data } = await admin.from(JOBS).select("log").eq("id", jobId).maybeSingle();
  const prev: RitaLogEntry[] = Array.isArray(data?.log) ? data.log : [];
  const next = [...prev, ...entries].slice(-200);
  await admin.from(JOBS).update({ log: next, updated_at: new Date().toISOString() }).eq("id", jobId);
}

function now() {
  return new Date().toISOString();
}

/** Borders + local cut + one 50% batch for a single chunk. */
async function submitChunk(admin: Admin, apiKey: string, chunk: any, log: RitaLogEntry[]) {
  const label = chunk.page_from ? `Pages ${chunk.page_from}–${chunk.page_to}` : "Your text";
  const text = String(chunk.chunk_text ?? "").trim();
  if (text.length < 40) {
    await admin.from(CHUNKS).update({ status: "empty" }).eq("id", chunk.id);
    log.push({ at: now(), text: `${label}: nothing readable here.`, tech: true });
    return;
  }

  await admin.from(CHUNKS).update({ status: "borders", error: null }).eq("id", chunk.id);

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${RITA_MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: BORDERS_SYSTEM }] },
        contents: [{ role: "user", parts: [{ text: `--- TEXT ---\n${text}\n--- END ---` }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 32768, responseMimeType: "application/json" },
      }),
    },
  );
  const raw = await res.text();
  if (!res.ok) {
    const msg = ritaKeyError(res.status, raw);
    await admin.from(CHUNKS).update({ status: "failed", error: msg }).eq("id", chunk.id);
    log.push({ at: now(), text: `${label}: border pass failed — ${msg}`, tech: true });
    return;
  }
  let borderText = "";
  try {
    borderText = JSON.parse(raw)?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  } catch {
    /* ignore */
  }
  const bookends = normalizeBookends(extractJsonArray(borderText) ?? []);

  let blocks = sliceByBookends(text, bookends).map((s) => s.text);
  if (blocks.length === 0) blocks = sliceByNumbers(text).map((s) => s.text);
  blocks = blocks.map((b) => b.trim()).filter((b) => b.length > 15).slice(0, 120);

  if (blocks.length === 0) {
    await admin.from(CHUNKS).update({ status: "empty", question_blocks: [], results: { found_count: 0 } })
      .eq("id", chunk.id);
    log.push({ at: now(), text: `${label}: no questions found — skipped.`, tech: true });
    return;
  }

  const requests = blocks.map((qb, i) => ({
    request: {
      systemInstruction: { parts: [{ text: SOLVER_SYSTEM }] },
      contents: [{
        role: "user",
        parts: [{ text: `Solve this question and return JSON per the system prompt.\n\n--- QUESTION ---\n${qb}\n--- END ---` }],
      }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 8192, responseMimeType: "application/json" },
    },
    metadata: { key: `q-${i}` },
  }));

  const bres = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${RITA_MODEL}:batchGenerateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        batch: {
          display_name: `rita38-${String(chunk.id).slice(0, 8)}-${Date.now()}`,
          input_config: { requests: { requests } },
        },
      }),
    },
  );
  const braw = await bres.text();
  if (!bres.ok) {
    const msg = ritaKeyError(bres.status, braw);
    await admin.from(CHUNKS).update({ status: "failed", error: msg, question_blocks: blocks }).eq("id", chunk.id);
    log.push({ at: now(), text: `${label}: batch submit failed — ${msg}`, tech: true });
    return;
  }
  let bjson: any = {};
  try { bjson = JSON.parse(braw); } catch { /* ignore */ }
  const batchName: string | undefined = bjson?.name || bjson?.metadata?.name;
  if (!batchName) {
    await admin.from(CHUNKS).update({ status: "failed", error: "No batch name returned." }).eq("id", chunk.id);
    log.push({ at: now(), text: `${label}: Gemini returned no batch name.`, tech: true });
    return;
  }

  await admin.from(CHUNKS).update({
    status: "awaiting_batch",
    question_blocks: blocks,
    batch_id: batchName,
    results: { found_count: blocks.length },
    error: null,
  }).eq("id", chunk.id);

  log.push({ at: now(), text: `${label}: cut ${blocks.length} question${blocks.length === 1 ? "" : "s"}, sent as one 50% batch (${batchName}).`, tech: true });
  log.push({ at: now(), text: `${label}: ${blocks.length} question${blocks.length === 1 ? "" : "s"} are being written up.` });
}

/** Poll a submitted chunk; import automatically the moment it is ready. */
async function collectChunk(admin: Admin, apiKey: string, chunk: any, job: any, log: RitaLogEntry[]) {
  const label = chunk.page_from ? `Pages ${chunk.page_from}–${chunk.page_to}` : "Your text";
  if (!chunk.batch_id) return 0;

  let bj: any;
  try {
    bj = await fetchBatch(apiKey, chunk.batch_id);
  } catch (e: any) {
    log.push({ at: now(), text: `${label}: status check failed — ${e?.message || e}`, tech: true });
    return 0;
  }
  const mapped = mapBatchStatus(getBatchState(bj));
  if (mapped === "pending" || mapped === "running") return 0;
  if (mapped !== "succeeded") {
    await admin.from(CHUNKS).update({ status: "failed", error: `batch ${mapped}` }).eq("id", chunk.id);
    log.push({ at: now(), text: `${label}: this piece could not be finished.`, tech: true });
    return 0;
  }

  const items = await downloadResponses(apiKey, bj);
  const parsedList = (items ?? []).map((it: any, i: number) => ({
    key: it?.metadata?.key || `q-${i}`,
    parsed: extractJsonObject(responseText(it)),
  }));
  return await importParsed(admin, job, chunk, parsedList, label, log);
}

/** Write solved questions into the chosen sub-subject. */
async function importParsed(
  admin: Admin,
  job: any,
  chunk: any,
  parsedList: { key: string; parsed: any }[],
  label: string,
  log: RitaLogEntry[],
) {
  // Writing into a shared archive shelf? Keep the rows private to this student.
  let ownerId: string | null = null;
  try {
    const { data: sub } = await admin
      .from("subjects")
      .select("owner_user_id, group_id")
      .eq("id", job.subject_id)
      .maybeSingle();
    if (sub && sub.owner_user_id !== job.user_id) {
      const { data: grp } = await admin
        .from("subject_groups")
        .select("course_id, owner_user_id")
        .eq("id", sub.group_id)
        .maybeSingle();
      const { data: course } = grp
        ? await admin.from("courses").select("created_by").eq("id", grp.course_id).maybeSingle()
        : { data: null as any };
      const mine = sub.owner_user_id === job.user_id || grp?.owner_user_id === job.user_id || course?.created_by === job.user_id;
      if (!mine) ownerId = job.user_id ?? null;
    }
  } catch {
    /* fall back to a shared row */
  }

  const { count } = await admin.from("questions")
    .select("id", { count: "exact", head: true }).eq("subject_id", job.subject_id);
  let order = (count ?? 0) + 1;

  let inserted = 0, skipped = 0, failed = 0;
  const errors: string[] = [];

  for (const item of parsedList) {
    const key = item.key;
    try {
      const parsed = item.parsed;
      if (!parsed?.prompt || !Array.isArray(parsed?.options) || parsed.options.length === 0) {
        failed++; errors.push(`${key}: unreadable answer`); continue;
      }
      const explanation = [
        String(parsed.explanation || "").trim(),
        parsed.summary_table ? `\n\n${String(parsed.summary_table).trim()}` : "",
      ].join("").trim() || null;

      const { data: q, error: qErr } = await admin.from("questions").upsert(
        {
          subject_id: job.subject_id,
          stem: String(parsed.prompt).trim(),
          explanation,
          sort_order: order,
          ...(ownerId ? { owner_user_id: ownerId } : {}),
        },
        { onConflict: "subject_id,stem_hash", ignoreDuplicates: true },
      ).select("id").maybeSingle();
      if (qErr) throw qErr;
      if (!q?.id) { skipped++; continue; }

      const rows = parsed.options.slice(0, 6).map((o: any, idx: number) => ({
        question_id: q.id,
        label: String(o?.letter || String.fromCharCode(65 + idx)).slice(0, 3),
        text: String(o?.body ?? o?.text ?? "").slice(0, 2000),
        is_correct: !!o?.is_correct,
        sort_order: idx + 1,
        ...(ownerId ? { owner_user_id: ownerId } : {}),
      }));

      const { error: oErr } = await admin.from("question_options").insert(rows);
      if (oErr) throw oErr;
      inserted++; order++;
    } catch (e: any) {
      failed++;
      errors.push(`${key}: ${e?.message || String(e)}`.slice(0, 180));
    }
  }

  await admin.from(CHUNKS).update({
    status: "imported",
    imported_count: inserted,
    results: { inserted, skipped, failed, errors: errors.slice(0, 6) },
  }).eq("id", chunk.id);

  log.push({ at: now(), text: `${label}: imported ${inserted}, ${skipped} duplicate, ${failed} unreadable.`, tech: true });
  if (inserted > 0) log.push({ at: now(), text: `Added ${inserted} new question${inserted === 1 ? "" : "s"} to your sub-subject.` });
  return inserted;

}

async function refreshJobCounters(admin: Admin, jobId: string) {
  const { data: chunks } = await admin.from(CHUNKS).select("status, imported_count").eq("job_id", jobId);
  const rows = chunks ?? [];
  const done = rows.filter((c: any) => ["imported", "empty", "failed"].includes(c.status)).length;
  const importedTotal = rows.reduce((n: number, c: any) => n + (c.imported_count ?? 0), 0);
  const active = rows.length - done;
  return { done, importedTotal, total: rows.length, active };
}

/**
 * One bounded tick: at most one job, `maxSubmit` new pieces sent and every
 * waiting piece checked (and auto-imported when ready).
 */
export async function runRitaWorker(maxSubmit = 2): Promise<{ handled: number; jobId?: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/legacy-client.server");
  const admin = supabaseAdmin as Admin;
  const nowIso = new Date().toISOString();

  const { data: jobs } = await admin
    .from(JOBS)
    .select("*")
    .in("status", ["queued", "running"])
    .or(`lease_until.is.null,lease_until.lt.${nowIso}`)
    .order("created_at", { ascending: true })
    .limit(1);

  const job = (jobs ?? [])[0];
  if (!job) return { handled: 0 };

  const lease = new Date(Date.now() + 5 * 60_000).toISOString();
  const { data: claimed } = await admin
    .from(JOBS)
    .update({ status: "running", lease_until: lease })
    .eq("id", job.id)
    .or(`lease_until.is.null,lease_until.lt.${nowIso}`)
    .select("id")
    .maybeSingle();
  if (!claimed) return { handled: 0 };

  const log: RitaLogEntry[] = [];
  let handled = 0;

  try {
    // Rita uses the same protected Gemini key as every text/vision study tool.
    const apiKey = await resolveRitaKey(admin);

    const { data: waiting } = await admin
      .from(CHUNKS).select("*").eq("job_id", job.id).eq("status", "awaiting_batch").order("chunk_index");
    let importedThisTick = 0;
    for (const chunk of waiting ?? []) {
      importedThisTick += await collectChunk(admin, apiKey, chunk, job, log);
      handled++;
    }

    const { bumpQuota, remainingQuota } = await import("@/lib/quota.server");
    if (importedThisTick > 0) {
      await bumpQuota(job.user_id, "archive_questions", importedThisTick);
    }
    const left = await remainingQuota(job.user_id, "archive_questions");
    if (left !== null && left <= 0) {
      // The plan allowance ran out part-way through this PDF: stop cleanly and
      // keep everything already imported.
      const { data: rest } = await admin
        .from(CHUNKS).select("id").eq("job_id", job.id).in("status", ["pending", "borders"]);
      for (const c of rest ?? []) {
        await admin.from(CHUNKS)
          .update({ status: "failed", error: "Plan question limit reached." })
          .eq("id", c.id);
      }
      const counters = await refreshJobCounters(admin, job.id);
      log.push({
        at: now(),
        text: `Stopped part-way: your plan's archive question limit is used up. ${counters.importedTotal} question${counters.importedTotal === 1 ? "" : "s"} were saved. Upgrade on the Plans page to finish this PDF.`,
      });
      await admin.from(JOBS).update({
        status: "done",
        lease_until: null,
        chunks_total: counters.total,
        chunks_done: counters.done,
        imported_total: counters.importedTotal,
        log: [...(job.log ?? []), ...log],
        updated_at: new Date().toISOString(),
      }).eq("id", job.id);
      return { handled, jobId: job.id };
    }

    const { data: pending } = await admin
      .from(CHUNKS).select("*").eq("job_id", job.id).in("status", ["pending", "borders", "solving"])
      .order("chunk_index").limit(maxSubmit);
    for (const chunk of pending ?? []) {
      await submitChunk(admin, apiKey, chunk, log);
      handled++;
    }

    const counters = await refreshJobCounters(admin, job.id);
    const finished = counters.active === 0;
    if (finished) {
      log.push({
        at: now(),
        text: `Finished — ${counters.importedTotal} question${counters.importedTotal === 1 ? "" : "s"} added.`,
      });
    }
    await admin.from(JOBS).update({
      status: finished ? "done" : "running",
      lease_until: null,
      chunks_total: counters.total,
      chunks_done: counters.done,
      imported_total: counters.importedTotal,
      updated_at: new Date().toISOString(),
    }).eq("id", job.id);
  } catch (e: any) {
    log.push({ at: now(), text: `Run paused: ${e?.message || String(e)}`, tech: true });
    await admin.from(JOBS).update({
      status: "running",
      lease_until: null,
      error: String(e?.message || e).slice(0, 400),
      updated_at: new Date().toISOString(),
    }).eq("id", job.id);
  }

  await appendLog(admin, job.id, log);
  return { handled, jobId: job.id };
}
