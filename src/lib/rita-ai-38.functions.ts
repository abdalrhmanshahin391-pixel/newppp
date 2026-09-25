import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/legacy-auth-middleware";
import { z } from "zod";

const JOBS = "rita_ai_jobs";
const CHUNKS = "rita_ai_chunks";
const PAGES_PER_CHUNK = 2;

async function isAdmin(supabase: any, userId: string) {
  try {
    const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    return !!data;
  } catch {
    return false;
  }
}

/**
 * Throws unless the caller may add questions here. Shared archive banks are
 * allowed too — in that case the questions are saved as the student's own
 * private rows, so nobody edits anyone else's shelf.
 */
async function assertOwnsSubject(supabase: any, userId: string, subjectId: string) {
  const { data: sub, error } = await supabase
    .from("subjects")
    .select("id, group_id, owner_user_id, access_level")
    .eq("id", subjectId)
    .maybeSingle();
  if (error) throw error;
  if (!sub) throw new Error("That sub-subject no longer exists.");
  const { data: grp } = await supabase
    .from("subject_groups")
    .select("id, course_id, owner_user_id")
    .eq("id", sub.group_id)
    .maybeSingle();
  if (!grp) throw new Error("That sub-subject is not attached to a subject.");
  const { data: course } = await supabase
    .from("courses")
    .select("id, created_by, kind, published")
    .eq("id", grp.course_id)
    .maybeSingle();
  if (!course) throw new Error("That subject no longer exists.");
  const mine =
    sub.owner_user_id === userId ||
    grp.owner_user_id === userId ||
    course.created_by === userId;
  // Readable shared archive shelf: allowed, but stored privately for this student.
  const sharedArchive = !mine && sub.owner_user_id == null && course.kind === "questions";
  if (!mine && !sharedArchive && !(await isAdmin(supabase, userId))) {
    throw new Error("You can only add questions to your own subjects.");
  }
  return { courseId: course.id as string, groupId: grp.id as string, shared: !mine && sharedArchive };
}


// ---------------- subject / sub-subject picker ----------------

