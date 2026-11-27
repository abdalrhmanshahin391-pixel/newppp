import { SignInRedirect } from "@/components/study/RequireSignIn";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, FileUp, LoaderCircle, Sparkles, Type } from "lucide-react";
import { RitaCube } from "@/components/rita-study/RitaCube";
import "@/components/study/flashcards-page.css";
import "@/components/study/lecture-lab.css";
import { SiteHeader } from "@/components/SiteHeader";
import { useAuth } from "@/hooks/useAuth";
import { usePlanGate } from "@/hooks/usePlanGate";
import { UpgradeWall } from "@/components/plan/UpgradeWall";
import { PromptDialog } from "@/components/study/SimpleDialogs";
import {
  lqAddSubject,
  lqAddSubtopic,
  lqBoard,
  lqEnsureDefault,
  lqGenerate,
} from "@/lib/lecture-lab.functions";
import { PdfScanError, extractPdfText, friendlyError, renderPdfPages } from "@/lib/pdf-text";
import {
  BuildProgress,
  estimateBuildSeconds,
  type BuildStep,
} from "@/components/study/BuildProgress";
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

const QUIZ_STEPS: BuildStep[] = [
  { key: "read", label: "Reading the lecture", weight: 1 },
  { key: "points", label: "Finding the teaching points", weight: 1.4 },
  { key: "questions", label: "Writing your questions", weight: 2.2 },
];

