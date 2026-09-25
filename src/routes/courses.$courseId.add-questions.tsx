import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Camera, FileUp, Loader2, ScanLine, Trash2, Type } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { useAuth } from "@/hooks/useAuth";
import { usePlanGate } from "@/hooks/usePlanGate";
import { UpgradeWall } from "@/components/plan/UpgradeWall";
import {
  ritaListSubjects,
  ritaCreateJob,
  ritaCreateTextJob,
  ritaCreateImageJob,
  ritaListRuns,
  ritaKickWorker,
  ritaDeleteJob,
} from "@/lib/rita-ai-38.functions";

export const Route = createFileRoute("/courses/$courseId/add-questions")({
  head: () => ({
    meta: [
      { title: "Add questions to your bank — RitaJet" },
      {
        name: "description",
        content:
          "Upload a PDF or photograph a real exam paper and RitaJet writes every question out with the concept, the right answer and why the others are wrong.",
      },
      { property: "og:title", content: "Add questions — RitaJet" },
      {
        property: "og:description",
        content: "Turn any paper into fully explained archive questions inside your own sub-subject.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AddQuestionsPage,
});

type SubjectRow = { id: string; name: string; subSubjects: { id: string; name: string; section: string }[] };
type RunRow = {
  id: string;
  name: string;
  status: string;
  totalPages: number;
  chunksTotal: number;
  chunksDone: number;
  imported: number;
  subjectName: string;
  createdAt: string;
  error: string | null;
  log: { at: string; text: string; tech?: boolean }[];
};

const PAGES_PER_JOB = 8;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result || "");
      resolve(s.slice(s.indexOf(",") + 1));
    };
    r.onerror = () => reject(new Error("Could not read that file."));
    r.readAsDataURL(file);
  });
}

/** Photos of a real paper are sharpened and enlarged before they are read. */
async function photoToUpscaledJpeg(file: File, longEdge = 2200): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("That picture could not be opened."));
      el.src = url;
    });
    const scale = Math.min(3, Math.max(1, longEdge / Math.max(img.width, img.height)));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser cannot prepare pictures.");
    ctx.imageSmoothingEnabled = true;
    (ctx as any).imageSmoothingQuality = "high";
    ctx.filter = "grayscale(1) contrast(1.25) brightness(1.05)";
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
    return dataUrl.slice(dataUrl.indexOf(",") + 1);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function statusLabel(run: RunRow) {
  if (run.status === "done") return `Finished — ${run.imported} question${run.imported === 1 ? "" : "s"} added`;
  if (run.status === "failed") return "Stopped — nothing more could be added";
  if (run.chunksDone === 0) return "Getting started…";
  return "Working through your pages…";
}

