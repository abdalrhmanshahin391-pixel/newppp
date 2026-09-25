import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Flag,
  Plus,
  RotateCcw,
  Timer,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { useAuth } from "@/hooks/useAuth";
import { ConfirmDialog, PromptDialog } from "@/components/study/SimpleDialogs";
import { lqAddSubject, lqAddSubtopic, lqBoard, lqRemove } from "@/lib/lecture-lab.functions";
import { PickerBoard, type PickerGroup } from "@/components/common/PickerBoard";
import { LaunchPanel, WorkspaceHeader } from "@/components/common/LaunchPanel";

export const Route = createFileRoute("/study/lectures/")({
  head: () => ({
    meta: [
      { title: "Lecture Lab — turn one lecture into a quick quiz" },
      {
        name: "description",
        content:
          "Drop today's lecture PDF into Lecture Lab and get multiple-choice questions with short explanations, a key-points sheet and study, session or timed exam mode.",
      },
      { property: "og:title", content: "Lecture Lab — RitaJet" },
      {
        property: "og:description",
        content: "One lecture in, a study-ready quiz out — with two-line explanations and a weak-spot retry.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LectureLabPage,
});

type Subject = { id: string; name: string };
type Subtopic = { id: string; subject_id: string; name: string };
type Lecture = {
  id: string;
  subtopic_id: string;
  title: string;
  source_name: string | null;
  difficulty: string;
  question_count: number;
  best_score: number | null;
  created_at: string;
};
type Stats = Record<string, { wrong: number; flagged: number }>;

const CREAM = "#fbf5e9";
const INK = "#23201d";
const ACCENT = "#4b9b2e";


function LectureLabPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const board = useServerFn(lqBoard);
  const addSubject = useServerFn(lqAddSubject);
  const addSubtopic = useServerFn(lqAddSubtopic);
  const remove = useServerFn(lqRemove);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subtopics, setSubtopics] = useState<Subtopic[]>([]);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [stats, setStats] = useState<Stats>({});
  const [busy, setBusy] = useState(true);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [pickedTopics, setPickedTopics] = useState<Set<string>>(new Set());
  const [pool, setPool] = useState<"all" | "flagged" | "wrong">("all");
  const [mode, setMode] = useState<"study" | "session" | "exam">("study");
  const [minutes, setMinutes] = useState(20);
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [subtopicFor, setSubtopicFor] = useState<Subject | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{
    kind: "subject" | "subtopic" | "lecture";
    id: string;
    label: string;
  } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r: any = await board({ data: undefined } as any);
      setSubjects(r.subjects ?? []);
      setSubtopics(r.subtopics ?? []);
      setLectures(r.lectures ?? []);
      setStats(r.stats ?? {});
      setOpen((prev) => {
        if (Object.keys(prev).length) return prev;
        const next: Record<string, boolean> = {};
        for (const s of r.subjects ?? []) next[s.id] = true;
        return next;
      });
    } catch {
      toast.error("Could not load your Lecture Lab.");
    } finally {
      setBusy(false);
    }
  }, [board]);

  useEffect(() => {
    if (!user) return;
    void refresh();
  }, [user, refresh]);

  const byTopic = useMemo(() => {
    const m: Record<string, Lecture[]> = {};
    for (const l of lectures) (m[l.subtopic_id] ??= []).push(l);
    return m;
  }, [lectures]);

  // One card per subject; its sub-subjects nest inside it, the way the
  // flashcards board works.
  const groups: PickerGroup[] = useMemo(() => {
    const out: PickerGroup[] = [];
    for (const s of subjects) {
      const mine = subtopics.filter((t) => t.subject_id === s.id);
      const sample = !!(s as any).is_example;
      out.push({
        id: s.id,
        name: s.name,
        color: ACCENT,
        sample,
        locked: sample,
        count: mine.reduce(
          (n, t) => n + (byTopic[t.id] ?? []).reduce((m, l) => m + l.question_count, 0),
          0,
        ),
        flags: mine.reduce(
          (n, t) => n + (byTopic[t.id] ?? []).reduce((m, l) => m + (stats[l.id]?.flagged ?? 0), 0),
          0,
        ),
        items: mine.map((t) => {
          const list = byTopic[t.id] ?? [];
          const qs = list.reduce((n, l) => n + l.question_count, 0);
          return {
            id: t.id,
            name: t.name,
            sample,
            count: qs,
            countLabel: list.length
              ? `${list.length} lecture${list.length === 1 ? "" : "s"} · ${qs} question${qs === 1 ? "" : "s"}`
              : "no lectures yet",
            note: list.length ? list.map((l) => l.title).join(" · ") : undefined,
            flags: list.reduce((n, l) => n + (stats[l.id]?.flagged ?? 0), 0),
          };
        }),
      });
    }
    return out;
  }, [subtopics, subjects, byTopic, stats]);

  // A tick picks a whole sub-subject; the round runs every lecture inside it.
  const selected = useMemo(() => {

    const ids = new Set<string>();
    for (const l of lectures) if (pickedTopics.has(l.subtopic_id) && l.question_count > 0) ids.add(l.id);
    return ids;
  }, [lectures, pickedTopics]);

  const selectedCount = selected.size;
  const totalQuestions = useMemo(
    () => lectures.filter((l) => selected.has(l.id)).reduce((n, l) => n + l.question_count, 0),
    [lectures, selected],
  );

  const toggle = (id: string) =>
    setPickedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });


  async function createSubject(name: string) {
    try {
      await addSubject({ data: { name } });
      toast.success("Subject added");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add the subject.");
    }
  }

  async function createSubtopic(subjectId: string, name: string) {
    try {
      await addSubtopic({ data: { subjectId, name } });
      setOpen((p) => ({ ...p, [subjectId]: true }));
      toast.success("Sub-subject added");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add the sub-subject.");
    }
  }


  async function doRemove(kind: "subject" | "subtopic" | "lecture", id: string) {
    try {
      await remove({ data: { kind, id } });
      setPickedTopics((p) => {
        const n = new Set(p);
        n.delete(id);
        return n;
      });

      void refresh();
    } catch {
      toast.error("Could not delete that.");
    }
  }

  function run(m: "study" | "session" | "exam") {
    if (!selectedCount) {
      toast.error("Tick at least one lecture first.");
      return;
    }
    setMode(m);
    void navigate({
      to: "/study/lectures/run",
      search: {
        ids: [...selected].join(","),
        mode: m,
        pool,
        minutes: m === "exam" ? minutes : 0,
      },
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: CREAM }}>
        <SiteHeader />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen" style={{ background: CREAM, color: INK }}>
        <SiteHeader />
        <main className="mx-auto max-w-xl px-4 py-24 text-center">
          <h1 className="font-display text-3xl font-black">Lecture Lab</h1>
          <p className="mt-3 text-[15px] text-[#4a453d]">Sign in to build quizzes from your lectures.</p>
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
      <main className="mx-auto max-w-6xl px-4 py-10 md:px-8 md:py-14">
        <Link to="/learn" className="inline-flex items-center gap-2 text-[13px] font-bold text-[#6b6357]">
          <ArrowLeft size={15} /> Back to study modes
        </Link>

        <div className="mt-4">
          <WorkspaceHeader
            eyebrow="Lecture Lab"
            title="One lecture in. A quiz out."
            description="Short questions with two-line explanations — the opposite of the archive bank. Takes about a minute."
            stats={[
              { label: "Subjects", value: subjects.length },
              { label: "Lectures", value: lectures.length },
              { label: "Selected", value: selectedCount },
            ]}
          />
        </div>

        <div className="mt-4 flex justify-end">
          <Link
            to="/study/lectures/new"
            className="inline-flex items-center gap-2 rounded-full bg-[#23201d] px-6 py-3 text-[14px] font-extrabold text-white transition hover:opacity-90"
          >
            <Upload size={16} /> New lecture quiz
          </Link>
        </div>

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
          <div>
            {!busy && !subjects.length ? (
              <div className="rounded-[26px] border border-black/[0.07] bg-white p-6">
                <p className="text-[14px] font-extrabold text-[#23201d]">Three steps to your first quiz</p>
                <ol className="mt-4 space-y-3">
                  {[
                    "Add a subject — the big area, like Physiology.",
                    "Add a sub-subject inside it — like Cardiac cycle.",
                    "Upload the lecture PDF and we write the questions.",
                  ].map((step, i) => (
                    <li key={step} className="flex items-start gap-3">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#23201d] text-[12px] font-black text-white">
                        {i + 1}
                      </span>
                      <span className="text-[13.5px] leading-relaxed text-[#4a453d]">{step}</span>
                    </li>
                  ))}
                </ol>
                <button
                  onClick={() => setSubjectOpen(true)}
                  className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#23201d] px-5 py-2.5 text-[13px] font-extrabold text-white hover:opacity-90"
                >
                  <Plus size={15} /> Start with a subject
                </button>
              </div>
            ) : (
              <PickerBoard
                accent={ACCENT}
                loading={busy}
                groups={groups}
                selected={[...pickedTopics]}
                onToggle={toggle}
                itemNoun="sub-subject"
                newItemLabel="Sub-subject"

                unitNoun="questions"
                searchPlaceholder="Search subjects and sub-subjects…"
                onNewGroup={() => setSubjectOpen(true)}
                onNewItem={(g) => {
                  const s = subjects.find((x) => x.id === g.id);
                  if (s) setSubtopicFor(s);
                }}
                onAddToGroup={() => void navigate({ to: "/study/lectures/new" })}
                addLabel="Add a lecture"
                emptyItemLabel="Add a sub-subject here"
                onDeleteGroup={(g) => setPendingDelete({ kind: "subject", id: g.id, label: g.name })}
                onDeleteItem={(t) => setPendingDelete({ kind: "subtopic", id: t.id, label: t.name })}
                emptyHint="No lectures yet — upload one to get started."

              />

            )}
          </div>

          <aside className="lg:sticky lg:top-24">
            <LaunchPanel
              accent={ACCENT}
              eyebrow="Start a round"
              stat={totalQuestions}
              statLabel={`question${totalQuestions === 1 ? "" : "s"} ready`}
              rows={[
                { label: "Lectures", value: selectedCount ? String(selectedCount) : "none picked" },
                { label: "Mode", value: mode === "exam" ? `Timed · ${minutes} min` : mode },
              ]}
              actions={[
                { label: "Study mode", icon: <BookOpen size={16} />, onClick: () => run("study"), disabled: !selectedCount, tone: "outline" },
                { label: "Session mode", icon: <RotateCcw size={16} />, onClick: () => run("session"), disabled: !selectedCount },
                { label: "Timed exam", icon: <Timer size={16} />, onClick: () => run("exam"), disabled: !selectedCount, tone: "dark" },
              ]}
              footnote={selectedCount ? undefined : "Tick at least one lecture on the left."}
            >
              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#a89e90]">
                Question pool
              </div>
              <div className="mt-2 flex gap-1.5 rounded-xl bg-[#faf6ee] p-1">
                {[
                  { key: "all", label: "All" },
                  { key: "wrong", label: "Weak spots" },
                  { key: "flagged", label: "Flagged" },
                ].map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setPool(p.key as typeof pool)}
                    className="h-8 flex-1 rounded-lg text-[12px] font-extrabold transition"
                    style={
                      pool === p.key
                        ? { background: "#fff", color: "#23201d" }
                        : { color: "#a29a8d" }
                    }
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <label className="mt-3 block text-[12px] font-extrabold text-[#6b645b]">
                Exam minutes
                <input
                  type="number"
                  min={1}
                  max={240}
                  value={minutes}
                  onChange={(e) => setMinutes(Math.max(1, Math.min(240, Number(e.target.value) || 1)))}
                  className="mt-1 h-10 w-full rounded-xl border border-black/10 bg-[#fbf8f2] px-3 text-[14px] font-semibold"
                />
              </label>
            </LaunchPanel>
          </aside>
        </div>
      </main>

      <PromptDialog
        open={subjectOpen}
        onOpenChange={setSubjectOpen}
        title="Add subject"
        description="A big area of your course, like Physiology."
        label="Subject name"
        placeholder="e.g. Physiology"
        confirmLabel="Add subject"
        onSubmit={(v) => void createSubject(v)}
      />

      <PromptDialog
        open={!!subtopicFor}
        onOpenChange={(v) => !v && setSubtopicFor(null)}
        title="Add sub-subject"
        description={subtopicFor ? `Inside ${subtopicFor.name}. Your lectures live here.` : undefined}
        label="Sub-subject name"
        placeholder="e.g. Cardiac cycle"
        confirmLabel="Add sub-subject"
        onSubmit={(v) => {
          if (subtopicFor) void createSubtopic(subtopicFor.id, v);
          setSubtopicFor(null);
        }}
      />

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(v) => !v && setPendingDelete(null)}
        title={`Delete ${pendingDelete?.kind ?? "item"}`}
        description={
          pendingDelete
            ? `Are you sure you want to delete \u201C${pendingDelete.label}\u201D? Everything inside goes with it.`
            : undefined
        }
        onConfirm={() => {
          if (pendingDelete) void doRemove(pendingDelete.kind, pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
