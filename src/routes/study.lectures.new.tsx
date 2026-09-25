import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, FileUp, Type } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { useAuth } from "@/hooks/useAuth";
import { usePlanGate } from "@/hooks/usePlanGate";
import { UpgradeWall } from "@/components/plan/UpgradeWall";
import { PromptDialog } from "@/components/study/SimpleDialogs";
import { lqAddSubject, lqAddSubtopic, lqBoard, lqEnsureDefault, lqGenerate } from "@/lib/lecture-lab.functions";
import { PdfScanError, extractPdfText, friendlyError, renderPdfPages } from "@/lib/pdf-text";
import { BuildProgress, estimateBuildSeconds, type BuildStep } from "@/components/study/BuildProgress";
import { aioReadPages } from "@/lib/all-in-one.functions";
import { PickerBoard } from "@/components/common/PickerBoard";

export const Route = createFileRoute("/study/lectures/new")({
  head: () => ({
    meta: [
      { title: "New lecture quiz — Lecture Lab" },
      {
        name: "description",
        content:
          "Upload a lecture PDF or paste its text, pick how many questions and how hard, and Lecture Lab writes the quiz in about a minute.",
      },
      { property: "og:title", content: "New lecture quiz — Lecture Lab" },
      { property: "og:description", content: "Lecture in, quiz out — with a key-points sheet." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewLectureQuizPage,
});

const CREAM = "#fbf5e9";
const INK = "#23201d";

const QUIZ_STEPS: BuildStep[] = [
  { key: "read", label: "Reading the lecture", weight: 1 },
  { key: "points", label: "Finding the teaching points", weight: 1.4 },
  { key: "questions", label: "Writing your questions", weight: 2.2 },
];

function NewLectureQuizPage() {
  const { user, loading } = useAuth();
  const gate = usePlanGate();
  const navigate = useNavigate();

  const board = useServerFn(lqBoard);
  const addSubject = useServerFn(lqAddSubject);
  const addSubtopic = useServerFn(lqAddSubtopic);
  const generate = useServerFn(lqGenerate);
  const ensureDefault = useServerFn(lqEnsureDefault);

  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [subtopics, setSubtopics] = useState<{ id: string; subject_id: string; name: string }[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [subtopicId, setSubtopicId] = useState("");

  const [source, setSource] = useState<"pdf" | "text">("pdf");
  const [file, setFile] = useState<File | null>(null);
  const [pasted, setPasted] = useState("");
  const [title, setTitle] = useState("");
  const [count, setCount] = useState(15);
  const [difficulty, setDifficulty] = useState<"easy" | "mixed" | "hard" | "exam">("mixed");
  const [keyPoints, setKeyPoints] = useState(true);

  const [reading, setReading] = useState("");
  const [step, setStep] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [estimate, setEstimate] = useState(90);
  const [runId, setRunId] = useState(0);

  const refresh = useCallback(async () => {
    const r: any = await board({ data: undefined } as any);
    setSubjects(r.subjects ?? []);
    setSubtopics(r.subtopics ?? []);
    return r;
  }, [board]);

  useEffect(() => {
    if (!user) return;
    refresh().catch((error) => toast.error(friendlyError(error)));
  }, [user, refresh]);

  const kids = useMemo(() => subtopics.filter((t) => t.subject_id === subjectId), [subtopics, subjectId]);

  const pickerGroups = useMemo(
    () =>
      subjects.map((s) => ({
        id: s.id,
        name: s.name,
        items: subtopics
          .filter((t) => t.subject_id === s.id)
          .map((t) => ({ id: t.id, name: t.name, countLabel: "sub-subject" })),
      })),
    [subjects, subtopics],
  );

  const readPages = useServerFn(aioReadPages);

  async function quickStart() {
    try {
      const result: any = await ensureDefault({ data: undefined } as any);
      await refresh();
      setSubjectId(result.subjectId);
      setSubtopicId(result.subtopicId);
      toast.success("My lectures · General is ready.");
    } catch (error) {
      toast.error(friendlyError(error));
      throw error;
    }
  }

  const [subjectOpen, setSubjectOpen] = useState(false);
  const [subtopicOpen, setSubtopicOpen] = useState(false);

  // Checked as the page opens, so a student is never handed an upload they
  // are not allowed to run.
  const planRow = gate.usage?.plan as any;
  const leftQuestions = gate.remaining("ai_questions");
  const featureOff = !gate.loading && !gate.usage?.is_admin && planRow?.feature_lecture_qgen === false;
  const outOfQuestions =
    !gate.loading && !gate.usage?.is_admin && leftQuestions !== null && leftQuestions < 1;
  const locked = featureOff || outOfQuestions;
  const lockReason = featureOff
    ? `Your ${gate.usage?.plan?.name ?? "current"} plan does not include lecture questions yet.`
    : "You have no AI questions left this month.";


  async function onNewSubject(name: string) {
    try {
      const r: any = await addSubject({ data: { name } });
      await refresh();
      setSubjectId(r.id);
      setSubtopicId("");
      toast.success(`Subject “${name}” added.`);
    } catch (error) {
      toast.error(friendlyError(error));
      throw error;
    }
  }

  async function onNewSubtopic(name: string) {
    if (!subjectId) throw new Error("Pick a subject first.");
    try {
      const r: any = await addSubtopic({ data: { subjectId, name } });
      await refresh();
      setSubtopicId(r.id);
      toast.success(`Sub-subject “${name}” added.`);
    } catch (error) {
      toast.error(friendlyError(error));
      throw error;
    }
  }

  async function onGenerate() {
    if (!subtopicId) return toast.error("Pick a sub-subject first.");
    const name = title.trim() || file?.name?.replace(/\.pdf$/i, "") || "Untitled lecture";
    if (source === "pdf" && !file) return toast.error("Choose a PDF, or switch to pasted text.");
    if (source === "text" && pasted.trim().length < 200) {
      return toast.error("Paste a bit more of the lecture (at least a couple of paragraphs).");
    }

    setBusy(true);
    setStep(0);
    setRunId((n) => n + 1);
    setEstimate(estimateBuildSeconds(pasted.trim().length || 20000, source === "pdf"));
    try {
      let text = pasted.trim();
      if (source === "pdf" && file) {
        try {
          const r = await extractPdfText(file, (p) => setReading(`Reading page ${p.page} of ${p.pages}…`));
          text = r.text;
        } catch (e) {
          if (!(e instanceof PdfScanError)) throw e;
          setReading("This one is a scan — reading the pages as pictures…");
          const images = await renderPdfPages(file, 10, (p) =>
            setReading(`Photographing page ${p.page} of ${p.pages}…`),
          );
          const r: any = await readPages({ data: { images } });
          text = String(r.text ?? "");
          if (text.length < 200) throw new Error("Those pages were too blurry to read.");
        }
        setReading("");
      }
      setEstimate(estimateBuildSeconds(text.length, source === "pdf"));
      setStep(keyPoints ? 1 : 2);
      const timer = setTimeout(() => setStep(2), 4000);
      const res: any = await generate({
        data: {
          subtopicId,
          title: name,
          sourceName: file?.name ?? undefined,
          text,
          count,
          difficulty,
          keyPoints,
        },
      });
      clearTimeout(timer);
      toast.success(`${res.questions} questions ready.`);
      void navigate({
        to: "/study/lectures/run",
        search: { ids: res.lectureId, mode: "study", pool: "all", minutes: 0 },
      });
    } catch (e: any) {
      toast.error(friendlyError(e));
      setReading("");
      setStep(-1);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: CREAM }}>
        <SiteHeader />
      <UpgradeWall block={gate.block} onClose={gate.closeBlock} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen" style={{ background: CREAM, color: INK }}>
        <SiteHeader />
        <main className="mx-auto max-w-xl px-4 py-24 text-center">
          <h1 className="font-display text-3xl font-black">Lecture Lab</h1>
          <p className="mt-3 text-[15px] text-[#4a453d]">Sign in to build a quiz from your lecture.</p>
          <Link
            to="/login"
            className="mt-6 inline-flex rounded-full bg-[#23201d] px-6 py-3 text-[14px] font-extrabold text-white"
          >
            Sign in
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: CREAM, color: INK }}>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-10 md:px-8 md:py-14">
        <Link to="/study/lectures" className="inline-flex items-center gap-2 text-[13px] font-bold text-[#6b6357]">
          <ArrowLeft size={15} /> Back to Lecture Lab
        </Link>

        <h1 className="mt-4 font-display text-[32px] font-black leading-tight tracking-tight md:text-[38px]">
          New lecture quiz
        </h1>
        <p className="mt-2 text-[15px] text-[#4a453d]">
          Pick where it belongs, drop the lecture, choose the shape of the quiz.
        </p>

        <section className="mt-7">
          <h2 className="font-display text-[18px] font-black">1 · Where does it go?</h2>
          <p className="mt-1 text-[13px] text-[#6b6357]">
            Open a subject and tick the sub-subject this lecture belongs to.
          </p>
          <div className="mt-3">
            <PickerBoard
              accent="#3f2c73"
              groups={pickerGroups}
              selected={subtopicId ? [subtopicId] : []}
              onToggle={(id) => setSubtopicId((cur) => (cur === id ? "" : id))}
              itemNoun="sub-subject"
              unitNoun="lectures"
              onNewGroup={() => setSubjectOpen(true)}
              onNewItem={(g) => {
                setSubjectId(g.id);
                setSubtopicOpen(true);
              }}
              onAddToGroup={(g) => {
                setSubjectId(g.id);
                setSubtopicOpen(true);
              }}
              addLabel="Sub-subject"
              emptyHint="No subjects yet — make one in a tap below."
            />
            {pickerGroups.length === 0 && (
              <button
                onClick={() => void quickStart()}
                className="mt-3 inline-flex rounded-full bg-[#3f2c73] px-5 py-2.5 text-[13px] font-extrabold text-white"
              >
                Set one up for me
              </button>
            )}
          </div>
        </section>

        <section className="mt-5 rounded-[26px] border border-black/[0.07] bg-white p-5">
          <h2 className="font-display text-[18px] font-black">2 · The lecture</h2>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setSource("pdf")}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-extrabold ${
                source === "pdf" ? "border-[#3f2c73] bg-[#f2edfb] text-[#3f2c73]" : "border-black/10"
              }`}
            >
              <FileUp size={15} /> PDF
            </button>
            <button
              onClick={() => setSource("text")}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-extrabold ${
                source === "text" ? "border-[#3f2c73] bg-[#f2edfb] text-[#3f2c73]" : "border-black/10"
              }`}
            >
              <Type size={15} /> Paste text
            </button>
          </div>

          {locked ? (
            <div className="mt-4 rounded-2xl border border-[#e6c9a8] bg-[#fdf3e6] px-5 py-6 text-center">
              <p className="text-[14px] font-extrabold text-[#7a4b16]">Uploading is off for now</p>
              <p className="mt-1 text-[13px] text-[#6b6357]">{lockReason}</p>
              <Link
                to="/pricing"
                className="mt-4 inline-flex rounded-full bg-[#23201d] px-5 py-2.5 text-[13px] font-extrabold text-white"
              >
                See plans
              </Link>
            </div>
          ) : source === "pdf" ? (
            <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-black/15 bg-[#faf6ec] px-6 py-10 text-center">
              <FileUp size={22} className="text-[#7a4b16]" />
              <span className="mt-2 text-[14px] font-extrabold">
                {file ? file.name : "Choose your lecture PDF"}
              </span>
              <span className="mt-1 text-[12px] text-[#6b6357]">
                Scans are fine too — the pages get read as pictures.
              </span>
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  e.target.value = "";
                  if (!f) return;
                  if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
                    toast.error("Choose a PDF file.");
                    return;
                  }
                  if (f.size > 25 * 1024 * 1024) {
                    toast.error("That PDF is over 25 MB. Split it into smaller files and try again.");
                    return;
                  }
                  if (!gate.check({ feature: "feature_lecture_qgen", kind: "ai_questions" })) return;
                  setFile(f);
                }}
              />
            </label>
          ) : (
            <textarea
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              rows={8}
              placeholder="Paste the lecture text here…"
              className="mt-4 w-full rounded-2xl border border-black/10 p-4 text-[14px] leading-relaxed"
            />
          )}


          <label className="mt-4 block text-[12px] font-black uppercase tracking-[0.14em] text-[#7a4b16]">
            Lecture title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={file?.name?.replace(/\.pdf$/i, "") || "e.g. Heart failure — week 4"}
              className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2.5 text-[14px] font-semibold normal-case tracking-normal text-[#23201d]"
            />
          </label>
        </section>

        <section className="mt-5 rounded-[26px] border border-black/[0.07] bg-white p-5">
          <h2 className="font-display text-[18px] font-black">3 · Shape of the quiz</h2>

          <div className="mt-3 text-[12px] font-black uppercase tracking-[0.14em] text-[#7a4b16]">Questions</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {[5, 10, 15, 20, 30].map((n) => (
              <button
                key={n}
                onClick={() => setCount(n)}
                className={`rounded-full border px-4 py-2 text-[13px] font-extrabold ${
                  count === n ? "border-[#4b9b2e] bg-[#eef7e8] text-[#2f6b1c]" : "border-black/10"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-[#6b6357]">
            On the free plan you can make 10 AI questions at a time — pick 10 or fewer if you see a limit message.
          </p>


          <div className="mt-4 text-[12px] font-black uppercase tracking-[0.14em] text-[#7a4b16]">Difficulty</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {[
              { k: "easy", l: "Easy" },
              { k: "mixed", l: "Mixed" },
              { k: "hard", l: "Hard" },
              { k: "exam", l: "Exam level" },
            ].map((d) => (
              <button
                key={d.k}
                onClick={() => setDifficulty(d.k as typeof difficulty)}
                className={`rounded-full border px-4 py-2 text-[13px] font-extrabold ${
                  difficulty === d.k ? "border-[#3f2c73] bg-[#f2edfb] text-[#3f2c73]" : "border-black/10"
                }`}
              >
                {d.l}
              </button>
            ))}
          </div>

          <label className="mt-4 flex items-center gap-2 text-[14px] font-bold">
            <input
              type="checkbox"
              checked={keyPoints}
              onChange={(e) => setKeyPoints(e.target.checked)}
              className="h-4 w-4 accent-[#3f2c73]"
            />
            Add a key-points sheet for this lecture
          </label>
        </section>

        {busy && (
          <div className="mt-5">
            <BuildProgress
              steps={QUIZ_STEPS}
              done={QUIZ_STEPS.filter((_, i) => i < step).map((s) => s.key)}
              current={QUIZ_STEPS[step]?.key ?? null}
              detail={reading}
              estimateSeconds={estimate}
              runId={runId}
            />
          </div>
        )}


        <button
          onClick={onGenerate}
          disabled={busy || locked}
          className="mt-6 w-full rounded-full bg-[#23201d] px-6 py-4 text-[15px] font-extrabold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {locked ? "Not available on your plan" : busy ? "Building your quiz…" : "Build my quiz"}
        </button>
      </main>

      <UpgradeWall block={gate.block} onClose={gate.closeBlock} />


      <PromptDialog
        open={subjectOpen}
        onOpenChange={setSubjectOpen}
        title="Add subject"
        description="A big area of your course, like Physiology."
        label="Subject name"
        placeholder="e.g. Physiology"
        confirmLabel="Add subject"
        onSubmit={onNewSubject}
      />

      <PromptDialog
        open={subtopicOpen}
        onOpenChange={setSubtopicOpen}
        title="Add sub-subject"
        description="Your lectures live inside a sub-subject."
        label="Sub-subject name"
        placeholder="e.g. Cardiac cycle"
        confirmLabel="Add sub-subject"
        onSubmit={onNewSubtopic}
      />
    </div>
  );
}
