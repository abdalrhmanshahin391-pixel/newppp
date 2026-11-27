import { SignInRedirect } from "@/components/study/RequireSignIn";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BookOpen, Minus, Plus, RotateCcw, Timer, Upload, X } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { useAuth } from "@/hooks/useAuth";
import { ConfirmDialog, PromptDialog } from "@/components/study/SimpleDialogs";
import { lqAddSubject, lqAddSubtopic, lqBoard, lqRemove } from "@/lib/lecture-lab.functions";
import { PickerBoard, type PickerGroup } from "@/components/common/PickerBoard";
import { RitaCube } from "@/components/rita-study/RitaCube";
import "@/components/study/flashcards-page.css";
import "@/components/study/lecture-lab.css";

export const Route = createFileRoute("/study/lectures/")({
  head: () => ({
    meta: [
      { title: "Lecture Lab — turn one lecture into a quick quiz" },
      {
        name: "description",
        content:
          "Drop today's lecture PDF into Lecture Lab and get multiple-choice questions with short explanations, a key-points sheet and study, session or timed exam mode.",
      },
      { property: "og:title", content: "Lecture Lab — Uzyra" },
      {
        property: "og:description",
        content:
          "One lecture in, a study-ready quiz out — with two-line explanations and a weak-spot retry.",
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

const ACCENT = "#2b6df0";

const POOLS = [
  { key: "all", label: "All" },
  { key: "wrong", label: "Weak spots" },
  { key: "flagged", label: "Flagged" },
] as const;

const MODES = [
  {
    key: "study",
    label: "Study",
    icon: BookOpen,
    note: "Every question with its answer and explanation.",
  },
  {
    key: "session",
    label: "Session",
    icon: RotateCcw,
    note: "Answer each one, then see if you were right.",
  },
  {
    key: "exam",
    label: "Timed",
    icon: Timer,
    note: "Against the clock. Answers at the end.",
  },
] as const;

function LectureLabPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const levels = useRef({ input: 0, output: 0 });

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
    for (const l of lectures)
      if (pickedTopics.has(l.subtopic_id) && l.question_count > 0) ids.add(l.id);
    return ids;
  }, [lectures, pickedTopics]);

  const selectedCount = selected.size;
  // The ticked sub-subjects, in list order, for the pills under the Start button.
  const picked = useMemo(
    () => subtopics.filter((t) => pickedTopics.has(t.id)),
    [subtopics, pickedTopics],
  );
  const selectedStats = useMemo(() => {
    let wrong = 0;
    let flagged = 0;
    for (const id of selected) {
      wrong += stats[id]?.wrong ?? 0;
      flagged += stats[id]?.flagged ?? 0;
    }
    return { wrong, flagged };
  }, [selected, stats]);
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
      <div className="fc-page min-h-screen bg-white">
        <SiteHeader />
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

  // What the round would hold: every question, or only the missed or flagged ones.
  const ready =
    pool === "all"
      ? totalQuestions
      : pool === "wrong"
        ? selectedStats.wrong
        : selectedStats.flagged;
  const questionsWord = `question${ready === 1 ? "" : "s"}`;
  const readyText = ready.toLocaleString("en-US");
  const ModeIcon = MODES.find((m) => m.key === mode)!.icon;
  const goLabel =
    !selectedCount || !ready
      ? "Start"
      : mode === "exam"
        ? `Start exam · ${minutes} min`
        : mode === "session"
          ? `Start session · ${readyText} ${questionsWord}`
          : `Study · ${readyText} ${questionsWord}`;

  return (
    <div className="fc-page ll-page min-h-screen bg-white text-[var(--pp-ink)]">
      <SiteHeader />
      <div className="fc-wrap">
        <header className="fc-head">
          <p className="fc-kicker">
            <span className="fc-cube" aria-hidden="true">
              <RitaCube levelsRef={levels} mode="idle" label="" />
            </span>
            Lecture Lab
          </p>
          <h1 className="fc-title">One lecture in. A quiz out.</h1>
          <p className="fc-lead">
            Drop a lecture and get short questions with two-line explanations.
          </p>
        </header>

        <div className="fc-toolbar">
          <Link to="/study/lectures/new" className="ll-new">
            <Upload size={17} aria-hidden="true" /> New lecture quiz
          </Link>
          {!busy && subjects.length > 0 && (
            <p className="ll-count">
              {subjects.length} subject{subjects.length === 1 ? "" : "s"} · {lectures.length}{" "}
              lecture{lectures.length === 1 ? "" : "s"}
            </p>
          )}
        </div>

        <div className={`fc-grid${!busy && !subjects.length ? " ll-solo" : ""}`}>
          {/* No subjects yet: only the first steps, no round to start. */}
          {(busy || subjects.length > 0) && (
            <aside className="fc-side">
              <section className="fc-session" aria-label="Start a round">
                <p className="fc-eyebrow">Start a round</p>
                <p className="fc-stat">
                  <b>{readyText}</b> {questionsWord} ready
                </p>
                <dl className="fc-rows">
                  <div>
                    <dt>Lectures</dt>
                    <dd>{selectedCount || "None picked"}</dd>
                  </div>
                  <div>
                    <dt>Weak spots</dt>
                    <dd>{selectedStats.wrong.toLocaleString("en-US")}</dd>
                  </div>
                  <div>
                    <dt>Flagged</dt>
                    <dd>{selectedStats.flagged.toLocaleString("en-US")}</dd>
                  </div>
                </dl>

                <p className="ll-label" id="ll-pool">
                  Which questions
                </p>
                <div className="fc-scope ll-three" role="group" aria-labelledby="ll-pool">
                  {POOLS.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      aria-pressed={pool === p.key}
                      onClick={() => setPool(p.key)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <p className="ll-label" id="ll-mode">
                  How
                </p>
                <div className="fc-scope ll-three" role="group" aria-labelledby="ll-mode">
                  {MODES.map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      aria-pressed={mode === m.key}
                      onClick={() => setMode(m.key)}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                <p className="ll-mode-note">{MODES.find((m) => m.key === mode)!.note}</p>

                {mode === "exam" && (
                  <div className="ll-time">
                    <span id="ll-minutes">Exam time</span>
                    <div className="ll-stepper" role="group" aria-labelledby="ll-minutes">
                      <button
                        type="button"
                        aria-label="Five minutes less"
                        disabled={minutes <= 5}
                        onClick={() => setMinutes((m) => Math.max(5, m - 5))}
                      >
                        <Minus size={16} aria-hidden="true" />
                      </button>
                      <label>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={240}
                          value={minutes}
                          aria-label="Exam minutes"
                          onChange={(e) =>
                            setMinutes(Math.max(1, Math.min(240, Number(e.target.value) || 1)))
                          }
                        />
                        min
                      </label>
                      <button
                        type="button"
                        aria-label="Five minutes more"
                        disabled={minutes >= 240}
                        onClick={() => setMinutes((m) => Math.min(240, m + 5))}
                      >
                        <Plus size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  className="fc-go"
                  aria-disabled={!selectedCount || !ready || undefined}
                  onClick={() => {
                    if (selectedCount && !ready) {
                      toast.error(
                        pool === "wrong"
                          ? "No weak spots in these lectures yet."
                          : "Nothing flagged in these lectures yet.",
                      );
                      return;
                    }
                    run(mode);
                  }}
                >
                  <ModeIcon size={18} aria-hidden="true" />
                  {goLabel}
                </button>

                {picked.length > 0 && (
                  <div className="fc-picked">
                    <div className="fc-picked-list">
                      {picked.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => toggle(t.id)}
                          aria-label={`Untick ${t.name}`}
                        >
                          <span>{t.name}</span> <X size={12} aria-hidden="true" />
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="fc-clear"
                      onClick={() => setPickedTopics(new Set())}
                    >
                      Clear selection
                    </button>
                  </div>
                )}
                <p className="fc-note">
                  {picked.length === 0
                    ? "Tick a sub-subject on the list to use its lectures."
                    : !selectedCount
                      ? "The ticked sub-subjects have no questions yet."
                      : !ready
                        ? pool === "wrong"
                          ? "No weak spots in these lectures yet. Answer them once first."
                          : "Nothing flagged in these lectures yet."
                        : "Only the lectures you ticked."}
                </p>
              </section>
            </aside>
          )}

          <main className="fc-main">
            {!busy && !subjects.length ? (
              <div className="fc-empty">
                <span className="fc-empty-cube" aria-hidden="true">
                  <RitaCube levelsRef={levels} mode="idle" label="" />
                </span>
                <h2>No subjects yet</h2>
                <p>Three steps to your first quiz:</p>
                <ol className="ll-steps">
                  {[
                    "Add a subject, the big area, like Physiology.",
                    "Add a sub-subject inside it, like Cardiac cycle.",
                    "Upload the lecture PDF and the questions get written for you.",
                  ].map((step, i) => (
                    <li key={step}>
                      <span aria-hidden="true">{i + 1}</span>
                      {step}
                    </li>
                  ))}
                </ol>
                <button type="button" className="fc-go" onClick={() => setSubjectOpen(true)}>
                  <Plus size={18} aria-hidden="true" /> Make your first subject
                </button>
              </div>
            ) : (
              <PickerBoard
                framed={false}
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
                onDeleteGroup={(g) =>
                  setPendingDelete({ kind: "subject", id: g.id, label: g.name })
                }
                onDeleteItem={(t) =>
                  setPendingDelete({ kind: "subtopic", id: t.id, label: t.name })
                }
                emptyHint="No lectures yet — upload one to get started."
              />
            )}
          </main>
        </div>
      </div>

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
        description={
          subtopicFor ? `Inside ${subtopicFor.name}. Your lectures live here.` : undefined
        }
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