export const ritaListSubjects = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = (context as any).supabase;
    const userId = (context as any).userId as string;
    const admin = await isAdmin(supabase, userId);

    // 1 — courses the student created (admins see every course).
    let q = supabase
      .from("courses")
      .select("id, title, created_by")
      .eq("kind", "questions")
      .order("title");
    if (!admin) q = q.eq("created_by", userId);
    const { data: ownCourses, error } = await q;
    if (error) throw error;

    // 1b — shared archive banks anyone signed in can open (RLS decides).
    const { data: sharedCourses } = await supabase
      .from("courses")
      .select("id, title, created_by")
      .eq("kind", "questions")
      .eq("published", true)
      .eq("admin_only", false)
      .order("title");
    const sharedCourseIds = new Set<string>(
      (sharedCourses ?? [])
        .filter((c: any) => !(ownCourses ?? []).some((o: any) => o.id === c.id))
        .map((c: any) => c.id as string),
    );
    const { data: sharedGroups } = sharedCourseIds.size
      ? await supabase
          .from("subject_groups")
          .select("id, course_id, name")
          .in("course_id", Array.from(sharedCourseIds))
          .is("owner_user_id", null)
          .order("sort_order")
      : { data: [] as any[] };


    // 2 — sections and sub-subjects the student made inside ANY course
    //     (their private shelves inside the shared archive).
    const [{ data: myGroups }, { data: mySubs }] = await Promise.all([
      supabase.from("subject_groups").select("id, course_id, name").eq("owner_user_id", userId),
      supabase.from("subjects").select("id, group_id, name").eq("owner_user_id", userId),
    ]);

    // Groups that hold one of my sub-subjects but are not mine.
    const missingGroupIds = Array.from(
      new Set(
        (mySubs ?? [])
          .map((s: any) => s.group_id)
          .filter((gid: string) => gid && !(myGroups ?? []).some((g: any) => g.id === gid)),
      ),
    );
    const { data: parentGroups } = missingGroupIds.length
      ? await supabase.from("subject_groups").select("id, course_id, name").in("id", missingGroupIds)
      : { data: [] as any[] };

    const courseIds = new Set<string>((ownCourses ?? []).map((c: any) => c.id));
    const allGroups: any[] = [...(myGroups ?? []), ...(parentGroups ?? [])];

    // Everything inside my own courses.
    const ownIds = Array.from(courseIds);
    const { data: courseGroups } = ownIds.length
      ? await supabase
          .from("subject_groups")
          .select("id, course_id, name")
          .in("course_id", ownIds)
          .order("sort_order")
      : { data: [] as any[] };
    for (const g of courseGroups ?? []) {
      if (!allGroups.some((x) => x.id === g.id)) allGroups.push(g);
    }
    for (const g of sharedGroups ?? []) {
      if (!allGroups.some((x) => x.id === g.id)) allGroups.push(g);
    }

    const groupIds = allGroups.map((g) => g.id);
    const { data: groupSubs } = groupIds.length
      ? await supabase
          .from("subjects")
          .select("id, group_id, name, owner_user_id")
          .in("group_id", groupIds)
          .order("sort_order")
      : { data: [] as any[] };

    // Usable when it is mine, in a course I own, or a shared archive shelf.
    const usableSubs: any[] = [];
    const seen = new Set<string>();
    const push = (s: any) => {
      if (s && !seen.has(s.id)) {
        seen.add(s.id);
        usableSubs.push(s);
      }
    };
    for (const s of groupSubs ?? []) {
      const grp = allGroups.find((g) => g.id === s.group_id);
      const inMyCourse = grp && courseIds.has(grp.course_id);
      const inSharedBank = grp && sharedCourseIds.has(grp.course_id) && s.owner_user_id == null;
      if (s.owner_user_id === userId || inMyCourse || inSharedBank) push(s);
    }

    for (const s of mySubs ?? []) push(s);

    // Pull in the titles of any archive course that hosts my shelves.
    for (const g of allGroups) if (g.course_id) courseIds.add(g.course_id);
    const extraIds = Array.from(courseIds).filter(
      (id) => !(ownCourses ?? []).some((c: any) => c.id === id),
    );
    const { data: extraCourses } = extraIds.length
      ? await supabase.from("courses").select("id, title").eq("kind", "questions").in("id", extraIds)
      : { data: [] as any[] };

    const courses = [...(ownCourses ?? []), ...(extraCourses ?? [])];

    const subjects = courses
      .map((c: any) => ({
        id: c.id as string,
        name: c.title as string,
        subSubjects: allGroups
          .filter((g) => g.course_id === c.id)
          .flatMap((g) =>
            usableSubs
              .filter((s) => s.group_id === g.id)
              .map((s) => ({ id: s.id as string, name: s.name as string, section: g.name as string })),
          ),
      }))
      .filter((c) => c.subSubjects.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name));

    return { isAdmin: admin, subjects };
  });

// ---------------- start a run (everything after this is server-side) -------

/**
 * The browser hands over the whole PDF once. We read its text here, split it
 * into 4-page pieces and queue them. The scheduled worker does the rest, so
 * the student can close the page immediately.
 */
export const ritaCreateJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      subjectId: z.string().uuid(),
      pdfName: z.string().min(1).max(200),
      pdfBase64: z.string().min(20).max(16_000_000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = (context as any).supabase;
    const userId = (context as any).userId as string;
    const { assertFeature, assertQuota } = await import("@/lib/quota.server");
    await assertFeature(userId, "feature_archive_qgen");
    await assertQuota(userId, "archive_questions", 1);
    const { courseId, groupId } = await assertOwnsSubject(supabase, userId, data.subjectId);

    const { extractText, getDocumentProxy } = await import("unpdf");
    const bin = Uint8Array.from(atob(data.pdfBase64), (c) => c.charCodeAt(0));
    const doc = await getDocumentProxy(bin);
    let pages: string[] = [];
    try {
      const r: any = await extractText(doc, { mergePages: false } as any);
      const arr = Array.isArray(r?.text) ? r.text : [String(r?.text ?? "")];
      pages = arr.map((s: any) => String(s || "").replace(/\s+\n/g, "\n").trim());
    } catch {
      pages = [];
    }
    if (!pages.length) throw new Error("We could not read any text out of that PDF.");

    const totalPages = pages.length;
    const chunks: { from: number; to: number; text: string }[] = [];
    for (let i = 0; i < totalPages; i += PAGES_PER_CHUNK) {
      const slice = pages.slice(i, i + PAGES_PER_CHUNK);
      chunks.push({
        from: i + 1,
        to: Math.min(i + PAGES_PER_CHUNK, totalPages),
        text: slice.join("\n\n").slice(0, 60_000),
      });
    }

    const { data: job, error } = await supabase.from(JOBS).insert({
      user_id: userId,
      course_id: courseId,
      group_id: groupId,
      subject_id: data.subjectId,
      pdf_name: data.pdfName,
      total_pages: totalPages,
      pages_per_chunk: PAGES_PER_CHUNK,
      chunks_total: chunks.length,
      status: "queued",
      log: [{ at: new Date().toISOString(), text: `Received ${data.pdfName} — ${totalPages} pages.` }],
    }).select("id").single();
    if (error) throw error;

    const rows = chunks.map((c, i) => ({
      job_id: job.id,
      chunk_index: i,
      page_from: c.from,
      page_to: c.to,
      chunk_text: c.text,
      status: "pending",
    }));
    const { error: cErr } = await supabase.from(CHUNKS).insert(rows);
    if (cErr) throw cErr;

    return { jobId: job.id as string, totalPages, chunkCount: chunks.length };
  });