function NewLectureQuizPage() {
  const { user, loading } = useAuth();
  const gate = usePlanGate();
  const navigate = useNavigate();
  const levels = useRef({ input: 0, output: 0 });

  const board = useServerFn(lqBoard);
  const addSubject = useServerFn(lqAddSubject);
  const addSubtopic = useServerFn(lqAddSubtopic);
  const generate = useServerFn(lqGenerate);
  const ensureDefault = useServerFn(lqEnsureDefault);

  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [subtopics, setSubtopics] = useState<{ id: string; subject_id: string; name: string }[]>(
    [],
  );
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

  const kids = useMemo(
    () => subtopics.filter((t) => t.subject_id === subjectId),
    [subtopics, subjectId],
  );

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
  const featureOff =
    !gate.loading && !gate.usage?.is_admin && planRow?.feature_lecture_qgen === false;
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
          const r = await extractPdfText(file, (p) =>
            setReading(`Reading page ${p.page} of ${p.pages}…`),
          );
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
      <div className="fc-page min-h-screen bg-white">
        <SiteHeader />
        <UpgradeWall block={gate.block} onClose={gate.closeBlock} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="fc-page min-h-screen bg-white">
        <SiteHeader />
        <SignInRedirect />
      </div>
    );
  }

  return (
    <div className="fc-page ll-page min-h-screen bg-white text-[var(--pp-ink)]">
      <SiteHeader />
      <div className="fc-wrap ll-narrow">
        <header className="fc-head">
          <Link to="/study/lectures" className="fc-kicker ll-kicker-link">
            <ArrowLeft size={18} aria-hidden="true" className="rtl:rotate-180" />
            <span className="fc-cube" aria-hidden="true">
              <RitaCube levelsRef={levels} mode="idle" label="" />
            </span>
            Lecture Lab
          </Link>
          <h1 className="fc-title">New lecture quiz.</h1>
          <p className="fc-lead">
            Pick where it belongs, drop the lecture, choose the shape of the quiz.
          </p>
        </header>

        <section className="ll-step" aria-labelledby="ll-step-1">
          <h2 id="ll-step-1">
            <span aria-hidden="true">1</span> Where does it go?
          </h2>
          <p className="ll-step-lead">
            Open a subject and tick the sub-subject this lecture belongs to.
          </p>
          <div className="ll-step-body">
            <PickerBoard
              framed={false}
              accent="#121117"
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
              <button type="button" onClick={() => void quickStart()} className="ll-new">
                Set one up for me
              </button>
            )}
          </div>
        </section>

        <section className="ll-step" aria-labelledby="ll-step-2">
          <h2 id="ll-step-2">
            <span aria-hidden="true">2</span> The lecture
          </h2>
          <div className="ll-step-body">
            <div className="fc-scope ll-two" role="group" aria-label="Lecture source">
              <button
                type="button"
                aria-pressed={source === "pdf"}
                onClick={() => setSource("pdf")}
              >
                <FileUp size={16} aria-hidden="true" /> PDF
              </button>
              <button
                type="button"
                aria-pressed={source === "text"}
                onClick={() => setSource("text")}
              >
                <Type size={16} aria-hidden="true" /> Paste text
              </button>
            </div>
            {locked ? (
              <div className="ll-locked" role="status">
                <p className="ll-locked-title">Uploading is off for now</p>
                <p>{lockReason}</p>
                <Link to="/pricing" className="ll-new">
                  See plans
                </Link>
              </div>
            ) : source === "pdf" ? (
              <label className={`ll-drop${file ? " has-file" : ""}`}>
                <span className="ll-drop-icon" aria-hidden="true">
                  <FileUp size={22} />
                </span>
                <span className="ll-drop-title">
                  {file ? file.name : "Choose your lecture PDF"}
                </span>
                <span className="ll-drop-hint">
                  {file
                    ? "Tap to choose another file."
                    : "Up to 25 MB. Scans are fine too — the pages get read as pictures."}
                </span>
                <input
                  type="file"
                  accept="application/pdf"
                  className="ll-sr"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    e.target.value = "";
                    if (!f) return;
                    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
                      toast.error("Choose a PDF file.");
                      return;
                    }
                    if (f.size > 25 * 1024 * 1024) {
                      toast.error(
                        "That PDF is over 25 MB. Split it into smaller files and try again.",
                      );
                      return;
                    }
                    if (!gate.check({ feature: "feature_lecture_qgen", kind: "ai_questions" }))
                      return;
                    setFile(f);
                  }}
                />
              </label>
            ) : (
              <textarea
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                rows={8}
                aria-label="Lecture text"
                placeholder="Paste the lecture text here…"
                className="ll-input ll-area"
              />
            )}
            <label className="ll-field">
              <span>Lecture title</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={file?.name?.replace(/\.pdf$/i, "") || "e.g. Heart failure — week 4"}
                className="ll-input"
              />
            </label>
          </div>
        </section>

        <section className="ll-step" aria-labelledby="ll-step-3">
          <h2 id="ll-step-3">
            <span aria-hidden="true">3</span> Shape of the quiz
          </h2>
          <div className="ll-step-body">
            <p className="ll-label" id="ll-count">
              Questions
            </p>
            <div className="ll-pills" role="group" aria-labelledby="ll-count">
              {[5, 10, 15, 20, 30].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={count === n}
                  onClick={() => setCount(n)}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="ll-hint">
              On the free plan you can make 10 AI questions at a time — pick 10 or fewer if you see
              a limit message.
            </p>
            <p className="ll-label" id="ll-level">
              Difficulty
            </p>
            <div className="ll-pills" role="group" aria-labelledby="ll-level">
              {[
                { k: "easy", l: "Easy" },
                { k: "mixed", l: "Mixed" },
                { k: "hard", l: "Hard" },
                { k: "exam", l: "Exam level" },
              ].map((d) => (
                <button
                  key={d.k}
                  type="button"
                  aria-pressed={difficulty === d.k}
                  onClick={() => setDifficulty(d.k as typeof difficulty)}
                >
                  {d.l}
                </button>
              ))}
            </div>
            <label className="ll-check">
              <input
                type="checkbox"
                checked={keyPoints}
                onChange={(e) => setKeyPoints(e.target.checked)}
              />
              Add a key-points sheet for this lecture
            </label>
          </div>
        </section>

        {busy && (
          <div className="ll-building">
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
          type="button"
          onClick={onGenerate}
          disabled={busy || locked}
          className="fc-go ll-make"
        >
          {busy ? (
            <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles size={18} aria-hidden="true" />
          )}
          {locked ? "Not available on your plan" : busy ? "Building your quiz…" : "Make the quiz"}
        </button>
      </div>

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