function AddQuestionsPage() {
  const { courseId } = useParams({ from: "/courses/$courseId/add-questions" });
  const { user, loading, isRealAdmin } = useAuth();
  const gate = usePlanGate();

  const listSubjects = useServerFn(ritaListSubjects);
  const createJob = useServerFn(ritaCreateJob);
  const createTextJob = useServerFn(ritaCreateTextJob);
  const createImageJob = useServerFn(ritaCreateImageJob);
  const listRuns = useServerFn(ritaListRuns);
  const kickWorker = useServerFn(ritaKickWorker);
  const deleteJob = useServerFn(ritaDeleteJob);

  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [subSubjectId, setSubSubjectId] = useState("");
  const [mode, setMode] = useState<"pdf" | "photos" | "text">("pdf");
  const [file, setFile] = useState<File | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [pastedText, setPastedText] = useState("");
  const [busy, setBusy] = useState("");
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [openRun, setOpenRun] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const subSubjects = useMemo(
    () => subjects.find((s) => s.id === subjectId)?.subSubjects ?? [],
    [subjects, subjectId],
  );

  useEffect(() => {
    if (!user) return;
    listSubjects({ data: undefined } as any)
      .then((r: any) => {
        const list: SubjectRow[] = r.subjects ?? [];
        setSubjects(list);
        if (list.some((s) => s.id === courseId)) setSubjectId(courseId);
      })
      .catch(() => setSubjects([]));
  }, [user, listSubjects, courseId]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    const tick = async () => {
      try {
        const r: any = await listRuns({ data: undefined } as any);
        if (!alive) return;
        setRuns(r.runs ?? []);
        const active = (r.runs ?? []).some((x: RunRow) => x.status === "queued" || x.status === "running");
        timer.current = setTimeout(tick, active ? 6000 : 20000);
      } catch {
        if (alive) timer.current = setTimeout(tick, 20000);
      }
    };
    tick();
    return () => {
      alive = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [user, listRuns]);

  async function refreshSoon() {
    try {
      const r: any = await listRuns({ data: undefined } as any);
      setRuns(r.runs ?? []);
    } catch { /* ignore */ }
  }

  /** Scanned PDF: render every page big, then hand them over in small batches. */
  async function runScannedPdf(pdf: File) {
    const { loadPdfForRender, renderPageToJpegBase64 } = await import("@/lib/pdf-page-render");
    setBusy("Opening your paper…");
    const doc = await loadPdfForRender(pdf);
    const total: number = doc?.numPages ?? 0;
    if (!total) throw new Error("That file has no pages we can read.");

    const images: string[] = [];
    for (let p = 1; p <= total; p++) {
      setBusy(`Sharpening page ${p} of ${total}…`);
      images.push(await renderPageToJpegBase64(doc, p, { targetWidth: 2200, quality: 0.88 }));
    }

    let jobs = 0;
    for (let i = 0; i < images.length; i += PAGES_PER_JOB) {
      const part = images.slice(i, i + PAGES_PER_JOB);
      setBusy(`Reading pages ${i + 1}–${i + part.length}…`);
      await createImageJob({
        data: {
          subjectId: subSubjectId,
          name: images.length > PAGES_PER_JOB ? `${pdf.name} (pages ${i + 1}–${i + part.length})` : pdf.name,
          images: part,
        },
      });
      jobs++;
    }
    return jobs;
  }

  async function handleRun() {
    if (!subSubjectId) {
      toast.error("Pick a subject and a sub-subject first.");
      return;
    }
    if (!gate.check({ feature: "feature_archive_qgen", kind: "archive_questions" })) return;

    setBusy("Getting ready…");
    try {
      if (mode === "text") {
        if (pastedText.trim().length < 40) throw new Error("Paste a bit more text.");
        await createTextJob({ data: { subjectId: subSubjectId, text: pastedText.trim(), name: "Pasted questions" } });
        setPastedText("");
      } else if (mode === "photos") {
        if (!photos.length) throw new Error("Add at least one picture of the paper.");
        const prepared: string[] = [];
        for (let i = 0; i < photos.length; i++) {
          setBusy(`Sharpening picture ${i + 1} of ${photos.length}…`);
          prepared.push(await photoToUpscaledJpeg(photos[i]!));
        }
        for (let i = 0; i < prepared.length; i += PAGES_PER_JOB) {
          const part = prepared.slice(i, i + PAGES_PER_JOB);
          setBusy(`Reading picture${part.length === 1 ? "" : "s"} ${i + 1}–${i + part.length}…`);
          await createImageJob({
            data: { subjectId: subSubjectId, name: `Paper photos (${i + 1}–${i + part.length})`, images: part },
          });
        }
        setPhotos([]);
      } else {
        if (!file) throw new Error("Choose a PDF first.");
        if (file.size > 11 * 1024 * 1024) throw new Error("That PDF is too big — keep it under 11 MB.");

        // Does this PDF carry real text, or is it a picture of a paper?
        let hasText = false;
        try {
          const { getPdfPageTexts } = await import("@/lib/pdf-page-render");
          const sample = await getPdfPageTexts(file, 1, 3);
          hasText = sample.join(" ").replace(/\s+/g, " ").trim().length > 120;
        } catch {
          hasText = false;
        }

        if (hasText) {
          setBusy("Sending your PDF…");
          const b64 = await fileToBase64(file);
          await createJob({ data: { subjectId: subSubjectId, pdfName: file.name, pdfBase64: b64 } });
        } else {
          await runScannedPdf(file);
        }
        setFile(null);
      }

      toast.success("Rita has it — you can close this page, the questions arrive on their own.");
      await refreshSoon();
      kickWorker({ data: undefined } as any).then(refreshSoon).catch(() => {});
    } catch (e: any) {
      toast.error(e?.message || "Could not start that run.");
    } finally {
      setBusy("");
    }
  }

  async function handleDelete(id: string) {
    await deleteJob({ data: { jobId: id } });
    setRuns((r) => r.filter((x) => x.id !== id));
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader variant="light" />
      <UpgradeWall block={gate.block} onClose={gate.closeBlock} />

      <main className="flex-1 mx-auto w-full max-w-6xl px-6 md:px-10 pt-24 pb-24">
        <Link
          to="/courses/$courseId"
          params={{ courseId }}
          className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={15} /> Back to the question bank
        </Link>

        <header className="mt-6 max-w-3xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">Add questions</p>
          <h1 className="mt-2 font-display text-4xl md:text-5xl font-semibold tracking-tight text-foreground">
            Any paper. Fully explained questions.
          </h1>
          <p className="mt-4 text-base md:text-lg text-muted-foreground">
            Upload a PDF, or take pictures of a real exam paper. RitaJet reads it, cuts out every
            question on its own, then writes the concept, why the right answer is right and why each
            other answer is wrong — straight into the sub-subject you choose.
          </p>
        </header>

        {loading ? (
          <div className="mt-10 h-56 animate-pulse rounded-3xl border border-border bg-card" />
        ) : !user ? (
          <div className="mt-10 rounded-3xl border border-border bg-card p-10 text-center shadow-[var(--shadow-card)]">
            <p className="text-base font-semibold text-foreground">Sign in to add your own questions.</p>
            <Link to="/login" className="rita-btn rita-btn-primary mt-4 inline-flex">Sign in</Link>
          </div>
        ) : (
          <div className="mt-10 grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
            {/* ---------- the form ---------- */}
            <section className="rounded-3xl border border-border bg-card p-6 md:p-8 shadow-[var(--shadow-card)]">
              <Step n={1} title="Where should they go?">
                <div className="grid gap-3 sm:grid-cols-2">
                  <select
                    value={subjectId}
                    onChange={(e) => { setSubjectId(e.target.value); setSubSubjectId(""); }}
                    className="add-q-input"
                  >
                    <option value="">Choose a subject…</option>
                    {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <select
                    value={subSubjectId}
                    onChange={(e) => setSubSubjectId(e.target.value)}
                    disabled={!subjectId}
                    className="add-q-input"
                  >
                    <option value="">Choose a sub-subject…</option>
                    {subSubjects.map((s) => (
                      <option key={s.id} value={s.id}>{s.section} · {s.name}</option>
                    ))}
                  </select>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Every question from this run lands in that one sub-subject.
                </p>
              </Step>

              <div className="mt-8">
                <Step n={2} title="What are you giving Rita?">
                  <div className="flex flex-wrap gap-2">
                    <ModeTab on={mode === "pdf"} onClick={() => setMode("pdf")} icon={<FileUp size={15} />} label="PDF" />
                    <ModeTab on={mode === "photos"} onClick={() => setMode("photos")} icon={<Camera size={15} />} label="Paper photos" />
                    <ModeTab on={mode === "text"} onClick={() => setMode("text")} icon={<Type size={15} />} label="Typed text" />
                  </div>

                  {mode === "pdf" && (
                    <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/40 px-4 py-10 text-center transition-colors hover:border-primary">
                      <FileUp size={24} className="text-primary" />
                      <span className="mt-2 text-sm font-semibold text-foreground">
                        {file ? file.name : "Choose a PDF"}
                      </span>
                      <span className="mt-1 text-xs text-muted-foreground">
                        Typed or scanned — up to 11 MB. Scans are read with our page reader automatically.
                      </span>
                      <input
                        type="file"
                        accept="application/pdf"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0] ?? null;
                          e.target.value = "";
                          if (f) setFile(f);
                        }}
                      />
                    </label>
                  )}

                  {mode === "photos" && (
                    <div className="mt-4">
                      <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/40 px-4 py-10 text-center transition-colors hover:border-primary">
                        <ScanLine size={24} className="text-primary" />
                        <span className="mt-2 text-sm font-semibold text-foreground">
                          {photos.length ? `${photos.length} picture${photos.length === 1 ? "" : "s"} ready` : "Add pictures of the paper"}
                        </span>
                        <span className="mt-1 text-xs text-muted-foreground">
                          One picture per page, straight on and in good light.
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={(e) => {
                            const list = Array.from(e.target.files ?? []);
                            e.target.value = "";
                            if (list.length) setPhotos((p) => [...p, ...list].slice(0, 24));
                          }}
                        />
                      </label>
                      {photos.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setPhotos([])}
                          className="mt-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
                        >
                          Clear pictures
                        </button>
                      )}
                    </div>
                  )}

                  {mode === "text" && (
                    <textarea
                      value={pastedText}
                      onChange={(e) => setPastedText(e.target.value)}
                      rows={8}
                      placeholder="Paste the questions here…"
                      className="add-q-input mt-4 font-mono text-xs"
                    />
                  )}
                </Step>
              </div>

              <button
                type="button"
                onClick={handleRun}
                disabled={!!busy}
                className="rita-btn rita-btn-primary mt-8 inline-flex disabled:opacity-70"
              >
                {busy ? <><Loader2 size={16} className="animate-spin" /> {busy}</> : "Add these questions"}
              </button>
              <p className="mt-4 rounded-2xl border border-[#d94a3d]/25 bg-[#d94a3d]/[0.07] px-4 py-3 text-[13px] font-semibold leading-relaxed text-[#c1392b]">
                <span className="font-black">This takes time — you don't have to wait here.</span>{" "}
                Close the page and come back whenever you like; the questions keep being written and land
                in your sub-subject by themselves. Big files can take up to two hours, but it is usually
                finished in under 30 minutes.
              </p>
            </section>

            {/* ---------- progress ---------- */}
            <section className="rounded-3xl border border-border bg-card p-6 md:p-7 shadow-[var(--shadow-card)]">
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Your runs</h2>
                <span className="text-xs font-semibold text-primary">
                  {runs.filter((r) => r.status !== "done").length} active
                </span>
              </div>

              <div className="mt-4 max-h-[32rem] space-y-3 overflow-auto pr-1">
                {runs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nothing yet. Once a run starts it stays here — even if you close the page.
                  </p>
                ) : (
                  runs.map((run) => {
                    const pct = run.chunksTotal ? Math.round((run.chunksDone / run.chunksTotal) * 100) : 0;
                    const open = openRun === run.id;
                    return (
                      <div key={run.id} className="rounded-2xl border border-border bg-muted/30 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-foreground">{run.name}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {run.subjectName ? `${run.subjectName} · ` : ""}{statusLabel(run)}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDelete(run.id)}
                            aria-label="Remove this run"
                            className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-border">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${run.status === "done" ? 100 : pct}%` }}
                          />
                        </div>
                        <p className="mt-2 text-xs font-semibold text-muted-foreground">
                          {run.imported} question{run.imported === 1 ? "" : "s"} added
                          {run.chunksTotal ? ` · ${run.chunksDone}/${run.chunksTotal} parts done` : ""}
                        </p>

                        <button
                          type="button"
                          onClick={() => setOpenRun(open ? null : run.id)}
                          className="mt-2 text-xs font-semibold text-primary"
                        >
                          {open ? "Hide details" : "Show details"}
                        </button>

                        {open && (
                          <div className="mt-2 space-y-1.5">
                            {isRealAdmin && run.error && (
                              <p className="text-xs text-destructive">{run.error}</p>
                            )}
                            {run.log.length === 0 ? (
                              <p className="text-xs text-muted-foreground">Nothing to show yet.</p>
                            ) : (
                              run.log.map((l, i) => (
                                <p key={i} className="text-xs text-muted-foreground">{l.text}</p>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2.5">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/12 text-xs font-bold text-primary">
          {n}
        </span>
        <h3 className="font-display text-lg font-semibold tracking-tight text-foreground">{title}</h3>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function ModeTab({
  on, onClick, icon, label,
}: { on: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        on
          ? "inline-flex items-center gap-2 rounded-full border border-primary bg-primary/10 px-4 py-2 text-sm font-semibold text-primary"
          : "inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
      }
    >
      {icon} {label}
    </button>
  );
}