/** Text-only mode: one paste of notes becomes one queued piece. */
export const ritaCreateTextJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      subjectId: z.string().uuid(),
      text: z.string().min(40).max(60_000),
      name: z.string().max(120).default("Pasted text"),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = (context as any).supabase;
    const userId = (context as any).userId as string;
    const { assertFeature, assertQuota } = await import("@/lib/quota.server");
    await assertFeature(userId, "feature_archive_qgen");
    await assertQuota(userId, "archive_questions", 1);
    const { courseId, groupId } = await assertOwnsSubject(supabase, userId, data.subjectId);

    const { data: job, error } = await supabase.from(JOBS).insert({
      user_id: userId, course_id: courseId, group_id: groupId, subject_id: data.subjectId,
      pdf_name: data.name, total_pages: 1, pages_per_chunk: 1, chunks_total: 1, status: "queued",
      log: [{ at: new Date().toISOString(), text: "Received your text." }],
    }).select("id").single();
    if (error) throw error;

    const { error: cErr } = await supabase.from(CHUNKS).insert({
      job_id: job.id, chunk_index: 0, page_from: 0, page_to: 0,
      chunk_text: data.text.trim(), status: "pending",
    });
    if (cErr) throw cErr;

    return { jobId: job.id as string, chunkCount: 1 };
  });

/**
 * Photographed / scanned paper mode.
 *
 * The browser sends already-upscaled page pictures. We read each one with
 * Gemini vision (OCR), then feed the typed-out text into exactly the same
 * borders -> cut -> solve -> save pipeline as a text PDF.
 */
