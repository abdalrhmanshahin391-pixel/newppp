import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  FolderPlus,
  Layers,
  ListChecks,
  Loader2,
  Play,
  Printer,
  RotateCcw,
  ScrollText,
  Sparkles,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { useAuth } from "@/hooks/useAuth";
import { aioFileQuestions, aioLoad } from "@/lib/all-in-one.functions";
import { lqAddSubject, lqAddSubtopic, lqBoard } from "@/lib/lecture-lab.functions";
import { friendlyError } from "@/lib/pdf-text";
import { GuideDoc } from "@/components/study/GuideDoc";
import { SummaryView } from "@/components/summary/SummaryView";
import { StudyPlayer } from "@/components/study/StudyPlayer";
import { readBoard, writeBoard } from "@/lib/local-board";
import { readCards, writeCards, type FlashCardItem } from "@/lib/use-flashcards";

export const Route = createFileRoute("/study/all-in-one/$lectureId")({
  component: AllInOneWorkspace,
  head: () => ({
    meta: [
      { title: "Your lecture workspace | RitaJet" },
      {
        name: "description",
        content: "Study guide, summary, flashcards and questions from one lecture, side by side in one workspace.",
      },
      { property: "og:title", content: "Your lecture workspace" },
      { property: "og:description", content: "Everything from one lecture, in one place." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const ACCENT = "#3f2c73";
type Tab = "guide" | "summary" | "cards" | "questions";

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "guide", label: "Study guide", icon: <ScrollText size={16} /> },
  { key: "summary", label: "Summary", icon: <Sparkles size={16} /> },
  { key: "cards", label: "Flashcards", icon: <Layers size={16} /> },
  { key: "questions", label: "Questions", icon: <ListChecks size={16} /> },
];

/** Small cream dialog used by both "save" flows. */
function SaveSheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 print:hidden">
      <div className="w-full max-w-[460px] rounded-[24px] border border-black/[0.07] bg-[#fbf8f2] p-6">
        <h2 className="font-display text-[22px] font-black text-[#23201d]">{title}</h2>
        <div className="mt-4 grid gap-3">{children}</div>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 text-[13px] font-extrabold text-[#a29a8d] hover:text-[#23201d]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

const FIELD =
  "h-12 w-full rounded-xl border border-black/10 bg-white px-4 text-[14.5px] font-semibold text-[#23201d]";



function AllInOneWorkspace() {
  const { lectureId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const load = useServerFn(aioLoad);
  const board = useServerFn(lqBoard);
  const addSubject = useServerFn(lqAddSubject);
  const addSubtopic = useServerFn(lqAddSubtopic);
  const fileQuestions = useServerFn(aioFileQuestions);

  const [tab, setTab] = useState<Tab>("guide");
  const [busy, setBusy] = useState(true);
  const [data, setData] = useState<any>(null);

  const [flip, setFlip] = useState<Record<string, boolean>>({});


  // Play + save flashcards
  const [playing, setPlaying] = useState(false);
  const [saveCards, setSaveCards] = useState(false);
  const [cardSubject, setCardSubject] = useState("");
  const [newCardSubject, setNewCardSubject] = useState("");
  const [cardSub, setCardSub] = useState("");

  // Save questions into Lecture Lab
  const [saveQs, setSaveQs] = useState(false);
  const [lqData, setLqData] = useState<any>(null);
  const [qSubject, setQSubject] = useState("");
  const [newQSubject, setNewQSubject] = useState("");
  const [qSub, setQSub] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setBusy(true);
    load({ data: { lectureId } })
      .then((r: any) => setData(r))
      .catch((e) => toast.error(friendlyError(e)))
      .finally(() => setBusy(false));
  }, [user, lectureId, load]);


  const playCards: FlashCardItem[] = useMemo(
    () =>
      ((data?.cards ?? []) as any[]).map((c) => ({ id: c.id, front: c.front, back: c.back })),
    [data],
  );

  const boardSubjects = useMemo(() => readBoard(), [saveCards]);

  function openSaveCards() {
    setCardSubject(boardSubjects[0]?.name ?? "");
    setNewCardSubject("");
    setCardSub(data?.lecture?.title?.slice(0, 60) ?? "All in one");
    setSaveCards(true);
  }

  function doSaveCards() {
    const subjectName = (newCardSubject.trim() || cardSubject).trim();
    const subName = cardSub.trim();
    if (!subjectName || !subName) return toast.error("Pick a subject and name the sub-subject.");
    const list = readBoard();
    let subject = list.find((s) => s.name === subjectName);
    if (!subject) {
      subject = { name: subjectName, subs: [] };
      list.push(subject);
    }
    if (!subject.subs.some((s) => s.name === subName)) subject.subs.push({ name: subName });
    writeBoard(list);
    const existing = readCards(subjectName, subName);
    writeCards(subjectName, subName, [
      ...existing,
      ...playCards.map((c, i) => ({ id: `${Date.now().toString(36)}-${i}`, front: c.front, back: c.back })),
    ]);
    setSaveCards(false);
    toast.success(`Saved to ${subjectName} · ${subName}.`);
  }

  async function openSaveQs() {
    setSaveQs(true);
    setQSub(data?.lecture?.title?.slice(0, 60) ?? "All in one");
    setNewQSubject("");
    try {
      const r: any = await board({ data: undefined } as any);
      setLqData(r);
      const mine = (r.subjects ?? []).filter((s: any) => !s.is_example);
      setQSubject(mine[0]?.id ?? "");
    } catch (e) {
      toast.error(friendlyError(e));
    }
  }

  async function doSaveQs() {
    const subName = qSub.trim();
    if (!subName) return toast.error("Name the sub-subject.");
    setSaving(true);
    try {
      let subjectId = qSubject;
      if (newQSubject.trim()) {
        const made: any = await addSubject({ data: { name: newQSubject.trim() } });
        subjectId = made.id;
      }
      if (!subjectId) throw new Error("Pick a subject, or type a new one.");
      const made: any = await addSubtopic({ data: { subjectId, name: subName } });
      await fileQuestions({ data: { lectureId, subtopicId: made.id as string } });
      setSaveQs(false);
      toast.success("Saved to Lecture Lab.");
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setSaving(false);
    }
  }



  if (busy) {
    return (
      <div className="min-h-screen bg-[#fbf5e9]">
        <SiteHeader />
        <div className="grid place-items-center py-32 text-[#6b6357]">
          <Loader2 className="animate-spin" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#fbf5e9]">
        <SiteHeader />
        <div className="mx-auto max-w-[700px] px-4 py-24 text-center">
          <p className="text-[16px] font-bold">We could not open that lecture.</p>
          <Link to="/study/all-in-one" className="mt-4 inline-block rounded-full bg-[#23201d] px-5 py-3 text-[14px] font-extrabold text-white">
            Upload another one
          </Link>
        </div>
      </div>
    );
  }

  const points: string[] = data.lecture?.key_points ?? [];

  return (
    <div className="min-h-screen bg-[#fbf5e9] text-[#23201d]">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1080px] px-4 pb-24 pt-8">
        <Link
          to="/study/all-in-one"
          className="inline-flex items-center gap-2 text-[13px] font-extrabold text-[#6b6357] hover:text-[#23201d]"
        >
          <ArrowLeft size={15} /> New all-in-one lecture
        </Link>

        <header className="mt-4">
          <div
            className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em]"
            style={{ background: "#e7dcf7", color: ACCENT }}
          >
            All in one
          </div>
          <h1 className="mt-3 font-display text-[30px] font-black leading-tight sm:text-[38px]">{data.lecture.title}</h1>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              { l: "Flashcards", v: data.cards.length },
              { l: "Questions", v: data.questions.length },
              { l: "Key points", v: points.length },
            ].map((s) => (
              <span
                key={s.l}
                className="rounded-full border border-black/[0.08] bg-[#fbf8f2] px-3 py-1.5 text-[12px] font-extrabold text-[#6b6357]"
              >
                {s.v} {s.l.toLowerCase()}
              </span>
            ))}
          </div>
        </header>

        <div className="mt-6 grid gap-5 lg:grid-cols-[220px_1fr]">
          <nav className="flex gap-2 overflow-x-auto lg:sticky lg:top-24 lg:h-fit lg:flex-col lg:overflow-visible">
            {TABS.map((t) => {
              const on = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className="inline-flex shrink-0 items-center gap-2 rounded-2xl border px-4 py-3 text-left text-[14px] font-extrabold transition"
                  style={
                    on
                      ? { background: ACCENT, color: "#fff", borderColor: "transparent", boxShadow: `0 14px 30px -18px ${ACCENT}` }
                      : { background: "#fff", color: "#3d3833", borderColor: "rgba(0,0,0,0.08)" }
                  }
                >
                  {t.icon}
                  {t.label}
                </button>
              );
            })}
          </nav>

          <section
            className={
              tab === "guide" || tab === "summary"
                ? ""
                : "rounded-[26px] border border-black/[0.07] bg-white p-5 sm:p-7"
            }
          >
            {tab === "guide" &&
              (data.guide ? (
                <GuideDoc text={data.guide} />
              ) : (
                <p className="text-[15px] text-[#6b6357]">No study guide was written for this lecture.</p>
              ))}

            {tab === "summary" && (
              <div>
                {data.sheet ? (
                  <div>
                    <div className="flex flex-wrap items-center gap-2 print:hidden">
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="rita-btn rita-btn-primary gap-2"
                      >
                        <Printer size={16} /> Download PDF
                      </button>
                      <Link
                        to="/summaries/$summaryId"
                        params={{ summaryId: data.sheet.id }}
                        className="rita-btn rita-btn-secondary"
                      >
                        Open full summary
                      </Link>
                    </div>
                    <div className="mt-4 overflow-hidden rounded-[26px] bg-[#fbf5e9]">
                      <SummaryView
                        content={data.sheet.content}
                        siteName="Rita"
                        authorName={data.sheet.author_name ?? undefined}
                        createdAt={data.sheet.created_at}
                      />
                    </div>
                  </div>
                ) : data.short ? (
                  <GuideDoc text={data.short} />
                ) : (
                  <p className="text-[15px] text-[#6b6357]">No summary yet.</p>
                )}
                {points.length > 0 && (
                  <div className="mt-6 rounded-2xl bg-[#faf6ee] p-4 print:hidden">
                    <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#a89e90]">Key points</div>
                    <ul className="mt-2 space-y-1.5">
                      {points.map((p: string, i: number) => (
                        <li key={i} className="flex gap-2 text-[14.5px] leading-[1.6]">
                          <span className="mt-[8px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: ACCENT }} />
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {tab === "cards" &&
              (data.cards.length ? (
                <div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setPlaying(true)} className="rita-btn rita-btn-primary gap-2">
                      <Play size={16} /> Play these cards
                    </button>
                    <button type="button" onClick={openSaveCards} className="rita-btn rita-btn-secondary gap-2">
                      <FolderPlus size={16} /> Save to flashcards
                    </button>
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {data.cards.map((c: any) => {
                      const on = !!flip[c.id];
                      return (
                        <button
                          key={c.id}
                          onClick={() => setFlip((f) => ({ ...f, [c.id]: !f[c.id] }))}
                          className="min-h-[132px] rounded-2xl border border-black/[0.08] p-4 text-left transition hover:-translate-y-0.5"
                          style={{ background: on ? "#faf6ee" : "#fff" }}
                        >
                          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#a89e90]">
                            {on ? "Answer" : "Card"}
                          </div>
                          <div className="mt-2 text-[15px] font-bold leading-[1.5]">{on ? c.back : c.front}</div>
                          <div className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-extrabold text-[#a29a8d]">
                            <RotateCcw size={13} /> Tap to flip
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-[15px] text-[#6b6357]">No flashcards for this lecture.</p>
              ))}

            {tab === "questions" && (
              <div>
                <p className="text-[15px] text-[#6b6357]">
                  {data.questions.length} question{data.questions.length === 1 ? "" : "s"} are ready with full
                  explanations.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(["study", "session", "exam"] as const).map((m) => (
                    <button
                      key={m}
                      disabled={!data.questions.length}
                      onClick={() =>
                        void navigate({
                          to: "/study/lectures/run",
                          search: { ids: lectureId, mode: m, pool: "all", minutes: m === "exam" ? 20 : 0 },
                        })
                      }
                      className="rounded-full px-5 py-3 text-[14px] font-extrabold transition disabled:opacity-40"
                      style={
                        m === "exam"
                          ? { background: "#23201d", color: "#fff" }
                          : m === "session"
                            ? { background: ACCENT, color: "#fff" }
                            : { background: "#fff", color: "#23201d", border: "1px solid rgba(0,0,0,0.1)" }
                      }
                    >
                      {m === "study" ? "Study mode" : m === "session" ? "Session mode" : "Timed exam"}
                    </button>
                  ))}
                </div>
                <div className="mt-3">
                  <button
                    type="button"
                    disabled={!data.questions.length}
                    onClick={() => void openSaveQs()}
                    className="rita-btn rita-btn-secondary gap-2 disabled:opacity-40"
                  >
                    <FolderPlus size={16} /> Save to Lecture Lab
                  </button>
                </div>
                <div className="mt-6 space-y-3">
                  {data.questions.slice(0, 5).map((qq: any, i: number) => (
                    <div key={qq.id} className="rounded-2xl bg-[#faf6ee] p-4">
                      <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#a89e90]">
                        Preview {i + 1}
                      </div>
                      <div className="mt-1 text-[15px] font-bold leading-[1.5]">{qq.stem}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </section>
        </div>
      </main>

      <StudyPlayer
        open={playing}
        title={data.lecture.title}
        cards={playCards}
        onClose={() => setPlaying(false)}
      />

      <SaveSheet open={saveCards} title="Save these flashcards" onClose={() => setSaveCards(false)}>
        {boardSubjects.length > 0 && (
          <label className="grid gap-1.5">
            <span className="text-[12px] font-black uppercase tracking-[0.14em] text-[#a89e90]">Subject</span>
            <select value={cardSubject} onChange={(e) => setCardSubject(e.target.value)} className={FIELD}>
              {boardSubjects.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="grid gap-1.5">
          <span className="text-[12px] font-black uppercase tracking-[0.14em] text-[#a89e90]">
            {boardSubjects.length ? "…or a new subject" : "New subject"}
          </span>
          <input
            value={newCardSubject}
            onChange={(e) => setNewCardSubject(e.target.value)}
            placeholder="e.g. Physiology"
            className={FIELD}
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-[12px] font-black uppercase tracking-[0.14em] text-[#a89e90]">Sub-subject</span>
          <input value={cardSub} onChange={(e) => setCardSub(e.target.value)} className={FIELD} />
        </label>
        <button type="button" onClick={doSaveCards} className="rita-btn rita-btn-primary !w-full">
          Save {playCards.length} cards
        </button>
      </SaveSheet>

      <SaveSheet open={saveQs} title="Save these questions" onClose={() => setSaveQs(false)}>
        {!lqData ? (
          <div className="flex items-center gap-2 text-[14px] font-bold text-[#a29a8d]">
            <Loader2 size={15} className="animate-spin" /> Loading your subjects…
          </div>
        ) : (
          <>
            {(lqData.subjects ?? []).filter((s: any) => !s.is_example).length > 0 && (
              <label className="grid gap-1.5">
                <span className="text-[12px] font-black uppercase tracking-[0.14em] text-[#a89e90]">Subject</span>
                <select value={qSubject} onChange={(e) => setQSubject(e.target.value)} className={FIELD}>
                  {(lqData.subjects ?? [])
                    .filter((s: any) => !s.is_example)
                    .map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <label className="grid gap-1.5">
              <span className="text-[12px] font-black uppercase tracking-[0.14em] text-[#a89e90]">
                …or a new subject
              </span>
              <input
                value={newQSubject}
                onChange={(e) => setNewQSubject(e.target.value)}
                placeholder="e.g. Cardiology"
                className={FIELD}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-[12px] font-black uppercase tracking-[0.14em] text-[#a89e90]">Sub-subject</span>
              <input value={qSub} onChange={(e) => setQSub(e.target.value)} className={FIELD} />
            </label>
            <button
              type="button"
              disabled={saving}
              onClick={() => void doSaveQs()}
              className="rita-btn rita-btn-primary !w-full disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save to Lecture Lab"}
            </button>
          </>
        )}
      </SaveSheet>
    </div>
  );
}