export const ritaCreateImageJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      subjectId: z.string().uuid(),
      name: z.string().min(1).max(200),
      images: z.array(z.string().min(100).max(6_000_000)).min(1).max(12),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = (context as any).supabase;
    const userId = (context as any).userId as string;
    const { assertFeature, assertQuota } = await import("@/lib/quota.server");
    await assertFeature(userId, "feature_archive_qgen");
    await assertQuota(userId, "archive_questions", 1);
    const { courseId, groupId } = await assertOwnsSubject(supabase, userId, data.subjectId);

    const { RITA_MODEL, OCR_SYSTEM, resolveRitaKey, ritaKeyError } = await import(
      "@/lib/rita-ai-38.server"
    );
    const apiKey = await resolveRitaKey(supabase);

    async function readPage(b64: string): Promise<string> {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${RITA_MODEL}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: OCR_SYSTEM }] },
            contents: [{
              role: "user",
              parts: [
                { inlineData: { mimeType: "image/jpeg", data: b64 } },
                { text: "Type out this page exactly as printed." },
              ],
            }],
            generationConfig: { temperature: 0, maxOutputTokens: 8192 },
          }),
        },
      );
      const raw = await res.text();
      if (!res.ok) throw new Error(ritaKeyError(res.status, raw));
      try {
        return String(JSON.parse(raw)?.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
      } catch {
        return "";
      }
    }

    // Read pages a few at a time so one big paper does not stall the request.
    const pages: string[] = new Array(data.images.length).fill("");
    const LANES = 3;
    let cursor = 0;
    await Promise.all(
      Array.from({ length: Math.min(LANES, data.images.length) }, async () => {
        while (cursor < data.images.length) {
          const i = cursor++;
          try {
            pages[i] = await readPage(data.images[i]!);
          } catch (e: any) {
            if (i === 0) throw e;
            pages[i] = "";
          }
        }
      }),
    );

    const readable = pages.filter((p) => p.trim().length > 20);
    if (!readable.length) {
      throw new Error("We could not read any writing on those pages. Try a sharper, straighter photo.");
    }

    const totalPages = pages.length;
    const chunks: { from: number; to: number; text: string }[] = [];
    for (let i = 0; i < totalPages; i += PAGES_PER_CHUNK) {
      const text = pages.slice(i, i + PAGES_PER_CHUNK).join("\n\n").trim();
      if (text.length < 40) continue;
      chunks.push({ from: i + 1, to: Math.min(i + PAGES_PER_CHUNK, totalPages), text: text.slice(0, 60_000) });
    }
    if (!chunks.length) throw new Error("Those pages did not contain enough writing to work with.");

    const { data: job, error } = await supabase.from(JOBS).insert({
      user_id: userId,
      course_id: courseId,
      group_id: groupId,
      subject_id: data.subjectId,
      pdf_name: data.name,
      total_pages: totalPages,
      pages_per_chunk: PAGES_PER_CHUNK,
      chunks_total: chunks.length,
      status: "queued",
      log: [{
        at: new Date().toISOString(),
        text: `Read ${readable.length} of ${totalPages} page${totalPages === 1 ? "" : "s"} from ${data.name}.`,
      }],
    }).select("id").single();
    if (error) throw error;

    const { error: cErr } = await supabase.from(CHUNKS).insert(
      chunks.map((c, i) => ({
        job_id: job.id,
        chunk_index: i,
        page_from: c.from,
        page_to: c.to,
        chunk_text: c.text,
        status: "pending",
      })),
    );
    if (cErr) throw cErr;

    return { jobId: job.id as string, totalPages, chunkCount: chunks.length, readPages: readable.length };
  });


/** Nudges the server worker so a fresh run starts without waiting for the schedule. */
export const ritaKickWorker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { runRitaWorker } = await import("@/lib/rita-ai-38.worker.server");
    try {
      const r = await runRitaWorker(1);
      return { ok: true, handled: r.handled };
    } catch (e: any) {
      return { ok: false, error: String(e?.message || e) };
    }
  });

// ---------------- what the page shows ----------------

export const ritaListRuns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = (context as any).supabase;
    const userId = (context as any).userId as string;
    const admin = await isAdmin(supabase, userId);

    const { data: jobs } = await supabase
      .from(JOBS)
      .select("id, pdf_name, total_pages, status, created_at, updated_at, subject_id, chunks_total, chunks_done, imported_total, log, error")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);

    const rows = jobs ?? [];
    const subjectIds = [...new Set(rows.map((r: any) => r.subject_id).filter(Boolean))];
    const { data: subs } = subjectIds.length
      ? await supabase.from("subjects").select("id, name").in("id", subjectIds)
      : { data: [] as any[] };
    const nameById = new Map((subs ?? []).map((s: any) => [s.id, s.name]));

    return {
      isAdmin: admin,
      runs: rows.map((j: any) => {
        const log: any[] = Array.isArray(j.log) ? j.log : [];
        return {
          id: j.id as string,
          name: j.pdf_name as string,
          status: j.status as string,
          totalPages: j.total_pages as number,
          chunksTotal: j.chunks_total as number,
          chunksDone: j.chunks_done as number,
          imported: j.imported_total as number,
          subjectName: (nameById.get(j.subject_id) as string) ?? "",
          createdAt: j.created_at as string,
          updatedAt: j.updated_at as string,
          error: admin ? (j.error as string | null) : null,
          log: (admin ? log : log.filter((l) => !l?.tech)).slice(-30).reverse(),
        };
      }),
    };
  });

export const ritaDeleteJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ jobId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const supabase = (context as any).supabase;
    const userId = (context as any).userId as string;
    await supabase.from(JOBS).delete().eq("id", data.jobId).eq("user_id", userId);
    return { ok: true };
  });
